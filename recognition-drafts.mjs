import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {confirmedWords} from './public/turn-text.mjs';
import {needsCamera,replyLanguage} from './public/input-language.mjs';
import {rideIntent} from './public/ride-quick-replies.mjs';

function eligible(text,final) {
  if(typeof text!=='string'||text.length>512||needsCamera(text)||rideIntent(text))return false;
  if(!/[\p{L}\p{N}]/u.test(text)||/(?:\.{2,}|[…,:;，、：；—-])\s*$/u.test(text))return false;
  if(/^(?:thank you|thanks|stop listening|stop voice conversation|repeat that|say that again|谢谢你?|停止.*对话|停止聆听|再说一次|重复一遍|감사합니다|고마워요?|대화\s*멈춰|다시\s*말해)[.!?。！？\s]*$/iu.test(text))return false;
  const longEnough=(text.match(/\p{Script=Han}/gu)||[]).length>=4||(text.match(/\p{Script=Hangul}/gu)||[]).length>=5||(text.match(/\p{L}+/gu)||[]).length>=4;
  return longEnough&&(final||/[.!?。！？]["'”’」』)]*$/u.test(text)||/(?:습니다|니까|어요|아요|했어|웠어|네요|뿌듯해|할게|해요)$/u.test(text.trim()));
}

// Each random ticket names one in-flight answer for one recognition socket.
// Only the originating turn, with its exact prior conversation, can claim it.
// An unclaimed stream backpressures the producer and expires within seconds.
export function createRecognitionDrafts(generate,canPrepare=()=>true) {
  const waiting=new Map();
  function session(inputLanguage){
    let setup,current,lastUnticketedWords,attempts=0,finalized=false;
    function cancel(){
      if(!current)return;
      current.abort();
      current=null;
    }
    return {
      configure(request){
        if(setup||!request||!['lumi','mori','bori'].includes(request.soul)||!Array.isArray(request.history)||request.history.length%2||
           request.history.some((m,i)=>m?.role!==(i%2?'assistant':'user')||typeof m.content!=='string'||!m.content.trim()))return;
        setup={soul:request.soul,history:request.history,context:request.context};
      },
      transcript(text,final,allowNewDraft=true){
        if(!setup||finalized)return;
        if(final)finalized=true;
        const words=confirmedWords(text);
        const deferUntilClaim=final&&words===lastUnticketedWords;
        if(!final)lastUnticketedWords=undefined;
        if(current?.words===words&&!current.signal.aborted)return current.id;
        cancel();
        if((!final&&(!allowNewDraft||attempts>=2))||!eligible(text,final)||waiting.size>=24||!canPrepare()){
          if(!final)lastUnticketedWords=words;
          return;
        }
        const id=randomUUID(),language=replyLanguage(text,inputLanguage);
        const payload={soul:setup.soul,language,context:setup.context,voice:true,inlineFirstSpeech:true,voiceTurnId:id,firstSpeechId:id,
          messages:[...setup.history,{role:'user',content:text}]};
        const controller=new AbortController();
        const channel=new TransformStream(undefined,undefined,{highWaterMark:512*1024,size:f=>f.audio?.length||f.text?.length||f.reply?.length||32});
        const writer=channel.writable.getWriter();
        const timer=setTimeout(abort,5000);timer.unref();
        function abort(){
          clearTimeout(timer);waiting.delete(id);controller.abort();
          writer.abort(controller.signal.reason).catch(()=>{});
        }
        function start(){
          generate(payload,controller.signal,f=>writer.write(f)).then(()=>writer.close(),err=>writer.abort(err)).catch(()=>{});
        }
        // An unticketed preview can already be generating over normal HTTP.
        // A client reusing that request will never claim the matching final.
        const entry={id,words,payload,signal:controller.signal,abort,startOnClaim:deferUntilClaim?start:undefined,async deliver(emit,signal){
          clearTimeout(timer);
          const reader=channel.readable.getReader();
          const end=()=>{abort();reader.cancel().catch(()=>{});};
          signal.addEventListener('abort',end,{once:true});
          let complete=false;
          try{
            signal.throwIfAborted();controller.signal.throwIfAborted();
            for(;;){const {value,done}=await reader.read();if(done)break;await emit(value);}
            complete=true;
          }finally{signal.removeEventListener('abort',end);if(!complete)end();reader.releaseLock();}
        }};
        waiting.set(id,entry);current=entry;attempts++;
        if(!deferUntilClaim)start();
        return id;
      },
      close(){if(!finalized)cancel();setup=null;}
    };
  }
  function take(p){
    const entry=waiting.get(p.recognitionDraft);
    if(!entry||entry.signal.aborted||p.voiceTurnId!==entry.id||p.firstSpeechId!==entry.id||p.inlineFirstSpeech!==true||p.image||p.event)return;
    const expected=entry.payload;
    if(p.soul!==expected.soul||p.language!==expected.language||!Array.isArray(p.messages)||p.messages.at(-1)?.role!=='user'||
       typeof p.messages.at(-1)?.content!=='string'||confirmedWords(p.messages.at(-1).content)!==entry.words||
       !isDeepStrictEqual(p.messages.slice(0,-1),expected.messages.slice(0,-1))||!isDeepStrictEqual(p.context,expected.context))return;
    waiting.delete(entry.id);
    entry.startOnClaim?.();
    return entry;
  }
  return {session,take};
}
