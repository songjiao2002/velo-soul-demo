import {SceneGate} from './vision-core.mjs';
import {outputLanguage} from './seoul-places.mjs';

export const VISION_COPY={
 ko:{start:'AI 관찰 켜기',stop:'AI 관찰 끄기',notice:'켜면 현재 카메라의 축소 이미지 1장을 약 20초 간격으로 Qwen에 보내요. 연속 영상은 보내지 않고, 이 사이트에 분석 이미지를 저장하지 않아요.',off:'AI 관찰 꺼짐 · 영상은 전송되지 않아요.',checking:'AI 연결을 확인하고 있어요…',watching:'장면을 살펴보고 있어요…',quiet:'아직 이야기할 만한 장면을 찾지 못했어요.',waiting:'다음 새로운 장면을 기다려요.',paused:'대화나 재생이 끝나면 다시 살펴볼게요.',not_configured:'AI 관찰에는 서버의 Qwen API Key가 필요해요.',provider_auth:'Qwen 키와 영상 모델 접근 권한을 확인해주세요.',provider_quota:'Qwen 사용 한도를 확인해주세요. 관찰을 멈췄어요.',rate_limited:'체험의 사용 한도에 도달해 관찰을 멈췄어요.',failed:'장면을 분석하지 못해 관찰을 멈췄어요. 다시 켤 수 있어요.',camera:'먼저 카메라를 켜주세요.',reply:'AI가 본 장면 · 인식은 틀릴 수 있어요.',listen:'다시 듣기 ♪'},
 en:{start:'Enable AI observation',stop:'Stop AI observation',notice:'When enabled, a small camera image is sent to Qwen about every 20 seconds. No continuous video is sent, and this site does not save analysis images.',off:'AI observation off · No images sent.',checking:'Checking the AI connection…',watching:'Looking at this scene…',quiet:'Nothing clear to comment on yet.',waiting:'Waiting for a new scene to share.',paused:'I’ll look again after the conversation or playback.',not_configured:'AI observation needs a Qwen API key on the server.',provider_auth:'Check the Qwen key and access to the vision model.',provider_quota:'Qwen quota unavailable. Observation stopped.',rate_limited:'The demo limit was reached. Observation stopped.',failed:'Could not analyze the scene. Observation stopped; you can enable it again.',camera:'Turn on the camera first.',reply:'AI scene observation · Recognition may be wrong.',listen:'Read again ♪'},
 zh:{start:'开启 AI 观察',stop:'停止 AI 观察',notice:'开启后约每 20 秒截取一张缩小的相机画面发送给千问。不传连续视频，本站不保存分析用图片。',off:'AI 观察已关闭，不会发送画面。',checking:'正在检查 AI 连接…',watching:'正在观察眼前的场景…',quiet:'暂时没有发现足够清晰、适合说起的内容。',waiting:'正在等待值得分享的新场景。',paused:'等聊天或语音播放结束后再观察。',not_configured:'AI 观察需要先在服务器配置千问 API Key。',provider_auth:'请检查千问密钥及视觉模型的使用权限。',provider_quota:'千问额度暂不可用，已停止观察。',rate_limited:'已达到演示使用限额，观察已停止。',failed:'这次未能分析画面，已停止观察，可以再次开启。',camera:'请先开启摄像头。',reply:'AI 对画面的观察，识别可能出错。',listen:'再听一次 ♪'}
};

VISION_COPY.ko.provider_not_activated='Model Studio 서비스가 아직 활성화되지 않았어요. 관리자 계정에서 해당 지역 서비스를 활성화해주세요.';
VISION_COPY.en.provider_not_activated='Model Studio is not activated for this account and region. Ask the site owner to activate it.';
VISION_COPY.zh.provider_not_activated='该账号对应地域的 Model Studio 服务尚未开通，请管理员到阿里云控制台完成开通。';

export function captureVisionFrame(video){
 if(!video||video.readyState<2||!video.videoWidth||!video.videoHeight)throw new Error('camera');
 const canvas=document.createElement('canvas'),scale=Math.min(1,640/Math.max(video.videoWidth,video.videoHeight));
 canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
 canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
 const image=canvas.toDataURL('image/jpeg',.65);
 if(image.length>650000)throw new Error('invalid_image');
 return image;
}

export class SoulVisionObserver {
 constructor({capture,getContext=()=>({}),canObserve=()=>true,onState=()=>{},onReply=()=>{},fetchImpl=(...args)=>globalThis.fetch(...args),intervalMs=20000,timeoutMs=30000,setTimer=(...args)=>globalThis.setTimeout(...args),clearTimer=(...args)=>globalThis.clearTimeout(...args),now=Date.now}={}){
  Object.assign(this,{capture,getContext,canObserve,onState,onReply,fetchImpl,intervalMs,timeoutMs,setTimer,clearTimer,now});this.active=false;this.epoch=0;this.controller=null;this.timer=null;this.gate=new SceneGate();
 }
 stop(){this.active=false;this.epoch++;this.clearTimer(this.timer);this.controller?.abort();this.controller=null;this.onState('off');}
 async request(url,options,serial){
  const controller=new AbortController();this.controller=controller;const timer=this.setTimer(()=>controller.abort(),this.timeoutMs);
  try{const response=await this.fetchImpl(url,{...options,signal:controller.signal});if(serial!==this.epoch)throw new Error('cancelled');const data=await response.json();if(!response.ok)throw new Error(data.error||'failed');return data;}
  finally{this.clearTimer(timer);if(this.controller===controller)this.controller=null;}
 }
 async start(soul,language){
  this.stop();this.active=true;this.soul=soul;this.language=outputLanguage(language);const serial=this.epoch;this.onState('checking');
  try{const status=await this.request('/api/chat/status',{cache:'no-store'},serial);if(!status.configured)throw new Error('not_configured');if(serial===this.epoch)await this.tick(serial);}
  catch(e){if(serial===this.epoch){this.stop();this.onState(e.message);}}
 }
 async tick(serial=this.epoch){
  if(!this.active||serial!==this.epoch)return;
  try{
   if(!this.canObserve()){this.onState('paused');return;}
   const image=this.capture();this.onState('watching');
   const result=await this.request('/api/vision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({soul:this.soul,language:this.language,image,context:this.getContext()})},serial);
   if(serial!==this.epoch||!this.active)return;
   if(result.soul!==this.soul)throw new Error('failed');
   // A conversation or navigation can start while the model is replying.
   if(!this.canObserve()){this.onState('paused');return;}
   if(this.gate.accept(result,this.now())){this.onState('reply');this.onReply(result,this.language);}
   else this.onState(result.shouldSpeak?'waiting':'quiet');
  }catch(e){if(serial===this.epoch){this.stop();this.onState(e.message);}}
  finally{if(this.active&&serial===this.epoch)this.timer=this.setTimer(()=>this.tick(serial),this.intervalMs);}
 }
}
