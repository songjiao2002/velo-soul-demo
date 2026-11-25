import {HANDS_FREE_COPY} from './hands-free.mjs';
const routine=new Set(['off','starting','listening','quiet','hearing','transcribing','thinking','synthesizing','speaking']);
const icons={start:'<path d="M8 5v14l11-7z"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>'};
const compact={
 en:{off:'Conversation paused',starting:'Connecting microphone…',listening:'Listening',quiet:'Listening · Speak whenever you’re ready',hearing:'Hearing you…',transcribing:'Recognizing…',thinking:'Thinking…',synthesizing:'Preparing voice…',speaking:'Speaking · You can interrupt',reconnecting:'Reconnecting…',audio_reconnecting:'Reconnecting microphone…',audio_retry:'Listening · Voice unavailable',denied:'Allow microphone access',start_timeout:'Microphone did not start',failed:'Connection needs attention'},
 ko:{off:'대화 일시 정지',starting:'마이크 연결 중…',listening:'듣고 있어요',quiet:'듣고 있어요 · 편하게 말해주세요',hearing:'말씀을 듣고 있어요…',transcribing:'음성 인식 중…',thinking:'생각하고 있어요…',synthesizing:'목소리 준비 중…',speaking:'말하는 중 · 끼어들 수 있어요',reconnecting:'다시 연결 중…',audio_reconnecting:'마이크 다시 연결 중…',audio_retry:'듣고 있어요 · 음성 재생 오류',denied:'마이크 권한을 허용해주세요',start_timeout:'마이크가 시작되지 않았어요',failed:'연결을 확인해주세요'},
 zh:{off:'对话已暂停',starting:'正在连接麦克风…',listening:'正在听',quiet:'正在听 · 随时可以说话',hearing:'听到你说话了…',transcribing:'正在识别…',thinking:'正在思考…',synthesizing:'正在准备语音…',speaking:'正在回答 · 可以说话打断',reconnecting:'正在重新连接…',audio_reconnecting:'正在恢复麦克风…',audio_retry:'正在听 · 语音暂不可用',denied:'请允许麦克风权限',start_timeout:'麦克风未能启动',failed:'请检查连接'}
};
export function rideVoiceStatus(language='en',state='off'){const c=compact[language]||compact.en;return c[state]||c.failed;}
export function rideVoiceControlsMarkup(language='en',active=false,state='off'){
 const c=HANDS_FREE_COPY[language]||HANDS_FREE_COPY.en;
 return `<div class="ride-voice-controls" data-no-translate>${['start','stop'].map(action=>`<button type="button" class="ride-voice-button" data-action="voice-${action}" aria-label="${c[action]}" title="${c[action]}" ${action==='start'?`aria-pressed="${active}"`:''}${(action==='start'?active:!active)?' disabled':''}><svg viewBox="0 0 24 24" aria-hidden="true">${icons[action]}</svg></button>`).join('')}<span data-live-status role="status" class="${routine.has(state)?'sr-only':'ride-voice-error'}">${c[state]||c.failed}</span></div>`;
}
export function paintRideVoiceControls(document,language,active,state){
 const c=HANDS_FREE_COPY[language]||HANDS_FREE_COPY.en;
 for(const label of document.querySelectorAll('[data-ride-listening]')){label.textContent=rideVoiceStatus(language,state);label.dataset.state=state;}
 for(const action of ['start','stop'])for(const b of document.querySelectorAll(`[data-action="voice-${action}"]`)){
  b.disabled=action==='start'?active:!active;b.setAttribute('aria-label',c[action]);b.title=c[action];if(action==='start')b.setAttribute('aria-pressed',String(active));
 }
 for(const label of document.querySelectorAll('.ride-voice-controls [data-live-status]')){label.textContent=c[state]||c.failed;label.className=routine.has(state)?'sr-only':'ride-voice-error';}
}

export const rideTextChatLabel={en:'Type a message',ko:'글로 대화하기',zh:'文字聊天'};
const microphoneIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg>';
const stopIcon='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="3"/></svg>';

function talkStatus(language,state,active){
 const labels=HANDS_FREE_COPY[language];
 if(state==='off')return '';
 return (active&&compact[language][state])||labels[state]||labels.failed;
}

export function rideTalkPanel(language,active,state,audioIssue,replayLabel){
 const labels=HANDS_FREE_COPY[language];
 return `<section class="ride-talk-panel" data-no-translate>
   <button type="button" class="ride-talk-toggle" data-action="ride-voice-toggle" aria-pressed="${active}">${microphoneIcon}${stopIcon}<span>${active?labels.stop:labels.start}</span></button>
   <span class="ride-talk-status" role="status">${talkStatus(language,state,active)}</span>
   <button type="button" data-action="ride-text-chat" ${!active&&state!=='off'?'':'hidden'}>${rideTextChatLabel[language]}</button>
   <button type="button" data-action="audio-unlock" ${active&&audioIssue?'':'hidden'}>${replayLabel}</button>
 </section>`;
}

export function paintRideTalk(panel,language,active,state,audioIssue){
 if(!panel)return;
 const toggle=panel.querySelector('.ride-talk-toggle');
 toggle.setAttribute('aria-pressed',String(active));
 toggle.querySelector('span').textContent=HANDS_FREE_COPY[language][active?'stop':'start'];
 const status=panel.querySelector('[role="status"]');
 const text=talkStatus(language,state,active);
 if(status.textContent!==text)status.textContent=text;
 panel.querySelector('[data-action="ride-text-chat"]').hidden=active||state==='off';
 panel.querySelector('[data-action="audio-unlock"]').hidden=!active||!audioIssue;
}
