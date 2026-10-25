// Layered vector artwork. No WebGL, raster portraits, or external font dependency.
export const FLAT_PALETTES={
 lumi:{fur:'#fff7e9',shade:'#f3e5ce',edge:'#9c8066',accent:'#e9a35f',hat:'#dfbd8f',hatLight:'#f3d9ae',bag:'#e58c48',bike:'#d99b57'},
 bori:{fur:'#fff9ec',shade:'#f2e7d6',edge:'#a18b69',accent:'#f2c35e',hat:'#f5cc68',hatLight:'#ffe8a0',bag:'#e8b84b',bike:'#e2b34a'},
 mori:{fur:'#fffcf3',shade:'#edece1',edge:'#899181',accent:'#50594c',hat:'#f2f4e9',hatLight:'#fffef6',bag:'#92aa7d',bike:'#879f74'}
};
const line='stroke-linecap="round" stroke-linejoin="round"';
const ellipse=(x,y,rx,ry,fill,extra='')=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const path=(d,fill,stroke,width=2,extra='')=>`<path d="${d}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="${width}"`:''} ${line} ${extra}/>`;

export const CHARACTER_2D_STYLE=`
.soul-flat{display:block;width:100%;height:100%;overflow:visible;--speech-open:0}
.two-torso{transform-origin:183px 247px;animation:flat-breathe 4s ease-in-out infinite}
.two-head{transform-origin:180px 205px;animation:flat-look 6s ease-in-out infinite}
.two-eyes{transform-origin:177px 171px;animation:flat-blink 5.8s infinite}
.two-tail{transform-origin:235px 255px;animation:flat-tail 4s ease-in-out infinite}
.two-pack{transform-origin:235px 233px;animation:flat-pack 4s ease-in-out infinite}
.two-bicycle,.two-cycle-legs,.two-cycle-arm,.two-road{display:none}
.two-rider{transform:translateY(50px);transform-origin:180px 232px;transition:transform .45s ease-in-out}
.two-question,.two-zzz,.two-nibble,.two-eyes-closed,.two-sleeping-panda{display:none}
.two-mouth-open{transform-origin:176px 190px;transform:scaleY(calc(.06 + var(--speech-open,0)*.94))}
.soul-flat:not([data-mouth-active=true]) .two-mouth-open{display:none}
.soul-flat[data-mouth-active=true] .two-mouth-closed{display:none}
.soul-flat[data-activity=riding] .two-rider{transform:translateY(0)}
.soul-flat[data-activity=riding] .two-bicycle,.soul-flat[data-activity=riding] .two-cycle-legs,.soul-flat[data-activity=riding] .two-cycle-arm,.soul-flat[data-activity=riding] .two-road{display:inline}
.soul-flat[data-activity=riding] .two-standing-feet,.soul-flat[data-activity=riding] .two-idle-arm{display:none}
.soul-flat[data-activity=riding] .two-torso{animation:flat-ride .9s ease-in-out infinite}
.soul-flat[data-activity=riding] .two-head{animation:flat-ride-head 2s ease-in-out infinite}
.soul-flat[data-stopped=true] .two-torso,.soul-flat[data-stopped=true] .two-head{animation-play-state:paused}
.soul-flat[data-soul=lumi][data-activity=greeting] .two-question{display:inline;animation:flat-question 1.8s ease-in-out infinite}
.soul-flat[data-soul=lumi][data-activity=greeting] .two-idle-arm-left{transform-origin:150px 224px;animation:flat-wave 1.1s ease-in-out 2}
.soul-flat[data-soul=lumi][data-activity=resting] .two-head{animation:flat-explore 5s ease-in-out infinite}
.soul-flat[data-soul=bori]:not([data-activity=riding]) .two-nibble{display:inline;transform-origin:220px 229px;animation:flat-nibble 1.5s ease-in-out infinite}
.soul-flat[data-soul=bori]:not([data-activity=riding]) .two-idle-arm-right{display:none}
.soul-flat[data-soul=bori][data-activity=resting] .two-nibble{animation:flat-take-bread 1.8s ease-out,flat-nibble 1.5s 1.8s ease-in-out infinite}
.soul-flat[data-soul=mori][data-activity=greeting] .two-rider{animation:flat-slow-arrival 3s ease-out both}
.soul-flat[data-soul=mori][data-activity=resting] .two-rider{display:none}
.soul-flat[data-soul=mori][data-activity=resting] .two-sleeping-panda{display:inline;transform-origin:180px 336px;animation:flat-curl-breathe 5s ease-in-out infinite}
.soul-flat[data-soul=mori][data-activity=resting] .two-head{animation:none}
.soul-flat[data-soul=mori][data-activity=resting] .two-eyes,.soul-flat[data-soul=mori][data-activity=resting] .two-helmet{display:none}
.soul-flat[data-soul=mori][data-activity=resting] .two-eyes-closed,.soul-flat[data-soul=mori][data-activity=resting] .two-zzz{display:inline}
.two-zzz{animation:flat-sleep 3.5s ease-in-out infinite}
.soul-flat[data-expression=listening] .two-head{animation:none;transform:rotate(-4deg)}
.soul-flat[data-expression=thinking] .two-head{animation:flat-think 2.5s ease-in-out infinite}
.two-ear-left{transform-origin:127px 133px;animation:flat-ear 7s ease-in-out infinite}.two-ear-right{transform-origin:226px 126px;animation:flat-ear 7s 1s ease-in-out infinite}
@keyframes flat-breathe{50%{transform:translateY(-2px) scaleY(1.012)}}
@keyframes flat-look{0%,35%,100%{transform:rotate(0)}60%,78%{transform:rotate(-2deg)}}
@keyframes flat-explore{0%,100%{transform:rotate(0) translateX(0)}25%{transform:rotate(-5deg) translateX(-3px)}65%{transform:rotate(4deg) translateX(3px)}}
@keyframes flat-blink{0%,42%,46%,88%,92%,100%{transform:scaleY(1)}44%,90%{transform:scaleY(.07)}}
@keyframes flat-tail{50%{transform:rotate(5deg)}}
@keyframes flat-pack{50%{transform:rotate(1.5deg)}}
@keyframes flat-ride{50%{transform:translateY(-1.5px)}}
@keyframes flat-ride-head{50%{transform:rotate(1deg)}}
@keyframes flat-question{0%,100%{transform:translateY(35px)}50%{transform:translateY(31px) rotate(3deg)}}
@keyframes flat-wave{50%{transform:rotate(27deg)}}
@keyframes flat-nibble{50%{transform:translate(-1px,-3px) rotate(-4deg)}}
@keyframes flat-take-bread{0%{transform:translate(13px,15px) rotate(32deg);opacity:0}35%{opacity:0}70%{opacity:1}100%{transform:translate(0,0)}}
@keyframes flat-sleep{50%{transform:translate(2px,-7px);opacity:.5}}
@keyframes flat-curl-breathe{50%{transform:scaleY(1.016) translateY(-.5px)}}
@keyframes flat-slow-arrival{from{opacity:0;transform:translate(12px,64px)}to{opacity:1;transform:translate(0,50px)}}
@keyframes flat-think{50%{transform:rotate(3deg)}}
@keyframes flat-ear{0%,85%,100%{transform:rotate(0)}90%{transform:rotate(-3deg)}95%{transform:rotate(2deg)}}
@media(prefers-reduced-motion:reduce){.soul-flat *{animation:none!important;transition:none!important}}
`;

function wheel(cx,p){let spokes='';for(let i=0;i<8;i++){const a=i*Math.PI/4;spokes+=path(`M${cx} 304 L${cx+Math.cos(a)*24} ${304+Math.sin(a)*24}`,'none','#c1c5b9',1.7);}return `<g>${ellipse(cx,304,34,34,'#4c5049')}${ellipse(cx,304,27,27,'#fffdf5')}${ellipse(cx,304,30.5,30.5,'none','stroke="#70756b" stroke-width="1.2"')}<g data-flat-wheel="${cx}">${spokes}${ellipse(cx+10,286,3,2,p.hatLight)}</g>${ellipse(cx,304,4,4,p.edge)}</g>`;}
function loaf(p){return `${path('M-12 12 Q-18 6 -14-8 L-7-24 Q-1-33 7-27 Q15-24 11-13 L7 10 Q3 20-8 18Z','#e9ae5e','#bb8248',1.6)}${path('M-8-11 L3-5 M-11-2 L0 5 M-2-20 L7-15','none','#ffe3a9',3)}`;}
function bike(id,p){return `<g class="two-bicycle">${wheel(116,p)}${wheel(246,p)}${path('M116 304 L143 247 L196 294 L246 304 L221 255 L143 247 M196 294 L221 255 M196 294 L116 304','none',p.bike,6)}${path('M117 304 L143 240 L146 230','none',p.edge,3)}${path('M127 231 Q146 227 170 230','none','#454a44',7)}${path('M216 254 L215 245','none','#757f6e',4)}${path('M201 244 Q215 239 231 243','none','#51564e',7)}${ellipse(196,294,11,11,p.bike,`stroke="${p.edge}" stroke-width="2"`)}<path data-flat-crank fill="none" stroke="#6f7766" stroke-width="3" stroke-linecap="round" d="M196 282 L196 306"/>${ellipse(137,247,4,4,'#fff0bb',`stroke="${p.edge}" stroke-width="1.5"`)}${id==='bori'?`<g class="two-basket">${path('M101 229 L144 229 L140 263 Q120 270 104 260Z','#f3c65d','#c49b4b',2)}${path('M99 230 Q121 236 146 229','none','#ffe5a3',5)}<g transform="translate(115 224) rotate(-18) scale(.7)">${loaf(p)}</g><g transform="translate(131 223) rotate(17) scale(.68)">${loaf(p)}</g>${ellipse(122,249,5,4,'#fff7dd')}${[116,121,126].map((x,i)=>ellipse(x,243-(i===1?2:0),2.2,2.5,'#fff7dd')).join('')}</g>`:''}</g>`;}
function helmet(id,p){if(id==='mori')return `<g class="two-helmet">${path('M109 138 L111 163 Q114 169 118 163 L117 139 M242 139 L242 163 Q246 170 250 162 L250 138','#dce3cf',p.edge,1.5)}${path('M108 132 C109 99 138 76 179 76 C220 76 249 99 250 132 L248 140 Q179 153 110 140Z',p.hat,p.edge,2)}${path('M115 123 C122 100 144 84 175 83','none',p.hatLight,4)}${path('M180 79 Q175 108 177 140','none','#d9e0cd',1.7)}${path('M107 132 Q179 151 251 132 L251 142 Q179 161 107 142Z','#e1e7d5',p.edge,1.6)}${path('M111 135 Q179 153 247 135','none','#fffef6',2.4)}${ellipse(114,148,2.4,2.4,'#b6c2a6')}${ellipse(246,148,2.4,2.4,'#b6c2a6')}</g>`;const brim=path('M98 145 Q169 164 252 140 Q262 136 259 130 Q189 143 100 134 Q89 139 98 145Z',p.hat,p.edge,2);const crown=path('M105 135 Q107 91 151 82 Q198 66 229 93 Q249 110 250 133 Q185 155 105 135Z',p.hat,p.edge,2);const seam=path('M170 81 Q156 108 160 143','none',p.hatLight,2);return `<g class="two-helmet">${crown}${seam}${path('M120 111 Q129 91 153 88','none',p.hatLight,3)}${brim}${id==='lumi'?`${path('M105 124 Q177 144 246 121','none','#80654b',7)}<g transform="rotate(-8 174 116)">${[143,203].map(x=>`${ellipse(x,116,24,18,'#b69570',`stroke="#735c46" stroke-width="2"`)}${ellipse(x,116,19,13.5,'#49504d')}${path(`M${x-11} 111 Q${x-2} 104 ${x+8} 108`,'none','#a5b3ac',2.5)}`).join('')}${path('M167 115 Q174 110 179 115','none','#735c46',4)}</g>`:`${[155,176,197].map((x,i)=>ellipse(x,104-i%2*3,3,4.3,'#626951')).join('')}${path('M112 137 Q185 151 248 132','none',p.hatLight,3)}`}</g>`;}
function head(id,p){const cat=id==='lumi',panda=id==='mori';const ears=cat?`<g class="two-ear-left">${path('M111 118 L115 76 Q116 65 126 70 L151 93Z',p.accent,p.edge,2)}${path('M121 105 L123 80 L141 96Z','#efc4ae',null)}</g><g class="two-ear-right">${path('M207 95 L231 64 Q239 57 242 69 L248 119Z',p.accent,p.edge,2)}${path('M221 97 L233 76 L237 109Z','#efc4ae',null)}</g>`:`<g class="two-ear-left">${ellipse(panda?119:122,panda?110:108,22,23,panda?'#4c4f49':p.fur,`stroke="${p.edge}" stroke-width="2"`)}${!panda?ellipse(122,108,14,17,'#edc1ad'):''}</g><g class="two-ear-right">${ellipse(panda?238:230,panda?110:98,panda?22:23,panda?23:24,panda?'#4c4f49':p.fur,`stroke="${p.edge}" stroke-width="2"`)}${!panda?ellipse(230,98,15,18,'#edc1ad'):''}</g>`;
 const face=path(panda?'M101 139 Q106 112 141 108 Q179 99 215 107 Q247 112 254 142 Q262 176 244 198 Q223 224 180 224 Q138 225 113 204 Q92 184 101 139Z':'M102 139 Q106 111 142 111 L211 105 Q247 110 254 141 Q263 180 239 200 Q213 220 172 216 Q128 219 109 195 Q91 174 102 139Z',p.fur,p.edge,2);
 const markings=cat?`${path('M110 143 Q122 132 139 138 Q142 152 124 157 L106 157Z',p.accent,null)}${path('M221 134 Q242 125 251 144 L252 156 Q233 165 224 150Z',p.accent,null)}${path('M109 175 L124 177 M110 184 L122 183 M231 173 L244 169 M232 182 L245 179','none','#d69c62',2.3)}`:panda?`${ellipse(149,170,17,21,'#52544f','transform="rotate(21 149 170)"')}${ellipse(206,168,17.5,22,'#52544f','transform="rotate(-21 206 168)"')}`:'';
 return `<g class="two-head">${ears}${face}${path('M124 201 Q170 220 222 202','none',p.shade,5)}${markings}${panda?`${ellipse(128,191,8,4,'#e6bfa8','opacity=".38"')}${ellipse(225,188,8,4,'#e6bfa8','opacity=".38"')}`:''}${!panda?`${ellipse(132,184,9,4,'#f0c0a9','opacity=".65"')}${ellipse(220,181,8,4,'#f0c0a9','opacity=".6"')}`:''}<g class="two-eyes">${ellipse(151,171,5.3,7,'#383d35')}${ellipse(205,167,5.3,7,'#383d35')}${ellipse(149.5,168.5,panda?2:1.6,panda?2.5:2,'#fffdf0')}${ellipse(203.5,164.5,panda?2:1.6,panda?2.5:2,'#fffdf0')}</g><g class="two-eyes-closed">${path('M143 172 Q150 177 158 170 M198 168 Q206 174 213 166','none','#363c35',2.5)}</g>${path('M170 181 Q177 177 182 180 Q181 187 177 187 Q172 186 170 181Z','#47463b',null)}${path('M177 186 L177 190','none','#6c6050',1.6)}${path(panda?'M170 192 Q176 201 184 191':'M171 194 Q176 195 177 190 Q181 194 185 191','none',panda?'#68715e':'#6c6050',1.5,'class="two-mouth-closed"')}${ellipse(176,194,5.5,7.5,'#725246','class="two-mouth-open"')}${helmet(id,p)}</g>`;
}
function sleepingPanda(p){return `<g class="two-sleeping-panda"><g transform="rotate(-12 251 284)">${path('M239 259 Q260 252 270 266 L274 294 Q262 308 242 302Z',p.bag,p.edge,1.8)}${path('M247 272 L266 270 L269 292 L250 296Z','none','#c8d4b5',1.5)}</g>${ellipse(232,300,48,31,p.fur,`stroke="${p.edge}" stroke-width="2"`)}${ellipse(266,319,16,11,'#4d504b')}${ellipse(249,301,18,20,'#4d504b')}<g transform="translate(-8 106) rotate(-7 178 165)">${head('mori',p)}</g>${ellipse(144,334,22,7,'#4d504b')}${ellipse(198,334,20,7,'#4d504b')}${path('M133 334 L139 334 M189 334 L195 334','none','#7f8a73',1.5)}</g>`;}
export function cyclePose(phase=0){return [-1,1].map((side,i)=>{const a=phase+i*Math.PI,x=196+Math.sin(a)*12,y=294+Math.cos(a)*12,hipX=i?205:185,hipY=i?248:245;return {x,y,hipX,hipY,path:`M${hipX} ${hipY} Q${hipX+18} ${(hipY+y)/2} ${x} ${y-4}`};});}

export function characterSVG(id,activity='idle'){
 const p=FLAT_PALETTES[id];if(!p)return '';const panda=id==='mori',fur=panda?'#4d504b':p.fur;
 const tail=id==='lumi'?`<g class="two-tail">${path('M232 255 Q279 267 294 235 Q303 216 288 201 Q276 195 271 208 Q268 220 281 225 Q278 243 237 231Z',p.accent,p.edge,2)}${path('M248 237 L251 255 M271 234 L278 249 M281 207 Q278 215 291 220','none',p.fur,11)}</g>`:id==='bori'?ellipse(239,258,11,10,p.fur,`stroke="${p.edge}" stroke-width="2"`):ellipse(236,259,10,9,'#474c43');
 const pack=`<g class="two-pack">${path('M222 199 Q241 193 251 207 L257 246 Q252 260 233 261 L220 248Z',p.bag,p.edge,2)}${path('M236 218 L251 216 L255 241 Q247 248 236 244Z',p.bag,p.edge,1.5)}${path('M229 208 L236 248 M247 210 L252 247','none','#6d7057',3)}${path('M232 223 L239 222 L240 229 L233 230Z',p.hatLight,p.edge,1.5)}${path('M232 199 Q229 187 238 189 Q247 191 246 200','none',p.bag,4)}</g>`;
 const body=path('M150 208 Q185 199 217 207 Q239 225 232 259 Q219 280 186 278 Q152 281 141 258 Q133 234 150 208Z',p.fur,p.edge,2);
 const legs=cyclePose();
 const cycleLegs=`<g class="two-cycle-legs">${legs.map((a,i)=>`${path(a.path,'none',i?fur:p.shade,16,`data-flat-leg="${i}"`)}<g data-flat-foot="${i}" transform="translate(${a.x} ${a.y-3})">${ellipse(1,0,12,7,fur,`stroke="${p.edge}" stroke-width="1.5"`)}${!panda?ellipse(-2,3,5,2,'#e4b995'):''}</g>`).join('')}</g>`;
 const standing=`<g class="two-standing-feet">${ellipse(163,278,16,10,fur,`stroke="${p.edge}" stroke-width="2"`)}${ellipse(207,278,16,10,fur,`stroke="${p.edge}" stroke-width="2"`)}${!panda?path('M153 281 L157 281 M163 282 L168 282 M197 281 L201 281 M207 282 L212 282','none','#ddbc99',2):''}</g>`;
 const left=path('M153 218 Q134 215 129 231 Q125 241 134 246 Q144 248 150 236 L160 229Z',fur,p.edge,2);
 const right=path('M214 214 Q232 216 236 231 Q239 243 229 247 Q215 250 207 235Z',fur,p.edge,2);
 const ridingArm=path('M214 215 Q214 227 196 234 L166 238 Q150 240 150 230 Q151 222 163 223 L187 224 Q193 215 202 212Z',fur,p.edge,2);
 const snack=`<g class="two-nibble">${path('M214 217 Q229 211 236 221 L242 234 Q238 245 226 244 L211 236Z',fur,p.edge,2)}<g transform="translate(236 213) rotate(12) scale(.78)">${loaf(p)}</g>${ellipse(230,229,10,8,p.fur,`stroke="${p.edge}" stroke-width="1.7"`)}</g>`;
 return `<svg class="soul-flat" data-soul="${id}" data-activity="${activity}" data-expression="rest" viewBox="0 0 360 380" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><style>${CHARACTER_2D_STYLE}</style>${ellipse(183,342,97,8,'#68805a','opacity=".09"')}<g class="two-road" opacity=".5">${path('M70 322 L86 322 M268 333 L292 333 M73 335 L101 335','none',p.hat,2.3)}</g>${bike(id,p)}<g class="two-rider">${cycleLegs}${standing}<g class="two-torso">${tail}${pack}${body}${panda?`${path('M145 219 Q183 215 228 214 L233 236 Q188 248 140 235Z','#4d504b',null)}${ellipse(186,253,35,23,p.fur)}`:''}${path('M151 255 Q177 274 216 258','none',p.shade,5)}<g class="two-idle-arm two-idle-arm-left">${left}</g><g class="two-cycle-arm">${path('M153 217 Q137 220 139 230 Q145 238 158 231 L168 225Z',fur,p.edge,2)}</g>${head(id,p)}<g class="two-idle-arm two-idle-arm-right">${right}</g><g class="two-cycle-arm">${ridingArm}</g>${id==='bori'?snack:''}</g></g>${panda?sleepingPanda(p):''}<g class="two-question" transform-origin="280 100">${path('M272 86 Q267 70 282 69 Q300 72 290 85 L281 95 L281 100','none',p.accent,5)}${ellipse(281,111,3.3,3.3,p.accent)}${path('M306 121 L311 115 M307 133 L315 135','none',p.accent,2)}</g><g class="two-zzz">${path('M244 236 L256 236 L244 249 L257 249 M268 212 L282 212 L269 228 L283 228 M294 186 L310 186 L295 205 L311 205','none','#7e9968',2.8)}</g></svg>`;
}
