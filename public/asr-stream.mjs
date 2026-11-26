import {MAX_MESSAGE_LENGTH} from './conversation-limits.mjs';
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
// Prepare the app connection while the mic is listening. Only the active
// transcriber can start a provider task or write any audio.
export function prepareStandby(Socket,url,setTimer,clearTimer){
 let socket;
 try{socket=new Socket(url);}catch{return null;}
 const timer=setTimer(close,35000);
 function detach(){
  clearTimer(timer);
  if(socket)socket.onclose=socket.onerror=null;
  const current=socket;socket=null;return current;
 }
 function close(){
  const current=detach();
  if(current?.readyState===0)current.onerror=()=>{};
  try{current?.close();}catch{}
 }
 socket.onclose=detach;socket.onerror=close;
 return {close,get available(){return Boolean(socket&&socket.readyState<=1);},take(){
  if(socket&&socket.readyState<=1)return detach();
  close();return null;
 }};
}
export class StreamingTranscriber {
 constructor({Socket,url,preparedSocket,onPartial,onFinal,onUnavailable,setTimer=(...a)=>globalThis.setTimeout(...a),clearTimer=(...a)=>globalThis.clearTimeout(...a)}){
  Object.assign(this,{onPartial,onFinal,onUnavailable,setTimer,clearTimer});this.queue=[];this.queuedBytes=0;this.encode=createPcm16Encoder();
  this.needsActivation=Boolean(preparedSocket);
  this.timer=setTimer(()=>this.fail(),6000);
  const onOpen=()=>{if(this.closed)return;for(const bytes of this.queue)this.sendAudio(bytes);this.queue=[];this.queuedBytes=0;if(this.finishing)this.send(JSON.stringify({type:'finish'}));};
  const onMessage=event=>{
   if(this.closed)return;let message;try{message=JSON.parse(event.data);}catch{return this.fail();}
   if(!message||typeof message!=='object'||Array.isArray(message))return this.fail();
   if(message.type==='ready'){this.clearTimer(this.timer);if(this.finishing)this.timer=this.setTimer(()=>this.fail(),10000);}
   else if(message.type==='partial'&&typeof message.text==='string')this.onPartial(message.text.slice(0,MAX_MESSAGE_LENGTH));
   else if(message.type==='final'&&typeof message.text==='string'){this.close();this.onFinal(message.text.slice(0,MAX_MESSAGE_LENGTH));}
   else if(message.type==='error')this.fail(typeof message.error==='string'?message.error:'network',message.retryAfter);
   else this.fail();
  };
  const attach=socket=>{
   this.socket=socket;socket.onopen=onOpen;socket.onmessage=onMessage;
   socket.onclose=socket.onerror=()=>{
    if(this.closed||this.socket!==socket)return;
    if(!this.needsActivation)return this.fail();
    // A previous server version or a network change can close standby before
    // any audio left the browser. Carry the same queued PCM to the live route.
    this.needsActivation=false;
    socket.onopen=socket.onclose=socket.onmessage=socket.onerror=null;
    try{socket.close();attach(new Socket(url));}catch{this.fail();}
   };
  };
  try{attach(preparedSocket||new Socket(url));}catch{this.setTimer(()=>this.fail(),0);}
 }
 send(data){if(this.closed)return;if(this.socket.bufferedAmount>131072)return this.fail();try{this.socket.send(data);}catch{this.fail();}}
 sendAudio(bytes){
  if(this.needsActivation){this.needsActivation=false;this.send(JSON.stringify({type:'start'}));}
  // A large capture callback must still fit the relay's 16 KiB frame limit.
  for(let offset=0;offset<bytes.length&&!this.closed;offset+=16384)this.send(bytes.subarray(offset,offset+16384));
 }
 writeBuffered(chunks,rate){
  // These samples already exist. Send the pre-roll now in 100 ms batches,
  // without delaying the first packet or holding any subsequent live frame.
  const batchSize=Math.max(1,Math.round(rate*.1));
  const batch=new Float32Array(batchSize);
  let filled=0;
  for(const chunk of chunks){
   let offset=0;
   while(offset<chunk.length&&!this.closed){
    const count=Math.min(batchSize-filled,chunk.length-offset);
    batch.set(chunk.subarray(offset,offset+count),filled);
    filled+=count;offset+=count;
    if(filled===batchSize){this.write(batch,rate);filled=0;}
   }
  }
  if(filled)this.write(batch.subarray(0,filled),rate);
 }
 write(samples,rate){
  if(this.closed||this.finishing)return;const bytes=this.encode(samples,rate);if(!bytes.length)return;
  if(this.socket?.readyState===1)this.sendAudio(bytes);else{this.queue.push(bytes);this.queuedBytes+=bytes.length;if(this.queuedBytes>192000)this.fail();}
 }
 finish(){if(this.closed||this.finishing)return;this.finishing=true;this.clearTimer(this.timer);this.timer=this.setTimer(()=>this.fail(),10000);if(this.socket?.readyState===1)this.send(JSON.stringify({type:'finish'}));}
 fail(error='network',retryAfter){if(this.closed)return;this.close();this.onUnavailable(error,retryAfter);}
 close(){this.closed=true;this.clearTimer(this.timer);this.queue=[];this.queuedBytes=0;const socket=this.socket;if(socket){socket.onopen=socket.onmessage=socket.onclose=null;socket.onerror=socket.readyState===0?()=>{}:null;try{socket.close();}catch{}}}
}
