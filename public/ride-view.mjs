import {KoreaMap,mapMarkup} from './korea-map.mjs';
export const RIDE_VIEW_COPY={
 zh:{camera:'相机',map:'地图',title:'切换骑行画面',center:'回到当前位置',live:'相机仍开启 · 可随时关闭',off:'相机未开启',hint:'地图与相机切换不影响语音对话'},
 en:{camera:'Camera',map:'Map',title:'Switch ride view',center:'My location',live:'Camera is still on · turn off any time',off:'Camera is off',hint:'Conversation continues when switching views'},
 ko:{camera:'카메라',map:'지도',title:'라이딩 화면 전환',center:'현재 위치로',live:'카메라 켜짐 · 언제든 끌 수 있어요',off:'카메라 꺼짐',hint:'화면을 바꿔도 음성 대화는 계속돼요'}
};
export function rideViewMarkup(lang){const c=RIDE_VIEW_COPY[lang]||RIDE_VIEW_COPY.en;return `<div class="scene-switch" role="group" aria-label="${c.title}" data-no-translate><button type="button" data-scene-mode="camera" aria-pressed="true">${c.camera}</button><button type="button" data-scene-mode="map" aria-pressed="false">${c.map}</button></div><div class="scene-map-layer" hidden data-no-translate>${mapMarkup(lang,true)}<button class="scene-recenter" type="button" data-scene-center>${c.center}</button><p class="scene-camera-note" data-scene-camera>${c.off}</p><p class="scene-map-hint">${c.hint}</p></div>`;}

// This controller changes presentation only. It never starts/stops media,
// changes the audio session or re-renders the camera/conversation DOM.
export class RideView {
 constructor({getLanguage,getPoints,isCameraLive,map=new KoreaMap({getLanguage})}){Object.assign(this,{getLanguage,getPoints,isCameraLive,map});this.mode='camera';}
 switch(root,mode){
  if(!root||!['camera','map'].includes(mode))return;
  if(this.root!==root){this.destroy();this.root=root;
  }
  this.mode=mode;root.dataset.sceneMode=mode;
  root.querySelectorAll('[data-scene-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sceneMode===mode)));
  const layer=root.querySelector('.scene-map-layer');layer.hidden=mode!=='map';
  if(mode==='map'){
   const target=layer.querySelector('[data-korea-map]');
   if(this.map.root!==target)this.map.attach(target,this.getPoints());
   else{this.map.map?.resize();this.map.update(this.getPoints());}
  }else this.map.map?.stop();
  this.language();
 }
 update(){if(this.mode==='map')this.map.update(this.getPoints());this.cameraStatus();}
 center(){const points=this.getPoints(),last=points.at(-1);if(last&&this.map.map)this.map.map.flyTo({center:[last.lon,last.lat],zoom:15,duration:400});else this.map.update([],true);}
 cameraStatus(){if(this.root){const c=RIDE_VIEW_COPY[this.getLanguage()];this.root.querySelector('[data-scene-camera]').textContent=c[this.isCameraLive()?'live':'off'];}}
 language(){if(!this.root)return;const c=RIDE_VIEW_COPY[this.getLanguage()];this.root.querySelector('.scene-switch').setAttribute('aria-label',c.title);for(const b of this.root.querySelectorAll('[data-scene-mode]'))b.textContent=c[b.dataset.sceneMode];this.root.querySelector('[data-scene-center]').textContent=c.center;this.root.querySelector('.scene-map-hint').textContent=c.hint;this.map.language();this.cameraStatus();}
 destroy(){this.resize?.disconnect();this.resize=null;this.map.destroy();this.root=null;this.mode='camera';}
}
