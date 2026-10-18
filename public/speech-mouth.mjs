const clamp=(value,lo=0,hi=1)=>Math.min(hi,Math.max(lo,value));
// Audio energy and spectral roughness drive an expressive approximation, not
// phoneme labels. Work is linear in each newly received chunk, never repeated.
export function analyseMouth(samples,sampleRate){
 const size=Math.max(1,Math.round(sampleRate*.02)),frames=[];
 for(let at=0;at<samples.length;at+=size){let energy=0,crossings=0;const end=Math.min(samples.length,at+size);
  for(let i=at;i<end;i++){const value=samples[i];energy+=value*value;if(i>at&&(value>=0)!==(samples[i-1]>=0))crossings++;}
  const rms=Math.sqrt(energy/(end-at));const open=rms<.008?0:Math.pow(clamp((rms-.008)/.17),.65);
  // A narrow/rounded shape for smoother sounds, wider for brighter sounds.
  const round=clamp(1-crossings/Math.max(1,end-at-1)/.22)*.8;
  frames.push({open,round});
 }
 return {frames,step:size/sampleRate,duration:samples.length/sampleRate};
}
export class SpeechMouthClock {
 constructor({onFrame=()=>{},requestFrame=fn=>globalThis.requestAnimationFrame?.(fn),cancelFrame=id=>globalThis.cancelAnimationFrame?.(id)}={}){Object.assign(this,{onFrame,requestFrame,cancelFrame});this.serial=0;this.segments=[];}
 begin(clock,soul){
  this.stop();const token=this.serial;this.clock=clock;this.soul=soul;this.active=true;this.open=0;this.round=.4;this.previous=null;this.lastWall=-Infinity;
  this.emit({active:true,open:0,round:.4,soul});this.frame=this.requestFrame(time=>this.tick(time,token));return token;
 }
 enqueue(samples,sampleRate,start,rate=1,token=this.serial){
  if(!this.active||token!==this.serial||!samples?.length||!Number.isFinite(start))return;
  const analysis=analyseMouth(samples,sampleRate);this.segments.push({...analysis,start,end:start+analysis.duration/rate,rate});
 }
 tick(wall,token){
  if(!this.active||token!==this.serial)return;
  if(wall-this.lastWall>=24){
   this.lastWall=wall;const now=this.clock();let target={open:0,round:.4};
   if(Number.isFinite(now)){
    while(this.segments.length&&this.segments[0].end<=now)this.segments.shift();
    const segment=this.segments.find(s=>now>=s.start&&now<s.end);
    if(segment)target=segment.frames[Math.min(segment.frames.length-1,Math.floor((now-segment.start)*segment.rate/segment.step))];
   }
   const elapsed=Number.isFinite(now)&&Number.isFinite(this.previous)?clamp(now-this.previous,.016,.1):.033;this.previous=now;
   this.open+=(target.open-this.open)*(1-Math.exp(-elapsed/(target.open > this.open ? .025 : .055)));
   this.round+=(target.round-this.round)*(1-Math.exp(-elapsed/.06));
   // Close immediately during an actual silent frame or a network playback gap.
   if(!target.open)this.open=0;
   this.emit({active:true,open:this.open,round:this.round,soul:this.soul});
  }
  this.frame=this.requestFrame(time=>this.tick(time,token));
 }
 emit(frame){try{this.onFrame(frame);}catch{/* Decorative animation must never interrupt audio. */}}
 stop(token){
  if(token!==undefined&&token!==this.serial)return;
  this.serial++;if(this.frame!==undefined)this.cancelFrame(this.frame);this.frame=undefined;this.active=false;this.segments=[];
  this.emit({active:false,open:0,round:.4,soul:this.soul});
 }
}
