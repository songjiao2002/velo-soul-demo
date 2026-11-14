import {CHARACTERS,characterArtwork} from './character-art.mjs';
import {rideDiary,DIARY_COPY} from './journey-diary.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const FLOW_COPY={
 en:{history:'Scan history',empty:'Scanned bikes will appear here.',scan:'Scan a bike’s QR',hint:'Point the camera at a bike’s QR code.',camera:'Camera',map:'Map',capture:'Take a photo',hold:'Tap to take a photo · Hold to finish',finish:'Finish ride',translate:'Translate',translating:'Translating…',failed:'Translation unavailable. Your original diary is unchanged.',original:'Original',details:'Photos, route and export'},
 ko:{history:'스캔 기록',empty:'스캔한 자전거가 여기에 표시돼요.',scan:'자전거 QR 스캔하기',hint:'자전거의 QR 코드를 카메라에 비춰주세요.',camera:'카메라',map:'지도',capture:'사진 찍기',hold:'짧게 눌러 촬영 · 길게 눌러 종료',finish:'라이딩 마치기',translate:'번역',translating:'번역 중…',failed:'번역하지 못했어요. 원본 일기는 그대로 보관돼요.',original:'원문',details:'사진, 경로 및 내보내기'},
 zh:{history:'扫码历史',empty:'扫描过的自行车会显示在这里。',scan:'扫描自行车二维码',hint:'将相机对准自行车上的二维码。',camera:'相机',map:'地图',capture:'拍照',hold:'轻触拍照 · 长按结束骑行',finish:'结束骑行',translate:'翻译',translating:'正在翻译…',failed:'暂时无法翻译，原始日记已保留。',original:'原文',details:'照片、路线与导出'}
};
export function readScanHistory(storage=globalThis.localStorage){try{return JSON.parse(storage.getItem('velo-soul-scan-history')||'[]').filter(x=>Object.hasOwn(CHARACTERS,x?.soul)&&Number.isFinite(x.at)&&x.at>0).slice(0,20);}catch{return [];}}
export function rememberScan(soul,storage=globalThis.localStorage,at=Date.now()){
 if(!Object.hasOwn(CHARACTERS,soul))return;
 const entries=[{soul,at},...readScanHistory(storage).filter(x=>x.soul!==soul)].slice(0,20);
 try{storage.setItem('velo-soul-scan-history',JSON.stringify(entries));}catch{}
 return entries;
}
export function mobileScanner(language='en',history=[]){
 const c=FLOW_COPY[language]||FLOW_COPY.en;
 const rows=history.map(x=>`<li><button type="button" data-meet="${x.soul}">${CHARACTERS[x.soul].en}</button><time datetime="${new Date(x.at).toISOString()}">${esc(new Date(x.at).toLocaleString(language,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}))}</time></li>`).join('');
 return `<section class="scan-home"><div class="scan-home-card"><div class="camera-view scanning" id="cameraView"><video id="cameraVideo" autoplay playsinline muted aria-label="${c.camera}"></video><div class="camera-placeholder"><svg class="scan-illustration" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 5H5v11M32 5h11v11M5 32v11h11m16 0h11V32M15 15h6v6h-6zm12 0h6v6h-6zM15 27h6v6h-6zm12 0h6v6h-6z"/></svg></div><span class="camera-label" id="cameraLabel">CAMERA OFF</span><div class="scan-target" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div><aside id="cameraRecovery" class="camera-recovery" hidden></aside></div><section class="scan-history-card"><h2>${c.history}</h2>${rows?'<ul class="scan-history-list">'+rows+'</ul>':'<p class="scan-history-empty">'+c.empty+'</p>'}</section><div class="scan-home-action"><button class="primary" id="cameraStart" data-action="camera-start">${c.scan}</button><p class="camera-status" id="cameraStatus" role="status">${c.hint}</p></div></section>`;
}
export function mobileCameraControls(language,photos=[],riding=true){const c=FLOW_COPY[language];return `<div class="camera-bottom" data-no-translate><button class="camera-scene-tab" data-scene-mode="camera" aria-pressed="true">${c.camera}</button><div class="camera-capture-controls"><button class="camera-photo-preview" id="downloadPhoto" data-action="download-photo" aria-label="${c.details}" ${photos.length?'':'disabled'}><img id="cameraThumb" alt="" ${photos.length?'src="'+esc(photos.at(-1))+'"':'hidden'}><span id="cameraPhotoCount">${photos.length}</span></button><button class="camera-shutter" id="capturePhoto" data-mobile-shutter ${riding?'data-hold-finish':''} aria-label="${riding?c.hold:c.capture}" aria-describedby="shutterHint" data-camera-live="false"><span></span></button></div><button class="camera-scene-tab" data-scene-mode="map" aria-pressed="false">${c.map}</button><p class="shutter-hint" id="shutterHint">${riding?c.hold:c.capture}</p></div>`;}

// One completed gesture causes one action; interrupted gestures never finish a ride.
export function createShutterGesture({capture,finish,holdMs=650,setTimer=setTimeout,clearTimer=clearTimeout}){
 let timer=null,pressed=false,held=false;
 const cancel=()=>{clearTimer(timer);timer=null;pressed=false;held=false;};
 return {begin(canFinish=true){if(pressed)return;pressed=true;held=false;if(canFinish)timer=setTimer(()=>{timer=null;if(pressed){held=true;finish();}},holdMs);},end(){if(!pressed)return;const take=!held;cancel();if(take)capture();},cancel};
}
export function wireMobileShutter(button,{capture,finish}){
 if(!button)return ()=>{};
 const abort=new AbortController(),options={signal:abort.signal};let pointer=null,start=null;
 const clear=()=>{gesture.cancel();button.classList.remove('holding');pointer=null;start=null;};
 const gesture=createShutterGesture({capture,finish:()=>{button.classList.remove('holding');if(button.isConnected)finish();}});
 button.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;e.preventDefault();pointer=e.pointerId;start=[e.clientX,e.clientY];button.setPointerCapture?.(pointer);button.classList.add('holding');gesture.begin(button.hasAttribute('data-hold-finish'));},options);
 button.addEventListener('pointermove',e=>{if(pointer===e.pointerId&&start&&Math.hypot(e.clientX-start[0],e.clientY-start[1])>20)clear();},options);
 button.addEventListener('pointerup',e=>{if(pointer!==e.pointerId)return;gesture.end();clear();},options);
 for(const type of ['pointercancel','lostpointercapture','blur'])button.addEventListener(type,clear,options);
 button.addEventListener('keydown',e=>{if(e.key==='Escape'){clear();return;}if(![' ','Enter'].includes(e.key)||e.repeat)return;e.preventDefault();button.classList.add('holding');gesture.begin(button.hasAttribute('data-hold-finish'));},options);
 button.addEventListener('keyup',e=>{if(![' ','Enter'].includes(e.key))return;e.preventDefault();gesture.end();clear();},options);
 button.addEventListener('click',e=>{e.preventDefault();if(e.detail===0&&!button.classList.contains('holding'))capture();},options);
 button.addEventListener('contextmenu',e=>e.preventDefault(),options);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();},options);
 return ()=>{clear();abort.abort();};
}
export function diaryTranslationMenu(language,chosen,busy=false){const c=FLOW_COPY[language];return `<details class="diary-translation" data-no-translate><summary aria-label="${c.translate}" title="${c.translate}"><span class="translation-icon" aria-hidden="true"></span></summary><div class="diary-translation-options">${[['en','English'],['ko','한국어'],['zh','中文'],['original',c.original]].map(([key,label])=>`<button type="button" data-diary-language="${key}" aria-label="${label}" aria-pressed="${chosen===key}" ${busy?'disabled':''}>${label}</button>`).join('')}</div></details>`;}
export function mobileDiaryEntry(record,{language='en',diary=rideDiary(record,language),extras='',status=''}={}){
 const c=FLOW_COPY[language],copy=DIARY_COPY[language];
 return `<article class="post diary-entry" data-diary-id="${esc(record.id)}" data-no-translate><div class="diary-entry-cover">${record.photos?.length?'<img src="'+esc(record.photos[0])+'" alt="">':characterArtwork(record.soul,'riding')}</div><div class="diary-entry-body"><h1 lang="${esc(diary.language)}">${esc(diary.title)}</h1><div class="diary-body" lang="${esc(diary.language)}">${diary.body.split(/\n\s*\n/).map(p=>'<p>'+esc(p)+'</p>').join('')}</div><div class="diary-entry-time"><time>${esc(diary.date)}</time></div><p class="diary-translation-status" role="status">${esc(status)}</p>${record.note?'<p class="post-note">'+esc(record.note)+'</p>':''}<details class="diary-extras"><summary>${c.details}</summary>${extras}<div class="post-actions"><button data-diary-copy="${esc(record.id)}">${copy.copy}</button><button data-export="${esc(record.id)}">${copy.image}</button><button data-delete="${esc(record.id)}">${copy.remove}</button></div></details></div></article>`;
}
