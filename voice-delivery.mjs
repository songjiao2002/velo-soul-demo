// Only the spoken line and the immediately preceding rider turn are relevant.
// The provider receives a delivery direction, never the rider's private turn.
const serious = /\b(?:watch out|look out|danger(?:ous)?|emergency|brakes? (?:failed|aren['’]t working)|crash(?:ed)?|injured|bleeding|i(?:['’]m| am) hurt|oncoming traffic)\b|小心|危险|刹车失灵|来车|受伤|流血|别分心|조심|위험|다쳤|다친|비상|차가 와/iu;
const gentle = /\b(?:tired|worn out|exhausted|take a breather|need a break|catch your breath|upset|sad|rough day|feeling down|feeling low|worried|rest a bit|keep it quiet)\b|累[了啦死坏]|好累|有点累|歇一|喘口气|难过|伤心|失落|难受|不舒服|担心|安静|好好休息|힘들|지쳤|지친|피곤|속상|슬퍼|쉬어|쉬자|걱정|조용히/iu;
const playful = /\b(?:haha|ha ha|funny|hilarious|kidding|joking|nailed it|we did it|made it|high five|so happy|wow|hooray|awesome|love it|five stars)\b|哇|哈哈|好耶|太好了|太棒|好开心|好可爱|笑死|开玩笑|五星|우와|와아|해냈|신난|웃기|귀엽|대박|농담|진짜 웃|[ㅋㅎ]{2,}/iu;
const letdown = /\b(?:disappointed|frustrat(?:ed|ing)|what a letdown|didn['’]t work(?: out)?|didn['’]t (?:make|enjoy|like) it|wasn['’]t worth it|that fell flat)\b|失望|沮丧|扫兴|白跑|扑了个空|没成[功行]|실망|아쉽|허탕|기대 이하|잘 안됐|안 됐어/iu;
const curiosity = /\b(?:i wonder|i['’]m curious|i am curious|what caught your eye|what do you make of)\b|我有点好奇|我很好奇|我在想|你注意到.{1,10}吗|궁금(?:해|하네|한데)|눈에 들어왔어/iu;
const achievement = /\b(?:i did it(?=[!.]|$)|i finally (?:made it|finished it|managed it)|my first (?:ride|climb) without stopping|you earned that)\b|终于(?:骑上|完成|到|坚持下来)|第一次.{0,8}(?:没停|骑上|骑完|爬上)|드디어.{0,10}(?:올라왔|올랐|완주|도착했)|처음으로.{0,10}완주/iu;
const pride = /\b(?:i(?:['’]m| am| feel) (?:really |pretty |so )?proud of myself|i(?:['’]ve| have) finally got the hang of it)\b|我(?:真的|真|挺|很|好|有点)(?:为自己(?:骄傲|高兴)|有成就感)|나(?:도|는)?\s*(?:정말|좀|꽤)?\s*뿌듯(?:해|하다|했어)|스스로가\s*대견해/iu;
const easing = /\b(?:i(?:['’]m| am| feel) (?:a (?:bit|little) )?(?:less (?:nervous|afraid)|more relaxed)|i can finally relax)\b|(?:没那么|不再)(?:紧张|害怕)|(?:终于|开始|也敢|敢)(?:稍微)?放松|덜\s*(?:떨려|무서워|긴장돼)|긴장이\s*(?:좀\s*)?풀렸어/iu;
const notTired = /\b(?:not|never) (?:that |really |very )?(?:tired|sad|worried)\b|(?:不|没那么|不怎么)(?:累|难过|担心)|(?:안\s*피곤\S*|피곤하지\s*않\S*)/giu;
const negatedCue = /\b(?:not (?:at all |that |really )?(?:disappointed|frustrated|funny|dangerous|injured|hurt|bleeding)|(?:i['’]m |i am )?not (?:joking|kidding))\b|(?:不算|并不|不太|没那么|不)(?:失望|危险|好笑)|没(?:有)?受伤|(?:아쉽지|위험하지|웃기지|실망하지)\s*않\S*|안\s*다쳤\S*/giu;
const irritation = /\b(?:annoyed|irritable|irritated|don['’]t (?:want|feel like) (?:to )?(?:explain(?:ing)?|talk(?:ing)? about it))\b|心烦|[有挺好很]点?烦|烦躁|烦死了|不想(?:说原因|解释|聊这个)|짜증|신경질|말하고 싶지 않/iu;
const closeCall = /\b(?:nearly|almost) (?:crashed|fell|hit|collided|got hit)|\bclose call\b|差点(?:儿)?(?:撞|摔|被.{0,4}撞)|险些(?:撞|摔)|(?:부딪힐|치일|넘어질)\s*뻔/iu;
const noIrritation = /\bnot (?:that |really )?(?:irritated|annoyed|irritable)\b|(?:并不|不再|不怎么|不)(?:心烦|烦躁|烦了)|짜증(?:이)?\s*(?:안\s*나|나지\s*않)\S*/giu;
const contrast = /\b(?:but|however|yet)\b|但(?:是)?|却|不过|可是|그러나|그런데|지만/iu;
const relief = /\b(?:i['’]m |we['’]re |it['’]s )?(?:safe|fine|okay) now\b|没事了|现在.{0,3}安全|이젠?\s*괜찮/iu;
const closedDestination = /\b(?:was closed|was shut|sold out)\b|关门了|没开门|卖完了|문[이을]?\s*닫|품절/iu;

function phraseTone(text,spoken){
  if (serious.test(text)||closeCall.test(text)) return 'serious';
  if (letdown.test(text)) return 'disappointed';
  if (gentle.test(text)||irritation.test(text)) return 'gentle';
  if (playful.test(text)||achievement.test(text)||pride.test(text)) return 'playful';
  if (easing.test(text)) return 'gentle';
  if (spoken&&curiosity.test(text)) return 'curious';
  return 'neutral';
}

function utteranceTone(value,spoken=false){
  if(typeof value!=='string'||!value)return 'neutral';
  const text=value.replace(negatedCue,'').replace(notTired,'').replace(noIrritation,'');
  const clauses=text.split(contrast),last=clauses.at(-1);
  if(clauses.length<2)return phraseTone(text,spoken);
  if(relief.test(last))return phraseTone(last,spoken);
  if(serious.test(text)||closeCall.test(text))return 'serious';
  if(closedDestination.test(last))return 'disappointed';
  const lastTone=phraseTone(last,spoken);
  return lastTone==='neutral'?phraseTone(text,spoken):lastTone;
}

export function deliveryTone(line,rider=''){
  return contextualTone(line,utteranceTone(rider));
}

// A confirmed safety cue outranks any mood. Allow a new clause to express
// its own feeling while a plain continuation inherits this rider's context.
export function contextualTone(line,riderTone){
  const local=utteranceTone(line,true);
  return ['serious','disappointed','gentle','playful','curious'].find(tone=>tone===local||tone===riderTone)||'neutral';
}

export function spokenPunctuation(text, tone, language, soul='lumi') {
  if (tone === 'playful'&&(soul==='lumi'||playful.test(text))) return text.replace(/[.。]$/u, language === 'Chinese' ? '！' : '!');
  if (tone === 'gentle'||tone==='disappointed') return text.replace(/[!！]+$/u, language === 'Chinese' ? '。' : '.');
  return text;
}

export const pandaDirection = {
  neutral: 'Start speaking promptly. Keep words clear at a conversational pace; gently stretch only the final vowel of occasional phrases by about 200–300 ms, with a small pitch rise then fall and a subtle sleepy throat rumble.',
  playful: 'Keep the dry humor understated. Lift the word that carries the joke just a little, as if privately delighted, then settle back into the familiar low register. Keep the everyday tempo.',
  curious: 'Sound mildly intrigued. Put a little lift on the detail that caught your interest and leave the rest easy and low. Keep the everyday tempo.',
  gentle: 'Start promptly. Sound quietly attentive, like keeping a tired friend company. Ease the stress on the first words and let the last word settle. Use a clear, soft speaking voice with natural breath.',
  disappointed: 'Acknowledge the letdown with a small downward inflection. Stay companionable, low and clear. Keep the usual pace and finish the thought simply.',
  serious: 'Start promptly. Speak steadily, clearly and matter-of-factly. Emphasize the important word once, with a short firm ending and no sleepy rumble or drawn-out syllables.'
};
