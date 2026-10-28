export const MAP_FULLSCREEN_COPY={
 ko:{enter:'전체 화면',exit:'전체 화면 닫기',title:'전체 화면 지도'},
 en:{enter:'Full screen',exit:'Exit full screen',title:'Full screen map'},
 zh:{enter:'全屏地图',exit:'退出全屏',title:'全屏地图'}
};
let activeView=null;
const focusable='button:not(:disabled),a[href],select:not(:disabled),input:not(:disabled),summary,[tabindex="0"]';

// Reparent only the map, never its camera, microphone or audio elements.
// A modal dialog fills the browser viewport, including browsers without the
// system Fullscreen API. The original MapLibre instance and GPS feed stay live.
export class MapFullscreen{
 constructor({getRoot,getLanguage,onResize=()=>{}}){Object.assign(this,{getRoot,getLanguage,onResize});}
 get active(){return !!this.shell;}
 get copy(){return MAP_FULLSCREEN_COPY[this.getLanguage()]||MAP_FULLSCREEN_COPY.ko;}
 open(trigger){
  if(this.active)return;
  const root=this.getRoot();if(!root?.isConnected)return;
  activeView?.close();activeView=this;
  this.root=root;this.doc=root.ownerDocument;this.previousFocus=trigger||this.doc.activeElement;
  const directory=root.querySelector('.map-tools');if(directory)directory.open=false;
  const scope=root.closest('.camera-fullscreen')||root.closest('.home-map-stack')||this.doc;
  this.placeholder=this.doc.createElement('div');
  this.placeholder.className='map-fullscreen-placeholder';
  this.placeholder.style.height=root.getBoundingClientRect().height+'px';
  root.before(this.placeholder);
  const shell=this.shell=this.doc.createElement('dialog');
  shell.className='map-fullscreen-shell';shell.dataset.noTranslate='';
  shell.setAttribute('aria-label',this.copy.title);
  shell.innerHTML='<header class="map-fullscreen-header"><b data-full-map-title></b><div data-full-map-gps></div><button type="button" class="map-fullscreen-exit" data-full-map-exit>×</button></header><div class="map-fullscreen-voice" data-full-map-voice hidden></div>';
  // These controls use the application's existing delegated actions and live
  // status updates. Cloning presentation controls does not restart media.
  const gps=scope.querySelector('[data-gps-toggle]');
  if(gps){const b=gps.cloneNode(true);b.removeAttribute('id');shell.querySelector('[data-full-map-gps]').append(b);}
  const controls=scope.querySelector('.ride-voice-controls');
  if(controls){
   const bar=shell.querySelector('[data-full-map-voice]');bar.hidden=false;shell.classList.add('has-voice');
   bar.append(controls.cloneNode(true));
   const retry=scope.querySelector('[data-action="audio-unlock"]');if(retry)bar.append(retry.cloneNode(true));
  }
  this.doc.body.append(shell);shell.prepend(root);root.classList.add('map-is-fullscreen');
  this.doc.body.classList.add('map-fullscreen-open');
  this.onCancel=e=>{e.preventDefault();this.close();};
  this.onClose=()=>this.close();
  this.onExit=()=>this.close();
  shell.addEventListener('cancel',this.onCancel);shell.addEventListener('close',this.onClose);
  shell.querySelector('[data-full-map-exit]').addEventListener('click',this.onExit);
  this.onKey=e=>{
   if(e.key==='Escape'){e.preventDefault();this.close();return;}
   if(e.key!=='Tab')return;
   const nodes=[...shell.querySelectorAll(focusable)].filter(el=>{
    if(el.closest('[hidden]'))return false;
    for(let parent=el.parentElement;parent&&parent!==shell;parent=parent.parentElement)
     if(parent.tagName==='DETAILS'&&!parent.open&&!parent.querySelector('summary')?.contains(el))return false;
    return el.getClientRects().length>0;
   });
   if(!nodes.length){e.preventDefault();shell.querySelector('[data-full-map-exit]').focus();return;}
   const first=nodes[0],last=nodes.at(-1),current=this.doc.activeElement;
   if(e.shiftKey&&(current===first||!shell.contains(current))){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&(current===last||!shell.contains(current))){e.preventDefault();first.focus();}
  };
  shell.addEventListener('keydown',this.onKey);
  this.language();
  let modal=false;
  try{if(typeof shell.showModal==='function'){shell.showModal();modal=true;}}catch{}
  if(!modal){
   shell.setAttribute('open','');shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');
   this.inertSiblings=[...this.doc.body.children].filter(el=>el!==shell).map(el=>({el,inert:el.hasAttribute('inert')}));
   for(const {el}of this.inertSiblings)el.setAttribute('inert','');
   this.onFocus=e=>{if(this.shell&&!shell.contains(e.target))shell.querySelector('[data-full-map-exit]').focus();};
   this.doc.addEventListener('focusin',this.onFocus);
  }
  shell.querySelector('[data-full-map-exit]').focus({preventScroll:true});
  this.onResize();
 }
 language(){
  const root=this.getRoot(),c=this.copy;
  for(const b of root?.querySelectorAll('[data-map-fullscreen]')||[]){b.setAttribute('aria-label',c.enter);b.title=c.enter;b.querySelector('span').textContent=c.enter;}
  if(!this.shell)return;
  this.shell.setAttribute('aria-label',c.title);this.shell.querySelector('[data-full-map-title]').textContent=c.title;
  const b=this.shell.querySelector('[data-full-map-exit]');b.setAttribute('aria-label',c.exit);b.title=c.exit;
 }
 close({restoreFocus=true}={}){
  const shell=this.shell;if(!shell)return;
  this.shell=null;if(activeView===this)activeView=null;
  shell.removeEventListener('cancel',this.onCancel);shell.removeEventListener('close',this.onClose);shell.removeEventListener('keydown',this.onKey);
  if(this.onFocus)this.doc.removeEventListener('focusin',this.onFocus);this.onFocus=null;
  for(const {el,inert}of this.inertSiblings||[])if(!inert)el.removeAttribute('inert');
  this.inertSiblings=null;
  this.root.classList.remove('map-is-fullscreen');
  if(this.placeholder.parentNode)this.placeholder.replaceWith(this.root);else this.root.remove();
  try{if(shell.open&&typeof shell.close==='function')shell.close();}catch{}
  shell.remove();this.doc.body.classList.remove('map-fullscreen-open');
  this.onResize();
  if(restoreFocus&&this.previousFocus?.isConnected)this.previousFocus.focus({preventScroll:true});
  this.root=null;this.placeholder=null;this.previousFocus=null;
 }
 destroy(){this.close({restoreFocus:false});}
}
