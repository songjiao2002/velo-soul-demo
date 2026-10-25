// Native screens ship inside the app. Only API calls use the existing HTTPS service.
import {prepareNativeMedia} from './native-media.mjs';
export const PUBLIC_ORIGIN='https://velo-soul-demo-production.up.railway.app';
export function isNative(){return globalThis.Capacitor?.isNativePlatform?.()===true;}
export function apiURL(path,native=isNative()){
 return native&&typeof path==='string'&&path.startsWith('/api/')?PUBLIC_ORIGIN+path:path;
}
export function appFetch(input,options){return globalThis.fetch(apiURL(input),options);}
export function speechSocketURL(location=globalThis.location,native=isNative()){
 const url=new URL('/api/transcribe/live',native?PUBLIC_ORIGIN:location.href);
 url.protocol=url.protocol==='https:'?'wss:':'ws:';return url;
}
export function createMediaPermissionQueue({prepare=prepareNativeMedia,setTimer=(...a)=>setTimeout(...a),clearTimer=(...a)=>clearTimeout(...a),timeout=45000}={}){
 let tail=Promise.resolve();
 return (constraints,devices,{isCurrent=()=>true}={})=>{
  const next=tail.then(async()=>{
   let expired=false,timer;
   const cancelled=()=>Object.assign(Error('cancelled'),{name:'AbortError'});
   if(!isCurrent())throw cancelled();
   const request=Promise.resolve(prepare(constraints)).then(()=>{if(expired||!isCurrent())throw cancelled();return devices.getUserMedia(constraints);}).then(stream=>{if(expired||!isCurrent()){stream?.getTracks().forEach(t=>t.stop());throw cancelled();}return stream;});
   try{return await Promise.race([request,new Promise((_,reject)=>{timer=setTimer(()=>{expired=true;reject(Object.assign(Error('Media permission timed out'),{name:'TimeoutError'}));},timeout);})]);}
   finally{clearTimer(timer);}
  });tail=next.catch(()=>{});return next;
 };
}
const mediaPermission=createMediaPermissionQueue();
export function getDeviceMedia(constraints,devices=globalThis.navigator?.mediaDevices,options){
 if(!devices?.getUserMedia)return Promise.reject(Object.assign(Error('Camera or microphone unavailable'),{name:'NotSupportedError'}));
 if(!isNative())return devices.getUserMedia(constraints);
 // Android WebView has one pending media-permission callback. Do not overlap
 // first-time camera and microphone prompts when starting live companionship.
 return mediaPermission(constraints,devices,options);
}
