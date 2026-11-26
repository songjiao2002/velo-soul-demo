// Used at both ends of a single recognition turn. This is only a cache
// identity; the final transcript is always displayed and saved verbatim.
export function confirmedWords(text){
 let words=text.normalize('NFC').trim().toLowerCase().replace(/[’‘]/gu,"'").replace(/\s+/gu,' ').replace(/[.。]$/u,'');
 // "I paid" and "I'll pay" must remain different. Only fold punctuation or
 // a courtesy ending when the question is already explicit in the words.
 if(/^(?:what|why|when|where|how|which|who|should we|can we|(?:can|could|would) you)\b/iu.test(words)){
   words=words.replace(/[?？]$/u,'').replace(/,\s*please$/u,'');
 }else if(/(?:吗|么|나요|까요|인가요|은가요|런가요|떤가요)[?？]?$/u.test(words)){
   words=words.replace(/[?？]$/u,'');
 }
 // Mandarin ASR sometimes restores sentence-final 了 to an explicitly
 // achieved change of degree. Do not fold aspect on plans, purchases,
 // negations, quantities or standalone verbs.
 const clause=words.split(/[，,。！？!?；;]/u).at(-1);
 if(/(?:今天|现在|如今|这回|这次|这阵子)(?:我)?(?:竟然|终于|总算|已经)?(?:敢|能|可以|愿意)(?:稍微)?(?:放松|轻松|踏实|安心|自在|自然|从容|大胆|走快|走慢|骑快|骑慢)(?:一点儿?|一些)了$/u.test(clause)&&!/[不没未别再]|[0-9]|可能|如果/u.test(clause)){
   words=words.slice(0,-1);
 }
 return words;
}
