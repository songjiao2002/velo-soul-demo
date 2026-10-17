export function detectInputLanguage(text,fallback='en'){return /[\uac00-\ud7af]/.test(text)?'ko':/[\u3400-\u9fff]/.test(text)?'zh':/[a-z]/i.test(text)?'en':fallback;}
