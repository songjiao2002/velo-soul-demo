export function detectInputLanguage(text,fallback='en'){return /[\uac00-\ud7af]/.test(text)?'ko':/[\u3400-\u9fff]/.test(text)?'zh':/[a-z]/i.test(text)?'en':fallback;}
const spoken=['en','ko','zh'];
export function outputLanguage(language){return spoken.includes(language)?language:'en';}

export function createSpeechLanguagePreferences(getStorage=()=>globalThis.localStorage){
 const inputKey='velo-soul-input-language',voiceKey='velo-soul-voice-language';
 let input,voice;
 try{
  const storage=getStorage();
  const savedInput=storage.getItem(inputKey),savedVoice=storage.getItem(voiceKey);
  if(savedInput==='auto'||spoken.includes(savedInput))input=savedInput;
  if(spoken.includes(savedVoice))voice=savedVoice;
 }catch{}
 return {
  input(uiLanguage){return input||voice||outputLanguage(uiLanguage);},
  voice(uiLanguage){
   return (input!=='auto'&&input)||voice||outputLanguage(uiLanguage);
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
export function replyLanguage(text,preferred='auto'){
 return spoken.includes(preferred)?preferred:detectInputLanguage(text);
}
export function needsCamera(text){return /看|画面|镜头|摄像|眼前|颜色|这是什么|那是什么|\b(see|look|camera|colour|color|in front|what(?:'s| is) (?:this|that|it))\b|보여|보이|보여줘|보이는|보니|봐|봤|카메라|색|이거|저거|무엇|풍경/iu.test(text);}
