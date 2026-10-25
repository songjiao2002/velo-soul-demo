import {CHARACTERS,CHARACTER_ORDER,characterArtwork} from './character-art.mjs';
const KEY='velo-soul-character-preferences-v1';
const DEFAULT={size:100,facing:32,turn:false};
export function normalizeLook(value={}){return {size:Number.isFinite(value.size)?Math.max(75,Math.min(125,value.size)):100,facing:Number.isFinite(value.facing)?Math.max(-180,Math.min(180,value.facing)):32,turn:value.turn===true};}
const COPY={
 en:{home:'Home',scan:'Scan QR',souls:'My Soul',journal:'Journeys',title:'Make room for your Soul.',intro:'Choose a companion. Make the view feel like you.',size:'Character size',angle:'Turn your companion',turn:'Slowly turn',pose:'Preview a moment',idle:'Say hello',riding:'On the road',rest:'Taking a break',use:'Meet this Soul',close:'Done',reset:'Reset view',saved:'Your view is saved on this device.',scanHint:'Works with the original Mori, Popo and Lulu bicycle QR codes.'},
 ko:{home:'홈',scan:'QR 스캔',souls:'나의 소울',journal:'여정',title:'내 곁에, 나의 소울.',intro:'동반자를 고르고 편안한 모습으로 조절해 보세요.',size:'캐릭터 크기',angle:'바라보는 방향',turn:'천천히 회전',pose:'순간 미리보기',idle:'인사하기',riding:'함께 달리기',rest:'쉬어 가기',use:'이 소울 만나기',close:'완료',reset:'기본 모습',saved:'이 기기에 설정을 저장했어요.',scanHint:'기존 모리·포포·루루 자전거 QR 코드를 그대로 사용해요.'},
 zh:{home:'首页',scan:'扫码',souls:'我的灵魂',journal:'旅程',title:'让灵魂，靠近一点。',intro:'选择伙伴，调整成你喜欢的观看方式。',size:'角色大小',angle:'角色朝向',turn:'缓缓旋转',pose:'预览一个瞬间',idle:'打个招呼',riding:'一起骑行',rest:'休息一下',use:'与它见面',close:'完成',reset:'恢复默认',saved:'观看设置已保存在本机。',scanHint:'支持原来的 Mori、Popo、Lulu 自行车二维码，无须更换。'}
};
const icons={home:'<path d="m3 10 9-7 9 7v10H3z M9 20v-7h6v7"/>',scan:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5 M8 8h3v3H8z M15 8h2v2h-2z M8 15h2v2H8z M14 14h3v3h-3z"/>',souls:'<path d="M5 20V10a7 7 0 0 1 14 0v10l-3-2-4 2-4-2z M9 10h.01 M15 10h.01 M10 14q2 2 4 0"/>',journal:'<path d="M5 3h14v18H5z M9 8h6 M9 12h6 M9 16h4"/>'};
const icon=key=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[key]}</svg>`;
export function createCompanionStudio({getLanguage=()=> 'en',getSelected=()=> 'lumi',choose=()=>{}}={}){
 let preferences={};try{preferences=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch{}
 let preview=getSelected(),revision=0,dialog,opener;
 const copy=()=>COPY[getLanguage()]||COPY.en;
 const look=id=>normalizeLook(preferences[id]);
 function apply(root=document){for(const host of root.querySelectorAll('[data-character-toon]')){
  const p=look(host.dataset.soul);host.dataset.lookSize=String(p.size);host.style.setProperty('--companion-size',p.size/100);
  const signature=JSON.stringify(p);if(host.dataset.lookSignature===signature)continue;
  host.dataset.lookSignature=signature;host.dataset.facing=String(p.facing*Math.PI/180);host.dataset.autoTurn=String(p.turn);host.dataset.turnRevision=String(++revision);
 }}
 function persist(){try{localStorage.setItem(KEY,JSON.stringify(preferences));}catch{}apply();}
 const nav=document.createElement('nav');nav.className='app-tabbar';nav.dataset.noTranslate='';nav.setAttribute('aria-label','App navigation');
 function paintNav(){const c=copy();nav.innerHTML=`<button data-nav="home">${icon('home')}<span>${c.home}</span></button><button data-action="scan" class="scan-tab">${icon('scan')}<span>${c.scan}</span></button><button data-studio-open>${icon('souls')}<span>${c.souls}</span></button><button data-nav="journal">${icon('journal')}<span>${c.journal}</span></button>`;nav.querySelector(`[data-nav="${document.body.dataset.screen}"]`)?.setAttribute('aria-current','page');if(document.body.dataset.screen==='scan')nav.querySelector('[data-action=scan]').setAttribute('aria-current','page');}
 document.body.append(nav);paintNav();
 function render(){const c=copy(),p=look(preview),ch=CHARACTERS[preview];dialog.innerHTML=`<div class="studio-heading"><span class="eyebrow">YOUR LITTLE COMPANION</span><button class="studio-done" data-studio-close>${c.close} ×</button></div><h2>${c.title}</h2><p class="studio-intro">${c.intro}</p><div class="studio-tabs" role="group" aria-label="${c.souls}">${CHARACTER_ORDER.map(id=>`<button data-studio-soul="${id}" aria-pressed="${id===preview}" style="--soul-color:${CHARACTERS[id].color}"><i></i>${CHARACTERS[id][getLanguage()==='ko'?'name':getLanguage()==='zh'?'zh':'en']}</button>`).join('')}</div><div class="studio-stage" style="--tint:${ch.tint}">${characterArtwork(preview)}<span>${ch.title[getLanguage()]||ch.title.en}</span></div><div class="studio-fields"><label>${c.size}<output id="sizeOutput">${p.size}%</output><input data-look="size" aria-label="${c.size}" type="range" min="75" max="125" step="5" value="${p.size}"></label><label>${c.angle}<output id="angleOutput">${p.facing}°</output><input data-look="facing" aria-label="${c.angle}" type="range" min="-180" max="180" step="1" value="${p.facing}"></label><label class="studio-check"><input type="checkbox" data-look="turn" ${p.turn?'checked':''}>${c.turn}</label></div><fieldset class="studio-poses"><legend>${c.pose}</legend>${['idle','riding','rest'].map(pose=>`<button data-studio-pose="${pose}" aria-pressed="${pose==='idle'}">${c[pose]}</button>`).join('')}</fieldset><div class="studio-actions"><button class="primary" data-studio-use>${c.use} ↗</button><button class="text-button" data-studio-reset>${c.reset}</button></div><p class="studio-note" role="status">${c.saved}</p>`;apply(dialog);}
 function open(){preview=getSelected();opener=document.activeElement;if(!dialog){dialog=document.createElement('dialog');dialog.className='companion-studio';dialog.dataset.noTranslate='';document.body.append(dialog);dialog.addEventListener('close',()=>{document.body.classList.remove('studio-open');opener?.focus();});dialog.addEventListener('input',e=>{const key=e.target.dataset.look;if(!key)return;const p=look(preview);p[key]=key==='turn'?e.target.checked:Number(e.target.value);if(key==='facing')p.turn=false;preferences[preview]=normalizeLook(p);persist();dialog.querySelector('#sizeOutput').textContent=p.size+'%';dialog.querySelector('#angleOutput').textContent=p.facing+'°';dialog.querySelector('[data-look=turn]').checked=p.turn;});}
 render();document.body.classList.add('studio-open');dialog.showModal();
 }
 document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-studio-open'))open();if(!dialog?.contains(b))return;
  if(b.dataset.studioSoul){preview=b.dataset.studioSoul;render();}
  if(b.dataset.studioPose){dialog.querySelector('[data-character-toon]').dataset.previewActivity=b.dataset.studioPose;dialog.querySelectorAll('[data-studio-pose]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}
  if(b.hasAttribute('data-studio-reset')){preferences[preview]={...DEFAULT};persist();render();}
  if(b.hasAttribute('data-studio-close'))dialog.close();
  if(b.hasAttribute('data-studio-use')){dialog.close();choose(preview);}
 });
 document.querySelector('#languageSelect')?.addEventListener('change',()=>{paintNav();if(dialog?.open)render();});
 let queued=false;new MutationObserver(records=>{if(records.some(r=>r.type==='childList'||r.attributeName==='data-screen')&&!queued){queued=true;queueMicrotask(()=>{queued=false;apply();nav.querySelectorAll('[aria-current]').forEach(e=>e.removeAttribute('aria-current'));nav.querySelector(`[data-nav="${document.body.dataset.screen}"]`)?.setAttribute('aria-current','page');if(document.body.dataset.screen==='scan')nav.querySelector('[data-action=scan]').setAttribute('aria-current','page');});}}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-screen']});
 apply();return {open,apply};
}
