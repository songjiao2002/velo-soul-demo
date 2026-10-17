// Dynamic replies use real audio, independent of installed speechSynthesis voices.
export function speechChunks(text,limit=540){
 const chars=Array.from(text.replace(/[\p{Extended_Pictographic}\uFE0F]/gu,'').trim()),parts=[];
 while(chars.length){let n=Math.min(limit,chars.length);if(n<chars.length){const part=chars.slice(0,n).join(''),boundary=Math.max(part.lastIndexOf('. '),part.lastIndexOf('? '),part.lastIndexOf('! '),part.lastIndexOf('。'),part.lastIndexOf(' '));if(boundary>limit/2)n=Array.from(part.slice(0,boundary+1)).length;}const part=chars.splice(0,n).join('').trim();if(part)parts.push(part);}
 return parts;
}
export class CloudSpeechPlayer {
 constructor({Context=globalThis.AudioContext||globalThis.webkitAudioContext,fetchImpl=(...args)=>globalThis.fetch(...args),setTimer=(...args)=>globalThis.setTimeout(...args),clearTimer=(...args)=>globalThis.clearTimeout(...args)}={}){Object.assign(this,{Context,fetchImpl,setTimer,clearTimer});this.serial=0;this.cache=new Map();}
 prepare(){
  try{
   if(!this.Context)return Promise.resolve(false);
   if(!this.context||this.context.state==='closed')this.context=new this.Context();
   const context=this.context;
   // Unlock the actual playback graph during the initial user gesture.
   const pulse=context.createBufferSource();pulse.buffer=context.createBuffer(1,1,context.sampleRate);pulse.connect(context.destination);pulse.start();pulse.onended=()=>pulse.disconnect();
   return Promise.resolve(context.resume()).then(()=>context.state==='running',()=>false);
  }catch{return Promise.resolve(false);}
 }
 stop(){this.serial++;this.controller?.abort();this.controller=null;this.clearTimer(this.timer);this.clearTimer(this.playTimer);if(this.source){this.source.onended=null;try{this.source.stop();this.source.disconnect();}catch{}this.source=null;}this.finishPlayback?.();this.finishPlayback=null;}
 async speak(text,{language='en',soul='lumi',onState=()=>{}}={}){
  this.stop();const serial=this.serial,valid=()=>serial===this.serial,report=state=>{if(valid())onState(state);};
  const parts=speechChunks(text);if(!parts.length){report('ended');return;}
  report('loading');
  if(!this.context){report('blocked');return;}
  if(this.context.state!=='running'){
   let resumeTimer;
   try{await Promise.race([this.context.resume(),new Promise(resolve=>{resumeTimer=this.setTimer(resolve,1500);})]);}catch{}finally{this.clearTimer(resumeTimer);}
   if(!valid())return;
   if(this.context.state!=='running'){report('blocked');return;}
  }
  const context=this.context,controller=new AbortController();this.controller=controller;let fetchTimer;
  try{
   for(const part of parts){
    if(!valid())return;
    const key=JSON.stringify([part,language,soul]);let buffer=this.cache.get(key);
    if(!buffer){
     fetchTimer=this.timer=this.setTimer(()=>controller.abort(),35000);
     const response=await this.fetchImpl('/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({text:part,language,soul})});
     if(!response.ok)throw new Error('speech_unavailable');
     const bytes=await response.arrayBuffer();if(!valid())return;
     if(bytes.byteLength>4000000)throw new Error('invalid_audio');
     buffer=await context.decodeAudioData(bytes);this.clearTimer(fetchTimer);
     if(!valid())return;
     this.cache.set(key,buffer);while(this.cache.size>4)this.cache.delete(this.cache.keys().next().value);
    }
    if(context.state!=='running'){report('blocked');return;}
    await new Promise((resolve,reject)=>{
     const source=context.createBufferSource();this.source=source;source.buffer=buffer;
     source.playbackRate.value=soul==='mori'?.94:soul==='bori'?1.04:1;source.connect(context.destination);
     let playTimer;
     const finish=()=>{this.clearTimer(playTimer);source.onended=null;source.disconnect();if(this.source===source)this.source=null;if(this.finishPlayback===finish)this.finishPlayback=null;resolve();};
     this.finishPlayback=finish;source.onended=finish;
     playTimer=this.playTimer=this.setTimer(()=>{source.onended=null;reject(new Error('playback_timeout'));try{source.stop();}catch{}finish();},Math.ceil(buffer.duration/source.playbackRate.value*1000)+5000);
     try{source.start();report('playing');}catch(error){this.clearTimer(this.playTimer);reject(error);}
    });
   }
   report('ended');
  }catch(error){if(valid())report(this.context?.state!=='running'?'blocked':'unavailable');}
  finally{this.clearTimer(fetchTimer);if(this.timer===fetchTimer)this.timer=null;if(this.controller===controller)this.controller=null;}
 }
 dispose(){this.stop();this.cache.clear();const context=this.context;this.context=null;if(context)context.close().catch(()=>{});}
}
