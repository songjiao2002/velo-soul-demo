// Each ID belongs to one spoken reply. The synthesis stream stays in this
// process only until the rider requests it, or the short claim window expires.
const uuidV4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const validFirstSpeechId=id=>typeof id==='string'&&id.length===36&&uuidV4.test(id);

export class FirstSpeechStreams {
  constructor(synthesize,{ttlMs=4000,deliveryMs=30000,maxEntries=8,setTimer=setTimeout,clearTimer=clearTimeout,timeoutError=()=>new DOMException('timeout','TimeoutError')}={}){
    this.synthesize=synthesize;
    this.entries=new Map();
    Object.assign(this,{ttlMs,deliveryMs,maxEntries,setTimer,clearTimer,timeoutError});
  }

  start(id,input,chatSignal){
    if(!validFirstSpeechId(id)||chatSignal.aborted||this.entries.has(id)||this.entries.size>=this.maxEntries)return;
    // Backpressure reaches the provider once 48 KiB of base64 is buffered.
    // The relay also caps any single upstream response at 4 MB of PCM.
    const stream=new TransformStream(undefined,undefined,{highWaterMark:48*1024,size:frame=>frame.audio?.length||1});
    const writer=stream.writable.getWriter();
    const controller=new AbortController();
    const entry={input,readable:stream.readable,controller,claimed:false};
    this.entries.set(id,entry);
    const expire=()=>{
      if(this.entries.get(id)===entry)this.entries.delete(id);
      this.clearTimer(entry.timer);
      chatSignal.removeEventListener('abort',cancel);
    };
    const cancel=()=>{
      controller.abort();
      if(!entry.claimed){
        expire();
        stream.readable.cancel().catch(()=>{});
      }
    };
    entry.timer=this.setTimer(cancel,this.ttlMs);
    entry.timer?.unref?.();
    chatSignal.addEventListener('abort',cancel,{once:true});
    entry.finish=()=>{
      // Retain a short claim receipt, so simultaneous retries cannot synthesize twice.
      chatSignal.removeEventListener('abort',cancel);
      delete entry.readable;
      delete entry.controller;
      delete entry.finish;
      entry.timer=this.setTimer(()=>this.entries.delete(id),this.ttlMs);
      entry.timer?.unref?.();
    };
    writer.closed.catch(()=>{});
    this.synthesize(input,{signal:controller.signal,emit:frame=>writer.write(frame)})
      .then(()=>writer.close(),error=>writer.abort(error)).catch(()=>{});
    return cancel;
  }

  async deliver(id,input,{signal,emit}){
    const entry=this.entries.get(id);
    if(!entry||entry.input.soul!==input.soul||entry.input.language!==input.language||entry.input.text!==input.text)return 'missing';
    if(entry.claimed)return 'used';
    entry.claimed=true;
    this.clearTimer(entry.timer);
    const controller=entry.controller;
    const reader=entry.readable.getReader();
    const stopReader=()=>{reader.cancel(controller.signal.reason).catch(()=>{});};
    const abort=()=>controller.abort(signal.reason);
    controller.signal.addEventListener('abort',stopReader,{once:true});
    if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
    // This deadline also covers a connected client which stops reading.
    const deadline=this.setTimer(()=>controller.abort(this.timeoutError()),this.deliveryMs);
    deadline?.unref?.();
    try{
      for(;;){
        const frame=await reader.read();
        controller.signal.throwIfAborted();
        if(frame.done)break;
        await emit(frame.value,controller.signal);
      }
      return 'delivered';
    }catch(error){
      controller.signal.throwIfAborted();
      throw error;
    }finally{
      this.clearTimer(deadline);
      signal.removeEventListener('abort',abort);
      controller.abort();
      controller.signal.removeEventListener('abort',stopReader);
      reader.releaseLock();
      entry.finish();
    }
  }
}
