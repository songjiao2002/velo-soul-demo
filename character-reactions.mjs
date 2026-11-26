import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {deliveryTone} from './voice-delivery.mjs';

// Files are bound to the exact transcript, locale and original character voice.
const lines={
  lumi:{
    en:{summit:'You made it up there and now I want to cheer for both of us!',boundary:"I'll tuck my questions away and just enjoy riding with you."},
    ko:{summit:'드디어 올라왔구나, 나까지 크게 외치고 싶어!',boundary:'내 질문은 잠깐 접어 두고 너랑 같이 달릴게.'},
    zh:{summit:'骑上来啦，我都想跟你再喊一遍！',boundary:'那我把问题收起来，想聊点别的我也乐意。'}
  },
  mori:{
    en:{summit:"You did it, I'd have wanted a nap halfway up.",boundary:"I'll ride along and skip the questions."},
    ko:{summit:'너 대단하다, 나라면 중간에 벌써 쉬었을걸.',boundary:'응, 이유는 안 묻고 네 옆에 있을게.'},
    zh:{summit:'你真行，换我半道就想歇了。',boundary:'嗯，我陪你，原因就不问了。'}
  },
  bori:{
    en:{summit:"You made it up there and now you've got me grinning too!",boundary:"You can ride with me without having to explain a thing."},
    ko:{summit:'드디어 올라왔네, 나까지 덩달아 으쓱해!',boundary:'내 옆에선 그냥 짜증 내도 돼, 이유는 안 물을게.'},
    zh:{summit:'上来啦，这下咱俩可以得意一会儿！',boundary:'不用跟我解释，烦就烦一会儿，我陪着你。'}
  }
};
const sha256=data=>createHash('sha256').update(data).digest('hex');
export const CHARACTER_REACTIONS=Object.entries(lines).flatMap(([soul,languages])=>
  Object.entries(languages).flatMap(([language,intents])=>Object.entries(intents).map(([intent,text])=>({
    soul,language,intent,text,file:`${soul}-${language}-${intent}-${sha256(text).slice(0,12)}.wav`
  })))
);

const triggers={
  en:{
    summit:/^i (?:(?:finally |just )?made it (?:all the way )?(?:up (?:that|the|this) hill|to the (?:summit|top(?: of (?:that|the|this) hill)?))|finally (?:(?:rode|cycled|pedaled|pedalled) (?:all the way )?up (?:that|the|this) hill|(?:got|rode|cycled) to the (?:summit|top(?: of (?:that|the|this) hill)?)|reached the (?:summit|top of (?:that|the|this) hill)))$/u,
    boundary:/^(?:i(?:'m| am| feel)(?: (?:just|a bit|a little|kind of|really))? (?:annoyed|irritated|upset|frustrated|grumpy)|i(?:'m| am) in a bad mood)(?: today| right now)?(?:[,!.] ?| and | but | )(?:i (?:don't want to|would rather not|'d rather not) (?:explain(?: why)?|say why|talk about (?:it|why))|i'd rather not (?:explain(?: why)?|say why|talk about it)|(?:please )?don't ask(?: me)? why)$/u
  },
  zh:{
    summit:/^(?:我)?(?:终于|总算)(?:骑上来|骑上去|骑上(?:了)?(?:这个|这座|那座|这段|这道)?坡|骑到(?:了)?(?:坡顶|山顶)|登顶|到(?:了)?(?:坡顶|山顶))(?:了|啦|了啦)?$/u,
    boundary:/^(?:我)?(?:今天|现在)?(?:心情)?(?:有点(?:儿)?烦|挺烦(?:的)?|心烦|烦躁|不太开心)(?:了|呢)?[,，.。]?(?:我)?(?:暂时|现在|先)?(?:不想(?:说|讲|解释)(?:原因|为什么)|不想解释|(?:别|不要|不用)问(?:我)?(?:原因|为什么))$/u
  },
  ko:{
    summit:/^(?:나|내가|저|제가)?(?:드디어|마침내)(?:(?:이|그|저)?(?:언덕|오르막(?:길)?)(?:을|도)?(?:다|끝까지)?(?:올라왔|올라갔|올랐)|(?:정상|꼭대기)(?:에|까지)?(?:올라왔|올라갔|올랐|도착했)|(?:다)?올라왔)(?:어|어요|다|네|네요)$/u,
    boundary:/^(?:나|난|저|전)?(?:오늘|지금)?(?:좀|조금|약간)?(?:짜증(?:이)?(?:나|나는데|나요)|기분이(?:안좋아|안좋은데|별로야)|속상(?:해|한데))(?:요)?[,，.]?(?:(?:그)?이유(?:는|를)?(?:말|얘기|설명)하고싶지않(?:아|아요)|이유는말하기싫(?:어|어요)|왜(?:그런지)?(?:는)?묻지(?:는)?(?:말아줘|말아주세요|마|마요)|이유는묻지(?:마|말아줘|마세요|마요))$/u
  }
};
const rideContext = /\b(?:hills?|uphill|climb\w*|summit|the top|mountain|accident|ambulance|traffic|brakes?|pain|injur\w*|scared|afraid|please remember)\b|坡|登顶|山顶|骑上来|爬上来|受伤|好疼|不适|害怕|刹车|车流|事故|记住|언덕|오르막|정상에|꼭대기|올라왔|사고|무섭|아프|아파|브레이크|기억해/iu;
const invitesAnswer = /[?？]|\b(?:why not|how about|try|let['’]s|you (?:could|should|might)|(?:would|can|are|will|did|do) you|tell me|i suggest|what do you|shall we|take a look)\b|^(?:look|check|take|turn|watch|stop|wait|listen)\b|不如|要不要|你可以|你觉得|试试|试一下|建议|告诉我|看看|试着|你先|记得|怎么样|[吗呢吧][。！.!]?\s*$|어때|해\s*보|해봐|해볼|할까|볼까|알려\s*줘|하자|가자|갈래|좋겠|(?:봐|보자|보세요)[.,! ]*$/iu;
// Only an ordinary, unrelated preceding topic is safe to interrupt with a standalone celebration.
const unrelatedTopic = /\b(?:hellos?|hi|hey|colors?|colours?|trees?|leaves|flowers?|river|sky|clouds?|sunshine|birds?|weather|scenery|murals?|music)\b|你好|嗨|颜色|树|花|河|天空|云朵|天气|鸟|壁画|音乐|안녕|색깔|색상|나무|꽃|하늘|구름|강변|날씨|음악|벽화/iu;

function fitsHistory(previous, reaction) {
  if (!previous.length) return true;
  if (reaction.intent !== 'summit' || previous.at(-1)?.role !== 'assistant' || previous.at(-2)?.role !== 'user') return false;
  const recent = previous.slice(-6);
  if (recent.some(msg => !['user','assistant'].includes(msg?.role) || typeof msg.content !== 'string' ||
      msg.content.length > 600 || rideContext.test(msg.content) || deliveryTone('',msg.content) !== 'neutral' ||
      CHARACTER_REACTIONS.some(row => row.text === msg.content.trim()))) return false;
  return !invitesAnswer.test(previous.at(-1).content) && unrelatedTopic.test(previous.at(-2).content);
}

export function matchCharacterReaction(input){
  if(!input||input.image||input.event||!Array.isArray(input.messages)||!input.messages.length)return;
  const msg=input.messages.at(-1);
  if(msg?.role!=='user'||typeof msg.content!=='string'||msg.content.length>180||/[?？]/u.test(msg.content))return;
  const locale=input.language,patterns=Object.hasOwn(triggers,locale)&&triggers[locale];
  if(!patterns)return;
  let line=msg.content.normalize('NFKC').toLowerCase().trim().replace(/[.!。！]+$/u,'').replace(/[’‘]/gu,"'").trim();
  line=locale==='en'?line.replace(/\s+/gu,' '):line.replace(/\s+/gu,'');
  const intent=Object.keys(patterns).find(id=>patterns[id].test(line));
  if(!intent)return;
  const reaction=CHARACTER_REACTIONS.find(r=>r.soul===input.soul&&r.language===locale&&r.intent===intent);
  if(reaction&&waves.has(reaction.file)&&fitsHistory(input.messages.slice(0,-1),reaction))return reaction;
}

const assets=new URL('./assets/character-reactions/',import.meta.url);
const waves=new Map();
let approved={};
try{approved=JSON.parse(readFileSync(new URL('recordings.json',assets),'utf8'));}catch{/* Missing media uses live conversation. */}
for(const {file} of CHARACTER_REACTIONS){
  if(typeof approved?.[file]!=='string')continue;
  try{
    const wave=readFileSync(new URL(file,assets));
    if(wave.length>480000||wave.length<4800||wave.length%2||wave.toString('ascii',0,4)!=='RIFF'||wave.toString('ascii',8,16)!=='WAVEfmt '||
      wave.readUInt32LE(4)!==wave.length-8||wave.readUInt32LE(16)!==16||wave.readUInt16LE(20)!==1||wave.readUInt16LE(22)!==1||
      wave.readUInt32LE(24)!==24000||wave.readUInt16LE(34)!==16||wave.toString('ascii',36,40)!=='data'||wave.readUInt32LE(40)!==wave.length-44)continue;
    if(sha256(wave)===approved[file])waves.set(file,wave);
  }catch{/* One absent recording must not disable other verified recordings. */}
}
export function characterReactionAudio({soul,language,text}={}){
  const entry=CHARACTER_REACTIONS.find(row=>row.soul===soul&&row.language===language&&row.text===text);
  return entry&&waves.get(entry.file);
}
