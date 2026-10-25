// Native screens ship inside the app. Only API calls use the existing HTTPS service.
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
let mediaPermission=Promise.resolve();
export function getDeviceMedia(constraints,devices=globalThis.navigator?.mediaDevices){
 if(!isNative())return devices.getUserMedia(constraints);
 // Android WebView has one pending media-permission callback. Do not overlap
 // first-time camera and microphone prompts when starting live companionship.
 const next=mediaPermission.then(()=>devices.getUserMedia(constraints));
 mediaPermission=next.catch(()=>{});return next;
}
