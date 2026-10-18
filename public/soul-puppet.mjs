import {BUILD} from './build-version.mjs';
let nextId=0;
// Landmarks use the unchanged 1254px cover coordinate space. The cover's actual
// eyes, brows and mouth remain the face; only the separated body and hands are new.
const rigs={
 lumi:{name:'Lumi',color:'blue',body:[108,126,.88,700,1],
  eyes:[{at:[525,495],shape:'<ellipse rx="74" ry="81" transform="rotate(20)"/>'},{at:[779,562],shape:'<ellipse rx="64" ry="78" transform="rotate(20)"/>'}],
  brows:[{at:[568,361],shape:'<path d="M-30 6 Q-18-13 17-11 Q31-9 27 3 Q25 9 8 7 L-26 13 Q-33 14-30 6Z"/>'},{at:[814,428],shape:'<path d="M-18-18 Q-8-23 8-8 Q23 7 18 18 Q11 21 5 10 L-17-5 Q-25-13-18-18Z"/>'}],
  mouth:{at:[642,588],shape:'<path d="M-34-28 Q-29-34-18-25 Q1-15 30-14 Q43-15 35 2 Q21 35-5 30 Q-35 27-36-5Z"/>'},
  left:{anchor:[497,728],crop:[1130,210,260,185],root:[1345,330],scale:.66},right:{anchor:[719,772],crop:[1150,515,270,175],root:[1183,566],scale:.62}},
 mori:{name:'Mori',color:'mint',body:[134,119,.906,650,.99],
  eyes:[{at:[460,525],shape:'<path d="M-48-19 Q-42-29-34-15 Q-4 10 34-10 Q51-22 49-7 Q43 18 7 23 Q-35 25-47-2 Q-50-12-48-19Z"/>'},{at:[699,553],shape:'<path d="M-53-18 Q-53-30-40-20 Q-3 13 37-8 Q52-18 54-5 Q47 22 12 26 Q-28 28-48 2Z"/>'}],brows:[],
  mouth:{at:[568,572],shape:'<path d="M-34-11 Q-32-20-22-10 Q-3 7 24-5 Q38-14 35 0 Q19 19-9 15 Q-31 11-34-3Z"/>'},
  left:{anchor:[382,696],crop:[1180,195,245,215],root:[1224,244],scale:.66},right:{anchor:[763,733],crop:[1200,470,230,205],root:[1376,520],scale:.69}},
 bori:{name:'Bori',color:'orange',body:[126,80,.96,749,1.14],
  eyes:[{at:[466,543],shape:'<ellipse rx="61" ry="69" transform="rotate(18)"/>'},{at:[721,585],shape:'<ellipse rx="63" ry="69" transform="rotate(12)"/>'}],
  brows:[{at:[492,421],shape:'<path d="M-28 5 Q-15-15 10-15 Q30-15 30-3 Q29 6 16 3 Q-1-4-21 12 Q-30 19-29 9Z"/>'},{at:[753,468],shape:'<path d="M-25-17 Q-20-27-2-16 Q18-5 24 12 Q28 25 17 19 Q2-1-16-3 Q-28-5-25-17Z"/>'}],
  mouth:{at:[585,616],shape:'<path d="M-39-35 Q-35-43-22-32 Q-3-19 30-26 Q47-32 45-17 Q39 20 12 35 Q-15 46-34 16 Q-47-4-43-26Z"/>'},
  left:{anchor:[436,755],crop:[1140,165,265,210],root:[1345,220],scale:.5},right:{anchor:[766,790],crop:[1150,440,265,205],root:[1218,504],scale:.7,flip:true}}
};
export function soulPuppet(soul){
 const rig=rigs[soul];if(!rig)return '';
 const id=`soul-surface-${++nextId}`,file=`/assets/${soul}-cover-rig.webp?v=${BUILD}`,portrait=`/soul-${rig.color}.webp?v=${BUILD}`;
 const image=`<image href="${file}" width="1536" height="1024"/>`;
 let clips='';
 const feature=(part,info,index=0)=>{
  const clip=`${id}-${part}-${index}`,[x,y]=info.at;clips+=`<clipPath id="${clip}">${info.shape}</clipPath>`;
  const classes=part==='eye'?'soul-eye-blink':part==='mouth'?'mouth-texture':`soul-brow brow-${index?'right':'left'}`;
  return `<g class="soul-${part}" transform="translate(${x} ${y})"><g class="${classes}"><g clip-path="url(#${clip})"><image href="${portrait}" x="${-x}" y="${-y}" width="1254" height="1254"/></g></g></g>`;
 };
 const face=`<g class="soul-face">${rig.eyes.map((v,i)=>feature('eye',v,i)).join('')}${rig.brows.map((v,i)=>feature('brow',v,i)).join('')}${feature('mouth',rig.mouth)}</g>`;
 const arm=side=>{
  const {anchor,crop,root,scale,flip}=rig[side],x=(crop[0]-root[0])*scale,y=(crop[1]-root[1])*scale;
  const snack=soul==='bori'&&side==='right'?`<g class="soul-wrist"><svg class="soul-snack" x="-383" y="-149" width="312" height="234" viewBox="1080 680 400 300">${image}</svg></g>`:'';
  return `<g class="soul-shoulder" data-side="${side}" transform="translate(${anchor.join(' ')})"><g class="soul-joint soul-arm arm-${side}" data-bone="arm-${side}">${snack}<g${flip?' transform="scale(-1 1)"':''}><svg x="${x}" y="${y}" width="${crop[2]*scale}" height="${crop[3]*scale}" viewBox="${crop.join(' ')}">${image}</svg></g></g></g>`;
 };
 const [x,y,scale,seam,tailScale]=rig.body;
 // Two touching texture bands align the head and tail to the cover landmarks;
 // all facial features and shoulder pivots share this single design space.
 const body=`<g class="soul-core"><svg x="${x}" y="${y}" width="${1024*scale}" height="${(seam+4)*scale}" viewBox="0 0 1024 ${seam+4}" preserveAspectRatio="none">${image}</svg><svg x="${x}" y="${y+seam*scale}" width="${1024*scale}" height="${(1024-seam)*tailScale}" viewBox="0 ${seam} 1024 ${1024-seam}" preserveAspectRatio="none">${image}</svg></g>`;
 return `<span class="soul-puppet ${soul}" data-soul="${soul}" data-expression="greeting" role="img" aria-label="${rig.name} animated companion"><svg class="puppet-defs" aria-hidden="true"><defs>${clips}</defs></svg><span class="soul-body"><svg class="soul-rig" viewBox="0 0 340 410" aria-hidden="true"><g class="soul-design" transform="translate(-80 -30) scale(.4)">${body}${face}${arm('right')}${arm('left')}</g></svg><span class="soul-emote" aria-hidden="true">${soul==='lumi'?'✦':soul==='mori'?'♪':'♡'}</span></span></span>`;
}
export function paintSoulExpression(root,state){
 const expression=['rest','greeting','listening','thinking','talking'].includes(state)?state:'rest';
 root.querySelectorAll('.soul-puppet').forEach(el=>{el.dataset.expression=expression;});
}
