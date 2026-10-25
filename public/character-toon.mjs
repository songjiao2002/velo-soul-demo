import * as T from 'three';
import {OutlineEffect} from 'three/addons/effects/OutlineEffect.js';
import {createCharacterModel,animateCharacter,disposeCharacter} from './character-toon-model.mjs';

let renderer=null,effect=null,failed=false,frame=0,last=0,observer=null,visibility=null;
const views=new Map(),watched=new Set(),camera=new T.OrthographicCamera(-1.6,1.6,1.6,-1.6,.1,30);
camera.position.set(0,2.05,7);camera.lookAt(0,1.35,0);
const setState=(host,value)=>{if(host.dataset.toonState!==value)host.dataset.toonState=value;};
function ensureRenderer(){
 if(renderer)return !failed;if(failed)return false;
 try{
  renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
  renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NoToneMapping;
  effect=new OutlineEffect(renderer,{defaultThickness:.0025,defaultColor:new T.Color(0x716857).toArray()});
  effect.autoClear=true;
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();failed=true;for(const [host]of views)setState(host,'fallback');});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{failed=false;});
  return true;
 }catch{failed=true;return false;}
}
function createView(host){
 if(views.has(host)||!host.isConnected)return;
 // Conversation thumbnails stay SVG; only the large companion needs a scene.
 const rect=host.getBoundingClientRect();if(rect.width<125||rect.height<125)return;
 if(!ensureRenderer()){setState(host,'fallback');return;}
 const canvas=host.querySelector('.toon-canvas'),context=canvas?.getContext('2d');if(!context)return;
 try{
  const model=createCharacterModel(host.dataset.soul),scene=new T.Scene();scene.add(model.root);
  scene.add(new T.AmbientLight(0xffffff,.85));const key=new T.DirectionalLight(0xffffff,2.25);key.position.set(-3,6,5);scene.add(key);
  const view={model,scene,canvas,context,yaw:.55,target:.55,drag:false,x:0,y:0,down:false,facing:null};views.set(host,view);
  host.addEventListener('pointerdown',view.start=e=>{if(!host.hasAttribute('data-turnable')||e.button>0)return;view.down=true;view.drag=false;view.x=e.clientX;view.y=e.clientY;});
  host.addEventListener('pointermove',view.move=e=>{if(!view.down)return;const dx=e.clientX-view.x,dy=e.clientY-view.y;if(!view.drag){if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>7){view.down=false;return;}if(Math.abs(dx)<5)return;view.drag=true;host.setPointerCapture?.(e.pointerId);}view.target+=dx*.012;view.x=e.clientX;view.y=e.clientY;host.dataset.autoTurn='false';});
  host.addEventListener('pointerup',view.end=e=>{view.down=view.drag=false;if(host.hasPointerCapture?.(e.pointerId))host.releasePointerCapture(e.pointerId);});
  host.addEventListener('pointercancel',view.end);host.addEventListener('lostpointercapture',view.end);
  host.addEventListener('keydown',view.key=e=>{if(!host.hasAttribute('data-turnable'))return;if(['ArrowLeft','ArrowRight','Home'].includes(e.key)){view.target=e.key==='Home'?0:view.target+(e.key==='ArrowLeft'?-.3:.3);host.dataset.autoTurn='false';e.preventDefault();}});
 }catch{setState(host,'fallback');}
}
function removeView(host,view){
 host.removeEventListener('pointerdown',view.start);host.removeEventListener('pointermove',view.move);host.removeEventListener('pointerup',view.end);host.removeEventListener('pointercancel',view.end);host.removeEventListener('lostpointercapture',view.end);host.removeEventListener('keydown',view.key);disposeCharacter(view.model);views.delete(host);
}
function attach(){
 for(const host of document.querySelectorAll('[data-character-toon]'))if(!watched.has(host)){watched.add(host);if(visibility)visibility.observe(host);else createView(host);}
 for(const host of watched)if(!host.isConnected){visibility?.unobserve(host);watched.delete(host);const view=views.get(host);if(view)removeView(host,view);}
}
function renderView(host,view,time,dt){
 const rect=host.getBoundingClientRect();if(rect.width<125||rect.height<125||rect.bottom<0||rect.top>innerHeight||rect.right<0||rect.left>innerWidth)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const facing=host.dataset.facing+':'+(host.dataset.turnRevision||'0');
 if(facing!==view.facing){view.facing=facing;if(Number.isFinite(Number(host.dataset.facing)))view.target=Number(host.dataset.facing);}
 if(host.dataset.autoTurn==='true'&&!view.down&&!reduced)view.target+=dt*.42;
 view.yaw=reduced?view.target:T.MathUtils.lerp(view.yaw,view.target,1-Math.exp(-dt*12));
 animateCharacter(view.model,{time,dt,state:host.dataset.previewActivity||host.dataset.activity||host.dataset.pose||'idle',speed:host.dataset.speed===undefined?12:Number(host.dataset.speed),expression:host.dataset.expression,speech:host.dataset.mouthActive==='true'?Number(host.style.getPropertyValue('--speech-open'))||0:0,yaw:view.yaw,reduced});
 const ratio=Math.min(devicePixelRatio||1,1.5),w=Math.max(1,Math.min(600,Math.round(rect.width*ratio))),h=Math.max(1,Math.min(600,Math.round(rect.height*ratio)));
 if(view.canvas.width!==w||view.canvas.height!==h){view.canvas.width=w;view.canvas.height=h;}
 const half=Math.max(1.55,1.33/(w/h))/(Math.max(75,Math.min(125,Number(host.dataset.lookSize)||100))/100);camera.left=-half*w/h;camera.right=half*w/h;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
 effect.setSize(w,h);effect.render(view.scene,camera);view.context.clearRect(0,0,w,h);view.context.drawImage(renderer.domElement,0,0,w,h);
 setState(host,'ready');const yaw=String(Math.round(view.yaw*180/Math.PI));if(host.dataset.rotation!==yaw)host.dataset.rotation=yaw;
}
function tick(ms){
 frame=requestAnimationFrame(tick);if(document.hidden||failed||ms-last<50)return;const dt=Math.min(.1,(ms-last)/1000||.05);last=ms;
 for(const [host,view]of views){if(!host.isConnected){removeView(host,view);continue;}try{renderView(host,view,ms/1000,dt);}catch{setState(host,'fallback');removeView(host,view);}}
}
export function mountCharacters(){
 if(!observer){if(globalThis.IntersectionObserver)visibility=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)createView(e.target);},{rootMargin:'100px'});
  observer=new MutationObserver(records=>{if(records.some(r=>r.addedNodes.length||r.removedNodes.length))attach();});observer.observe(document.body,{childList:true,subtree:true});}
 attach();if(!frame)frame=requestAnimationFrame(tick);
}
export function disposeCharacters(){
 cancelAnimationFrame(frame);frame=0;last=0;observer?.disconnect();observer=null;visibility?.disconnect();visibility=null;watched.clear();
 for(const [host,view]of views){setState(host,'fallback');removeView(host,view);}renderer?.dispose();renderer?.forceContextLoss();renderer=null;effect=null;failed=false;
}
export function characterSnapshot(id){
 for(const [host,view]of views)if(host.dataset.soul===id&&host.dataset.toonState==='ready'&&host.isConnected){const copy=document.createElement('canvas');copy.width=view.canvas.width;copy.height=view.canvas.height;copy.getContext('2d').drawImage(view.canvas,0,0);return copy;}return null;
}
