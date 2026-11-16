// Body only: punctuation, spaces and the separate title do not count.
// English uses words; Chinese and Korean use Unicode letters/numbers.
export function diaryLength(body,language){
 return language==='en'?(body.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)||[]).length:(body.match(/[\p{L}\p{N}]/gu)||[]).length;
}
export function diaryFormat(body,language){
 const length=diaryLength(body,language),paragraphs=body.trim().split(/\n\s*\n/);
 return {length,paragraphs:paragraphs.length,valid:length>=150&&length<=200&&paragraphs.length===3&&paragraphs.every(p=>p.trim()&&!/[\r\n]/.test(p.trim())&&!/^\s*(?:[-*#]|\d+[.)])\s/.test(p))};
}
export function diaryFormatInstruction(language){
 return `Use exactly three prose paragraphs separated by a blank line: (1) a supported ride detail, or the simple fact of accompanying the rider if evidence is empty; (2) this character's own response and interests; (3) a gentle closing with no question, request or future promise. The body must contain 150–200 ${language==='en'?'English words':'letters/numbers (count each Chinese or Korean character separately)'}, excluding title, punctuation and spaces. Aim for 170–180. Keep the title separate and short. No paragraph labels, lists, filler, repeated sentiments or ellipses to pad the count. Sparse evidence still requires three paragraphs and the same length: elaborate only on the character's own perspective, never invent events or rider feelings. Examples illustrate voice only, not the required length.`;
}
