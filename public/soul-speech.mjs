// Shared playback for chat, GPS and camera replies. Late callbacks cannot
// revive a stopped voice or overlap the next reply.
export class SoulSpeechPlayer {
 constructor({synth=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance,onState=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}={}){Object.assign(this,{synth,Utterance,onState,setTimer,clearTimer});this.serial=0;this.utterance=null;this.timer=null;this.listener=null;}
 prepare(){this.synth?.getVoices();this.synth?.resume();}
 stop(){this.serial++;this.clearTimer(this.timer);this.timer=null;if(this.listener)this.synth?.removeEventListener?.('voiceschanged',this.listener);this.listener=null;this.utterance=null;this.synth?.cancel();}
 speak(text,{language='en',soul='lumi',onState=()=>{}}={}){
  this.stop();const serial=this.serial;
  const report=state=>{if(serial===this.serial){this.onState(state);onState(state);}};
  if(!text?.trim())return;
  if(!this.synth||!this.Utterance){report('unavailable');return;}
  report('loading');this.prepare();
  const start=()=>{
   if(serial!==this.serial||this.utterance)return;
   this.clearTimer(this.timer);if(this.listener)this.synth.removeEventListener?.('voiceschanged',this.listener);this.listener=null;
   const locale=language==='ko'?'ko':'en';
   const voices=this.synth.getVoices();const matching=voices.filter(v=>v.lang.toLowerCase().startsWith(locale));
   const preferred=locale==='en'?(soul==='mori'?'en-gb':'en-us'):'ko-kr';
   const voice=matching.find(v=>v.lang.toLowerCase()===preferred)||matching[0];
   const u=new this.Utterance(text);this.utterance=u;u.lang=voice?.lang||(locale==='ko'?'ko-KR':'en-US');if(voice)u.voice=voice;
   u.rate=soul==='mori'?.86:soul==='bori'?1.03:1;
   u.onstart=()=>{if(serial!==this.serial)return;this.clearTimer(this.timer);report('playing');};
   u.onend=()=>{if(serial!==this.serial)return;this.clearTimer(this.timer);this.utterance=null;report('ended');};
   u.onerror=e=>{if(serial!==this.serial)return;this.clearTimer(this.timer);this.utterance=null;report(e.error==='not-allowed'?'blocked':'unavailable');};
   // Some mobile engines expose an empty voice list but can speak using lang.
   try{this.timer=this.setTimer(()=>{if(serial===this.serial){this.synth.cancel();this.utterance=null;report('blocked');}},10000);this.synth.speak(u);}catch{this.clearTimer(this.timer);report('unavailable');}
  };
  if(this.synth.getVoices().length)start();else{this.listener=start;this.synth.addEventListener?.('voiceschanged',start);this.timer=this.setTimer(start,350);}
 }
}
