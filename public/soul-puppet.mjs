import {characterPuppet} from './character-art.mjs';
export function mouthPose(soul,opening=0,roundness=.4){
 const open=Math.max(0,Math.min(1,Number(opening)||0)),round=Math.max(0,Math.min(1,Number(roundness)||0));
 const width=(soul==='bori'?41:soul==='mori'?30:35)*(1-.42*round)*(.95+.1*open),height=4+open*(soul==='mori'?27:soul==='bori'?49:42);
 const n=value=>Number(value.toFixed(2)),w=n(width),h=n(height),top=n(-8-round*7),corner=n(top+5),bow=n(top+7-round*14);
 return {open,closed:open<.045,width:w,height:h,
  aperture:`M${-w} ${corner} C${n(-w*.58)} ${bow} ${n(w*.58)} ${bow} ${w} ${corner} C${n(w*1.05)} ${n(h*.65)} ${n(w*.5)} ${h} 0 ${h} C${n(-w*.5)} ${h} ${n(-w*1.05)} ${n(h*.65)} ${-w} ${corner} Z`,
  tongue:`M${n(-w*.9)} ${n(h*.83)} Q0 ${n(h*.2)} ${n(w*.9)} ${n(h*.83)} L${w} ${n(h+10)} H${-w}Z`,
  lip:`M${n(-w*.72)} ${n(h*.8)} Q0 ${n(h+6)} ${n(w*.72)} ${n(h*.8)}`};
}


export const soulPuppet=characterPuppet;
export function paintSoulExpression(root,state){const expression=['rest','greeting','listening','thinking','talking'].includes(state)?state:'rest';for(const el of root.querySelectorAll('.soul-puppet'))if(el.dataset.expression!==expression)el.dataset.expression=expression;}
export function paintSoulMouth(root,frame={active:false}){for(const el of root.querySelectorAll('.character-puppet')){const active=!!frame.active&&el.dataset.soul===frame.soul;const value=String(active);if(el.dataset.mouthActive!==value)el.dataset.mouthActive=value;el.style.setProperty('--speech-open',String(active?Math.max(0,Math.min(1,Number(frame.open)||0)):0));}}
