import {appFetch} from './app-network.mjs';
// Optional media-element playback for browsers whose Web Audio route is wrong.
// It uses complete WAV responses, trading first-audio latency for a different
// playback path. It cannot select Bluetooth when the host app forbids it.
export class NativeSpeechPlayer {
 constructor({document=globalThis.document,URL=globalThis.URL,fetchImpl=appFetch,setTimer=(...a)=>globalThis.setTimeout(...a),clearTimer=(...a)=>globalThis.clearTimeout(...a),mouth,decode}={}){
  Object.assign(this,{URL,fetchImpl,setTimer,clearTimer,mouth,decode});this.serial=0;this.cache=new Map();this.preloads=new Map();this.bytes=0;
  this.audio=document?.createElement?.('audio');if(this.audio){this.audio.preload='auto';this.audio.setAttribute('playsinline','');}
 }
 prepare(){
  if(!this.audio)return Promise.resolve(false);if(this.prepared||this.playing)return Promise.resolve(true);
  // A short silent WAV unlocks this same element in the original user gesture.
  const bytes=new Uint8Array(46),v=new DataView(bytes.buffer),text=(at,s)=>[...s].forEach((c,i)=>bytes[at+i]=c.charCodeAt(0));
  text(0,'RIFF');v.setUint32(4,38,true);text(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,2,true);
  this.clearSource();this.objectURL=this.URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));this.audio.src=this.objectURL;
  try{return Promise.resolve(this.audio.play()).then(()=>{this.prepared=true;return true;},()=>false);}catch{return Promise.resolve(false);}
 }
 clearSource(){if(this.objectURL){this.audio?.removeAttribute('src');this.URL.revokeObjectURL(this.objectURL);this.objectURL=null;}}
 recover(){
  if(!this.playing||!this.audio?.paused||this.recovering)return;
  const serial=this.serial;this.recovering=true;
  try{Promise.resolve(this.audio.play()).catch(error=>{if(serial===this.serial)this.finish?.(error);}).finally(()=>{this.recovering=false;});}catch(error){this.recovering=false;this.finish?.(error);}
 }
 stop(){
  this.serial++;this.controller?.abort();this.controller=null;this.clearTimer(this.fetchTimer);this.fetchTimer=null;this.finish?.();this.finish=null;this.mouth?.stop();
  if(this.playing){this.audio.pause();this.playing=false;}this.clearSource();
 }
 remember(key,bytes){if(bytes.byteLength>4000000)return;const old=this.cache.get(key);if(old)this.bytes-=old.byteLength;this.cache.delete(key);this.cache.set(key,bytes);this.bytes+=bytes.byteLength;while(this.cache.size>8||this.bytes>8000000){const first=this.cache.keys().next().value;this.bytes-=this.cache.get(first).byteLength;this.cache.delete(first);}}
 preload(text,{language='en',soul='lumi',source}={}){
  const key=JSON.stringify([source||'',text,language,soul]);if(this.cache.has(key))return Promise.resolve(this.cache.get(key));if(this.preloads.has(key))return this.preloads.get(key).promise;
  const controller=new AbortController(),entry={controller,dynamic:!source},timer=this.setTimer(()=>controller.abort(),source?3000:8000);
  entry.promise=(async()=>{try{const response=await this.fetchImpl(source||'/api/speech',{signal:controller.signal,...(source?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,language,soul})})});if(!response.ok||Number(response.headers.get('content-length'))>4000000)throw Error('audio');const bytes=await response.arrayBuffer();if(bytes.byteLength<44||bytes.byteLength>4000000||controller.signal.aborted)throw Error('audio');this.remember(key,bytes);return bytes;}catch{return null;}finally{this.clearTimer(timer);if(this.preloads.get(key)===entry)this.preloads.delete(key);}})();
  this.preloads.set(key,entry);while(this.preloads.size>8){const first=this.preloads.keys().next().value;this.preloads.get(first).controller.abort();this.preloads.delete(first);}return entry.promise;
 }
 cancelPrefetches(){for(const [key,entry]of this.preloads)if(entry.dynamic){entry.controller.abort();this.preloads.delete(key);}}
 async speak(parts,{language,soul,source,report,allowed=()=>true}){
  this.stop();const serial=this.serial,valid=()=>serial===this.serial;
  if(!this.audio){report('unavailable');return;}const controller=this.controller=new AbortController();
  try{
   for(const part of parts){
    if(!valid())return;if(!allowed()){report('blocked');return;}
    const key=JSON.stringify([source||'',part,language,soul]);let bytes=this.cache.get(key);
    if(!bytes&&this.preloads.has(key))bytes=await this.preloads.get(key).promise;if(!valid())return;
    if(!bytes){this.fetchTimer=this.setTimer(()=>controller.abort(),35000);
     const response=await this.fetchImpl(source||'/api/speech',{signal:controller.signal,...(source?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:part,language,soul})})});
     if(!response.ok||Number(response.headers.get('content-length'))>4000000)throw Error('audio');
     bytes=await response.arrayBuffer();this.clearTimer(this.fetchTimer);this.fetchTimer=null;
     if(!valid())return;if(bytes.byteLength<44||bytes.byteLength>4000000)throw Error('audio');this.remember(key,bytes);
    }
    if(!valid())return;if(!allowed()){report('blocked');return;}
    await this.playBytes(bytes,{soul,serial,report,mime:/\.mp3(?:\?|$)/i.test(source||'')?'audio/mpeg':'audio/wav'});
   }
   if(valid())report('ended');
  }catch(error){if(valid())report(error.name==='NotAllowedError'?'blocked':'unavailable');}
  finally{if(valid()){this.clearTimer(this.fetchTimer);this.fetchTimer=null;this.controller=null;this.playing=false;this.clearSource();}}
 }
 playBytes(bytes,{soul,serial,report,mime='audio/wav'}){
  const a=this.audio;this.clearSource();this.objectURL=this.URL.createObjectURL(new Blob([bytes],{type:mime}));a.src=this.objectURL;a.volume=1;a.playbackRate=soul==='mori'?.94:soul==='bori'?1.04:1;this.playing=true;
  return new Promise((resolve,reject)=>{
   let timer,token,finished=false;const valid=()=>serial===this.serial&&!finished;
   const finish=error=>{if(finished)return;finished=true;this.clearTimer(timer);a.onplaying=a.onended=a.onerror=a.onloadedmetadata=null;if(token!==undefined)this.mouth?.stop(token);if(this.finish===finish)this.finish=null;this.playing=false;a.pause();error?reject(error):resolve();};
   this.finish=finish;timer=this.setTimer(()=>finish(Error('playback_timeout')),90000);
   a.onended=()=>finish();a.onerror=()=>finish(Error('audio'));a.onplaying=()=>{if(valid())report('playing');};
   a.onloadedmetadata=()=>{if(!valid()||!Number.isFinite(a.duration))return;this.clearTimer(timer);timer=this.setTimer(()=>finish(Error('playback_timeout')),Math.min(180000,Math.ceil(a.duration/a.playbackRate*1000)+8000));};
   // Decode only for lip movement; this buffer is never connected to a speaker.
   if(this.mouth&&this.decode)Promise.resolve().then(()=>this.decode(bytes.slice(0))).then(buffer=>{if(!valid()||!buffer)return;token=this.mouth.begin(()=>a.paused?null:a.currentTime,soul);this.mouth.enqueue(buffer.getChannelData(0),buffer.sampleRate,0,1,token);}).catch(()=>{});
   try{Promise.resolve(a.play()).catch(finish);}catch(error){finish(error);}
  });
 }
 dispose(){this.stop();for(const entry of this.preloads.values())entry.controller.abort();this.preloads.clear();this.cache.clear();this.bytes=0;}
}
