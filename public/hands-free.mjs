import {VOICE_PRIVACY} from './voice-privacy.mjs';
import {readVoiceReply} from './chat-stream.mjs';
import {newVoiceTurnId,serverVoiceTurnId} from './speech-cache.mjs';
import {appFetch} from './app-network.mjs';
import {replyLanguage,needsCamera} from './input-language.mjs';
import {contextualRideQuickReply} from './ride-quick-replies.mjs';
import {COMMUNICATION_LIMIT_COPY,conversationServiceError,isConversationLimit,MAX_MESSAGE_LENGTH,conversationMessages} from './conversation-limits.mjs';

const endConversation=/^(stop listening|stop (the )?(voice )?conversation|停止(语音)?对话|停止聆听|대화\s*멈춰|음성\s*대화\s*(종료|그만))[.!?。！\s]*$/i;
const temporaryLimits=new Set(['service_busy','minute_limit','provider_rate_limited','rate_limited']);
const hardLimits=new Set(['daily_limit','provider_quota']);
const repeatRequest=/^(repeat that|say that again|再说一次|重复一遍|다시\s*말해)[.!?。！\s]*$/i;
// Final ASR commonly restores casing, spacing and a closing period. Keep
// question marks, negation, numbers and interior punctuation significant.
function confirmedWords(text){
 const words=text.normalize('NFC').trim().toLowerCase().replace(/\s+/gu,' ').replace(/[.。]$/u,'');
 // A recognizer may add just the question mark to an explicit question.
 if(/^(?:what|why|when|where|how|which|who|should we|can we|could you)\b/iu.test(words)||
    /(?:吗|么|나요|까요)[?？]?$/u.test(words))return words.replace(/[?？]$/u,'');
 return words;
}
function retryDelay(reason,retryAfter){
 const seconds=Number(retryAfter);
 return Number.isFinite(seconds)&&seconds>0?Math.ceil(seconds*1000):reason==='service_busy'?1000:60000;
}
function interruption(text){
 const command=text.match(/^(?:(?:hey\s+)?(?:lumi|lulu|mori|bori|popo)[,\s]+)?(stop\b(?:\s+(?:talking|speaking))?|wait\b(?:\s+a\s+(?:second|moment))?|等一下|等一等|停一下|暂停|잠깐만(?:요)?|잠깐|그만)([\s,，.。!！?？:：]*)(.*)$/i);
 if(!command)return text;
 const [,prefix,separator,remainder]=command;
 // “Stop at the café” and “wait for me” are complete requests.
 if(remainder&&/^(stop|wait)$/i.test(prefix)&&!separator.trim()&&!/^(?:I|we|you|can|could|do|does|did|is|are|how|what|where|when|why|who|let|please)\b/i.test(remainder))return text;
 if(remainder&&/[가-힣]/u.test(prefix)&&!separator)return text;
 return remainder.trim();
}
function substantialPreview(text){
 // Backchannels and very short hypotheses can still change on the next frame.
 if(/^(?:thank you|thanks|고마워요?|감사합니다|谢谢你?)[.!?。！\s]*$/iu.test(text))return false;
 const letters=text.match(/\p{L}/gu)||[];
 return (text.match(/\p{Script=Han}/gu)||[]).length>=3||(text.match(/\p{Script=Hangul}/gu)||[]).length>=4||
  (letters.length>=6&&(text.match(/\p{L}+/gu)||[]).length>=2);
}
function replyEcho(text,spokenText){
 const normalize=t=>t.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 const heard=normalize(text),spoken=normalize(spokenText);
 if(!heard)return true;
 if(spoken.includes(heard))return true;
 if(heard.length<8)return false;
 let matches=0;for(let i=0;i<=heard.length-3;i++)if(spoken.includes(heard.slice(i,i+3)))matches++;
 return matches/(heard.length-2)>=.85;
}

export const HANDS_FREE_COPY={
 ko:{start:'음성 대화 켜기',stop:'음성 대화 끄기',listening:'듣고 있어요 · 말하면 자동으로 보내요',hearing:'말씀을 듣고 있어요…',thinking:'소울이 답을 생각하고 있어요…',speaking:'소울이 말하는 중 · 끝나면 다시 들어요',off:'음성 대화 꺼짐',unsupported:'이 브라우저는 연속 음성 대화를 지원하지 않아요. 글로 대화할 수 있어요.',denied:'마이크 권한을 허용한 뒤 음성 대화를 다시 켜주세요.',network:'음성 인식 연결이 끊겼어요. 연결을 확인하고 다시 켜주세요.',audio:'목소리를 재생하지 못해 대화를 멈췄어요. ♪ 버튼으로 소리를 확인해주세요.',failed:'대화 연결이 끊겼어요. 다시 켜서 이어갈 수 있어요.',rate_limited:'체험 한도에 도달해 음성 대화를 멈췄어요.',notice:'말하면 자동 전송 → 음성 답변 → 다시 듣기. “대화 멈춰”로 종료해요. 화면을 켜둬야 해요. 음성 인식은 브라우저 서비스가 처리할 수 있어요.'},
 en:{start:'Start voice conversation',stop:'Stop voice conversation',listening:'Listening · Speak to send automatically',hearing:'I’m listening…',thinking:'Your Soul is thinking…',speaking:'Your Soul is speaking · Listening resumes after',off:'Voice conversation off',unsupported:'This browser does not support continuous voice conversation. You can type instead.',denied:'Allow microphone access, then start voice conversation again.',network:'Speech recognition disconnected. Check your connection and start again.',audio:'Conversation paused because speech could not play. Tap ♪ to check the voice.',failed:'Conversation disconnected. Start again to continue.',rate_limited:'The demo limit was reached. Voice conversation stopped.',notice:'Speak → automatic send → spoken reply → listen again. Say “stop listening” to end. Keep this page in the foreground. Recognition may use your browser provider’s service.'},
 zh:{start:'开启连续语音',stop:'停止语音对话',listening:'正在听 · 说完自动发送',hearing:'正在听你说…',thinking:'灵魂正在想怎么回答…',speaking:'灵魂正在回答 · 说完继续聆听',off:'语音对话已停止',unsupported:'此浏览器不支持连续语音对话，可以使用文字聊天。',denied:'请允许麦克风权限后，重新开启语音对话。',network:'语音识别连接中断，请检查网络后重新开启。',audio:'未能播放语音，已暂停对话。点击 ♪ 检查声音后再开启。',failed:'对话连接中断，可以重新开启继续。',rate_limited:'已达到演示使用限额，语音对话已停止。',notice:'说话 → 自动发送 → 语音回复 → 继续聆听。说“停止对话”即可结束。请保持网页在前台；语音识别可能由浏览器服务商处理。'}
};

export class HandsFreeConversation {
 constructor({Recognition=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition,fetchImpl=appFetch,getContext=()=>({}),speak=()=>{},canPrepareFirstSpeech=()=>false,prefetchSpeech=()=>{},primeReplies=()=>{},stopSpeech=()=>{},releaseInput=()=>{},onState=()=>{},onTranscript=()=>{},onReply=()=>{},onTurn=()=>{},getOpening=()=>null,onOpening=()=>{},introduced=new Set(),setTimer=(...args)=>globalThis.setTimeout(...args),clearTimer=(...args)=>globalThis.clearTimeout(...args)}={}){Object.assign(this,{Recognition,fetchImpl,getContext,speak,canPrepareFirstSpeech,prefetchSpeech,primeReplies,stopSpeech,releaseInput,onState,onTranscript,onReply,onTurn,getOpening,onOpening,introduced,setTimer,clearTimer});this.active=false;this.epoch=0;this.recognizer=null;this.controller=null;this.timer=null;this.state='off';this.histories={lumi:[],mori:[],bori:[]};}
 setState(state){this.state=state;this.stateSince=Date.now();this.onState(state,this.active);}
 disconnect(){const r=this.recognizer;this.recognizer=null;if(r){r.onresult=r.onend=r.onerror=r.onspeechstart=r.onspeechend=r.onstart=r.onquiet=r.ontranscribing=r.onaudiorecovering=null;try{r.abort();}catch{}}}
 stopInterrupt(){this.clearTimer(this.interruptTimer);this.interruptTimer=null;this.interruptSpeech=false;this.playbackFinished=false;const r=this.interruptRecognizer;this.interruptRecognizer=null;if(r){r.onresult=r.onend=r.onerror=r.onspeechstart=r.ontranscribing=null;try{r.abort();}catch{}}}
 stop(reason='off'){this.active=false;this.epoch++;this.clearTimer(this.timer);this.discardDraft();this.controller?.abort();this.controller=null;this.disconnect();this.stopInterrupt();this.spokenPhrases=[];this.monitorLimit=null;this.releaseInput();this.stopSpeech();this.setState(reason);}
 start(soul,language){this.stop();if(!this.Recognition){this.setState('unsupported');return;}this.soul=soul;this.language=language;this.active=true;this.primeReplies(soul,language);this.retryCount=0;this.audioIssue=false;this.pendingOpening=this.introduced.has(soul)?null:this.getOpening(soul,language);this.listen();}
 setLanguage(language){
  if(!['auto','en','ko','zh'].includes(language)||this.language===language)return;
  this.language=language;
  if(!this.active)return;
  this.epoch++;
  this.primeReplies(this.soul,language);this.discardDraft();
  this.clearTimer(this.timer);
  this.controller?.abort();this.controller=null;
  this.disconnect();this.stopInterrupt();this.stopSpeech();
  this.spokenPhrases=[];this.monitorLimit=null;this.retryCount=0;this.audioIssue=false;
  if(this.pendingOpening)this.pendingOpening=this.getOpening(this.soul,language);
  this.listen();
 }
 isBusy(){return this.active&&(temporaryLimits.has(this.state)||['starting','hearing','transcribing','thinking','synthesizing','speaking','reconnecting','audio_reconnecting'].includes(this.state));}
 resumeAfter(serial,delay=500){this.clearTimer(this.timer);this.timer=this.setTimer(()=>{if(this.active&&serial===this.epoch)this.listen();},delay);}
 listen(){
  if(!this.active)return;this.discardDraft();this.disconnect();const serial=this.epoch;let r;try{r=new this.Recognition();}catch{this.stop('unsupported');return;}this.recognizer=r;
  r.inputLanguage=this.language;r.lang={en:'en-US',ko:'ko-KR',zh:'zh-CN'}[this.language]||'en-US';r.continuous=false;r.interimResults=true;r.maxAlternatives=1;
  const valid=()=>this.active&&this.epoch===serial&&this.recognizer===r;
  let finalText='',submitted=false,started=false,primedAutoLanguage;
  const send=()=>{if(!valid()||submitted)return;submitted=true;this.disconnect();this.clearTimer(this.timer);if(finalText)this.submit(finalText,serial);else this.resumeAfter(serial,1000);};
  r.onstart=()=>{if(valid()){started=true;this.clearTimer(this.timer);if(this.pendingOpening?.text){const opening=this.pendingOpening;this.pendingOpening=null;this.onOpening(opening.text,opening.language);this.output(opening.text,opening.language,serial,state=>{if(state==='playing')this.introduced.add(this.soul);});return;}this.setState('listening');this.timer=this.setTimer(()=>{if(valid()){this.disconnect();this.resumeAfter(serial);}},45000);}};
  r.onspeechstart=()=>{if(valid()){this.clearTimer(this.timer);this.setState('hearing');}};
  r.ontranscribing=endpoint=>{if(valid()){this.clearTimer(this.timer);this.setState('transcribing');if(endpoint?.text)this.prepareDraft(endpoint.text);}};
  r.onaudiorecovering=()=>{if(valid()){this.clearTimer(this.timer);this.setState('audio_reconnecting');}};
  r.onquiet=()=>{if(valid())this.setState('quiet');};
  r.onresult=e=>{
   if(!valid())return;
   let interim='';const finals=[];
   for(const result of Array.from(e.results)){
    const text=result[0]?.transcript||'';
    if(result.isFinal)finals.push(text);else interim+=text;
   }
   finalText=finals.join(' ').trim();
   if(finalText.length>MAX_MESSAGE_LENGTH)return this.recognitionError(serial,{error:'utterance_too_long'});
   if(this.language==='auto'&&interim&&substantialPreview(interim)){
    const language=replyLanguage(interim,this.language);
    if(primedAutoLanguage!==language){this.primeReplies(this.soul,language);primedAutoLanguage=language;}
   }
   this.onTranscript(finalText||interim,Boolean(finalText));
   if(finalText){this.retryCount=0;send();}
  };
  r.onspeechend=()=>{if(valid())try{r.stop();}catch{send();}};
  r.onend=send;
  r.onerror=e=>{if(valid())this.recognitionError(serial,e);};
  const startTimeout=Number.isFinite(r.startTimeoutMs)?Math.max(12000,Math.min(r.startTimeoutMs,100000)):12000;
  this.setState('starting');try{this.timer=this.setTimer(()=>{if(valid()&&!started)this.stop('start_timeout');},startTimeout);r.start();}catch{this.stop('denied');}
 }
 recognitionError(serial,event){
  this.discardDraft();
  const reason=event.error;
  this.disconnect();this.clearTimer(this.timer);
  if(temporaryLimits.has(reason)){this.setState(reason);this.resumeAfter(serial,retryDelay(reason,event.retryAfter));}
  else if(hardLimits.has(reason)||['unsupported','not_configured','provider_auth','provider_not_activated'].includes(reason))this.stop(reason);
  else if(reason==='utterance_too_long'){this.setState(reason);this.resumeAfter(serial,1500);}
  else if(reason==='no-speech'||reason==='aborted'){this.setState('listening');this.resumeAfter(serial,reason==='no-speech'?1000:500);}
  else if(reason==='audio-capture'||['network','asr_timeout','timeout','provider_unavailable','invalid_response'].includes(reason))this.recover(serial,reason==='audio-capture');
  else this.stop(['not-allowed','service-not-allowed'].includes(reason)?'denied':'network');
 }
 requestFor(text,language){
  const extra=this.getContext(needsCamera(text)),messages=conversationMessages(this.histories[this.soul],text);
  return {url:extra.image?'/api/chat/scene':'/api/chat',body:{voice:true,soul:this.soul,language,messages,context:extra.context,image:extra.image}};
 }
 beginRequest(request,text,controller){
  const voiceTurnId=newVoiceTurnId();
  const id=request.url==='/api/chat'&&!needsCamera(text)&&this.canPrepareFirstSpeech()?serverVoiceTurnId(voiceTurnId):undefined;
  const response=this.fetchImpl(request.url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/x-ndjson'},signal:controller.signal,body:JSON.stringify({...request.body,voiceTurnId:serverVoiceTurnId(voiceTurnId),firstSpeechId:id})});
  return {id,voiceTurnId,response};
 }
 discardDraft(){
  if(!this.draft)return;
  this.clearTimer(this.draft.timer);this.draft.controller.abort();this.draft=null;
 }
 prepareDraft(text){
  // Called once after local end-of-speech, while the recognizer confirms its
  // last preview. Nothing from this request is shown or played until matched.
  if(this.draft||text.length>512||!substantialPreview(text)||needsCamera(text)||endConversation.test(text)||repeatRequest.test(text))return;
  const language=replyLanguage(text,this.language,this.soul);
  if(contextualRideQuickReply(text,{soul:this.soul,language},this.histories[this.soul].at(-1)))return;
  try{
   const request=this.requestFor(text,language);
   if(request.body.image)return;
   const controller=new AbortController();
   const flight=this.beginRequest(request,text,controller);
   flight.response.catch(()=>{});
   this.draft={...flight,request,controller,text,language,timer:this.setTimer(()=>this.discardDraft(),3000)};
  }catch{/* If preparation is unavailable the confirmed turn uses its usual request. */}
 }
 playbackByMessage=new WeakMap();
 rememberTurn(text,reply,playback){
  const message={role:'assistant',content:reply};
  this.histories[this.soul].push({role:'user',content:text},message);
  this.playbackByMessage.set(message,playback);
  this.histories[this.soul]=this.histories[this.soul].slice(-40);
  this.onTurn({soul:this.soul,user:text,reply});this.onReply(reply,playback);
 }
 async submit(text,serial,retryRequest=null){
  if(!this.active||serial!==this.epoch)return;
  if(endConversation.test(text)){this.stop();return;}
  const language=replyLanguage(text,this.language,this.soul);
  const draft=!retryRequest&&this.draft?.language===language&&confirmedWords(this.draft.text)===confirmedWords(text)?this.draft:null;
  if(draft){this.clearTimer(draft.timer);this.draft=null;}else this.discardDraft();
  const previous=this.histories[this.soul].at(-1);
  if(previous&&replyLanguage(previous.content)===language&&repeatRequest.test(text)){this.output(previous.content,language,serial,undefined,undefined,false,this.playbackByMessage?.get(previous));return;}
  const quick=contextualRideQuickReply(text,{soul:this.soul,language},previous);
  if(quick){
   draft?.controller.abort();
   const playback={firstReplySegment:true,quickReplySource:quick.path};
   this.rememberTurn(text,quick.text,playback);
   this.output(quick.text,language,serial,undefined,undefined,false,playback);
   return;
  }
  this.setState('thinking');const controller=draft?.controller||new AbortController();this.controller=controller;const timeout=this.setTimer(()=>controller.abort(),35000);
  let request=retryRequest||draft?.request,receivedReply=false;
  try{
   request??=this.requestFor(text,language);
   const flight=draft||this.beginRequest(request,text,controller);
   const firstSpeechId=flight.id,playback={voiceTurnId:flight.voiceTurnId},response=await flight.response;
   const valid=()=>this.active&&serial===this.epoch;
   const streamed=response.ok&&response.headers.get('content-type')?.includes('application/x-ndjson');
   let speaking=false,complete=false,firstReplySegment=true;const queue=[];
   const prepareNext=()=>{
    const next=queue[0];
    if(speaking&&valid()&&!temporaryLimits.has(this.state)&&next&&!next.prepared&&next.text.length<=540){
     next.prepared=true;
     this.prefetchSpeech(next.text,language,this.soul,playback);
    }
   };
   const drain=()=>{
    if(!valid()||speaking)return;
    const next=queue.shift();
    if(!next){if(complete)this.finishPlayback(serial);return;}
    speaking=true;
    const speechOptions=firstReplySegment?{...playback,firstReplySegment:true,firstSpeechId}:playback;
    firstReplySegment=false;
    this.output(next.text,language,serial,()=>{},()=>{speaking=false;drain();},false,speechOptions);
    prepareNext();
   };
   const enqueue=value=>{
    if(!valid())return;
    // Keep one clip ready. Later sentences can share a request while it plays.
    const tail=queue.at(-1);
    if(tail&&!tail.prepared)tail.text+=(language==='zh'?'':' ')+value;
    else queue.push({text:value,prepared:false});
    if(speaking)prepareNext();else drain();
   };
   const data=streamed?await readVoiceReply(response,{soul:this.soul,joinReactions:Boolean(serverVoiceTurnId(flight.voiceTurnId)),onText:value=>{if(valid()&&value){receivedReply=true;this.onReply(value,playback);}},onSentence:enqueue}):await response.json();if(!valid())return;
   if(!response.ok)throw conversationServiceError(data,response.headers,'failed');if(data.soul!==this.soul||typeof data.reply!=='string'||!data.reply.trim())throw new Error('failed');
   this.rememberTurn(text,data.reply,playback);if(streamed){complete=true;drain();}else this.output(data.reply,language,serial,undefined,undefined,false,playback);
  }catch(error){
   if(!this.active||serial!==this.epoch)return;
   const next=++this.epoch,reason=error.message;
   this.stopInterrupt();this.spokenPhrases=[];this.monitorLimit=null;this.stopSpeech();
   if(temporaryLimits.has(reason)){
    this.setState(reason);const delay=retryDelay(reason,error.retryAfter);
    if(retryRequest||receivedReply)this.resumeAfter(next,delay);
    else this.timer=this.setTimer(()=>{if(this.active&&this.epoch===next)this.submit(text,next,request);},delay);
   }else if(hardLimits.has(reason)||['provider_auth','not_configured','provider_not_activated'].includes(reason))this.stop(reason);
   else this.recover(next);
  }
  finally{this.clearTimer(timeout);if(this.controller===controller)this.controller=null;}
 }
 output(text,language,serial,onState=()=>{},onEnded,retried=false,speechOptions){
  if(!this.active||serial!==this.epoch)return false;this.disconnect();this.clearTimer(this.timer);this.setState('synthesizing');
  let played=false,settled=false;
  this.speak(text,language,this.soul,(state,detail)=>{
   if(settled||!this.active||serial!==this.epoch)return;
   onState(state,detail);
   if(state==='playing'){played=true;this.audioIssue=false;this.setState('speaking');this.monitorInterrupt(serial,text);}
   else if(state==='ended'){settled=true;if(onEnded){this.setState('synthesizing');onEnded();}else this.finishPlayback(serial);}
   else if(isConversationLimit(state)){
    settled=true;this.audioIssue=false;
    if(hardLimits.has(state)){this.stop(state);return;}
    this.stopInterrupt();this.spokenPhrases=[];this.stopSpeech();this.setState(state);
    this.timer=this.setTimer(()=>{
     if(!this.active||serial!==this.epoch)return;
     if(!played&&!retried)this.output(text,language,serial,onState,onEnded,true,speechOptions?{...speechOptions,firstSpeechId:undefined}:undefined);
     else if(played&&onEnded){this.setState('synthesizing');onEnded();}
     else{
      const next=++this.epoch;this.controller?.abort();this.finishPlayback(next);
     }
    },retryDelay(state,detail?.retryAfter));
   }else if(['blocked','unavailable'].includes(state)){settled=true;this.audioIssue=true;this.stopInterrupt();this.setState('audio_retry');this.resumeAfter(serial,1500);}
  },speechOptions);return true;
 }
 finishPlayback(serial){
  if(this.monitorLimit){
   const {reason,until}=this.monitorLimit;this.monitorLimit=null;this.spokenPhrases=[];
   if(hardLimits.has(reason)){this.stop(reason);return;}
   this.setState(reason);this.resumeAfter(serial,Math.max(0,until-Date.now()));return;
  }
  if(this.interruptRecognizer&&this.interruptSpeech){
   // A rider can start on the last syllable. Keep those samples, including when
   // the recognizer only returns a transcript after the audio upload finishes.
   this.playbackFinished=true;this.setState('hearing');return;
  }
  this.stopInterrupt();this.spokenPhrases=[];this.setState('listening');this.resumeAfter(serial,100);
 }
 monitorInterrupt(serial,spokenText){
  this.spokenPhrases=[...(this.spokenPhrases||[]).slice(-1),spokenText];
  if(this.interruptRecognizer||this.interruptTimer!=null||this.monitorLimit)return;
  const stillSpeaking=()=>this.active&&this.epoch===serial&&['speaking','synthesizing'].includes(this.state);
  const listen=()=>{
   this.interruptTimer=null;
   if(!stillSpeaking())return;
   let r;try{r=new this.Recognition();}catch{this.onState('speaking_no_interrupt',true);return;}
   this.interruptRecognizer=r;let owner=serial,yielded=false;
   r.inputLanguage=this.language;r.lang={en:'en-US',ko:'ko-KR',zh:'zh-CN'}[this.language]||'en-US';r.continuous=false;r.interimResults=true;
   const valid=()=>this.active&&this.epoch===owner&&this.interruptRecognizer===r;
   const resume=(delay=100)=>{this.stopInterrupt();this.spokenPhrases=[];this.setState('listening');this.resumeAfter(owner,delay);};
   const repeat=()=>{
    if(!valid())return;
    if(yielded||this.playbackFinished){resume();return;}
    this.stopInterrupt();this.interruptTimer=this.setTimer(listen,300);
   };
   const yieldToRider=()=>{
    if(yielded)return;
    yielded=true;owner=++this.epoch;this.clearTimer(this.timer);
    this.controller?.abort();this.stopSpeech();this.setState('hearing');
   };
   r.onspeechstart=()=>{if(valid())this.interruptSpeech=true;};
   r.ontranscribing=()=>{if(valid()&&(yielded||this.playbackFinished))this.setState('transcribing');};
   r.onresult=e=>{
    if(!valid())return;
    const results=Array.from(e.results),final=results.every(x=>x.isFinal),text=results.map(x=>x[0]?.transcript||'').join(' ').trim();
    if(!text)return;
    if(replyEcho(text,this.spokenPhrases.join(' '))||/^(?:[uhm]+|[嗯呃]+|[음흠]+)[.!?。！\s]*$/iu.test(text)){
     if(final&&(yielded||this.playbackFinished))resume();return;
    }
    this.interruptSpeech=true;
    if(!final){if(substantialPreview(text))yieldToRider();this.onTranscript(text,false);return;}
    if(endConversation.test(text)){this.stop();return;}
    yieldToRider();
    const rest=interruption(text);
    if(rest.length>MAX_MESSAGE_LENGTH){this.stopInterrupt();this.spokenPhrases=[];this.recognitionError(owner,{error:'utterance_too_long'});return;}
    if(!rest){resume(150);return;}
    this.stopInterrupt();this.spokenPhrases=[];this.retryCount=0;this.onTranscript(rest,true);this.submit(rest,owner);
   };
   r.onend=repeat;r.onerror=e=>{
    if(!valid())return;
    if(e.error==='no-speech'||e.error==='aborted'){repeat();return;}
    const hasFloor=yielded||this.playbackFinished;this.stopInterrupt();
    if(!hasFloor){
     if(temporaryLimits.has(e.error)||hardLimits.has(e.error))this.monitorLimit={reason:e.error,until:Date.now()+retryDelay(e.error,e.retryAfter)};
     this.onState('speaking_no_interrupt',true);return;
    }
    this.spokenPhrases=[];
    this.recognitionError(owner,e);
   };
   try{r.start();}catch{if(valid()){this.stopInterrupt();this.onState('speaking_no_interrupt',true);}}
  };
  this.interruptTimer=this.setTimer(listen,150);
 }
 recover(serial,capture=false){this.disconnect();this.clearTimer(this.timer);if(capture)this.releaseInput();if(++this.retryCount>3){this.stop(capture?'audio-capture':'network');return;}this.setState(capture?'audio_reconnecting':'reconnecting');this.resumeAfter(serial,Math.min(1500*this.retryCount,4500));}
 announce(text,language,onState=()=>{},playback){if(!this.active||this.isBusy())return false;const serial=++this.epoch;this.disconnect();return this.output(text,language,serial,onState,undefined,false,playback);}
}

HANDS_FREE_COPY.ko.speaking='소울이 말하는 중 · “잠깐”으로 끊을 수 있어요';
HANDS_FREE_COPY.en.speaking='Speaking · Say “stop” to interrupt';
HANDS_FREE_COPY.zh.speaking='灵魂正在回答 · 说“等一下”可打断';
HANDS_FREE_COPY.ko.notice+=' 답변 중 일반 전사는 멈추지만 “잠깐” 명령은 들어요.';
HANDS_FREE_COPY.en.notice+=' Normal transcription pauses during replies; “stop” detection remains active.';
HANDS_FREE_COPY.zh.notice+=' 回答时暂停普通转写，但保留“等一下”的指令监听。';

HANDS_FREE_COPY.ko.speaking_no_interrupt='말하는 중 · 이 브라우저에서 음성 끼어들기를 시작하지 못했어요';
HANDS_FREE_COPY.en.speaking_no_interrupt='Speaking · Voice interruption is unavailable in this browser';
HANDS_FREE_COPY.zh.speaking_no_interrupt='正在回答 · 此浏览器未能启动打断监听';

Object.assign(HANDS_FREE_COPY.ko,{starting:'마이크와 음성 인식을 연결하고 있어요…',start_timeout:'음성 인식이 시작되지 않았어요. 마이크 권한을 확인하고 휴대폰 브라우저에서 다시 열어주세요.',languageHint:'영어, 한국어, 중국어 중 대화할 언어를 선택하세요.'});
Object.assign(HANDS_FREE_COPY.en,{starting:'Connecting microphone and speech recognition…',start_timeout:'Speech recognition did not start. Check microphone access and reopen in your phone browser.',languageHint:'Choose English, Korean or Chinese for your conversation.'});
Object.assign(HANDS_FREE_COPY.zh,{starting:'正在连接麦克风和语音识别…',start_timeout:'语音识别未能启动。请检查麦克风权限，并用手机浏览器重新打开。',languageHint:'选择想用来对话的语言。'});

Object.assign(HANDS_FREE_COPY.ko,{mic:'마이크 음량',transcribing:'들었어요 · 음성을 글로 바꾸고 있어요…',quiet:'음성이 감지되지 않아요. 음량 막대와 마이크 입력을 확인해주세요.',languageHint:'대화할 언어를 고르세요. 자동을 선택하면 말할 때마다 언어를 바꿀 수 있어요.',notice:'말하고 약 0.5초 쉬면 자동 전송 → 답변 → 다시 듣기. 음성은 서버를 거쳐 Qwen에서 인식하며 녹음 파일을 저장하지 않아요. 답변 중에는 끼어들기 감지가 계속돼요. 화면을 켜두세요.', 'audio-capture':'마이크 입력을 받지 못했어요. 마이크 장치를 확인하고 다시 켜주세요.',asr_timeout:'음성 인식 시간이 초과됐어요. 다시 켜서 시도해주세요.',not_configured:'서버에 음성 인식이 설정되지 않았어요.',provider_auth:'음성 서비스 인증에 실패했어요.',provider_not_activated:'음성 인식 모델을 활성화해야 해요.'});
Object.assign(HANDS_FREE_COPY.en,{mic:'Mic level',transcribing:'Heard you · Transcribing…',quiet:'No speech detected. Check the level meter and microphone input.',languageHint:'Choose your conversation language. Select Auto to switch languages between turns.',notice:'Speak and pause for about 0.5 seconds → reply → listen again. Audio goes through our server to Qwen; recordings are not saved. Interruption detection continues during replies. Keep the page in the foreground.', 'audio-capture':'No microphone input. Check the input device and start again.',asr_timeout:'Speech recognition timed out. Start again to retry.',not_configured:'Speech recognition is not configured on the server.',provider_auth:'Speech service authentication failed.',provider_not_activated:'The speech recognition model needs activation.'});
Object.assign(HANDS_FREE_COPY.zh,{mic:'麦克风音量',transcribing:'收到声音 · 正在识别文字…',quiet:'还没有检测到说话，请检查音量条和麦克风输入设备。',languageHint:'选择中文、英语或韩语。选自动时，每句话都可以换一种语言。',notice:'说完停顿约0.5秒 → 自动发送 → 回答 → 继续聆听。音频经服务器发送给千问识别，不保存录音文件。回答时保留打断检测。请保持网页在前台。', 'audio-capture':'未能读取麦克风，请检查输入设备后重新开启。',asr_timeout:'语音识别超时，请重新开启后再试。',not_configured:'服务器尚未配置语音识别。',provider_auth:'语音服务认证失败。',provider_not_activated:'千问语音识别模型尚未开通。'});

Object.assign(HANDS_FREE_COPY.ko,{synthesizing:'목소리를 준비하고 있어요…',audio_retry:'소리가 재생되지 않았어요 · 대화는 계속돼요',reconnecting:'연결을 복구하고 있어요 · 자동으로 다시 들어요'});
Object.assign(HANDS_FREE_COPY.en,{synthesizing:'Getting my voice ready…',audio_retry:'Audio needs attention · Still connected',reconnecting:'Reconnecting · Listening will resume automatically'});
Object.assign(HANDS_FREE_COPY.zh,{synthesizing:'正在生成语音…',audio_retry:'声音暂未播放 · 对话仍然保持',reconnecting:'正在恢复连接 · 稍后自动继续聆听'});

Object.assign(HANDS_FREE_COPY.ko,{start:'대화 시작',stop:'대화 정지',off:'대화가 멈췄어요',listening:'듣고 있어요 · 편하게 말해주세요',quiet:'여기 있어요 · 준비되면 말해주세요'});
Object.assign(HANDS_FREE_COPY.en,{start:'Start conversation',stop:'Stop conversation',off:'Conversation stopped',listening:'Listening · Go ahead',quiet:'Still here · Speak whenever you’re ready'});
Object.assign(HANDS_FREE_COPY.zh,{start:'开始交流',stop:'停止交流',off:'对话已停止',listening:'正在听 · 直接说就好',quiet:'我还在 · 随时可以接着说'});

HANDS_FREE_COPY.ko.notice='말하는 동안 자막이 나타나고 수정돼요. 약 0.5초 쉬면 최종 문장을 보내고 답을 들어요. 연결이 불안정하면 한 문장 단위 인식으로 전환해요. 음성은 서버를 거쳐 Qwen으로 전송하며 녹음은 저장하지 않아요. 답변 중 “잠깐”으로 끊을 수 있어요. 화면을 켜두세요.';
HANDS_FREE_COPY.en.notice='Words appear and update while you speak. Pause about 0.5 seconds to send the confirmed sentence and hear a reply. If streaming disconnects, sentence recognition takes over. Audio goes through our server to Qwen; recordings are not saved. Say “stop” to interrupt a reply. Keep this page in the foreground.';
HANDS_FREE_COPY.zh.notice='说话时文字会逐步出现并修正，停顿约0.5秒后发送确认的句子并语音回答。流式连接中断时会转用整句识别。音频经服务器传给千问，不保存录音。回答时可说“等一下”打断。请保持网页在前台。';

Object.assign(HANDS_FREE_COPY.ko,{audio_reconnecting:'오디오 연결을 복구하고 있어요…','audio-capture':'오디오 연결을 복구하지 못했어요. 이어폰 연결을 확인하고 대화를 다시 켜주세요.'});
Object.assign(HANDS_FREE_COPY.en,{audio_reconnecting:'Restoring the audio connection…','audio-capture':'Audio could not reconnect. Check your headset connection and start the conversation again.'});
Object.assign(HANDS_FREE_COPY.zh,{audio_reconnecting:'正在恢复音频连接…','audio-capture':'音频连接未能恢复。请检查耳机连接，再点击开始交流。'});

Object.assign(HANDS_FREE_COPY.ko,{speaking:'소울이 말하는 중 · 말하면 끼어들 수 있어요',speaking_no_interrupt:'말하는 중 · 듣기는 답변 후 다시 시작해요',utterance_too_long:'한 번에 보내기에는 너무 길어요. 나누어 말씀해 주세요.',notice:'길게 이야기해도 자막이 이어져요. 말을 마치고 잠시 쉬면 소울이 답해요. 답변 중 새 질문을 하거나 “잠깐”으로 멈출 수 있어요. '+VOICE_PRIVACY.ko});
Object.assign(HANDS_FREE_COPY.en,{speaking:'Speaking · You can interrupt with a question',speaking_no_interrupt:'Speaking · Listening will resume after this reply',utterance_too_long:'That was too long to send in one turn. Please try it in parts.',notice:'Captions follow you as you speak, even on longer turns. Pause when you finish and your Soul will reply. You can ask a new question during a reply or say “stop” to interrupt. '+VOICE_PRIVACY.en});
Object.assign(HANDS_FREE_COPY.zh,{speaking:'正在回答 · 直接说话可以打断',speaking_no_interrupt:'正在回答 · 回答结束后继续聆听',utterance_too_long:'这段话太长了，请分几次说。',notice:'长一点的话也可以连续说，字幕会跟着出现。说完稍作停顿，角色就会接话。回答中可直接提出新问题，也可说“等一下”打断。'+VOICE_PRIVACY.zh});
for(const language of ['ko','en','zh'])Object.assign(HANDS_FREE_COPY[language],COMMUNICATION_LIMIT_COPY[language]);
