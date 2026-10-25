import {getDeviceMedia} from './app-network.mjs';

// A permission grant owns a stream only while this camera attempt is current.
export class SoulCameraController {
 constructor({video,onState=()=>{},getMedia,isSecure,setTimer=(...a)=>setTimeout(...a),clearTimer=(...a)=>clearTimeout(...a)}={}){
  Object.assign(this,{video,onState,setTimer,clearTimer});this.getMedia=getMedia||((c,isCurrent)=>getDeviceMedia(c,undefined,{isCurrent}));
  this.isSecure=isSecure||(()=>globalThis.isSecureContext&&!!globalThis.navigator?.mediaDevices?.getUserMedia);this.sequence=0;this.waits=new Map();this.stream=null;
 }
 release(stream){stream?.getTracks().forEach(t=>t.stop());}
 stop(){
  this.sequence++;for(const [timer,cancel]of this.waits){this.clearTimer(timer);cancel();}this.waits.clear();
  this.release(this.stream);this.stream=null;if(this.video){this.video.pause();this.video.srcObject=null;this.video.style?.removeProperty('display');}
 }
 deadline(promise,ms,name='TimeoutError'){
  let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=this.setTimer(()=>reject(Object.assign(Error(name),{name})),ms);this.waits.set(timer,()=>reject(Object.assign(Error('Cancelled'),{name:'AbortError'})));})]).finally(()=>{this.clearTimer(timer);this.waits.delete(timer);});
 }
 async start(){
  this.stop();const req=this.sequence,valid=()=>req===this.sequence;
  if(!this.isSecure()){this.onState('error','카메라를 지원하는 휴대폰 브라우저에서 HTTPS 주소를 열어주세요. 미리보기로도 체험할 수 있어요.','UnsupportedError');return;}
  this.onState('requesting','브라우저의 카메라 권한 안내에서 허용을 선택해주세요.');
  let stream;
  try{
   const choices=[{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},{facingMode:{ideal:'environment'}},true];
   for(let i=0;i<choices.length;i++){
    let expired=false;
    try{
     const request=this.getMedia({audio:false,video:choices[i]},valid).then(value=>{if(expired||!valid()){this.release(value);return null;}return value;});
     stream=await this.deadline(request,45000);break;
    }catch(error){
     expired=true;if(!valid())return;
     if(i===choices.length-1||!['OverconstrainedError','ConstraintNotSatisfiedError','NotReadableError','AbortError'].includes(error.name))throw error;
    }
   }
   if(!valid()){this.release(stream);return;}if(!stream)throw Error('No stream');this.stream=stream;
   const video=this.video;video.muted=true;video.defaultMuted=true;video.playsInline=true;video.autoplay=true;
   video.setAttribute?.('playsinline','');video.setAttribute?.('webkit-playsinline','');video.setAttribute?.('muted','');
   // Some mobile WebViews never start a display:none video. Reveal it before play().
   if(video.style)video.style.display='block';video.srcObject=stream;
   await this.deadline(Promise.resolve(video.play()),8000,'PlaybackTimeoutError');
   if(!valid())return;
   stream.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if(!valid())return;this.stop();this.onState('error','카메라 연결이 끝났어요. 다시 켤 수 있어요.','TrackEndedError');},{once:true}));
   this.onState('live','카메라가 켜졌어요.');
  }catch(error){
   if(!valid())return;this.stop();
   this.onState('error',({NotAllowedError:'카메라 사용이 허용되지 않았어요. 주소창의 사이트 설정에서 허용한 뒤 다시 켜주세요.',NotFoundError:'사용할 수 있는 카메라가 없어요. 미리보기로 소울을 만나보세요.',NotReadableError:'카메라를 열 수 없어요. 다른 앱에서 사용 중인지 확인해주세요.',TimeoutError:'카메라 권한 요청이 지연돼요. 권한 안내를 확인한 뒤 다시 눌러주세요.',PlaybackTimeoutError:'카메라 화면을 시작하지 못했어요. 다시 켜기를 눌러주세요.'})[error.name]||'카메라를 시작하지 못했어요. 다시 시도하거나 미리보기로 계속해주세요.',error.name||'CameraError');
  }
 }
}
