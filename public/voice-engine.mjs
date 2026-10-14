export const VOICE_PROFILES={
 lumi:{locale:'en-US',preferred:/Jenny|Aria|Ava|Emma|Samantha|Zira|Google US/i,rate:.99,pitch:1.06,pause:180,label:'EN · 미국식 영어 우선 · 가볍고 호기심 있게'},
 mori:{locale:'en-GB',preferred:/Sonia|Libby|Serena|Hazel|Daniel|Google UK English Female/i,rate:.89,pitch:.98,pause:380,label:'EN · 영국식 영어 우선 · 느긋하고 부드럽게'},
 bori:{locale:'en-US',preferred:/Guy|Andrew|Eric|David|Alex|Google US/i,rate:1.03,pitch:1.03,pause:220,label:'EN · 미국식 영어 우선 · 따뜻하고 신나게'}
};
export function chooseEnglishVoice(voices,id){
 const profile=VOICE_PROFILES[id]||VOICE_PROFILES.lumi;
 const english=voices.filter(v=>/^en(?:[-_]|$)/i.test(v.lang));
 const regional=english.filter(v=>v.lang.replace('_','-').toLowerCase()===profile.locale.toLowerCase());
 const pool=regional.length?regional:english;
 const voice=pool.find(v=>profile.preferred.test(v.name))||pool.find(v=>v.default)||pool[0];
 return {voice,profile,matchedAccent:regional.length>0};
}
export function phrasePlan(text,id){
 const p=VOICE_PROFILES[id]||VOICE_PROFILES.lumi;
 // Use sentence punctuation, modest pitch changes and deliberate breathing space.
 // Voice locale determines the accent; rate/pitch never stand in for an accent.
 return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[text]).map(part=>({text:part.trim(),rate:p.rate,pitch:p.pitch,pause:p.pause})).filter(p=>p.text);
}
export class EnglishVoicePlayer {
 constructor({synth,Utterance,onState=()=>{}}={}){this.synth=synth;this.Utterance=Utterance;this.onState=onState;this.serial=0;this.timer=null;this.loadTimer=null;this.listener=null;this.active=null;}
 stop(){this.serial++;clearTimeout(this.timer);clearTimeout(this.loadTimer);if(this.listener)this.synth?.removeEventListener('voiceschanged',this.listener);this.listener=null;this.synth?.cancel();this.active=null;}
 speak(text,id){
  this.stop();const serial=this.serial;
  if(!this.synth||!this.Utterance){this.onState('unavailable');return;}
  const start=()=>{
   if(serial!==this.serial)return;
   const choice=chooseEnglishVoice(this.synth.getVoices(),id);if(!choice.voice)return false;
   clearTimeout(this.loadTimer);if(this.listener)this.synth.removeEventListener('voiceschanged',this.listener);this.listener=null;
   const phrases=phrasePlan(text,id);let index=0;
   const next=()=>{
    if(serial!==this.serial)return;
    if(index>=phrases.length){this.active=null;this.onState('ended',choice);return;}
    const phrase=phrases[index++],u=new this.Utterance(phrase.text);this.active=u;u.voice=choice.voice;u.lang=choice.voice.lang;u.rate=phrase.rate;u.pitch=phrase.pitch;u.volume=1;
    this.timer=setTimeout(()=>{if(serial!==this.serial)return;this.stop();this.onState('error',choice);},10000);
    u.onstart=()=>{if(serial!==this.serial)return;clearTimeout(this.timer);this.onState('playing',choice);};
    u.onend=()=>{if(serial!==this.serial)return;clearTimeout(this.timer);this.timer=setTimeout(next,phrase.pause);};
    u.onerror=()=>{if(serial!==this.serial)return;this.stop();this.onState('error',choice);};
    this.synth.speak(u);
   };next();return true;
  };
  if(!start()){this.onState('loading');this.listener=()=>start();this.synth.addEventListener('voiceschanged',this.listener);this.loadTimer=setTimeout(()=>{if(serial!==this.serial)return;this.stop();this.onState('unavailable');},1800);}
 }
}
