import {browserAudioContext,companionBrowserLinks} from './audio-browser.mjs';
import {isNative} from './app-network.mjs';
import {hasNativeMedia,openMediaSettings} from './native-media.mjs';
// Output routing is owned entirely by the operating system. This helper
// only shares the existing audio graph and refreshes microphone metadata.
export class AudioDevices {
 constructor({session,mediaDevices=session.navigator?.mediaDevices,onChange=()=>{}}){
  Object.assign(this,{session,mediaDevices,onChange});this.devices=[];this.state='system';this.media=new Map();session.devices=this;
  const browser=browserAudioContext(session.navigator?.userAgent||''),preferred=browser.android&&(browser.embedded||isNative())?'media':'stream';
  session.playbackMode=preferred;
  this.changed=()=>{session.changed?.();void this.refresh();};this.visible=()=>{if(!session.document?.hidden)this.changed();};
  mediaDevices?.addEventListener?.('devicechange',this.changed);session.document?.addEventListener?.('visibilitychange',this.visible);
 }
 canPlay(){return true;}
 notify(){if(!this.disposed)this.onChange(this);}
 destination(){
  const context=this.session.getContext();
  if(this.context!==context){this.gain?.disconnect();this.context=context;this.gain=context.createGain();this.gain.gain.value=1;this.gain.connect(context.destination);}
  return this.gain;
 }
 refresh(){
  if(this.disposed)return Promise.resolve();if(this.refreshing){this.refreshAgain=true;return this.refreshing;}
  const task=Promise.resolve().then(async()=>{
   do{this.refreshAgain=false;try{const list=await this.mediaDevices?.enumerateDevices?.();if(this.disposed)return;this.devices=Array.isArray(list)?list.filter(d=>d.kind==='audioinput'):[];}catch{}this.notify();}while(this.refreshAgain&&!this.disposed);
  }).finally(()=>{if(this.refreshing===task)this.refreshing=null;});this.refreshing=task;return task;
 }
 inputLabel(){return [...this.session.inputs.values()].map(c=>c.getInput?.()?.label).find(Boolean)||'';}
 routeMedia(audio){
  // Leave prerecorded introductions on the system's media output. Routing an
  // HTML player into Web Audio can strand it on a suspended/old headset route.
  return !!audio;
 }
 dispose(){this.disposed=true;this.mediaDevices?.removeEventListener?.('devicechange',this.changed);this.session.document?.removeEventListener?.('visibilitychange',this.visible);for(const node of this.media.values())node.disconnect();this.media.clear();this.gain?.disconnect();}
}

const COPY={
 en:{button:'Sound help',close:'Done',route:'Sound follows your device.',hint:'Choose your headphones in the phone’s media output. Allow microphone access to talk. This page cannot pair headphones or select the output.',embedded:'This in-app browser may control sound. Pause here, then open the same companion in Chrome or Samsung Internet.',permissions:'App permissions',chrome:'Open Chrome',samsung:'Open Samsung Internet',link:'Original companion link',failed:'Open VELO SOUL permissions in your phone settings.'},
 ko:{button:'소리 도움말',close:'완료',route:'기기의 소리 설정을 따라요.',hint:'휴대폰 미디어 출력에서 이어폰을 선택하고 대화하려면 마이크를 허용해 주세요. 웹페이지는 이어폰을 연결하거나 출력을 선택하지 않아요.',embedded:'앱 내 브라우저가 소리를 제어할 수 있어요. 대화를 멈춘 뒤 같은 소울을 Chrome 또는 삼성 인터넷에서 열어 주세요.',permissions:'앱 권한 설정',chrome:'Chrome에서 열기',samsung:'삼성 인터넷에서 열기',link:'원래 소울 링크',failed:'휴대폰 설정에서 VELO SOUL 앱 권한을 열어 주세요.'},
 zh:{button:'声音帮助',close:'完成',route:'声音跟随设备设置。',hint:'请在手机的媒体输出中选择耳机，并允许麦克风后开始对话。网页不会配对耳机或选择输出设备。',embedded:'内置浏览器可能控制声音输出。请暂停这里的对话，再用 Chrome 或三星浏览器打开同一个伙伴。',permissions:'打开 App 权限',chrome:'用 Chrome 打开',samsung:'用三星浏览器打开',link:'原来的伙伴链接',failed:'请在手机设置中打开 VELO SOUL 的应用权限。'}
};
export const audioDeviceButton=lang=>`<div class="audio-device-entry" data-no-translate><button class="audio-device-button" type="button" data-audio-devices>${(COPY[lang]||COPY.en).button}</button></div>`;
export function createAudioDeviceUI({getLanguage,document=globalThis.document}){
 const dialog=document.createElement('dialog');dialog.className='audio-device-dialog';dialog.dataset.noTranslate='';dialog.setAttribute('aria-labelledby','audioDeviceTitle');document.body.append(dialog);
 const make=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
 function paint(){
  const c=COPY[getLanguage()]||COPY.en;document.querySelectorAll('[data-audio-devices]').forEach(b=>{if(b.textContent!==c.button)b.textContent=c.button;});if(!dialog.open)return;
  const head=make('div','');head.className='audio-device-heading';const title=make('h2',c.button);title.id='audioDeviceTitle';const close=make('button',c.close);close.type='button';close.onclick=()=>dialog.close();head.append(title,close);dialog.replaceChildren(head,make('p',c.route),make('p',c.hint));
  if(hasNativeMedia()){const settings=make('button',c.permissions);settings.className='secondary';settings.onclick=()=>openMediaSettings().catch(()=>{dialog.append(make('p',c.failed));});dialog.append(settings);}
  const browser=browserAudioContext(globalThis.navigator?.userAgent||'');
  if(browser.embedded&&!isNative()){
   dialog.append(make('p',c.embedded));const links=companionBrowserLinks(document.location.href);
   if(browser.android)for(const [name,url] of [[c.chrome,links.chrome],[c.samsung,links.samsung]]){const a=make('a',name);a.href=url;a.className='secondary';dialog.append(a);}
   const link=make('a',c.link);link.href=links.link;dialog.append(link);
  }
 }
 document.addEventListener('click',e=>{if(e.target.closest('[data-audio-devices]')){if(!dialog.open)dialog.showModal();paint();}});
 document.querySelector('#languageSelect')?.addEventListener('change',paint);
 return {dialog,paint};
}
