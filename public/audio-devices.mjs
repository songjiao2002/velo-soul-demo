// Device IDs stay in this page only. A browser cannot pair/reconnect Bluetooth
// or identify the OS output route when output-selection APIs are unavailable.
export class AudioDevices {
 constructor({session,mediaDevices=session.navigator?.mediaDevices,onChange=()=>{}}){
  Object.assign(this,{session,mediaDevices,onChange});this.devices=[];this.selected=null;this.state='system';this.epoch=0;this.media=new Map();
  session.devices=this;
  this.changed=()=>{if(this.selected){this.gate(false);this.state='checking';this.notify();}void this.refresh();};
  mediaDevices?.addEventListener?.('devicechange',this.changed);
 }
 destination(){
  const context=this.session.getContext();
  if(this.context!==context){this.context?.removeEventListener?.('sinkchange',this.changed);this.context=context;this.gain=context.createGain();this.gain.gain.value=this.selected?0:1;this.gain.connect(context.destination);context.addEventListener?.('sinkchange',this.changed);}
  return this.gain;
 }
 gate(open){if(this.gain)this.gain.gain.value=open?1:0;}
 notify(){this.onChange(this);}
 canSelectOutput(){return typeof this.session.Context?.prototype?.setSinkId==='function'||typeof this.session.context?.setSinkId==='function';}
 async refresh(){
  if(this.disposed)return;
  if(this.selecting){try{await this.selecting;}catch{}if(this.disposed)return;}
  const epoch=++this.epoch;
  try{
   const devices=await this.mediaDevices?.enumerateDevices?.();if(epoch!==this.epoch)return;
   this.devices=Array.isArray(devices)?devices:[];
   if(this.selected){
    const present=this.devices.some(d=>d.kind==='audiooutput'&&d.deviceId===this.selected.deviceId);
    if(!present){this.gate(false);this.state='missing';}
    else{
     const context=this.session.getContext();
     await context.setSinkId(this.selected.deviceId);if(epoch!==this.epoch)return;
     this.state='selected';this.gate(true);
    }
   }
  }catch{if(epoch!==this.epoch)return;if(this.selected){this.gate(false);this.state='unavailable';}}
  if(epoch===this.epoch)this.notify();
 }
 selectOutput(device){
  const task=Promise.resolve(this.selecting).catch(()=>{}).then(()=>this.applyOutput(device)).finally(()=>{if(this.selecting===task)this.selecting=null;});this.selecting=task;return task;
 }
 async applyOutput(device){
  if(this.disposed)throw Error('cancelled');
  if(!this.canSelectOutput())throw Error('unsupported');
  const context=this.session.getContext(),epoch=++this.epoch;
  this.destination();this.gate(false);this.state='checking';this.notify();
  try{
   await context.setSinkId(device?.deviceId||'');if(epoch!==this.epoch)return;
   this.selected=device?.deviceId?{deviceId:device.deviceId,label:device.label||''}:null;
   this.state=this.selected?'selected':'system';this.gate(true);this.notify();
  }catch(error){if(epoch===this.epoch){this.state='unavailable';this.gate(false);this.notify();}throw error;}
 }
 async chooseOutput(){
  if(!this.mediaDevices?.selectAudioOutput||!this.canSelectOutput())throw Error('unsupported');
  // Must run directly in a click: never prompt for a device on page load.
  const device=await this.mediaDevices.selectAudioOutput();await this.selectOutput(device);await this.refresh();
 }
 async selectInput(deviceId){
  this.session.inputDeviceId=deviceId||'';
  // Changing a user-selected input is the only deliberate mid-conversation
  // capture replacement. Normal reply turns keep the same stream alive.
  const results=await Promise.all([...this.session.inputs.values()].map(c=>c.changeInput?.()));this.notify();if(results.includes(false))throw Error('audio-capture');
 }
 inputLabel(){return [...this.session.inputs.values()].map(c=>c.getInput?.()?.label).find(Boolean)||'';}
 routeMedia(audio){
  if(this.media.has(audio))return true;
  try{const context=this.session.getContext();if(!context.createMediaElementSource)return false;
   const node=context.createMediaElementSource(audio);node.connect(this.destination());this.media.set(audio,node);return true;
  }catch{return false;}
 }
 dispose(){this.disposed=true;this.epoch++;this.mediaDevices?.removeEventListener?.('devicechange',this.changed);this.context?.removeEventListener?.('sinkchange',this.changed);for(const node of this.media.values())node.disconnect();this.media.clear();this.gain?.disconnect();}
}

export const AUDIO_DEVICE_COPY={
 zh:{button:'耳机／音频设备',title:'声音从哪里来？',close:'关闭',output:'播放设备',input:'麦克风',system:'跟随系统',choose:'选择播放设备',refresh:'刷新设备',test:'测试声音',current:'当前麦克风：',unknown:'开始交流后可查看',hint:'先在手机蓝牙设置中连接耳机，再开始交流。三星手机请在快捷面板的“媒体输出”选择耳机，并检查耳机的“通话”和“音频”开关。',limited:'此浏览器不能指定播放设备。请在三星“媒体输出”中选择耳机；微信等内置浏览器仍外放时，请用 Chrome 或 Samsung Internet 打开同一链接。',privacy:'设备选择仅保留在当前页面，不上传设备名称或编号。麦克风名称不代表声音一定从该耳机播放。',systemStatus:'播放设备由系统控制',selected:'已指定播放设备',checking:'正在检查音频设备…',missing:'选定设备已断开，已静音，避免切到扬声器。重新连接后自动检查。',unavailable:'无法使用所选播放设备，已静音。请重新选择设备。',error:'未能更改设备。请检查浏览器权限和耳机连接。',inputHint:'如果没有显示耳机，请先开始交流并允许麦克风，再刷新设备。',saved:'麦克风设置已更新。',testLine:'I’m here. Can you hear me through your headphones?'},
 en:{button:'Headphones / audio devices',title:'Where does the sound go?',close:'Close',output:'Playback device',input:'Microphone',system:'Follow system',choose:'Choose playback device',refresh:'Refresh devices',test:'Test sound',current:'Current microphone: ',unknown:'Available after starting conversation',hint:'Connect your headset before starting. On Samsung, choose it in Quick panel → Media output and check its Calls and Audio switches in Bluetooth settings.',limited:'This browser cannot select the playback device. Choose your headset in Samsung Media output. If an in-app browser still uses the speaker, open this same link in Chrome or Samsung Internet.',privacy:'Device choices stay in this page. Device names and IDs are not uploaded. The microphone name does not confirm the playback route.',systemStatus:'Playback is controlled by the system',selected:'Playback device selected',checking:'Checking audio devices…',missing:'Selected device disconnected. Output is muted to avoid the speaker; reconnecting triggers another check.',unavailable:'Selected output is unavailable. Sound is muted; choose a device again.',error:'Could not change device. Check browser permission and the headset connection.',inputHint:'If the headset is not listed, start the conversation, allow the microphone, then refresh.',saved:'Microphone setting updated.',testLine:'I’m here. Can you hear me through your headphones?'},
 ko:{button:'이어폰 / 오디오 기기',title:'어디에서 소리가 나나요?',close:'닫기',output:'재생 기기',input:'마이크',system:'시스템 설정 따르기',choose:'재생 기기 선택',refresh:'기기 새로고침',test:'소리 테스트',current:'현재 마이크: ',unknown:'대화를 시작하면 확인할 수 있어요',hint:'먼저 이어폰을 연결한 뒤 대화를 시작해주세요. 삼성 휴대폰은 빠른 설정의 미디어 출력에서 이어폰을 고르고 블루투스 설정의 통화·오디오 항목을 확인해주세요.',limited:'이 브라우저에서는 재생 기기를 지정할 수 없어요. 삼성 미디어 출력에서 이어폰을 선택해주세요. 앱 내 브라우저에서 계속 스피커로 나오면 같은 링크를 Chrome 또는 Samsung Internet에서 열어주세요.',privacy:'기기 선택은 현재 페이지에서만 유지돼요. 기기 이름과 ID는 전송하지 않아요. 마이크 이름이 재생 기기를 보장하지는 않아요.',systemStatus:'시스템이 재생 기기를 선택해요',selected:'재생 기기를 지정했어요',checking:'오디오 기기를 확인하고 있어요…',missing:'선택한 기기가 끊겨 스피커로 나오지 않도록 음소거했어요. 다시 연결하면 확인해요.',unavailable:'선택한 재생 기기를 사용할 수 없어 음소거했어요. 기기를 다시 선택해주세요.',error:'기기를 변경하지 못했어요. 브라우저 권한과 이어폰 연결을 확인해주세요.',inputHint:'이어폰이 없으면 대화를 시작해 마이크를 허용한 뒤 새로고침해주세요.',saved:'마이크 설정을 변경했어요.',testLine:'나 여기 있어. 이어폰으로 내 목소리가 들리나요?'}
};
Object.assign(AUDIO_DEVICE_COPY.zh,{missingDevice:'此前选择的设备暂不可用',busy:'请等当前回复结束后再测试声音。'});
Object.assign(AUDIO_DEVICE_COPY.en,{missingDevice:'Previously selected device is unavailable',busy:'Wait for the current reply to finish before testing.'});
Object.assign(AUDIO_DEVICE_COPY.ko,{missingDevice:'선택했던 기기를 사용할 수 없어요',busy:'현재 답변이 끝난 뒤 소리를 테스트해주세요.'});
export const audioDeviceButton=lang=>`<div class="audio-device-entry" data-no-translate><button class="audio-device-button" type="button" data-audio-devices>${AUDIO_DEVICE_COPY[lang]?.button||AUDIO_DEVICE_COPY.en.button}</button><span class="audio-device-alert" data-audio-route-status role="status"></span></div>`;

export function createAudioDeviceUI({devices,getLanguage,prepare,onTest,document=globalThis.document}){
 const dialog=document.createElement('dialog');dialog.className='audio-device-dialog';dialog.dataset.noTranslate='';dialog.setAttribute('aria-labelledby','audioDeviceTitle');document.body.append(dialog);
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const copy=()=>AUDIO_DEVICE_COPY[getLanguage()]||AUDIO_DEVICE_COPY.en;
 const options=(kind,selected)=>`<option value="">${copy().system}</option>`+(selected&&!devices.devices.some(d=>d.kind===kind&&d.deviceId===selected)?`<option value="${esc(selected)}" selected disabled>${copy().missingDevice}</option>`:'')+devices.devices.filter(d=>d.kind===kind&&d.deviceId&&d.deviceId!=='default'&&d.deviceId!=='communications').map(d=>`<option value="${esc(d.deviceId)}" ${d.deviceId===selected?'selected':''}>${esc(d.label||copy()[kind==='audioinput'?'input':'output'])}</option>`).join('');
 function paint(){const c=copy();document.querySelectorAll('[data-audio-route-status]').forEach(el=>{el.textContent=['missing','unavailable','checking'].includes(devices.state)?c[devices.state]:'';});if(!dialog.open)return;const selectable=devices.canSelectOutput();dialog.innerHTML=`<div class="audio-device-heading"><h2 id="audioDeviceTitle">${c.title}</h2><button type="button" data-device-close aria-label="${c.close}">×</button></div><p>${c.hint}</p><p class="audio-route-status" role="status">${c[devices.state==='system'?'systemStatus':devices.state]}${devices.state==='selected'&&devices.selected.label?' · '+esc(devices.selected.label):''}</p>${selectable?`<label>${c.output}<select data-device-output>${options('audiooutput',devices.selected?.deviceId)}</select></label>${devices.mediaDevices?.selectAudioOutput?`<button class="secondary" type="button" data-device-picker>${c.choose}</button>`:''}`:`<p class="audio-device-limited">${c.limited}</p>`}<label>${c.input}<select data-device-input>${options('audioinput',devices.session.inputDeviceId)}</select></label><p class="small">${c.current}${esc(devices.inputLabel()||c.unknown)}</p><p class="small">${c.inputHint}</p><div class="audio-device-actions"><button class="secondary" type="button" data-device-refresh>${c.refresh}</button><button class="primary" type="button" data-device-test>${c.test}</button></div><p class="small" data-device-result role="status"></p><p class="small">${c.privacy}</p>`;}
 devices.onChange=paint;
 const error=()=>{const el=dialog.querySelector('[data-device-result]');if(el)el.textContent=copy().error;};
 document.addEventListener('click',e=>{if(e.target.closest('[data-audio-devices]')){if(!dialog.open)dialog.showModal();paint();void devices.refresh();}});
 dialog.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-device-close'))dialog.close();
  if(b.hasAttribute('data-device-refresh'))void devices.refresh();
  if(b.hasAttribute('data-device-picker'))void devices.chooseOutput().catch(error);
  if(b.hasAttribute('data-device-test')){prepare();if(onTest(copy().testLine,getLanguage()==='ko'?'ko':'en')===false)dialog.querySelector('[data-device-result]').textContent=copy().busy;}
 });
 dialog.addEventListener('change',async e=>{const el=e.target;try{if(el.matches('[data-device-output]')){const device=devices.devices.find(d=>d.kind==='audiooutput'&&d.deviceId===el.value);await devices.selectOutput(device);}if(el.matches('[data-device-input]')){el.disabled=true;await devices.selectInput(el.value);paint();}}catch{paint();error();}});
 return {dialog,paint};
}
