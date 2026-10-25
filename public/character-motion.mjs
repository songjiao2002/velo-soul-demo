import {CHARACTERS} from './character-art.mjs';
const validSpeed=n=>Number.isFinite(n)&&n>=0&&n<90;
// GPS speed is km/h. Hysteresis keeps a red light / noisy fix from repeatedly
// making the companion get on and off. No fix means unknown, not asleep.
export class CharacterMotion{
 constructor({now=Date.now,onChange=()=>{}}={}){Object.assign(this,{now,onChange});this.reset();}
 reset(){this.state='idle';this.speed=null;this.lastAt=null;this.lowSince=null;this.highSince=null;this.entranceUntil=0;}
 snapshot(){return {state:this.state,speed:this.speed,pace:this.speed>=22?'fast':this.speed>=10?'normal':'slow'};}
 emit(state){this.state=state;this.onChange(this.snapshot());return this.snapshot();}
 enter(soul){this.entranceUntil=this.now()+(soul==='mori'?3600:2400);this.emit('greeting');}
 sample(speed,{accuracy=0,time=this.now()}={}){
  const now=this.now();
  if(!validSpeed(speed)||!Number.isFinite(accuracy)||accuracy>40||accuracy<0||!Number.isFinite(time)||now-time>10000||time-now>5000){this.speed=null;this.lastAt=null;this.lowSince=null;this.highSince=null;return this.tick();}
  if(this.lastAt!==null&&time<=this.lastAt)return this.snapshot();
  this.speed=speed;this.lastAt=time;
  if(speed>=4){this.highSince??=now;this.lowSince=null;}
  else if(speed<=1.5){this.lowSince??=now;this.highSince=null;}
  else{this.lowSince=null;this.highSince=null;}
  return this.tick();
 }
 tick(){
  const now=this.now();
  if(now<this.entranceUntil)return this.emit('greeting');
  if(this.lastAt===null||now-this.lastAt>15000){this.speed=null;this.lowSince=null;this.highSince=null;return this.emit('idle');}
  if(this.speed>=4&&now-this.highSince>=1500)return this.emit('riding');
  if(this.speed<=1.5&&now-this.lowSince>=8000)return this.emit('resting');
  return this.emit(this.state==='greeting'?'idle':this.state);
 }
 pause(){this.entranceUntil=0;this.lastAt=null;this.speed=null;this.lowSince=null;this.highSince=null;return this.emit('idle');}
}
export function paintCharacterMotion(root,snapshot,language='ko'){
 for(const el of root.querySelectorAll('.character-puppet')){
  // Homepage illustrations are static; only companion puppets track motion.
  const activity=snapshot.state||'idle';if(el.dataset.activity!==activity)el.dataset.activity=activity;
  if(el.dataset.pace!==snapshot.pace)el.dataset.pace=snapshot.pace||'slow';
  const c=CHARACTERS[el.dataset.soul],rest=c?.rest[language]||c?.rest.en;
  const label=activity==='resting'?rest:activity==='riding'?({ko:'함께 자전거를 타요',en:'Riding together',zh:'一起骑自行车'})[language]:({ko:'곁에 있어요',en:'Right here with you',zh:'就在你身边'})[language];
  const name=language==='ko'?c?.name:language==='zh'?c?.zh:c?.en;
  const aria=`${name} · ${label}`;if(el.getAttribute('aria-label')!==aria)el.setAttribute('aria-label',aria);
 }
 for(const el of root.querySelectorAll('[data-character-speed]')){
  const value=validSpeed(snapshot.speed)?snapshot.speed.toFixed(1):'—';if(el.textContent!==value)el.textContent=value;
 }
}
