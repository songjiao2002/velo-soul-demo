// Keep fractional sample boundaries between microphone batches (44.1/48 kHz).
export function createPcm16Encoder(){
 let phase=0,sum=0,lastRate;
 return (samples,rate)=>{
  if(lastRate!==rate){phase=sum=0;lastRate=rate;}
  const out=new Uint8Array((Math.ceil(samples.length*16000/rate)+2)*2),view=new DataView(out.buffer);let offset=0;
  for(const sample of samples){let remaining=16000/rate;while(remaining>1e-9){const amount=Math.min(1-phase,remaining);sum+=sample*amount;phase+=amount;remaining-=amount;if(phase>=1-1e-9){const value=Math.max(-1,Math.min(1,sum));view.setInt16(offset,Math.round(value*(value<0?32768:32767)),true);offset+=2;phase=sum=0;}}}
  return out.slice(0,offset);
 };
}
export class StreamingTranscriber {
 constructor({Socket,url,onPartial,onFinal,onUnavailable,setTimer=(...a)=>globalThis.setTimeout(...a),clearTimer=(...a)=>globalThis.clearTimeout(...a)}){
  Object.assign(this,{onPartial,onFinal,onUnavailable,setTimer,clearTimer});this.queue=[];this.queuedBytes=0;this.encode=createPcm16Encoder();
  try{this.socket=new Socket(url);}catch{this.setTimer(()=>this.fail(),0);return;}
  this.timer=setTimer(()=>this.fail(),6000);
  this.socket.onopen=()=>{if(this.closed)return;for(const bytes of this.queue)this.send(bytes);this.queue=[];this.queuedBytes=0;if(this.finishing)this.send(JSON.stringify({type:'finish'}));};
  this.socket.onmessage=event=>{
   if(this.closed)return;let message;try{message=JSON.parse(event.data);}catch{return this.fail();}
   if(message.type==='ready'){this.clearTimer(this.timer);if(this.finishing)this.timer=this.setTimer(()=>this.fail(),10000);}
   else if(message.type==='partial'&&typeof message.text==='string')this.onPartial(message.text.slice(0,1000));
   else if(message.type==='final'&&typeof message.text==='string'){this.close();this.onFinal(message.text.slice(0,1000));}
   else if(message.type==='error')this.fail(message.error);
  };
  this.socket.onerror=()=>this.fail();this.socket.onclose=()=>{if(!this.closed)this.fail();};
 }
 send(data){if(this.closed)return;if(this.socket.bufferedAmount>131072)return this.fail();try{this.socket.send(data);}catch{this.fail();}}
 write(samples,rate){
  if(this.closed||this.finishing)return;const bytes=this.encode(samples,rate);if(!bytes.length)return;
  if(this.socket?.readyState===1)this.send(bytes);else{this.queue.push(bytes);this.queuedBytes+=bytes.length;if(this.queuedBytes>192000)this.fail();}
 }
 finish(){if(this.closed||this.finishing)return;this.finishing=true;this.clearTimer(this.timer);this.timer=this.setTimer(()=>this.fail(),10000);if(this.socket?.readyState===1)this.send(JSON.stringify({type:'finish'}));}
 fail(error='network'){if(this.closed)return;this.close();this.onUnavailable(error);}
 close(){this.closed=true;this.clearTimer(this.timer);this.queue=[];this.queuedBytes=0;const socket=this.socket;if(socket){socket.onopen=socket.onmessage=socket.onerror=socket.onclose=null;try{socket.close();}catch{}}}
}
