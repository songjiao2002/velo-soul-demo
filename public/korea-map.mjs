import {BUILD} from './build-version.mjs';
import {koreaMapStyle,mapName,routeFeature} from './korea-map-style.mjs';
import {KOREA_LANDMARKS,MAP_REGIONS,MAP_KINDS,LANDMARK_COPY,landmarkIcon,groupLandmarks} from './korea-landmarks.mjs';
const COPY={ko:{title:'오늘, 우리가 만날 풍경',subtitle:'서울에서 시작하는 작은 지도',loading:'서울의 길을 펼치고 있어요…',preview:'서울 미리보기 · 내 위치 아님',live:'실제 GPS 위치 · 기록된 여정',failed:'지도를 불러오지 못했어요. 다시 시도하거나 소울과 먼저 만나세요.',retry:'지도 다시 열기',note:'OpenStreetMap의 한국 도로·공원·명소. 경로 안내나 자전거 통행 가능 여부를 뜻하지 않아요.',privacy:'지도 타일은 OpenFreeMap에서 불러와요. 공급자는 표시 지역과 IP를 알 수 있지만, 전체 GPS 경로를 업로드하지 않아요.'},en:{title:'A little world to share',subtitle:'A small map, beginning in Seoul',loading:'Unfolding the streets of Seoul…',preview:'Seoul preview · not your location',live:'Live GPS position · recorded journey',failed:'The map could not load. Retry, or meet your soul first.',retry:'Retry map',note:'Korean roads, parks and places from OpenStreetMap. This is not routing or confirmation that cycling is permitted.',privacy:'Tiles load from OpenFreeMap, which receives the viewed area and your IP. Your full GPS trail is not uploaded.'},zh:{title:'今天，会遇见怎样的风景',subtitle:'从首尔展开的一张小地图',loading:'正在展开首尔的街道…',preview:'首尔预览 · 不是你的定位',live:'真实 GPS 位置 · 已记录的旅程',failed:'地图暂时未能加载。可以重试，也可以先认识灵魂。',retry:'重新加载地图',note:'使用 OpenStreetMap 的韩国道路、公园与名胜数据；不提供导航或确认自行车通行权限。',privacy:'地图瓦片来自 OpenFreeMap，供应方会接收显示区域和 IP，不会收到完整 GPS 轨迹。'}};

let library;
function loadLibrary(){if(!library){const css=document.createElement('link');css.rel='stylesheet';css.href=`/vendor/maplibre/maplibre-gl.css?v=${BUILD}`;css.dataset.maplibre='';if(!document.querySelector('[data-maplibre]'))document.head.append(css);const url=`/vendor/maplibre/maplibre-gl.mjs?v=${BUILD}`;library=import(url).catch(error=>{library=null;throw error;});}return library;}
const localized=(value,lang)=>value[lang]||value.ko;
const controls=(lang,region='all')=>{
 const c=LANDMARK_COPY[lang];
 const places=KOREA_LANDMARKS.filter(p=>region==='all'||p.region===region);
 return `<details class="map-explore map-tools"><summary><span>${c.browse}</span><span class="map-tools-count">${places.length}</span><span class="map-tools-chevron" aria-hidden="true">⌄</span></summary><div class="map-tools-body"><div class="map-region-row"><label>${c.region}<select data-map-region>${Object.entries(MAP_REGIONS).map(([id,n])=>`<option value="${id}" ${id===region?'selected':''}>${localized(n,lang)}</option>`).join('')}</select></label><button data-map-all>${c.all}</button><button data-map-location>${c.near}</button></div><div class="map-directory"><div class="map-places">${places.map(p=>`<button data-map-place="${p.id}">${landmarkIcon(p.kind)}<span>${localized(p.name,lang)}</span></button>`).join('')}</div></div></div></details>`;
};
export function mapMarkup(language='ko',compact=false){
 const lang=COPY[language]?language:'ko',c=COPY[lang],l=LANDMARK_COPY[lang];
 return `<section class="korea-map ${compact?'compact-map':'discovery-map'}" data-korea-map data-no-translate><div class="map-title"><div><span>KOREA / A LITTLE WORLD</span><h2 data-map-title>${c.title}</h2></div><span class="map-north" aria-hidden="true">N ↑</span></div><div class="map-viewport"><div class="korea-map-canvas" data-map-canvas role="region" aria-label="${l.explore}"></div><div class="map-loading" data-map-loading role="status"><span class="map-loading-orbit" aria-hidden="true">✧</span><p>${c.loading}</p><button data-map-retry hidden>${c.retry}</button></div></div><div class="map-caption"><span data-map-caption>${c.preview}</span><span class="map-key" data-map-place-word>${l.key}</span></div><div data-map-controls>${controls(lang)}</div><div data-map-detail class="map-place-detail" aria-live="polite" hidden></div><details class="map-privacy"><summary>${lang==='zh'?'地图数据与隐私':lang==='en'?'Map data & privacy':'지도 데이터와 개인정보'}</summary><p class="map-data-note" data-map-note>${c.note}</p><p data-map-privacy>${c.privacy}</p><a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors · ODbL</a><p>Landmarks: UNESCO · Visit Seoul · Wikimedia. <a href="/landmark-sources.html" target="_blank" rel="noopener">${l.source}</a></p></details></section>`;
}
export class KoreaMap{
 constructor({getLanguage=()=> 'ko'}={}){this.getLanguage=getLanguage;this.epoch=0;this.markers=[];this.region='all';}
 get lang(){return COPY[this.getLanguage()]?this.getLanguage():'ko';}
 get places(){return KOREA_LANDMARKS.filter(p=>this.region==='all'||p.region===this.region);}
 attach(root,points=[]){
  this.destroy();if(!root)return;this.root=root;this.points=points;this.region='all';this.manualBrowse=false;this.state='loading';
  this.onClick=e=>{
   const b=e.target.closest('[data-map-place]');
   if(b)this.selectPlace(b.dataset.mapPlace);
   if(e.target.closest('[data-map-all]'))this.setRegion('all');
   if(e.target.closest('[data-map-location]')&&this.points?.length){this.manualBrowse=false;this.region='all';this.selected=null;this.renderControls();this.update(this.points,true);this.addPlaces();}
   if(e.target.closest('[data-map-close]')){this.selected=null;this.renderDetail();}
   if(e.target.closest('[data-map-retry]'))this.attach(root,this.points);
  };
  this.onChange=e=>{if(e.target.matches('[data-map-region]'))this.setRegion(e.target.value);};
  root.addEventListener('click',this.onClick);root.addEventListener('change',this.onChange);this.renderControls();
  if(typeof IntersectionObserver==='undefined')return;
  this.observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){this.observer.disconnect();void this.open();}},{rootMargin:'120px'});
  this.observer.observe(root);
 }
 async open(){
  const serial=this.epoch,root=this.root;this.timer=setTimeout(()=>this.fail(serial),15000);
  try{
   const lib=await loadLibrary();if(serial!==this.epoch||!root.isConnected)return;this.lib=lib;
   lib.setWorkerUrl(`/vendor/maplibre/maplibre-gl-worker.mjs?v=${BUILD}`);
   const accent=getComputedStyle(root).getPropertyValue('--accent').trim()||'#187962';
   this.map=new lib.Map({container:root.querySelector('[data-map-canvas]'),style:koreaMapStyle(this.lang,accent),center:[126.997,37.557],zoom:11.4,minZoom:4,maxZoom:18,attributionControl:{compact:false},cooperativeGestures:true,localIdeographFontFamily:'sans-serif',canvasContextAttributes:{antialias:false},fadeDuration:0});
   this.map.addControl(new lib.NavigationControl({showCompass:false}),'top-right');
   this.map.on('load',()=>{
    if(serial!==this.epoch)return;clearTimeout(this.timer);this.state='ready';
    root.querySelector('[data-map-loading]').hidden=true;root.classList.add('map-ready');
    if(this.selected)this.selectPlace(this.selected.id);
    else if(this.manualBrowse)this.fitPlaces(this.places);
    else this.update(this.points,true);
    this.addPlaces();
   });
   this.map.on('moveend',()=>this.addPlaces());
   this.map.on('dragstart',()=>{this.manualBrowse=true;});
   this.map.on('error',()=>{if(serial===this.epoch&&this.state!=='ready')this.fail(serial);});
  }catch{this.fail(serial);}
 }
 fail(serial){if(serial!==this.epoch||!this.root)return;this.state='failed';const el=this.root.querySelector('[data-map-loading]');el.hidden=false;el.querySelector('p').textContent=COPY[this.lang].failed;el.querySelector('button').hidden=false;}
 renderControls(){
  if(!this.root)return;const target=this.root.querySelector('[data-map-controls]');
  const opened=target.querySelector('details')?.open;
  target.innerHTML=controls(this.lang,this.region);target.querySelector('details').open=!!opened;
  target.querySelector('[data-map-location]').disabled=!this.points?.length;
  this.renderDetail();
 }
 setRegion(region){
  if(!MAP_REGIONS[region])return;
  this.region=region;this.manualBrowse=true;this.selected=null;
  this.renderControls();this.fitPlaces(this.places);this.addPlaces();
  this.root.querySelector('[data-map-caption]').textContent=localized(MAP_REGIONS[region],this.lang);
 }
 fitPlaces(places){
  if(this.state!=='ready'||!places.length)return;
  if(places.length===1){const p=places[0];this.map.flyTo({center:[p.lon,p.lat],zoom:12,duration:600});return;}
  const bounds=new this.lib.LngLatBounds();for(const p of places)bounds.extend([p.lon,p.lat]);
  this.map.fitBounds(bounds,{padding:48,maxZoom:14,duration:600});
 }
 selectPlace(id){
  const p=KOREA_LANDMARKS.find(p=>p.id===id);if(!p)return;
  this.selected=p;this.manualBrowse=true;this.renderDetail();
  if(this.state==='ready')this.map.flyTo({center:[p.lon,p.lat],zoom:p.kind==='nature'?12:15,duration:600});
  this.root.querySelector('[data-map-caption]').textContent=localized(p.name,this.lang);
 }
 renderDetail(){
  if(!this.root)return;const el=this.root.querySelector('[data-map-detail]'),p=this.selected,c=LANDMARK_COPY[this.lang];
  el.hidden=!p;if(!p){el.replaceChildren();return;}
  el.innerHTML=`<div class="map-place-heading">${landmarkIcon(p.kind)}<div><small>${localized(MAP_REGIONS[p.region],this.lang)} · ${localized(MAP_KINDS[p.kind],this.lang)}</small><h3></h3></div><button data-map-close aria-label="${c.close}">×</button></div><p data-map-point-note></p><a target="_blank" rel="noopener">${c.source} ↗</a>`;
  el.querySelector('h3').textContent=localized(p.name,this.lang);
  el.querySelector('[data-map-point-note]').textContent=`${c.representative} ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`;
  el.querySelector('a').href=p.source;
 }
 addPlaces(){
  if(this.state!=='ready'||!this.map)return;
  // Preserve focused marker keyboard navigation by restoring its key after regrouping.
  const active=document.activeElement?.dataset?.mapMarker;
  for(const m of this.markers)m.marker.remove();this.markers=[];
  const groups=groupLandmarks(this.places,xy=>this.map.project(xy)),zoom=this.map.getZoom();
  for(const group of groups){
   const p=group.places[0],many=group.places.length>1,c=LANDMARK_COPY[this.lang];
   const el=document.createElement('button');el.type='button';el.dataset.mapMarker=p.id;
   el.className='soul-map-pin '+(many?'map-cluster':p.kind)+(zoom<13?' pin-icon-only':'');
   const name=many?`${group.places.length} ${c.group}`:localized(p.name,this.lang);
   el.setAttribute('aria-label',name);el.title=name;
   el.innerHTML=many?`<strong>${group.places.length}</strong><span></span>`:`${landmarkIcon(p.kind)}<span></span>`;
   el.querySelector('span').textContent=many?localized(MAP_REGIONS[p.region],this.lang):name;
   el.onclick=()=>{if(many){this.manualBrowse=true;this.fitPlaces(group.places);}else this.selectPlace(p.id);};
   this.markers.push({p,el,marker:new this.lib.Marker({element:el,anchor:'center'}).setLngLat([p.lon,p.lat]).addTo(this.map)});
  }
  if(active)this.markers.find(m=>m.p.id===active)?.el.focus({preventScroll:true});
 }
 update(points=[],fit=false){
  this.points=points;const data=routeFeature(points);
  const btn=this.root?.querySelector('[data-map-location]');if(btn)btn.disabled=!points.length;
  if(!this.map||this.state!=='ready')return;this.map.getSource('journey')?.setData(data);
  const last=points.at(-1);
  if(!last){this.position?.remove();this.position=null;if(!this.manualBrowse)this.root.querySelector('[data-map-caption]').textContent=COPY[this.lang].preview;}
  if(!last&&fit&&!this.manualBrowse)this.map.fitBounds([[126.95,37.51],[127.075,37.60]],{padding:32,duration:0});
  if(last&&Number.isFinite(last.lon)&&Number.isFinite(last.lat)){
   if(!this.position){const el=document.createElement('div');el.className='our-map-position';el.setAttribute('aria-label',LANDMARK_COPY[this.lang].near);this.position=new this.lib.Marker({element:el}).setLngLat([last.lon,last.lat]).addTo(this.map);}
   else this.position.setLngLat([last.lon,last.lat]);
   if(!this.manualBrowse){
    if(fit&&points.length>1){const bounds=new this.lib.LngLatBounds();for(const p of points)bounds.extend([p.lon,p.lat]);this.map.fitBounds(bounds,{padding:45,maxZoom:16,duration:0});}
    else if(fit||points.length===1)this.map.jumpTo({center:[last.lon,last.lat],zoom:14});
    this.root.querySelector('[data-map-caption]').textContent=COPY[this.lang].live;
   }
  }
 }
 language(){
  if(!this.root)return;const lang=this.lang,c=COPY[lang],l=LANDMARK_COPY[lang];
  this.root.querySelector('[data-map-canvas]').setAttribute('aria-label',l.explore);
  this.root.querySelector('.map-privacy summary').textContent=lang==='zh'?'地图数据与隐私':lang==='en'?'Map data & privacy':'지도 데이터와 개인정보';
  this.root.querySelector('.map-privacy a[href="/landmark-sources.html"]').textContent=l.source;
  this.root.querySelector('[data-map-retry]').textContent=c.retry;
  if(this.state==='loading')this.root.querySelector('[data-map-loading] p').textContent=c.loading;
  this.root.querySelector('[data-map-title]').textContent=c.title;
  this.root.querySelector('[data-map-note]').textContent=c.note;
  this.root.querySelector('[data-map-privacy]').textContent=c.privacy;
  this.root.querySelector('[data-map-caption]').textContent=this.selected?localized(this.selected.name,lang):this.manualBrowse?localized(MAP_REGIONS[this.region],lang):this.points?.length?c.live:c.preview;
  this.root.querySelector('[data-map-place-word]').textContent=l.key;
  this.renderControls();
  if(this.state==='ready'){this.addPlaces();for(const layer of this.map.getStyle().layers.filter(x=>x.type==='symbol'))this.map.setLayoutProperty(layer.id,'text-field',mapName(lang));}
  else if(this.state==='failed')this.fail(this.epoch);
 }
 destroy(){
  this.epoch++;clearTimeout(this.timer);this.observer?.disconnect();
  if(this.root){this.root.removeEventListener('click',this.onClick);this.root.removeEventListener('change',this.onChange);}
  for(const m of this.markers)m.marker.remove();this.markers=[];this.selected=null;
  this.position?.remove();this.position=null;this.map?.remove();this.map=null;this.root=null;
 }
}
