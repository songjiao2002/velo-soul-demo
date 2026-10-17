import {detectInputLanguage} from './soul-chat.mjs';
import {outputLanguage} from './seoul-places.mjs';

export const HANDS_FREE_COPY={
 ko:{start:'음성 대화 켜기',stop:'음성 대화 끄기',listening:'듣고 있어요 · 말하면 자동으로 보내요',hearing:'말씀을 듣고 있어요…',thinking:'소울이 답을 생각하고 있어요…',speaking:'소울이 말하는 중 · 끝나면 다시 들어요',off:'음성 대화 꺼짐',unsupported:'이 브라우저는 연속 음성 대화를 지원하지 않아요. 글로 대화할 수 있어요.',denied:'마이크 권한을 허용한 뒤 음성 대화를 다시 켜주세요.',network:'음성 인식 연결이 끊겼어요. 연결을 확인하고 다시 켜주세요.',audio:'목소리를 재생하지 못해 대화를 멈췄어요. ♪ 버튼으로 소리를 확인해주세요.',failed:'대화 연결이 끊겼어요. 다시 켜서 이어갈 수 있어요.',rate_limited:'체험 한도에 도달해 음성 대화를 멈췄어요.',notice:'말하면 자동 전송 → 음성 답변 → 다시 듣기. “대화 멈춰”로 종료해요. 화면을 켜둬야 해요. 음성 인식은 브라우저 서비스가 처리할 수 있어요.'},
 en:{start:'Start voice conversation',stop:'Stop voice conversation',listening:'Listening · Speak to send automatically',hearing:'I’m listening…',thinking:'Your Soul is thinking…',speaking:'Your Soul is speaking · Listening resumes after',off:'Voice conversation off',unsupported:'This browser does not support continuous voice conversation. You can type instead.',denied:'Allow microphone access, then start voice conversation again.',network:'Speech recognition disconnected. Check your connection and start again.',audio:'Conversation paused because speech could not play. Tap ♪ to check the voice.',failed:'Conversation disconnected. Start again to continue.',rate_limited:'The demo limit was reached. Voice conversation stopped.',notice:'Speak → automatic send → spoken reply → listen again. Say “stop listening” to end. Keep this page in the foreground. Recognition may use your browser provider’s service.'},
 zh:{start:'开启连续语音',stop:'停止语音对话',listening:'正在听 · 说完自动发送',hearing:'正在听你说…',thinking:'灵魂正在想怎么回答…',speaking:'灵魂正在回答 · 说完继续聆听',off:'语音对话已停止',unsupported:'此浏览器不支持连续语音对话，可以使用文字聊天。',denied:'请允许麦克风权限后，重新开启语音对话。',network:'语音识别连接中断，请检查网络后重新开启。',audio:'未能播放语音，已暂停对话。点击 ♪ 检查声音后再开启。',failed:'对话连接中断，可以重新开启继续。',rate_limited:'已达到演示使用限额，语音对话已停止。',notice:'说话 → 自动发送 → 语音回复 → 继续聆听。说“停止对话”即可结束。请保持网页在前台；语音识别可能由浏览器服务商处理。'}
};

export class HandsFreeConversation {
 constructor({Recognition=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition,fetchImpl=(...args)=>globalThis.fetch(...args),getContext=()=>({}),speak=()=>{},stopSpeech=()=>{},onState=()=>{},onTranscript=()=>{},onReply=()=>{},setTimer=(...args)=>globalThis.setTimeout(...args),clearTimer=(...args)=>globalThis.clearTimeout(...args)}={}){Object.assign(this,{Recognition,fetchImpl,getContext,speak,stopSpeech,onState,onTranscript,onReply,setTimer,clearTimer});this.active=false;this.epoch=0;this.recognizer=null;this.controller=null;this.timer=null;this.state='off';this.histories={lumi:[],mori:[],bori:[]};}
 setState(state){this.state=state;this.onState(state,this.active);}
 disconnect(){const r=this.recognizer;this.recognizer=null;if(r){r.onresult=r.onend=r.onerror=r.onspeechstart=r.onspeechend=r.onstart=null;try{r.abort();}catch{}}}
 stopInterrupt(){this.clearTimer(this.interruptTimer);this.interruptTimer=null;const r=this.interruptRecognizer;this.interruptRecognizer=null;if(r){r.onresult=r.onend=r.onerror=null;try{r.abort();}catch{}}}
 stop(reason='off'){this.active=false;this.epoch++;this.clearTimer(this.timer);this.controller?.abort();this.controller=null;this.disconnect();this.stopInterrupt();this.stopSpeech();this.setState(reason);}
 start(soul,language){this.stop();if(!this.Recognition){this.setState('unsupported');return;}this.soul=soul;this.language=language;this.active=true;this.listen();}
 isBusy(){return this.active&&['hearing','thinking','speaking'].includes(this.state);}
 resumeAfter(serial,delay=500){this.clearTimer(this.timer);this.timer=this.setTimer(()=>{if(this.active&&serial===this.epoch)this.listen();},delay);}
 listen(){
  if(!this.active)return;this.disconnect();const serial=this.epoch;const r=new this.Recognition();this.recognizer=r;
  r.lang={en:'en-US',ko:'ko-KR',zh:'zh-CN'}[this.language]||'en-US';r.continuous=false;r.interimResults=true;r.maxAlternatives=1;
  const valid=()=>this.active&&this.epoch===serial&&this.recognizer===r;
  let finalText='',submitted=false;
  const send=()=>{if(!valid()||submitted)return;submitted=true;this.disconnect();this.clearTimer(this.timer);if(finalText)this.submit(finalText,serial);else this.resumeAfter(serial,1000);};
  r.onstart=()=>{if(valid())this.setState('listening');};
  r.onspeechstart=()=>{if(valid())this.setState('hearing');};
  r.onresult=e=>{if(!valid())return;let interim='';const finals=[];for(const result of Array.from(e.results)){const text=result[0]?.transcript||'';if(result.isFinal)finals.push(text);else interim+=text;}finalText=finals.join(' ').trim().slice(0,1000);this.onTranscript(finalText||interim);if(finalText)send();};
  r.onspeechend=()=>{if(valid())try{r.stop();}catch{send();}};
  r.onend=send;
  r.onerror=e=>{if(!valid())return;if(e.error==='no-speech'){this.disconnect();this.setState('listening');this.resumeAfter(serial,1000);}else if(e.error==='aborted'){this.disconnect();this.resumeAfter(serial);}else this.stop(['not-allowed','service-not-allowed','audio-capture'].includes(e.error)?'denied':'network');};
  this.setState('listening');try{r.start();this.timer=this.setTimer(()=>{if(valid()){this.disconnect();this.resumeAfter(serial);}},45000);}catch{this.stop('denied');}
 }
 async submit(text,serial){
  if(!this.active||serial!==this.epoch)return;
  if(/^(stop listening|stop (the )?(voice )?conversation|停止(语音)?对话|停止聆听|대화\s*멈춰|음성\s*대화\s*(종료|그만))[.!?。！\s]*$/i.test(text)){this.stop();return;}
  const language=outputLanguage(detectInputLanguage(text,this.language));
  if(/^(repeat that|say that again|再说一次|重复一遍|다시\s*말해)[.!?。！\s]*$/i.test(text)&&this.histories[this.soul].length){this.output(this.histories[this.soul].at(-1).content,language,serial);return;}
  this.setState('thinking');const controller=new AbortController();this.controller=controller;const timeout=this.setTimer(()=>controller.abort(),35000);
  try{
   const extra=this.getContext(true),messages=[...this.histories[this.soul].slice(-10),{role:'user',content:text}];
   const response=await this.fetchImpl(extra.image?'/api/chat/scene':'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({soul:this.soul,language,messages,context:extra.context,image:extra.image})});
   const data=await response.json();if(!this.active||serial!==this.epoch)return;
   if(!response.ok)throw new Error(data.error||'failed');if(data.soul!==this.soul||typeof data.reply!=='string'||!data.reply.trim())throw new Error('failed');
   this.histories[this.soul].push({role:'user',content:text},{role:'assistant',content:data.reply});this.histories[this.soul]=this.histories[this.soul].slice(-40);
   this.onReply(data.reply);this.output(data.reply,language,serial);
  }catch(error){if(this.active&&serial===this.epoch)this.stop(error.message==='rate_limited'?'rate_limited':'failed');}
  finally{this.clearTimer(timeout);if(this.controller===controller)this.controller=null;}
 }
 output(text,language,serial,onState=()=>{}){
  if(!this.active||serial!==this.epoch)return false;this.disconnect();this.clearTimer(this.timer);this.setState('speaking');
  this.speak(text,language,this.soul,state=>{if(!this.active||serial!==this.epoch)return;onState(state);if(state==='playing')this.monitorInterrupt(serial,text);else if(state==='ended'){this.stopInterrupt();this.setState('listening');this.resumeAfter(serial,650);}else if(['blocked','unavailable'].includes(state))this.stop('audio');});return true;
 }
 monitorInterrupt(serial,spokenText){
  this.stopInterrupt();
  const stillSpeaking=()=>this.active&&this.epoch===serial&&this.state==='speaking';
  const listen=()=>{
   if(!stillSpeaking())return;
   const r=new this.Recognition();this.interruptRecognizer=r;
   r.lang={en:'en-US',ko:'ko-KR',zh:'zh-CN'}[this.language]||'en-US';r.continuous=false;r.interimResults=false;
   const valid=()=>stillSpeaking()&&this.interruptRecognizer===r;
   const repeat=()=>{if(!valid())return;this.stopInterrupt();this.interruptTimer=this.setTimer(listen,300);};
   r.onresult=e=>{
    if(!valid())return;
    const text=Array.from(e.results).filter(x=>x.isFinal).map(x=>x[0]?.transcript||'').join(' ').trim();
    if(/^(stop listening|stop (the )?(voice )?conversation|停止(语音)?对话|停止聆听|대화\s*멈춰|음성\s*대화\s*(종료|그만))[.!?。！\s]*$/i.test(text)){this.stop();return;}
    const command=text.match(/^(?:(?:hey\s+)?(?:lumi|mori|bori)[,\s]+)?(stop\b(?:\s+(?:talking|speaking))?|wait\b(?:\s+a\s+(?:second|moment))?|等一下|等一等|停一下|暂停|잠깐만(?:요)?|잠깐|그만)(?:[\s,，.。!！?？:：]*)(.*)$/i);
    if(!command)return;
    // Reject a recognizer echo of a longer phrase from the current reply.
    const normalize=t=>t.toLowerCase().replace(/[\s.,!?，。！？]/g,'');
    if(text.length>8&&normalize(spokenText).includes(normalize(text)))return;
    const rest=command[2]?.trim();const nextSerial=++this.epoch;
    this.stopInterrupt();this.stopSpeech();this.setState('listening');
    if(rest){this.onTranscript(rest);this.submit(rest.slice(0,1000),nextSerial);}else this.resumeAfter(nextSerial,150);
   };
   r.onend=repeat;r.onerror=e=>{if(!valid())return;if(e.error==='no-speech'){repeat();return;}this.stopInterrupt();this.onState('speaking_no_interrupt',true);};
   try{r.start();}catch{if(valid()){this.stopInterrupt();this.onState('speaking_no_interrupt',true);}}
  };
  this.interruptTimer=this.setTimer(listen,150);
 }
 announce(text,language,onState=()=>{}){if(!this.active||this.isBusy())return false;const serial=++this.epoch;this.disconnect();return this.output(text,language,serial,onState);}
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
