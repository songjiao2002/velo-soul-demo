// The length contract applies to the English original only. Translations keep
// its content and paragraphs, not a separate 150–200-character target.
export function diaryLength(body,language){
 return language==='en'?(body.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)||[]).length:(body.match(/[\p{L}\p{N}]/gu)||[]).length;
}
export function diaryFormat(body,language){
 const length=diaryLength(body,language),paragraphs=body.trim().split(/\n\s*\n/);
 const padding=/(?:\p{Script=Han}\s+){4,}\p{Script=Han}/u.test(body)||/(.{8,})\1\1/u.test(body);
 return {length,paragraphs:paragraphs.length,valid:!padding&&(language==='en'?length>=150&&length<=200:body.length<=2400)&&paragraphs.length===3&&paragraphs.every(p=>p.trim()&&!/[\r\n]/.test(p.trim())&&!/^\s*(?:[-*#]|\d+[.)])\s/.test(p))};
}
export function diaryFormatInstruction(language){
 return `Write the original in English, exactly three prose paragraphs separated by a blank line: (1) a supported ride detail, or the simple fact of accompanying the rider if evidence is empty; (2) this character's own response and interests; (3) a gentle closing with no question, request or future promise. Write about three complete sentences per paragraph, around 55–65 English words per paragraph. The full English body must contain 150–200 words, excluding title, punctuation and spaces. Aim for 175. Keep the title separate and short. Only complete, natural sentences: never append isolated words, spaced-out characters, counting notes, or repeated phrases to meet the length. Sparse evidence still requires three paragraphs and the same length: elaborate only on the character's own perspective, never invent events or rider feelings. No physical actions by the fictional character: no paws, sitting in a basket, wind, or imaginary sensations described as a real event.`;
}
