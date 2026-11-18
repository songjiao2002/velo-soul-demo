// The length contract applies to the English original only. Translations keep
// its content and paragraphs, not a separate 150–200-character target.
// Opt-in lets older installed apps keep accepting the diary response.
export const LULU_DIARY_FORMAT='lulu-short-v1';
export function diaryWordRange(format){
 return format===LULU_DIARY_FORMAT?{min:60,max:90,target:75}:{min:150,max:200,target:175};
}

export function diaryLength(body,language){
 return language==='en'?(body.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)||[]).length:(body.match(/[\p{L}\p{N}]/gu)||[]).length;
}
export function diaryFormat(body,language,format){
 const {min,max}=diaryWordRange(format);
 const length=diaryLength(body,language),paragraphs=body.trim().split(/\n\s*\n/);
 const padding=/(?:\p{Script=Han}\s+){4,}\p{Script=Han}/u.test(body)||/(.{8,})\1\1/u.test(body);
 return {length,paragraphs:paragraphs.length,valid:!padding&&(language==='en'?length>=min&&length<=max:body.length<=2400)&&paragraphs.length===3&&paragraphs.every(p=>p.trim()&&!/[\r\n]/.test(p.trim())&&!/^\s*(?:[-*#]|\d+[.)])\s/.test(p))};
}
// Only new afterwords use this viewpoint guard. Existing stored diaries retain their wording.
export function diaryPerspective(text,language){
 if(language==='en')return !/\b(?:you|your|yours|yourself|yourselves)\b/i.test(text);
 if(language==='zh')return !/[你您妳]/u.test(text);
 if(language==='ko')return !/(?:^|[\s"'“‘(])(?:너|넌|널|네가|네게|네|너의|너를|너와|너랑|너에게|네겐|당신(?:은|이|의|을|과|에게)?|그대(?:는|의|를)?)(?=$|[\s.,!?"'…])/u.test(text);
 return true;
}
export function diaryFormatInstruction(format){
 const {min,max,target}=diaryWordRange(format);
 const sentences=format===LULU_DIARY_FORMAT?'Use one or two simple sentences per paragraph. Pick one detail and one feeling to keep. Lulu can sound sleepy or gently amused. Put the thought down in a few words and leave it there.':'Write about three complete sentences per paragraph, around 55–65 English words per paragraph.';

 return `Write the original in English, exactly three prose paragraphs separated by a blank line: (1) a brief supported ride detail and my initial personal response, or simply my feeling about being a companion if evidence is empty; (2) my own feelings, interests and small contradictions; (3) the personal feeling I am left with, with no question, request or future promise. Narrate as I/my, refer to the rider only in third person, never address them as you. Most sentences should reveal the character rather than describe or praise the rider. ${sentences} The full English body must contain ${min}–${max} words, excluding title, punctuation and spaces. Aim for ${target}. Keep the title separate and short. Only complete, natural sentences: never append isolated words, spaced-out characters, counting notes, or repeated phrases to meet the length. Sparse evidence still requires three paragraphs and the same length: elaborate only on the character's own perspective, never invent events or rider feelings. No physical actions by the fictional character: no paws, sitting in a basket, wind, or imaginary sensations described as a real event.`;
}
