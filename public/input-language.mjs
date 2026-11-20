export function detectInputLanguage(text,fallback='en'){return /[\uac00-\ud7af]/.test(text)?'ko':/[\u3400-\u9fff]/.test(text)?'zh':/[a-z]/i.test(text)?'en':fallback;}

export function createSpeechLanguagePreferences(getStorage=()=>globalThis.localStorage){
 const inputKey='velo-soul-input-language',voiceKey='velo-soul-voice-language';
 const spoken=['en','ko','zh'];
 let input,voice;
 try{
  const storage=getStorage();
  const savedInput=storage.getItem(inputKey),savedVoice=storage.getItem(voiceKey);
  if(savedInput==='auto'||spoken.includes(savedInput))input=savedInput;
  if(spoken.includes(savedVoice))voice=savedVoice;
 }catch{}
 const defaultVoice=uiLanguage=>uiLanguage==='ko'?'ko':'en';
 return {
  input(uiLanguage){return input||voice||defaultVoice(uiLanguage);},
  voice(uiLanguage,soul){
   const language=voice||(input!=='auto'&&input)||defaultVoice(uiLanguage);
   return language==='zh'&&soul!=='mori'?'en':language;
  },
  select(value){
   if(value!=='auto'&&!spoken.includes(value))return;
   input=value;
   if(value!=='auto')voice=value;
   try{
    const storage=getStorage();
    storage.setItem(inputKey,value);
    if(value!=='auto')storage.setItem(voiceKey,value);
   }catch{}
  }
 };
}
export function replyLanguage(text,preferred='auto',soul){
 const detected=detectInputLanguage(text,'en');
 if(soul==='mori')return ['en','ko','zh'].includes(preferred)?preferred:detected;
 // Preserve the project's Chinese-to-English policy; an explicit Korean
 // preference also keeps short ambiguous acknowledgements in Korean.
 return detected==='zh'?'en':['en','ko'].includes(preferred)?preferred:detected==='ko'?'ko':'en';
}
export function needsCamera(text){return /看|画面|镜头|摄像|眼前|颜色|这是什么|那是什么|\b(see|look|camera|colour|color|in front|what(?:'s| is) (?:this|that|it))\b|보여|보이|보여줘|보이는|보니|봐|봤|카메라|색|이거|저거|무엇|풍경/iu.test(text);}
