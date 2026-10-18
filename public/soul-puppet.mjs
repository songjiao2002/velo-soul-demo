import {BUILD} from './build-version.mjs';
let nextId=0;
// Landmarks use the unchanged 1254px cover coordinate space. The cover's actual
// eyes and brows remain the face; the original mouth returns between utterances.
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

const mouthPalettes={
 lumi:{edge:'#283c9b',inside:'#171638',bottom:'#473270',tongue:'#b092dd',shine:'#a8baff',tilt:14},
 mori:{edge:'#356849',inside:'#163c2d',bottom:'#366c4d',tongue:'#a6cfad',shine:'#d5efcc',tilt:5},
 bori:{edge:'#ae510b',inside:'#65210e',bottom:'#aa4015',tongue:'#ff9852',shine:'#ffd27a',tilt:8}
};
export function mouthPose(soul,opening=0,roundness=.4){
 const open=Math.max(0,Math.min(1,Number(opening)||0)),round=Math.max(0,Math.min(1,Number(roundness)||0));
 const width=(soul==='bori'?41:soul==='mori'?30:35)*(1-.42*round)*(.95+.1*open),height=4+open*(soul==='mori'?27:soul==='bori'?49:42);
 const n=value=>Number(value.toFixed(2)),w=n(width),h=n(height),top=n(-8-round*7),corner=n(top+5),bow=n(top+7-round*14);
 return {open,closed:open<.045,width:w,height:h,
  aperture:`M${-w} ${corner} C${n(-w*.58)} ${bow} ${n(w*.58)} ${bow} ${w} ${corner} C${n(w*1.05)} ${n(h*.65)} ${n(w*.5)} ${h} 0 ${h} C${n(-w*.5)} ${h} ${n(-w*1.05)} ${n(h*.65)} ${-w} ${corner} Z`,
  tongue:`M${n(-w*.9)} ${n(h*.83)} Q0 ${n(h*.2)} ${n(w*.9)} ${n(h*.83)} L${w} ${n(h+10)} H${-w}Z`,
  lip:`M${n(-w*.72)} ${n(h*.8)} Q0 ${n(h+6)} ${n(w*.72)} ${n(h*.8)}`};
}

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
 const palette=mouthPalettes[soul],pose=mouthPose(soul),mouthId=`${id}-speech`;
 clips+=`<linearGradient id="${mouthId}-cavity" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${palette.inside}"/><stop offset="1" stop-color="${palette.bottom}"/></linearGradient><linearGradient id="${mouthId}-tongue" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${palette.tongue}"/><stop offset="1" stop-color="${palette.bottom}"/></linearGradient><clipPath id="${mouthId}-clip"><path class="mouth-aperture-clip" d="${pose.aperture}"/></clipPath>`;
 const speechMouth=`<g class="soul-speech-mouth" transform="translate(${rig.mouth.at.join(' ')}) rotate(${palette.tilt})"><path class="mouth-closed" d="M-27 -5 Q0 17 27 -5" fill="none" stroke="${palette.edge}" stroke-width="5" stroke-linecap="round"/><g class="mouth-voiced"><path class="mouth-aperture" d="${pose.aperture}" fill="url(#${mouthId}-cavity)" stroke="${palette.edge}" stroke-width="2.4" stroke-linejoin="round"/><g clip-path="url(#${mouthId}-clip)"><path class="mouth-tongue" d="${pose.tongue}" fill="url(#${mouthId}-tongue)"/></g><path class="mouth-lip-glint" d="${pose.lip}" fill="none" stroke="${palette.shine}" stroke-width="2" stroke-linecap="round" opacity=".5"/></g></g>`;
 const face=`<g class="soul-face">${rig.eyes.map((v,i)=>feature('eye',v,i)).join('')}${rig.brows.map((v,i)=>feature('brow',v,i)).join('')}${feature('mouth',rig.mouth)}${speechMouth}</g>`;
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

// Weakly held part references avoid searching the SVG on each audio frame.
const mouthNodes=new WeakMap();
export function paintSoulMouth(root,frame={active:false}){
 const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 root.querySelectorAll('.soul-puppet').forEach(el=>{
  const active=frame.active&&!reduced&&el.dataset.soul===frame.soul;
  if(!active){el.removeAttribute('data-mouth-active');el.removeAttribute('data-mouth-open');return;}
  const pose=mouthPose(el.dataset.soul,frame.open,frame.round);el.dataset.mouthActive='true';el.dataset.mouthOpen=String(!pose.closed);
  if(pose.closed)return;
  let nodes=mouthNodes.get(el);if(!nodes){nodes={aperture:el.querySelector('.mouth-aperture'),clip:el.querySelector('.mouth-aperture-clip'),tongue:el.querySelector('.mouth-tongue'),lip:el.querySelector('.mouth-lip-glint')};mouthNodes.set(el,nodes);}
  nodes.aperture?.setAttribute('d',pose.aperture);nodes.clip?.setAttribute('d',pose.aperture);nodes.tongue?.setAttribute('d',pose.tongue);nodes.lip?.setAttribute('d',pose.lip);
 });
}
