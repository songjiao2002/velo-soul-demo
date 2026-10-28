import {HANDS_FREE_COPY} from './hands-free.mjs';
const routine=new Set(['off','starting','listening','quiet','hearing','transcribing','thinking','synthesizing','speaking']);
const icons={start:'<path d="M8 5v14l11-7z"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>'};
export function rideVoiceControlsMarkup(language='en',active=false,state='off'){
 const c=HANDS_FREE_COPY[language]||HANDS_FREE_COPY.en;
 return `<div class="ride-voice-controls" data-no-translate>${['start','stop'].map(action=>`<button type="button" class="ride-voice-button" data-action="voice-${action}" aria-label="${c[action]}" title="${c[action]}" ${action==='start'?`aria-pressed="${active}"`:''}${(action==='start'?active:!active)?' disabled':''}><svg viewBox="0 0 24 24" aria-hidden="true">${icons[action]}</svg></button>`).join('')}<span data-live-status role="status" class="${routine.has(state)?'sr-only':'ride-voice-error'}">${c[state]||c.failed}</span></div>`;
}
export function paintRideVoiceControls(document,language,active,state){
 const c=HANDS_FREE_COPY[language]||HANDS_FREE_COPY.en;
 for(const action of ['start','stop'])for(const b of document.querySelectorAll(`[data-action="voice-${action}"]`)){
  b.disabled=action==='start'?active:!active;b.setAttribute('aria-label',c[action]);b.title=c[action];if(action==='start')b.setAttribute('aria-pressed',String(active));
 }
 for(const label of document.querySelectorAll('.ride-voice-controls [data-live-status]')){label.textContent=c[state]||c.failed;label.className=routine.has(state)?'sr-only':'ride-voice-error';}
}
