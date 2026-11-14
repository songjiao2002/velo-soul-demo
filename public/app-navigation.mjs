import {mobileLabels} from './mobile-v2.mjs';
const COPY={en:['Scan QR','Diaries'],ko:['QR 스캔','라이딩 일기'],zh:['扫码','骑行日记']};
const icons=['<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5 M8 8h3v3H8z M15 8h2v2h-2z M8 15h2v2H8z M14 14h3v3h-3z"/>','<path d="M5 3h14v18H5z M9 8h6 M9 12h6 M9 16h4"/>'];
// Explicit screen events replace observing every character animation/DOM change.
export function createAppNavigation({getLanguage=()=> 'en',document=globalThis.document,mobile=false}={}){
 const nav=document.createElement('nav');nav.className='app-tabbar';nav.dataset.noTranslate='';nav.setAttribute('aria-label','App navigation');
 const current=()=>{const screen=document.body.dataset.screen;for(const button of nav.querySelectorAll('button')){const match=button.dataset.nav===screen||(button.dataset.nav==='home'&&screen==='companions')||(button.dataset.nav==='journal'&&screen==='diary')||(button.dataset.action==='scan'&&['home','scan'].includes(screen));if(match)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}};
 const paint=()=>{const labels=mobile?(mobileLabels[getLanguage()]||mobileLabels.en):(COPY[getLanguage()]||COPY.en);const actions=mobile?['data-nav="home"','data-action="scan" class="scan-tab"','data-nav="journal"']:['data-action="scan" class="scan-tab"','data-nav="journal"'];const navIcons=mobile?['<path d="m3 10 9-7 9 7v10H3z M9 20v-7h6v7"/>',...icons]:icons;nav.innerHTML=labels.map((label,i)=>`<button ${actions[i]}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${navIcons[i]}</svg><span>${label}</span></button>`).join('');current();};
 document.body.append(nav);paint();document.addEventListener('velo:screen',current);document.querySelector('#languageSelect')?.addEventListener('change',paint);
 return {dispose(){document.removeEventListener('velo:screen',current);document.querySelector('#languageSelect')?.removeEventListener('change',paint);nav.remove();}};
}
