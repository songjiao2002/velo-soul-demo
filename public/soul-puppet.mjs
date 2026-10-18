import {BUILD} from './build-version.mjs';
let nextId=0;
const names={lumi:'Lumi',mori:'Mori',bori:'Bori'};
// Each arm rotates around an opaque point inside the torso. Texture roots are
// expressed in atlas coordinates; Mori/Bori use the opposite cells so the
// shoulder end, rather than the mitten, meets the body.
const rigs={
 lumi:{left:{anchor:[120,208],crop:[600,185,345,320],root:[855,275],scale:.32},right:{anchor:[256,208],crop:[1110,185,370,320],root:[1220,275],scale:.32}},
 mori:{left:{anchor:[113,208],crop:[1110,185,370,320],root:[1324,280],scale:.32},right:{anchor:[249,208],crop:[600,185,345,320],root:[720,280],scale:.32}},
 bori:{left:{anchor:[101,218],crop:[1110,185,370,320],root:[1295,260],scale:.32},right:{anchor:[273,218],crop:[600,185,345,320],root:[742,260],scale:.32}}
};
export function soulPuppet(soul){
 if(!names[soul])return '';
 const id=`soul-surface-${++nextId}`,file=`/assets/${soul}-puppet.webp?v=${BUILD}`;
 const image=`<image href="${file}" width="1536" height="1024" filter="url(#${id})"/>`;
 const arm=side=>{
  const {anchor,crop,root,scale}=rigs[soul][side],x=(crop[0]-root[0])*scale,y=(crop[1]-root[1])*scale;
  const snack=soul==='bori'&&side==='right'?`<g class="soul-wrist" transform="translate(25 51)"><svg class="soul-snack" x="-26" y="-17" width="91" height="69" viewBox="1070 635 425 320">${image}</svg></g>`:'';
  return `<g class="soul-shoulder" data-side="${side}" transform="translate(${anchor.join(' ')})"><g class="soul-joint soul-arm arm-${side}" data-bone="arm-${side}"><svg x="${x}" y="${y}" width="${crop[2]*scale}" height="${crop[3]*scale}" viewBox="${crop.join(' ')}">${image}</svg>${snack}</g></g>`;
 };
 const eye=x=>`<g class="soul-eye" style="--eye-x:${x}px" transform="translate(${x} 265)"><g class="soul-eye-blink"><ellipse class="eye-white" rx="35" ry="44" fill="#edf6ff"/><g class="soul-pupil"><ellipse rx="27" ry="38" fill="#121e2b"/><ellipse cx="-9" cy="-15" rx="9" ry="12" fill="white"/><circle cx="10" cy="17" r="4" fill="white" opacity=".5"/></g></g><path class="soul-eye-smile" d="M-28 0 Q0 25 28 0" fill="none" stroke="#18372c" stroke-width="10" stroke-linecap="round"/></g>`;
 return `<span class="soul-puppet ${soul}" data-soul="${soul}" data-expression="greeting" role="img" aria-label="${names[soul]} animated companion"><svg class="puppet-defs" aria-hidden="true"><defs><filter id="${id}" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncA type="linear" slope="3" intercept="-1.6"/></feComponentTransfer></filter></defs></svg><span class="soul-body"><svg class="soul-rig" viewBox="0 0 340 410" aria-hidden="true">
 ${arm('left')}${arm('right')}
 <svg class="soul-core" x="61.2" y="0" width="251.6" height="360.8" viewBox="80 15 410 560">${image}<g class="soul-face">${eye(204)}${eye(353)}<path class="soul-brow brow-left" d="M175 202 Q196 188 216 200"/><path class="soul-brow brow-right" d="M326 202 Q347 188 368 200"/><g class="soul-mouth" transform="translate(278 324)"><path class="mouth-smile" d="M-23 -2 Q0 27 23 -2" fill="none" stroke="#242338" stroke-width="9" stroke-linecap="round"/><g class="mouth-talk"><ellipse rx="23" ry="24" fill="#312039"/><ellipse cy="10" rx="14" ry="7" fill="#ee8eaa"/></g><ellipse class="mouth-thought" rx="9" ry="12" fill="#312039"/></g><g class="face-blush" fill="#f28a9c" opacity=".4"><ellipse cx="172" cy="319" rx="25" ry="12"/><ellipse cx="377" cy="319" rx="25" ry="12"/></g></g></svg>
 </svg>
 <span class="soul-emote" aria-hidden="true">${soul==='lumi'?'✦':soul==='mori'?'♪':'♡'}</span></span></span>`;
}
export function paintSoulExpression(root,state){
 const expression=['rest','greeting','listening','thinking','talking'].includes(state)?state:'rest';
 root.querySelectorAll('.soul-puppet').forEach(el=>{el.dataset.expression=expression;});
}
