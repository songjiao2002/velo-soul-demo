import {createVoiceSentenceReader} from './public/chat-stream.mjs';
import {getFastOpeningSource} from './public/fast-openings.mjs';

// Unrecorded fillers should share a voice request with the words they introduce.
// Treat only a word we actually received as a filler, never create one.
const interjection=/^(?:hm+|m{2,}|uh|um+|huh|oh|ah|hey|ok(?:ay)?|sure|well|yeah|yes|yep|nope|음+|응+|어|아|네|그래|맞아|좋아|글쎄|그렇지|아하|嗯+|唔+|哦+|噢|啊|哎|哇|好|好呀|好啊|行|行呀|对|对呀)$/iu;
const opening=/^(\s*)([\p{L}]+)([\s,，、;；:：…~～—]*)([\s\S]*)$/u;
// Conversational lead-ins that can span several model tokens. Limit this
// list to acknowledgments; e.g. "slow down" is already a useful answer.
const compoundOpenings={
  en:['sure thing','of course','all right','no problem','for sure','you bet','fair enough'],
  ko:['아 그럼','그럼 물론이지','그럼 당연하지','그렇긴 하지','물론이지','물론이죠'],
  zh:['没问题','没问题呀','当然可以','当然啦','那当然','好嘞','那好吧']
};
const compounds=Object.fromEntries(Object.entries(compoundOpenings).map(([lang,forms])=>{
  const words=forms.map(form=>form.replaceAll(' ','\\s+')).join('|');
  return [lang,{forms,match:new RegExp('^(\\s*)('+words+')(?=$|[\\s,，、;；:：…~～—.!?。！？])([\\s,，、;；:：…~～—]*)([\\s\\S]*)$','iu')}];
}));
function firstSelected(soul,text){
  let first;
  createVoiceSentenceReader(soul,phrase=>{first??=phrase;})(text);
  return first;
}

const surpriseWords={
  zh:['真的啊','真的呀','真的嘛','真的吗','真的假的','是吗','是嘛'],
  ko:['정말이야','정말이에요','정말로요','정말요','진짜예요','진짜야','진짜요','정말','진짜'],
  en:['oh really','is that so','for real','really']
};
const divider=/^\s*[，,。.!！？?—–…~～][\s，,。.!！？?—–…~～]*/u;

// A shipped player can split "真的啊" before the next token supplies the
// comma. Hold only this small family of possible prefixes. If the rider asked
// a question, the reaction may itself answer it. Preserve it in that case.
export function createSpokenLead(payload,emit){
  const line=payload.messages?.at(-1)?.content?.trim()||'';
  const words=validFirstSpeechId(payload.voiceTurnId)&&!/[?？][”’"']*$/u.test(line)?surpriseWords[payload.language]:null;
  let pending='',removed='',decided=!Array.isArray(words);
  function release(text){decided=true;pending='';if(text)return emit(text);}
  return {
    push(delta){
      if(decided)return emit(delta);
      pending+=delta;
      const current=pending.trimStart().toLowerCase();
      if(!current||words.some(word=>word.startsWith(current.trimEnd())))return pending.length<96?undefined:release(pending);
      for(const word of words){
        if(!current.startsWith(word))continue;
        const rest=current.slice(word.length),separator=divider.exec(rest);
        if(!separator)continue;
        const next=rest.slice(separator[0].length);
        if(!next&&pending.length<96)return;
        if(/^[\p{L}\p{N}]/u.test(next)){
          const end=pending.length-pending.trimStart().length+word.length+separator[0].length;
          removed=pending.slice(0,end).trimStart();
          return release(pending.slice(end));
        }
      }
      return release(pending);
    },
    finish(){if(!decided)return release(pending);},
    reply(original){return removed&&original.startsWith(removed)?original.slice(removed.length):original;}
  };
}

export function createVoiceOpeningStream({soul,language,voiceTurnId},emit,{signal,waitMs=320,maxChars=128,setTimer=setTimeout,clearTimer=clearTimeout}={}){
  const compound=Object.hasOwn(compounds,language)?compounds[language]:undefined;
  let text='',sent=0,plain=false,holding=false,standaloneDot=false,timer,queued=Promise.resolve(),openingLength=0;
  function write(delta){
    if(delta)queued=queued.then(()=>{signal?.throwIfAborted();return emit(delta);});
    // A timer may flush while the provider is idle. Its error is propagated
    // through the next push or finish, without an unhandled rejection.
    queued.catch(()=>{});
    return queued;
  }
  function flush(suffix=''){
    plain=true;
    clearTimer(timer);
    const rest=text.slice(sent)+suffix;
    text='';
    return write(rest);
  }
  function stop(){
    plain=true;text='';clearTimer(timer);
    signal?.removeEventListener('abort',stop);
  }
  signal?.addEventListener('abort',stop,{once:true});
  function hold(prefix){
    if(timer===undefined){
      timer=setTimer(()=>flush(),waitMs);
      timer?.unref?.();
    }
    const delta=text.slice(sent,prefix);
    sent=Math.max(prefix,sent);
    return write(delta);
  }
  // Reveal as much of a compound opener as possible without letting an
  // existing player speak just "Sure" at the first space in "Sure thing".
  function safeCompoundEnd(end){
    if(!firstSelected(soul,text.slice(0,end)))return end;
    let safe=sent;
    while(safe<end&&!firstSelected(soul,text.slice(0,safe+1)))safe++;
    return safe;
  }
  function showCompoundPrefix(){
    const safe=safeCompoundEnd(text.length);
    if(safe<text.length)return hold(safe);
    const delta=text.slice(sent);sent=text.length;return write(delta);
  }
  function hasWholeSentence(value){
    const first=firstSelected(soul,value);
    return first&&/[。！？!?.]$/u.test(first)&&/[\p{L}\p{N}]/u.test(first.slice(openingLength));
  }
  return {
    push(delta){
      if(plain)return write(delta);
      text+=delta;
      if(text.length>maxChars)return flush();
      if(holding)return hasWholeSentence(text)?flush():queued;
      const multi=compound?.match.exec(text);
      if(!multi&&compound){
        const partial=text.trimStart().toLowerCase().replace(/\s+/gu,' ');
        if(partial&&compound.forms.some(form=>form.startsWith(partial)))return showCompoundPrefix();
      }
      const match=multi||opening.exec(text);
      if(!match){
        if(text.trim())return flush();
        const delta=text.slice(sent);sent=text.length;return write(delta);
      }
      const [,space,word,boundary,rest]=match,endWord=space.length+word.length;
      standaloneDot=false;
      if(multi&&!boundary&&rest==='.'&&firstSelected(soul,text)&&firstSelected(soul,text+' ')===word+'.'){
        standaloneDot=true;
        return hold(safeCompoundEnd(endWord));
      }
      if(multi&&!boundary.trim()&&!rest)return showCompoundPrefix();
      if(!boundary&&!rest){
        // A Chinese particle can itself trigger a cut without punctuation.
        // Expose its first character immediately and wait briefly for context.
        if(interjection.test(word)&&firstSelected(soul,text))return hold(space.length+1);
        const delta=text.slice(sent);sent=text.length;return write(delta);
      }
      const bareOpener=!multi&&soul==='mori'&&/^[a-z]/iu.test(word);
      if((!multi&&!interjection.test(word))||!boundary||(!boundary.trim()&&!bareOpener))return flush();
      const phrase=firstSelected(soul,text.slice(0,endWord+boundary.length));
      if(!phrase||(!validFirstSpeechId(voiceTurnId)&&getFastOpeningSource(phrase,{soul,language})))return flush();
      holding=true;openingLength=phrase.length;
      if(hasWholeSentence(text))return flush();
      // Never publish the comma on its own, even when a provider delta starts
      // with the entire greeting plus comma. The existing APK would speak it.
      const safe=multi?safeCompoundEnd(endWord):(firstSelected(soul,text.slice(0,endWord))?space.length+1:endWord);
      return hold(safe);
    },
    finish(success=true){
      // The deployed reader needs whitespace lookahead to recognize a final
      // English period. Only add layout whitespace if it unlocks a real full
      // sentence; the authoritative complete frame keeps the exact source text.
      const needLookahead=standaloneDot||holding&&text.endsWith('.')&&hasWholeSentence(text+' ');
      const lookahead=success&&needLookahead?' ':'';
      return plain?queued:flush(lookahead);
    },
    stop
  };
}

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

  start(id,input,chatSignal,tone){
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
    this.synthesize(input,{signal:controller.signal,tone,firstReply:true,emit:frame=>writer.write(frame)})
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
