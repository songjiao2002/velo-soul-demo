const COPY={en:['Home','Scan QR','Journeys'],ko:['홈','QR 스캔','여정'],zh:['首页','扫码','旅程']};
const icons=['<path d="m3 10 9-7 9 7v10H3z M9 20v-7h6v7"/>','<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5 M8 8h3v3H8z M15 8h2v2h-2z M8 15h2v2H8z M14 14h3v3h-3z"/>','<path d="M5 3h14v18H5z M9 8h6 M9 12h6 M9 16h4"/>'];
// Explicit screen events replace observing every character animation/DOM change.
export function createAppNavigation({getLanguage=()=> 'en',document=globalThis.document}={}){
 const nav=document.createElement('nav');nav.className='app-tabbar';nav.dataset.noTranslate='';nav.setAttribute('aria-label','App navigation');
 const current=()=>{const screen=document.body.dataset.screen;for(const button of nav.querySelectorAll('button')){const match=button.dataset.nav===screen||(button.dataset.action==='scan'&&screen==='scan');if(match)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}};
 const paint=()=>{const labels=COPY[getLanguage()]||COPY.en;nav.innerHTML=labels.map((label,i)=>`<button ${['data-nav="home"','data-action="scan" class="scan-tab"','data-nav="journal"'][i]}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[i]}</svg><span>${label}</span></button>`).join('');current();};
 document.body.append(nav);paint();document.addEventListener('velo:screen',current);document.querySelector('#languageSelect')?.addEventListener('change',paint);
 return {dispose(){document.removeEventListener('velo:screen',current);document.querySelector('#languageSelect')?.removeEventListener('change',paint);nav.remove();}};
}
