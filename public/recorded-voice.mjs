import {SOUL_INTRO,introductionClip} from './soul-intro.mjs';
import {SCENARIOS} from './soul-core.mjs';

export const VOICE_PROFILES={
 lumi:{locale:'en-US',label:'EN · 미국식 영어 · 가볍고 호기심 있게'},
 mori:{locale:'en-GB',label:'EN · 영국식 영어 · 느긋하고 부드럽게'},
 bori:{locale:'en-US',label:'EN · 미국식 영어 · 따뜻하고 신나게'}
};
export const BASE_KEYS=['hello','start','during','pause','end'];
export function voiceFile(language,id,key,line){
 if(!Object.hasOwn(VOICE_PROFILES,id))return null;
 if(key==='hello'&&['ko','en'].includes(language))return introductionClip(SOUL_INTRO[id][language],id,language);
 if(language==='ko')return BASE_KEYS.includes(key)?`audio/${id}-${key}.mp3`:null;
 if(language!=='en')return null;
 const scene=SCENARIOS[id].find(s=>s.line===line);
 const resolved=BASE_KEYS.includes(key)?key:scene&&(scene.audio||scene.id);
 return resolved?`audio/en/${id}-${resolved}.wav?v=20261014-complete`:null;
}

// Packaged audio is independent of installed OS/browser speech voices.
export class RecordedVoicePlayer {
 constructor({audio,onState=()=>{},timeout=15000}){this.audio=audio;this.onState=onState;this.timeout=timeout;this.serial=0;this.timer=null;}
 stop(){
  this.serial++;clearTimeout(this.timer);this.timer=null;
  this.audio.onplaying=this.audio.onended=this.audio.onerror=null;
  // Do not touch the native media session between cloud voice turns when
  // this element is idle; load()/pause() can relinquish Android audio focus.
  if(this.audio.getAttribute?.('src')||this.audio.src){this.audio.pause();this.audio.removeAttribute('src');this.audio.load();}
 }
 play(src){
  this.stop();const serial=this.serial,a=this.audio;
  const report=state=>{if(serial===this.serial)this.onState(state);};
  const fail=state=>{if(serial!==this.serial)return;this.stop();this.onState(state);};
  a.src=src;a.muted=false;a.volume=1;a.playbackRate=1;
  a.onplaying=()=>{if(serial!==this.serial)return;clearTimeout(this.timer);report('playing');};
  a.onended=()=>{if(serial!==this.serial)return;clearTimeout(this.timer);report('ended');};
  a.onerror=()=>fail('error');
  this.timer=setTimeout(()=>fail('timeout'),this.timeout);
  report('loading');
  // Invoke play in the original click handler, before any await.
  try{Promise.resolve(a.play()).catch(e=>fail(e.name==='NotAllowedError'?'blocked':'error'));}catch(e){fail(e.name==='NotAllowedError'?'blocked':'error');}
 }
}
