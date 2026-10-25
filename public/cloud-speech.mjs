import {appFetch} from './app-network.mjs';
import {NativeSpeechPlayer} from './native-speech.mjs';
import {SpeechMouthClock} from './speech-mouth.mjs';
import {SpeechAudioCache} from './speech-cache.mjs';
// Dynamic replies use real audio, independent of installed speechSynthesis voices.
export function speechChunks(text,limit=540){
 const chars=Array.from(text.replace(/[\p{Extended_Pictographic}\uFE0F]/gu,'').trim()),parts=[];
 while(chars.length){let n=Math.min(limit,chars.length);if(n<chars.length){const part=chars.slice(0,n).join(''),boundary=Math.max(part.lastIndexOf('. '),part.lastIndexOf('? '),part.lastIndexOf('! '),part.lastIndexOf('。'),part.lastIndexOf(' '));if(boundary>limit/2)n=Array.from(part.slice(0,boundary+1)).length;}const part=chars.splice(0,n).join('').trim();if(part)parts.push(part);}
 return parts;
}
export class CloudSpeechPlayer {
 constructor({onMouth,audioSession,Context=globalThis.AudioContext||globalThis.webkitAudioContext,fetchImpl=appFetch,setTimer=(...args)=>globalThis.setTimeout(...args),clearTimer=(...args)=>globalThis.clearTimeout(...args)}={}){Object.assign(this,{audioSession,Context,fetchImpl,setTimer,clearTimer});this.serial=0;this.cache=new SpeechAudioCache();this.preloads=new Map();this.mouth=onMouth?new SpeechMouthClock({onFrame:onMouth}):null;this.mediaMouthCache=new Map();this.native=new NativeSpeechPlayer({fetchImpl,setTimer,clearTimer,mouth:this.mouth,decode:bytes=>(this.context||audioSession?.context)?.decodeAudioData(bytes)});if(audioSession)audioSession.nativeSpeech=this.native;}
 preload(text,{language='en',soul='lumi',source}={}){
  if(this.audioSession?.playbackMode==='media')return this.native.preload(text,{language,soul,source});
  const key=JSON.stringify([text,language,soul]);if(this.cache.has(key))return Promise.resolve(null);if(this.preloads.has(key))return this.preloads.get(key).promise;
  const controller=new AbortController(),entry={controller,dynamic:!source};
  const timer=this.setTimer(()=>controller.abort(),source?3000:8000);
  entry.promise=(async()=>{
   try{
    const response=await this.fetchImpl(source||'/api/speech',{signal:controller.signal,...(source?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,language,soul})})});
    if(!response.ok||Number(response.headers.get('content-length'))>4000000)throw Error('audio');
    const bytes=await response.arrayBuffer();if(bytes.byteLength<44||bytes.byteLength>4000000)throw Error('audio');
    return bytes;
   }catch{return null;}finally{this.clearTimer(timer);}
  })();
  this.preloads.set(key,entry);
  while(this.preloads.size>8){const oldest=this.preloads.keys().next().value;this.preloads.get(oldest).controller.abort();this.preloads.delete(oldest);}
  return entry.promise;
 }
 cancelPrefetches(){this.native.cancelPrefetches();for(const [key,entry] of this.preloads)if(entry.dynamic){entry.controller.abort();this.preloads.delete(key);}}
 prepare(){
  if(this.audioSession?.playbackMode==='media')return this.native.prepare();
  try{
   if(!this.Context)return Promise.resolve(false);
   if(!this.context||this.context.state==='closed')this.context=this.audioSession?.getContext()||new this.Context();
   const context=this.context;
   // Unlock the actual playback graph during the initial user gesture.
   if(this.unlockedContext!==context){const pulse=context.createBufferSource();pulse.buffer=context.createBuffer(1,1,context.sampleRate);pulse.connect(this.audioSession?.getOutput()||context.destination);pulse.start();pulse.onended=()=>pulse.disconnect();this.unlockedContext=context;}
   if(context.state==='running')return Promise.resolve(true);
   return Promise.resolve(context.resume()).then(()=>context.state==='running',()=>false);
  }catch{return Promise.resolve(false);}
 }
 stop(){this.serial++;this.native.stop();this.mouth?.stop();this.controller?.abort();this.controller=null;this.streamStop?.();this.clearTimer(this.timer);this.clearTimer(this.playTimer);if(this.source){this.source.onended=null;try{this.source.stop();this.source.disconnect();}catch{}this.source=null;}this.finishPlayback?.();this.finishPlayback=null;}
 async playStream(response,{soul,valid,report,received}){
  const context=this.context,reader=response.body.getReader(),decoder=new TextDecoder(),nodes=new Set();
  const rate=soul==='mori'?.94:soul==='bori'?1.04:1;
  let pending='',bytes=0,carry=null,done=false,played=false,next=context.currentTime+.08,tailTimer,resolveTail,mouthToken;
  let samplesToCache=[],sampleCount=0;
  const tail=new Promise(resolve=>resolveTail=resolve);
  const cleanup=()=>{if(mouthToken!==undefined)this.mouth?.stop(mouthToken);this.clearTimer(tailTimer);reader.cancel().catch(()=>{});for(const source of nodes){source.onended=null;try{source.stop();source.disconnect();}catch{}}nodes.clear();resolveTail();if(this.streamStop===cleanup)this.streamStop=null;};
  this.streamStop=cleanup;
  const frame=value=>{
   const data=JSON.parse(value);if(data.error||done)throw new Error('invalid_audio');
   if(data.done){done=true;return;}
   if(data.rate!==24000||typeof data.audio!=='string'||!data.audio||data.audio.length>6000000)throw new Error('invalid_audio');
   const binary=globalThis.atob(data.audio);bytes+=binary.length;if(bytes>4000000)throw new Error('invalid_audio');
   const pcm=new Uint8Array(binary.length+(carry===null?0:1));let at=0;if(carry!==null)pcm[at++]=carry;for(const char of binary)pcm[at++]=char.charCodeAt(0);
   carry=pcm.length%2?pcm.at(-1):null;const count=Math.floor(pcm.length/2);if(!count)return;
   const buffer=context.createBuffer(1,count,24000),samples=buffer.getChannelData(0),view=new DataView(pcm.buffer);
   for(let i=0;i<count;i++)samples[i]=view.getInt16(i*2,true)/32768;
   sampleCount+=count;
   if(sampleCount*4>this.cache.maxBytes)samplesToCache=null;
   else samplesToCache?.push(samples);
   const source=context.createBufferSource();source.buffer=buffer;source.playbackRate.value=rate;source.connect(this.audioSession?.getOutput()||context.destination);nodes.add(source);
   source.onended=()=>{source.onended=null;source.disconnect();nodes.delete(source);if(done&&!nodes.size)resolveTail();};
   next=Math.max(next,context.currentTime+.03);if(!played)mouthToken=this.mouth?.begin(()=>context.state==='running'?context.currentTime:null,soul);this.mouth?.enqueue(samples,24000,next,rate,mouthToken);source.start(next);next+=count/24000/rate;
   if(!played){played=true;report('playing');}
  };
  try{
   while(valid()&&!done){
    const chunk=await reader.read();if(!valid())return;if(chunk.done)break;
    pending+=decoder.decode(chunk.value,{stream:true});if(pending.length>6000000)throw new Error('invalid_audio');
    let end;while((end=pending.indexOf('\n'))!==-1){const value=pending.slice(0,end).trim();pending=pending.slice(end+1);if(value)frame(value);}
   }
   pending+=decoder.decode();if(pending.trim())frame(pending.trim());
   if(!valid())return;if(!done||!played||carry!==null)throw new Error('incomplete_audio');
   received();reader.cancel().catch(()=>{});if(!nodes.size)resolveTail();
   let timedOut=false;tailTimer=this.setTimer(()=>{timedOut=true;cleanup();},Math.max(0,next-context.currentTime)*1000+8000);
   await tail;if(timedOut)throw new Error('playback_timeout');
   // Cache only a complete, successfully played stream; never a cancelled reply.
   if(valid()&&samplesToCache){
    const buffer=context.createBuffer(1,sampleCount,24000),samples=buffer.getChannelData(0);let offset=0;
    for(const chunk of samplesToCache){samples.set(chunk,offset);offset+=chunk.length;}
    return buffer;
   }
  }finally{cleanup();reader.releaseLock();}
 }
 async speak(text,{language='en',soul='lumi',source,onState=()=>{}}={}){
  this.stop();const serial=this.serial,valid=()=>serial===this.serial,report=state=>{if(valid())onState(state);};
  const parts=speechChunks(text);if(!parts.length){report('ended');return;}
  report('loading');
  if(this.audioSession?.playbackMode==='media')return this.native.speak(parts,{language,soul,source,report});
  if(!this.context){report('blocked');return;}
  if(this.context.state!=='running'){
   let resumeTimer;
   try{await Promise.race([this.audioSession?.inputs.size?this.audioSession.recover():this.context.resume(),new Promise(resolve=>{resumeTimer=this.setTimer(resolve,this.audioSession?.inputs.size?10000:1500);})]);}catch{}finally{this.clearTimer(resumeTimer);}
   if(!valid())return;
   if(this.context.state!=='running'){report('blocked');return;}
  }
  const context=this.context,controller=new AbortController();this.controller=controller;let fetchTimer;
  try{
   for(const part of parts){
    if(!valid())return;
    const key=JSON.stringify([part,language,soul]);let buffer=this.cache.get(key);
    if(!buffer&&(source||this.preloads.has(key))){
     const bytes=await (this.preloads.get(key)?.promise||this.preload(part,{language,soul,source}));if(!valid())return;
     if(bytes){try{buffer=await context.decodeAudioData(bytes.slice(0));}catch{}if(!valid())return;}
     if(buffer)this.cache.set(key,buffer);
    }
    if(!buffer){
     fetchTimer=this.timer=this.setTimer(()=>controller.abort(),35000);
     const response=await this.fetchImpl('/api/speech/stream',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({text:part,language,soul})});
     if(!response.ok)throw new Error('speech_unavailable');
     if(!valid()){response.body?.cancel().catch(()=>{});return;}
     if(response.headers.get('content-type')?.includes('application/x-ndjson')){
      const completed=await this.playStream(response,{soul,valid,report,received:()=>this.clearTimer(fetchTimer)});
      if(completed&&valid())this.cache.set(key,completed);continue;
     }
     const bytes=await response.arrayBuffer();if(!valid())return;
     if(bytes.byteLength>4000000)throw new Error('invalid_audio');
     buffer=await context.decodeAudioData(bytes);this.clearTimer(fetchTimer);
     if(!valid())return;
     this.cache.set(key,buffer);
    }
    if(context.state!=='running'){report('blocked');return;}
    await new Promise((resolve,reject)=>{
     const source=context.createBufferSource();this.source=source;source.buffer=buffer;
     source.playbackRate.value=soul==='mori'?.94:soul==='bori'?1.04:1;source.connect(this.audioSession?.getOutput()||context.destination);
     let playTimer,mouthToken;
     const finish=()=>{if(mouthToken!==undefined)this.mouth?.stop(mouthToken);this.clearTimer(playTimer);source.onended=null;source.disconnect();if(this.source===source)this.source=null;if(this.finishPlayback===finish)this.finishPlayback=null;resolve();};
     this.finishPlayback=finish;source.onended=finish;
     playTimer=this.playTimer=this.setTimer(()=>{source.onended=null;reject(new Error('playback_timeout'));try{source.stop();}catch{}finish();},Math.ceil(buffer.duration/source.playbackRate.value*1000)+8000);
     try{mouthToken=this.mouth?.begin(()=>context.state==='running'?context.currentTime:null,soul);this.mouth?.enqueue(buffer.getChannelData?.(0),buffer.sampleRate||context.sampleRate,context.currentTime,source.playbackRate.value,mouthToken);source.start();report('playing');}catch(error){if(mouthToken!==undefined)this.mouth?.stop(mouthToken);this.clearTimer(this.playTimer);reject(error);}
    });
   }
   report('ended');
  }catch(error){if(valid())report(this.context?.state!=='running'?'blocked':'unavailable');}
  finally{this.clearTimer(fetchTimer);if(this.timer===fetchTimer)this.timer=null;if(this.controller===controller)this.controller=null;}
 }
 // Analyse packaged HTML audio without rerouting or delaying its playback.
 async followMedia(audio,src,soul){
  if(!this.mouth||!this.context)return;const serial=this.serial,valid=()=>serial===this.serial;
  const controller=new AbortController();this.controller=controller;
  const timer=this.setTimer(()=>controller.abort(),5000);
  try{
   let buffer=this.mediaMouthCache.get(src);
   if(!buffer){const response=await this.fetchImpl(src,{signal:controller.signal});if(!response.ok||Number(response.headers.get('content-length'))>4000000)return;const bytes=await response.arrayBuffer();if(!valid()||bytes.byteLength>4000000)return;buffer=await this.context.decodeAudioData(bytes);if(!valid())return;this.mediaMouthCache.set(src,buffer);while(this.mediaMouthCache.size>8)this.mediaMouthCache.delete(this.mediaMouthCache.keys().next().value);}
   if(!valid()||audio.ended)return;
   const token=this.mouth.begin(()=>audio.paused||audio.ended||audio.readyState<3?null:audio.currentTime,soul);
   this.mouth.enqueue(buffer.getChannelData?.(0),buffer.sampleRate||this.context.sampleRate,0,1,token);
  }catch{/* A failed animation decode leaves the original audio untouched. */}
  finally{this.clearTimer(timer);if(this.controller===controller)this.controller=null;}
 }
 dispose(){this.stop();this.native.dispose();this.cache.clear();this.mediaMouthCache.clear();for(const entry of this.preloads.values())entry.controller.abort();this.preloads.clear();const context=this.context;this.context=null;if(context&&!this.audioSession)context.close().catch(()=>{});}
}
