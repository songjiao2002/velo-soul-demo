import {AUDIO_OUTPUT_COPY} from './audio-output-copy.mjs';
import {AUDIO_COMPAT_COPY} from './audio-compat-copy.mjs';
import {browserAudioContext,companionBrowserLinks} from './audio-browser.mjs';
// Output routing is owned entirely by the operating system. This helper
// only shares the existing audio graph and refreshes microphone metadata.
export class AudioDevices {
 constructor({session,mediaDevices=session.navigator?.mediaDevices,onChange=()=>{}}){
  Object.assign(this,{session,mediaDevices,onChange});this.devices=[];this.state='system';this.media=new Map();session.devices=this;
  try{session.playbackMode=globalThis.localStorage?.getItem('velo-audio-playback')==='media'?'media':'stream';}catch{session.playbackMode='stream';}
  this.changed=()=>{void this.refresh();};this.visible=()=>{if(!session.document?.hidden)this.changed();};
  mediaDevices?.addEventListener?.('devicechange',this.changed);session.document?.addEventListener?.('visibilitychange',this.visible);
 }
 canPlay(){return true;}
 notify(){if(!this.disposed)this.onChange(this);}
 destination(){
  const context=this.session.getContext();
  if(this.context!==context){this.gain?.disconnect();this.context=context;this.gain=context.createGain();this.gain.gain.value=1;this.gain.connect(context.destination);}
  return this.gain;
 }
 async setPlaybackMode(mode){
  if(this.disposed)throw Error('cancelled');if(!['media','stream'].includes(mode))throw Error('unsupported');if(this.session.inputs.size)throw Error('busy');
  if(mode==='media'&&!this.session.nativeSpeech?.audio)throw Error('unsupported');
  this.session.playbackMode=mode;try{globalThis.localStorage?.setItem('velo-audio-playback',mode);}catch{}this.notify();
 }
 refresh(){
  if(this.disposed)return Promise.resolve();if(this.refreshing){this.refreshAgain=true;return this.refreshing;}
  const task=Promise.resolve().then(async()=>{
   do{this.refreshAgain=false;try{const list=await this.mediaDevices?.enumerateDevices?.();if(this.disposed)return;this.devices=Array.isArray(list)?list.filter(d=>d.kind==='audioinput'):[];}catch{}this.notify();}while(this.refreshAgain&&!this.disposed);
  }).finally(()=>{if(this.refreshing===task)this.refreshing=null;});this.refreshing=task;return task;
 }
 inputLabel(){return [...this.session.inputs.values()].map(c=>c.getInput?.()?.label).find(Boolean)||'';}
 routeMedia(audio){
  if(this.media.has(audio))return true;
  try{const context=this.session.getContext();if(!context.createMediaElementSource)return false;const node=context.createMediaElementSource(audio);node.connect(this.destination());this.media.set(audio,node);return true;}catch{return false;}
 }
 dispose(){this.disposed=true;this.mediaDevices?.removeEventListener?.('devicechange',this.changed);this.session.document?.removeEventListener?.('visibilitychange',this.visible);for(const node of this.media.values())node.disconnect();this.media.clear();this.gain?.disconnect();}
}

export const AUDIO_DEVICE_COPY={
 zh:{button:'耳机／音频设备',title:'声音从哪里来？',close:'关闭',output:'播放设备',input:'麦克风',system:'跟随系统',choose:'选择播放设备',refresh:'刷新设备',test:'测试声音',current:'当前麦克风：',unknown:'开始交流后可查看',hint:'先在手机蓝牙设置中连接耳机，再开始交流。三星手机请在快捷面板的“媒体输出”选择耳机，并检查耳机的“通话”和“音频”开关。',limited:'此浏览器不能指定播放设备。请在三星“媒体输出”中选择耳机；微信等内置浏览器仍外放时，请用 Chrome 或 Samsung Internet 打开同一链接。',privacy:'设备选择仅保留在当前页面，不上传设备名称或编号。麦克风名称不代表声音一定从该耳机播放。',systemStatus:'播放设备由系统控制',selected:'已指定播放设备',checking:'正在检查音频设备…',missing:'选定设备已断开，已静音，避免切到扬声器。重新连接后自动检查。',unavailable:'无法使用所选播放设备，已静音。请重新选择设备。',error:'未能更改设备。请检查浏览器权限和耳机连接。',inputHint:'如果没有显示耳机，请先开始交流并允许麦克风，再刷新设备。',saved:'麦克风设置已更新。',testLine:'I’m here. Can you hear me through your headphones?'},
 en:{button:'Headphones / audio devices',title:'Where does the sound go?',close:'Close',output:'Playback device',input:'Microphone',system:'Follow system',choose:'Choose playback device',refresh:'Refresh devices',test:'Test sound',current:'Current microphone: ',unknown:'Available after starting conversation',hint:'Connect your headset before starting. On Samsung, choose it in Quick panel → Media output and check its Calls and Audio switches in Bluetooth settings.',limited:'This browser cannot select the playback device. Choose your headset in Samsung Media output. If an in-app browser still uses the speaker, open this same link in Chrome or Samsung Internet.',privacy:'Device choices stay in this page. Device names and IDs are not uploaded. The microphone name does not confirm the playback route.',systemStatus:'Playback is controlled by the system',selected:'Playback device selected',checking:'Checking audio devices…',missing:'Selected device disconnected. Output is muted to avoid the speaker; reconnecting triggers another check.',unavailable:'Selected output is unavailable. Sound is muted; choose a device again.',error:'Could not change device. Check browser permission and the headset connection.',inputHint:'If the headset is not listed, start the conversation, allow the microphone, then refresh.',saved:'Microphone setting updated.',testLine:'I’m here. Can you hear me through your headphones?'},
 ko:{button:'이어폰 / 오디오 기기',title:'어디에서 소리가 나나요?',close:'닫기',output:'재생 기기',input:'마이크',system:'시스템 설정 따르기',choose:'재생 기기 선택',refresh:'기기 새로고침',test:'소리 테스트',current:'현재 마이크: ',unknown:'대화를 시작하면 확인할 수 있어요',hint:'먼저 이어폰을 연결한 뒤 대화를 시작해주세요. 삼성 휴대폰은 빠른 설정의 미디어 출력에서 이어폰을 고르고 블루투스 설정의 통화·오디오 항목을 확인해주세요.',limited:'이 브라우저에서는 재생 기기를 지정할 수 없어요. 삼성 미디어 출력에서 이어폰을 선택해주세요. 앱 내 브라우저에서 계속 스피커로 나오면 같은 링크를 Chrome 또는 Samsung Internet에서 열어주세요.',privacy:'기기 선택은 현재 페이지에서만 유지돼요. 기기 이름과 ID는 전송하지 않아요. 마이크 이름이 재생 기기를 보장하지는 않아요.',systemStatus:'시스템이 재생 기기를 선택해요',selected:'재생 기기를 지정했어요',checking:'오디오 기기를 확인하고 있어요…',missing:'선택한 기기가 끊겨 스피커로 나오지 않도록 음소거했어요. 다시 연결하면 확인해요.',unavailable:'선택한 재생 기기를 사용할 수 없어 음소거했어요. 기기를 다시 선택해주세요.',error:'기기를 변경하지 못했어요. 브라우저 권한과 이어폰 연결을 확인해주세요.',inputHint:'이어폰이 없으면 대화를 시작해 마이크를 허용한 뒤 새로고침해주세요.',saved:'마이크 설정을 변경했어요.',testLine:'나 여기 있어. 이어폰으로 내 목소리가 들리나요?'}
};
Object.assign(AUDIO_DEVICE_COPY.zh,{missingDevice:'此前选择的设备暂不可用',busy:'请等当前回复结束后再测试声音。'});
Object.assign(AUDIO_DEVICE_COPY.en,{missingDevice:'Previously selected device is unavailable',busy:'Wait for the current reply to finish before testing.'});
Object.assign(AUDIO_DEVICE_COPY.ko,{missingDevice:'선택했던 기기를 사용할 수 없어요',busy:'현재 답변이 끝난 뒤 소리를 테스트해주세요.'});
for(const lang of ['zh','en','ko']){AUDIO_DEVICE_COPY[lang].protected=AUDIO_OUTPUT_COPY[lang].protected;AUDIO_DEVICE_COPY[lang].system=AUDIO_OUTPUT_COPY[lang].system;}
Object.assign(AUDIO_DEVICE_COPY.zh,{button:'声音设置',title:'声音设置',systemStatus:'声音跟随手机或电脑当前的输出设置',privacy:'网页不选择蓝牙或扬声器，也不会因为设备检查自动静音。请在系统中设置播放设备。'});
Object.assign(AUDIO_DEVICE_COPY.en,{button:'Sound settings',title:'Sound settings',systemStatus:'Sound follows your phone or computer’s current output',privacy:'The website does not choose Bluetooth or speakers, or mute output after device checks. Choose playback devices in system settings.'});
Object.assign(AUDIO_DEVICE_COPY.ko,{button:'소리 설정',title:'소리 설정',systemStatus:'휴대폰 또는 컴퓨터의 현재 출력 설정을 따라요',privacy:'웹사이트가 블루투스나 스피커를 선택하거나 기기 확인 후 자동 음소거하지 않아요. 시스템에서 재생 기기를 선택해주세요.'});
export const audioDeviceButton=lang=>`<div class="audio-device-entry" data-no-translate><button class="audio-device-button" type="button" data-audio-devices>${AUDIO_DEVICE_COPY[lang]?.button||AUDIO_DEVICE_COPY.en.button}</button><span class="audio-device-alert" data-audio-route-status role="status"></span></div>`;

export function createAudioDeviceUI({devices,getLanguage,prepare,onTest,onModeChange=()=>{},document=globalThis.document}){
 const dialog=document.createElement('dialog');dialog.className='audio-device-dialog';dialog.dataset.noTranslate='';dialog.setAttribute('aria-labelledby','audioDeviceTitle');document.body.append(dialog);
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const copy=()=>AUDIO_DEVICE_COPY[getLanguage()]||AUDIO_DEVICE_COPY.en;
 const compat=()=>AUDIO_COMPAT_COPY[getLanguage()]||AUDIO_COMPAT_COPY.en;
 const environment=browserAudioContext(devices.session.navigator?.userAgent||'');
 const links=()=>companionBrowserLinks(document.location.href);
 let result='',refreshPending=false;
 const outputCopy=()=>AUDIO_OUTPUT_COPY[getLanguage()]||AUDIO_OUTPUT_COPY.en;
 function compatibilityMarkup(){const c=compat(),url=links(),active=devices.session.inputs.size>0,mode=devices.session.playbackMode||'stream';return `<section class="audio-compatibility">${environment.embedded?`<div class="audio-app-warning"><b>${c.inside.replace('{app}',esc(environment.host))}</b><p>${c.embedded}</p><p>${c.outside}</p></div>`:''}<label>${c.mode}<select data-playback-mode ${active?'disabled':''}><option value="stream" ${mode==='stream'?'selected':''}>${c.stream}</option><option value="media" ${mode==='media'?'selected':''}>${c.media}</option></select></label><p class="small">${active?c.pause:c.modeHint}</p><button type="button" class="secondary" data-media-test ${active?'disabled':''}>${c.sample}</button><p class="small">${c.sampleHint}</p><details class="audio-external" ${environment.embedded?'open':''}><summary>${c.links}</summary>${environment.android?`<div class="audio-browser-links"><a class="secondary" href="${esc(url.chrome)}">${c.chrome}</a><a class="secondary" href="${esc(url.samsung)}">${c.samsung}</a></div>`:''}<p class="small">${c.fallback}</p><button type="button" class="secondary" data-copy-browser-link>${c.copy}</button><input class="audio-copy-link" aria-label="${c.copy}" readonly value="${esc(url.link)}"><p class="small">${c.handoff}</p></details><p class="small">${c.unverified}</p></section>`;}

 function paint(){const c=copy(),o=outputCopy();document.querySelectorAll('[data-audio-devices]').forEach(el=>{if(el.textContent!==c.button)el.textContent=c.button;});document.querySelectorAll('[data-audio-route-status]').forEach(el=>{el.textContent='';});if(!dialog.open)return;
 const expanded=[...dialog.querySelectorAll('details')].map(el=>({name:el.className,open:el.open})),scroll=dialog.scrollTop,active=document.activeElement;
 const focus=dialog.contains(active)?[...active.attributes].find(a=>a.name.startsWith('data-')):null;
 dialog.innerHTML=`<div class="audio-device-heading"><h2 id="audioDeviceTitle">${c.title}</h2><button type="button" data-device-close aria-label="${c.close}">×</button></div><p class="audio-route-status" role="status">${c.systemStatus}</p><div class="audio-device-actions"><button class="secondary" type="button" data-device-refresh ${refreshPending?'disabled':''}>${refreshPending?o.refreshing:c.refresh}</button><button class="primary" type="button" data-device-test>${c.test}</button></div><p class="small" data-device-result role="status">${esc(result)}</p><details class="audio-advanced"><summary>${o.advanced}</summary><p>${c.hint}</p>${compatibilityMarkup()}</details><details class="audio-microphone"><summary>${o.mic}</summary><p class="small">${c.current}${esc(devices.inputLabel()||c.unknown)}</p><p class="small">${c.inputHint}</p></details><p class="small">${c.privacy}</p>`;for(const item of expanded){const el=[...dialog.querySelectorAll('details')].find(el=>el.className===item.name);if(el)el.open=item.open;}if(focus){const el=[...dialog.querySelectorAll('button,select,input')].find(el=>el.getAttribute(focus.name)===focus.value);el?.focus({preventScroll:true});}dialog.scrollTop=scroll;}
 devices.onChange=paint;
 document.addEventListener('change',e=>{if(e.target.id==='languageSelect')queueMicrotask(paint);});
 async function refreshList(){if(refreshPending)return;refreshPending=true;paint();try{await devices.refresh();}finally{refreshPending=false;paint();}}
 const error=()=>{result=copy().error;const el=dialog.querySelector('[data-device-result]');if(el)el.textContent=result;};
 document.addEventListener('click',e=>{if(e.target.closest('[data-audio-devices]')){if(!dialog.open)dialog.showModal();paint();void refreshList();}});
 dialog.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-device-close'))dialog.close();
  if(b.hasAttribute('data-copy-browser-link')){try{await devices.session.navigator?.clipboard?.writeText(links().link);if(!devices.session.navigator?.clipboard?.writeText)throw Error('clipboard');result=compat().copied;}catch{result=compat().copyFailed;}paint();}
  if(b.hasAttribute('data-media-test')){if(devices.session.inputs.size){result=compat().pause;paint();return;}try{onModeChange();devices.session.nativeSpeech?.prepare();await devices.setPlaybackMode('media');result=compat().sampleHint;paint();prepare();onTest(copy().testLine,getLanguage()==='ko'?'ko':'en',{sample:true});}catch{error();}}
  if(b.hasAttribute('data-device-refresh'))void refreshList();
  if(b.hasAttribute('data-device-test')){prepare();if(onTest(copy().testLine,getLanguage()==='ko'?'ko':'en')===false)dialog.querySelector('[data-device-result]').textContent=copy().busy;}
 });
 dialog.addEventListener('change',async e=>{const el=e.target;if(!el.matches('[data-playback-mode]'))return;try{if(devices.session.inputs.size)throw Error('busy');onModeChange();if(el.value==='media')devices.session.nativeSpeech?.prepare();await devices.setPlaybackMode(el.value);paint();}catch{paint();error();}});
 return {dialog,paint};
}
