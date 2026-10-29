import {CHARACTERS} from './character-art.mjs';
import {distance} from './soul-core.mjs';
const validSpeed=n=>Number.isFinite(n)&&n>=0&&n<90;
// A five-second entrance is presentation only. After it, missing/weak GPS
// never implies movement. Brief hysteresis filters stationary GPS jitter.
export class CharacterMotion{
 constructor({now=Date.now,onChange=()=>{}}={}){Object.assign(this,{now,onChange});this.reset();}
 reset(){this.rideMode=false;this.state='idle';this.speed=null;this.lastAt=null;this.lowSince=null;this.highSince=null;this.entranceUntil=0;this.rideEntranceUntil=0;this.positions=[];}
 // The ride animation is presentation, never a fabricated GPS measurement.
 snapshot(){return {state:this.state,speed:this.speed,animationSpeed:this.state==='riding'?(this.now()<this.rideEntranceUntil?12:validSpeed(this.speed)?this.speed:0):0,pace:this.speed>=22?'fast':this.speed>=10?'normal':'slow'};}
 fallback(){return this.rideMode?'resting':'idle';}
 setRideMode(active){if(this.rideMode===!!active)return this.snapshot();this.rideMode=!!active;this.rideEntranceUntil=active?this.now()+5000:0;return this.pause();}
 emit(state){this.state=state;this.onChange(this.snapshot());return this.snapshot();}
 enter(soul){if(this.rideMode)return this.tick();this.entranceUntil=this.now()+(soul==='mori'?3600:2400);return this.emit('greeting');}
 position(point,speed){
  const now=this.now();
  if(!point||![point.lat,point.lon,point.time,point.accuracy].every(Number.isFinite)||Math.abs(point.lat)>90||Math.abs(point.lon)>180||point.accuracy<0||point.accuracy>40||now-point.time>10000||point.time-now>5000){this.positions=[];return this.sample(null);}
  if(this.positions.at(-1)?.time>=point.time)return this.snapshot();
  this.positions=this.positions.filter(p=>point.time-p.time<=8000);this.positions.push(point);this.positions=this.positions.slice(-16);
  if(!validSpeed(speed)){
   const from=this.positions.find(p=>point.time-p.time>=2000),dt=from?(point.time-from.time)/1000:0;
   const meters=from?distance(from,point):0;
   // Browsers may omit coords.speed. Infer movement only beyond the accuracy
   // envelope; small location changes while stationary are not a bike ride.
   speed=dt?meters>Math.max(4,from.accuracy,point.accuracy)?meters/dt*3.6:0:null;
  }
  return this.sample(speed,{accuracy:point.accuracy,time:point.time});
 }
 sample(speed,{accuracy=0,time=this.now()}={}){
  const now=this.now();
  if(!validSpeed(speed)||!Number.isFinite(accuracy)||accuracy>40||accuracy<0||!Number.isFinite(time)||now-time>10000||time-now>5000){this.speed=null;this.lastAt=null;this.lowSince=null;this.highSince=null;return this.tick();}
  if(this.lastAt!==null&&time<=this.lastAt)return this.snapshot();
  this.speed=speed;this.lastAt=time;
  if(speed>=2.5){this.highSince??=now;this.lowSince=null;}
  else if(speed<=1.5){this.lowSince??=now;this.highSince=null;}
  else{this.lowSince=null;this.highSince=null;}
  return this.tick();
 }
 tick(){
  const now=this.now();
  if(this.rideMode&&now<this.rideEntranceUntil)return this.emit('riding');
  if(now<this.entranceUntil)return this.emit('greeting');
  if(this.lastAt===null||now-this.lastAt>8000){this.speed=null;this.lowSince=null;this.highSince=null;return this.emit(this.fallback());}
  if(this.speed>=2.5&&now-this.highSince>=1000)return this.emit('riding');
  if(this.speed<=1.5&&now-this.lowSince>=2000)return this.emit('resting');
  if(this.rideMode&&this.state==='riding'&&this.highSince===null)return this.emit('resting');
  return this.emit(this.state==='greeting'?this.fallback():this.state);
 }
 pause(){this.entranceUntil=0;this.lastAt=null;this.speed=null;this.lowSince=null;this.highSince=null;this.positions=[];return this.tick();}
}
export function paintCharacterMotion(root,snapshot,language='ko'){
 for(const el of root.querySelectorAll('.character-puppet')){
  // Homepage illustrations are static; only companion puppets track motion.
  const activity=snapshot.state||'idle';if(el.dataset.activity!==activity)el.dataset.activity=activity;
  el.dataset.speed=String(snapshot.speed??0);
  el.dataset.animationSpeed=String(snapshot.animationSpeed??snapshot.speed??0);
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
