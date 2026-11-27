// These bindings reconnect the published UI to the maintained production services.
// The imported source retains its layout, rendering, navigation and interactions.
// Camera and microphone must use the same pending Android permission queue.
Ft=liveDeviceMedia;
Qt=liveOutputLanguage;ds=livePlaceFallback;on=liveBikeMemoryLine;
la=liveWeatherLine;mn=liveWeatherGreeting;
const referenceRideDiary=kt;
kt=(record,language)=>record.sample?referenceRideDiary(record,language):liveRideDiary(record,language);
Q=liveFetch;hs=liveDiary;cs=liveDiaryCopy;Re=liveDiaryLabels;So=options=>liveSoulChat({...options,getUILanguage:S,prefetchSpeech:(text,language,soul,playback)=>ue.preload(text,{language,soul,...playback}),primeReplies:(id,lang)=>ue.primeRideReplies(id,lang),canPrepareFirstSpeech:()=>!M?.active&&Z&&ue.canPrepareFirstSpeech()});
Tt=LiveSpeech;at=LiveMicrophone;ua=options=>liveRecognition({...options,standby:true});Et=LiveAudioSession;xi=LiveMemory;
Ga=rideVoiceControlsMarkup;
fs=paintRideVoiceControls;
const referenceVoiceState=kl;
function openRideTextChat(){
 p('rideSettings')?.close();
 V.open(P);
 const input=document.querySelector('.soul-chat[open] #chatInput');
 const composer=input?.closest('details');
 if(composer)composer.open=true;
 input?.focus();
}
const referenceCameraControlMarkup=cameraControlMarkup;
cameraControlMarkup=function(kind){
 const markup=referenceCameraControlMarkup(kind);
 if(kind!=='mic')return markup;
 const description={en:'Hold to type a message, or press Shift+F10.',ko:'길게 누르거나 Shift+F10을 눌러 메시지를 입력하세요.',zh:'长按或按 Shift+F10 输入文字消息。'}[S()];
 return markup.replace(' data-action=',` aria-description="${description}" aria-keyshortcuts="Shift+F10" data-action=`);
};
function bindRideMicTextChat(doc,win,open){
 const mic=event=>event.target.closest?.('[data-action="companion-mic"]');
 let press=null,suppressClick=null;
 const cancel=()=>{
   if(press)win.clearTimeout(press.timer);
   press=null;
 };
 const show=button=>{
   if(suppressClick===button)return;
   suppressClick=button;
   cancel();
   open();
 };
 doc.addEventListener('pointerdown',event=>{
   cancel();
   suppressClick=null;
   const button=mic(event);
   if(!button||event.button!==0||!event.isPrimary)return;
   press={id:event.pointerId,x:event.clientX,y:event.clientY,timer:win.setTimeout(()=>{
     if(button.isConnected)show(button);
     else cancel();
   },550)};
 },true);
 doc.addEventListener('pointermove',event=>{
   if(press?.id===event.pointerId&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>10)cancel();
 },true);
 for(const type of ['pointerup','pointercancel']){
   doc.addEventListener(type,event=>{if(press?.id===event.pointerId)cancel();},true);
 }
 win.addEventListener('blur',cancel);
 doc.addEventListener('visibilitychange',()=>{if(doc.hidden)cancel();});
 doc.addEventListener('velo:screen',cancel);
 doc.addEventListener('contextmenu',event=>{
   const button=mic(event);
   if(!button)return;
   event.preventDefault();
   if(press||event.button===2)show(button);
 },true);
 doc.addEventListener('keydown',event=>{
   const button=mic(event);
   if(!button||!(event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey))return;
   event.preventDefault();
   if(!event.repeat){cancel();open();}
 },true);
 // Touch browsers can retarget the release to the newly opened dialog. Consume
 // its compatibility events so it cannot blur the composer or press a dialog button.
 for(const type of ['mousedown','click']){
   doc.addEventListener(type,event=>{
     if(!suppressClick||event.detail===0)return;
     event.preventDefault();
     event.stopImmediatePropagation();
     if(type==='click')suppressClick=null;
   },true);
 }
}
bindRideMicTextChat(document,window,openRideTextChat);
kl=function(state){
 const caption=p('heardText');
 if(caption?.dataset.transcriptState==='interim'&&(!M?.active||['starting','listening','reconnecting','audio_reconnecting','speaking_no_interrupt'].includes(state))){
   caption.textContent='';
   delete caption.dataset.transcriptState;
 }
 referenceVoiceState(state);
 const status=p('cameraControlStatus');
 if(status&&!cameraPaused&&rideTextFallbackStates.has(state)){
   status.textContent=rideVoiceStatus(S(),state)+' ';
   const button=document.createElement('button');
   button.type='button';button.dataset.action='ride-text-chat';
   button.textContent=rideTextChatLabel[S()];status.append(button);
 }
};
const rideTextFallbackStates=new Set(['denied','unsupported','failed','network','audio_retry','start_timeout','audio_capture','not_configured','provider_auth','daily_limit','provider_quota','rate_limited','service_busy','provider_unavailable']);
wt=class extends LiveConversation {
 constructor(options={}){super({...options,primeReplies:(id,lang)=>ue.primeRideReplies(id,lang),canPrepareFirstSpeech:()=>Z&&ue.canPrepareFirstSpeech(),prefetchSpeech:(text,language,soul,playback)=>ue.preload(text,{language,soul,...playback}),stopSpeech:()=>{ue.cancelPrefetches();options.stopSpeech?.();}});}
};
Ds=liveIntroduction;Kt=liveIntroClip;
Mi=(text,language='auto')=>liveReplyLanguage(text,language,P);
en=liveParseQR;$i=liveBrowserLinks;
mt=query=>{
 const suffix=query?'?'+companionQuery(query):'';
 const framed=window.frameElement?.id==='veloRideFrame';
 history.replaceState(null,'',(framed?'/index.html':'/')+suffix);
 if(framed)window.parent.history.replaceState(null,'','/'+suffix);
};
Vo=function(){
 const query=new URLSearchParams(location.search),soul=currentSoulQR(query);
 if(query.has('bike')&&!soul){showCompanions();he(({en:'This QR code has expired. Please scan a new code.',ko:'만료된 QR 코드예요. 새 코드를 스캔해 주세요.',zh:'这个二维码已作废，请扫描新码。'})[S()]);return;}
 if(query.get('diary'))openDiary(query.get('diary'),true);
 else if(query.get('view')==='journeys')gi();
 else if(query.get('view')==='scan')_o();
 else if(soul){Eo(soul);query.get('view')==='camera'?qo():di(soul);}
 else showCompanions();
};
Uo=async function(record,language){
 if(lt.has(record.id))return;
 const controller=new AbortController();lt.set(record.id,controller);record.diaryGeneration='writing';bn(record);
 const timeout=setTimeout(()=>controller.abort('timeout'),65000);
 try{
  if(!await Sn.save(record)){record.diaryGeneration='failed';bn(record);return;}
  const generated=await liveDiary(record,language,{signal:controller.signal});
  if(controller.signal.aborted)return;
  record.generatedDiary=generated;record.diaryTranslations={};record.diaryGeneration='ready';
 }catch{if(controller.signal.aborted&&controller.signal.reason!=='timeout')return;record.diaryGeneration='failed';}
 finally{clearTimeout(timeout);if(lt.get(record.id)===controller)lt.delete(record.id);}
 record.diary=kt(record,language);await Sn.save(record);bn(record);ji();
};
originalDiaryLanguage=record=>record.generatedDiary?.language||record.diary?.language||S();
let liveTranslationController=null;
translateDiary=async function(language){
 if(!openedDiary||!Object.hasOwn(journalCopy,language)||lt.has(openedDiary.id))return;
 liveTranslationController?.abort();const record=openedDiary;
 const controller=new AbortController();liveTranslationController=controller;
 const timeout=setTimeout(()=>controller.abort('timeout'),65000);
 const menu=document.querySelector('.diary-translation');
 const buttons=[...menu.querySelectorAll('[data-diary-language]')];
 buttons.forEach(button=>button.disabled=true);
 try{
  let diary;
  if(record.sample||language===originalDiaryLanguage(record))diary=kt(record,language);
  else if(record.diaryTranslations?.[language])diary=record.diaryTranslations[language];
  else{
   const original=record.generatedDiary?.baseDiary||record.generatedDiary||kt(record,originalDiaryLanguage(record));
   diary=original.language===language?original:await liveDiary(record,language,{sourceDiary:{title:original.title.slice(0,80),body:original.body},signal:controller.signal});
   if(controller.signal.aborted||openedDiary!==record||D!=='diary')return;
   (record.diaryTranslations??={})[language]=diary;await Sn.save(record);
  }
  if(controller.signal.aborted||openedDiary!==record||D!=='diary')return;
  const text=p('diaryText');text.lang=language;text.innerHTML=diaryParagraphs(diary.body);
  const title=document.querySelector('.diary-entry h1');title.textContent=diary.title.startsWith(B[record.soul].en+' · ')?diary.title:B[record.soul].en+' · '+diary.title;
  buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.diaryLanguage===language)));
 }catch{if(!controller.signal.aborted||controller.signal.reason==='timeout')he(({en:'Could not translate. Please try again.',ko:'번역하지 못했어요. 다시 시도해 주세요.',zh:'翻译未完成，请重试。'})[S()]);}
 finally{clearTimeout(timeout);buttons.forEach(button=>button.disabled=false);if(liveTranslationController===controller)liveTranslationController=null;}
};
const referenceSurface=pt;
pt=function(...args){liveTranslationController?.abort();return referenceSurface(...args);};
const referenceTheme=Eo;
const speechLanguages=createSpeechLanguagePreferences();
yi=()=>speechLanguages.input(S());
function playLiveIntroduction(){
 const intro=Ln(P,yi());
 In(intro.text,intro.language);
 if(G)G.key='hello';
}
function syncSpeechLanguage(){
 const language=yi(),voice=speechLanguages.voice(S(),P);
 const changed=W!==voice||M?.active&&M.language!==language;
 W=voice;
 const select=p('voiceSelect');
 select.value=language;
 const choices=[...(p('rideSettings')?.querySelectorAll('[name=ride-language]')||[])];
 const index=choices.findIndex(option=>option.value===select.value);
 if(index>=0){
  choices[index].checked=true;
  choices[index].closest('.language-options').style.setProperty('--choice-index',index);
 }
 if(changed){
  We();
  ue.cancelPrefetches();
  if(!M?.active)Ce();
  if(ae?.active)ae.start(P,W);
 }
 if(M?.active)M.setLanguage(language);
 if(V?.isOpen())V.setInputLanguage(language);
}
jn=function(language){
 speechLanguages.select(language);
 syncSpeechLanguage();
 La();
};
Eo=function(soul){W=speechLanguages.voice(S(),soul);referenceTheme(soul);};
const referenceStop=Ce;
Ce=function(){liveIdlePurr?.activity();referenceStop();};
let liveIdlePurr;
window.addEventListener('velo:ready',()=>{
 const settings=p('appSettingsDialog');
 const voiceLabel=p('voiceSelectLabel');
 const toggleLanguages=()=>{
   const expanded=settings.toggleAttribute('data-all-voice-languages');
   voiceLabel.setAttribute('aria-expanded',String(expanded));
 };
 voiceLabel.addEventListener('click',toggleLanguages);
 voiceLabel.addEventListener('keydown',event=>{
   if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleLanguages();}
 });
 let inputTapped=false;
 // The published form dispatches change only if its hidden select changes value.
 // A rider who taps the current default and saves has chosen it explicitly too.
 settings.addEventListener('click',event=>{
   if(event.target.matches('[name="voiceSelectChoice"]'))inputTapped=true;
   if(inputTapped&&event.target.closest('[data-save-settings]')){
     const selected=settings.querySelector('[name="voiceSelectChoice"]:checked')?.value;
     if(selected===p('voiceSelect').value)speechLanguages.select(selected);
     inputTapped=false;
   }
 },true);
 settings.addEventListener('close',()=>{
   inputTapped=false;settings.removeAttribute('data-all-voice-languages');
   voiceLabel.setAttribute('aria-expanded','false');
 });
 liveIdlePurr=new LivePurr({session:He,canPlay:()=>P==='mori'&&Z&&!document.hidden&&!!M?.active&&['listening','quiet'].includes(M.state)&&!V.isOpen()&&!document.bo