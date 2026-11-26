// A provisional period is also an endpoint hint to deployed clients. A time
// clause ("before I turn…") or dangling adverb still needs its predicate.
// Restrict this to the current Mandarin clause; finals keep provider punctuation.
const rideTimeClause=/^(?:[我你他她][们們]?|咱[们們])?(?:每次|每回|[刚剛]|准备|準備|在)?(?:[过過][弯彎桥橋]|[转轉][弯彎]|[骑騎](?:[车車]|行)|出[发發门門]|上坡|下坡|起步|[停煞刹][车車]|[减減]速|加速|回家)(?:[以之][前后後]|的[时時]候)(?:[总總](?:是)?|常常|往往|通常|[经經]常)?$/u;
const hangingAdverb=/^(?:[我你他她][们們]?|咱[们們])(?:[以之]前|[过過]去|平[时時]|[现現]在)?(?:[总總](?:是)?|常常|往往|通常|[经經]常)$/u;

export function interimTranscript(text,language){
  if(language!=='zh'&&language!=='auto'||!/[。.]$/u.test(text))return text;
  const words=text.slice(0,-1),clause=words.split(/[，,。！？!?；;]/u).at(-1).replace(/\s+/gu,'');
  return rideTimeClause.test(clause)||hangingAdverb.test(clause)?words:text;
}
