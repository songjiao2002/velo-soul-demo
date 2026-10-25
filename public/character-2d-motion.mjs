import {cyclePose} from './character-2d.mjs';
const views=new Map();let frame=0,last=0,observer=null;
const set=(node,name,value)=>{if(node.getAttribute(name)!==String(value))node.setAttribute(name,String(value));};
function attach(root=document){for(const host of root.querySelectorAll('[data-character-2d]')){if(views.has(host))continue;const svg=host.querySelector('.soul-flat');if(!svg)continue;views.set(host,{svg,phase:0,legs:[...svg.querySelectorAll('[data-flat-leg]')],feet:[...svg.querySelectorAll('[data-flat-foot]')],wheels:[...svg.querySelectorAll('[data-flat-wheel]')],crank:svg.querySelector('[data-flat-crank]')});}}
function tick(ms){frame=requestAnimationFrame(tick);if(document.hidden||ms-last<50)return;const dt=Math.min(.12,(ms-last)/1000||.05);last=ms;
 const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 for(const [host,v]of views){if(!host.isConnected){views.delete(host);continue;}const r=host.getBoundingClientRect();const visible=r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;
  const toonReady=host.dataset.toonState==='ready';set(v.svg,'data-flat-paused',!visible||toonReady);if(!visible||toonReady)continue;
  const activity=host.dataset.previewActivity||host.dataset.activity||host.dataset.pose||'idle',speed=host.dataset.speed===undefined?12:Number(host.dataset.speed),speech=Math.max(0,Math.min(1,Number(host.style.getPropertyValue('--speech-open'))||0));
  set(v.svg,'data-activity',activity);set(v.svg,'data-expression',host.dataset.expression||'rest');set(v.svg,'data-mouth-active',host.dataset.mouthActive==='true');set(v.svg,'data-stopped',activity==='riding'&&!(speed>0));
  if(v.svg.style.getPropertyValue('--speech-open')!==String(speech))v.svg.style.setProperty('--speech-open',String(speech));
  if(activity!=='riding'||reduced||!(speed>0))continue;v.phase+=dt*Math.min(9,speed*.45);
  const pose=cyclePose(v.phase);for(let i=0;i<2;i++){set(v.legs[i],'d',pose[i].path);set(v.feet[i],'transform',`translate(${pose[i].x} ${pose[i].y-3})`);}
  for(const wheel of v.wheels)set(wheel,'transform',`rotate(${v.phase*180/Math.PI} ${wheel.dataset.flatWheel} 304)`);
  set(v.crank,'d',`M${pose[0].x} ${pose[0].y} L${pose[1].x} ${pose[1].y}`);
 }
}
export function mountCharacters(){attach();if(!observer){observer=new MutationObserver(records=>{if(records.some(r=>r.addedNodes.length))attach();});observer.observe(document.body,{childList:true,subtree:true});}if(!frame)frame=requestAnimationFrame(tick);}
export function disposeCharacters(){cancelAnimationFrame(frame);frame=0;last=0;observer?.disconnect();observer=null;views.clear();}
export async function characterSnapshot(id){
 const source=document.querySelector(`[data-character-2d][data-soul="${id}"] .soul-flat`);if(!source)return null;
 const svg=source.cloneNode(true);svg.setAttribute('width','360');svg.setAttribute('height','380');svg.setAttribute('data-mouth-active','false');
 const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent='.soul-flat *{animation:none!important;transition:none!important}';svg.append(style);
 const canvas=document.createElement('canvas');canvas.width=360;canvas.height=380;
 const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml;charset=utf-8'}));
 try{const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=url;});canvas.getContext('2d').drawImage(img,0,0,360,380);return canvas;}catch{return null;}finally{URL.revokeObjectURL(url);}
}
