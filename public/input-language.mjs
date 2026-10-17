export function detectInputLanguage(text,fallback='en'){return /[\uac00-\ud7af]/.test(text)?'ko':/[\u3400-\u9fff]/.test(text)?'zh':/[a-z]/i.test(text)?'en':fallback;}
export function replyLanguage(text,preferred='auto'){
 const detected=detectInputLanguage(text,'en');
 // Preserve the project's Chinese-to-English policy; an explicit Korean
 // preference also keeps short ambiguous acknowledgements in Korean.
 return detected==='zh'?'en':['en','ko'].includes(preferred)?preferred:detected==='ko'?'ko':'en';
}
export function needsCamera(text){return /看|画面|镜头|摄像|眼前|颜色|这是什么|那是什么|\b(see|look|camera|colour|color|in front|what(?:'s| is) (?:this|that|it))\b|보여|보이|보여줘|보이는|보니|봐|봤|카메라|색|이거|저거|무엇|풍경/iu.test(text);}
