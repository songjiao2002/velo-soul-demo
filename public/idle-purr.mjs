// A quiet nonverbal idle sound, synthesized locally: no model call or text turn.
export class IdlePurr {
 constructor({session,canPlay,now=Date.now,random=Math.random}){Object.assign(this,{session,canPlay,now,random});this.lastActivity=now();this.nextAt=0;}
 activity(){this.lastActivity=this.now();this.stop();}
 stop(){const source=this.source;this.source=null;if(source){try{source.stop();}catch{}source.disconnect();}}
 tick(){
  const now=this.now();
  if(!this.canPlay()){this.activity();return;}
  if(this.source||now-this.lastActivity<30000||now<this.nextAt)return;
  const context=this.session.context;if(context?.state!=='running')return;
  this.nextAt=now+75000+this.random()*30000;
  try{
   const length=Math.floor(context.sampleRate*.65),buffer=context.createBuffer(1,length,context.sampleRate),pcm=buffer.getChannelData(0);
   for(let i=0;i<length;i++){
    const t=i/context.sampleRate,fade=Math.sin(Math.PI*i/length)**2;
    const flutter=.6+.4*Math.sin(2*Math.PI*24*t);
    pcm[i]=.018*fade*flutter*(Math.sin(2*Math.PI*105*t)+.25*Math.sin(2*Math.PI*210*t));
   }
   const source=context.createBufferSource();source.buffer=buffer;source.connect(this.session.getOutput());this.source=source;
   source.onended=()=>{source.disconnect();if(this.source===source)this.source=null;};source.start();
  }catch{this.stop();}
 }
}
