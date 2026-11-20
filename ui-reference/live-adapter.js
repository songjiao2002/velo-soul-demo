// These bindings reconnect the published UI to the maintained production services.
// The imported source retains its layout, rendering, navigation and interactions.
Q=liveFetch;hs=liveDiary;cs=liveDiaryCopy;kt=liveRideDiary;Re=liveDiaryLabels;So=options=>liveSoulChat({...options,getUILanguage:S});
Tt=LiveSpeech;at=LiveMicrophone;ua=options=>liveRecognition({...options,standby:true});Et=LiveAudioSession;xi=LiveMemory;
const referenceVoiceState=kl;
kl=function(state){
 const caption=p('heardText');
 if(caption?.dataset.transcriptState==='interim'&&(!M?.active||['starting','listening','reconnecting','audio_reconnecting','speaking_no_interrupt'].includes(state))){
   caption.textContent='';
   delete caption.dataset.transcriptState;
 }
 referenceVoiceState(state);
};
wt=class extends LiveConversation {
 constructor(options={}){super({...options,prefetchSpeech:(text,language,soul)=>ue.preload(text,{language,soul}),stopSpeech:()=>{ue.cancelPrefetches();options.stopSpeech?.();}});}
};
Ds=liveIntroduction;Kt=liveIntroClip;
Mi=(text,language='auto')=>liveReplyLanguage(text,language,P);
en=liveParseQR;$i=liveBrowserLinks;
mt=query=>history.replaceState(null,'',query?'/?'+companionQuery(query):'/');
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
}
function syncSpeechLanguage(){
 W=speechLanguages.voice(S(),P);
 const select=p('voiceSelect');
 select.value=yi();
 p('voiceSelectLabel').textContent={ko:'음성 입력 언어',en:'Speech input',zh:'语音输入语言'}[S()];
 const choices=[...(p('rideSettings')?.querySelectorAll('[name=ride-language]')||[])];
 const index=choices.findIndex(option=>option.value===select.value);
 if(index>=0){
  choices[index].checked=true;
  choices[index].closest('.language-options').style.setProperty('--choice-index',index);
 }
}
jn=function(language){
 speechLanguages.select(language);
 syncSpeechLanguage();
 La();
 if(ae?.active)ae.start(P,W);
};
Eo=function(soul){W=speechLanguages.voice(S(),soul);referenceTheme(soul);};
const referenceStop=Ce;
Ce=function(){liveIdlePurr?.activity();referenceStop();};
let liveIdlePurr;
window.addEventListener('velo:ready',()=>{
 const settings=p('appSettingsDialog');
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
 settings.addEventListener('close',()=>{inputTapped=false;});
 liveIdlePurr=new LivePurr({session:He,canPlay:()=>P==='mori'&&Z&&!document.hidden&&!!M?.active&&['listening','quiet'].includes(M.state)&&!V.isOpen()&&!document.body.classList.contains('voice-playing')});
 const timer=setInterval(()=>liveIdlePurr.tick(),250);
 window.addEventListener('pagehide',()=>{clearInterval(timer);liveIdlePurr.stop();},{once:true});
},{once:true});
