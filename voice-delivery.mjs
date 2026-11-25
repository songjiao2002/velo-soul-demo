// Only the spoken line and the immediately preceding rider turn are relevant.
// The provider receives a delivery direction, never the rider's private turn.
const serious = /\b(?:watch out|look out|danger(?:ous)?|emergency|brakes? failed|crash(?:ed)?|hurt|injured|bleeding|traffic|crossing)\b|小心|危险|刹车失灵|来车|受伤|流血|路口|别分心|조심|위험|다쳤|다친|비상|교차로|차가 와/iu;
const gentle = /\b(?:tired|worn out|exhausted|take a breather|need a break|catch your breath|upset|sad|rough day|feeling down|feeling low|worried|rest a bit|keep it quiet)\b|累[了啦死坏]|好累|有点累|歇一|喘口气|难过|伤心|失落|难受|不舒服|担心|安静|好好休息|힘들|지쳤|지친|피곤|속상|슬퍼|쉬어|쉬자|걱정|조용히/iu;
const playful = /\b(?:haha|ha ha|funny|hilarious|kidding|joking|nailed it|we did it|made it|high five|so happy|wow|hooray|awesome|love it|you drew|one star|five stars)\b|哇|哈哈|好耶|太好了|太棒|好开心|好可爱|笑死|开玩笑|画的|原来是你|一星|五星|우와|와아|해냈|신난|웃기|귀엽|대박|농담|진짜 웃|네가 그렸|[ㅋㅎ]{2,}/iu;
const notTired = /\b(?:not|never) (?:that |really |very )?(?:tired|sad|worried)\b|(?:不|没那么|不怎么)(?:累|难过|担心)|(?:안\s*피곤\S*|피곤하지\s*않\S*)/giu;

export function deliveryTone(line, rider = '') {
  const text = [rider, line].filter(value => typeof value === 'string').join('\n');
  if (serious.test(text)) return 'serious';
  if (gentle.test(text.replace(notTired, ''))) return 'gentle';
  if (playful.test(text)) return 'playful';
  return 'neutral';
}

export function spokenPunctuation(text, tone, language) {
  if (tone === 'playful') return text.replace(/[.。]$/u, language === 'Chinese' ? '！' : '!');
  if (tone === 'gentle') return text.replace(/[!！]+$/u, language === 'Chinese' ? '。' : '.');
  return text;
}

export const pandaDirection = {
  neutral: 'Start speaking promptly. Keep words clear at a conversational pace; gently stretch only the final vowel of occasional phrases by about 200–300 ms, with a small pitch rise then fall and a subtle sleepy throat rumble.',
  playful: 'Start promptly. Let a small, amused smile come through in the vowels. Give the playful word a slight lift, then settle warmly on the last word. Keep the relaxed low panda voice.',
  gentle: 'Start promptly. Sound quietly attentive, like keeping a tired friend company. Ease the stress on the first words and let the last word settle. Use a clear, soft speaking voice with natural breath.',
  serious: 'Start promptly. Speak steadily, clearly and matter-of-factly. Emphasize the important word once, with a short firm ending and no sleepy rumble or drawn-out syllables.'
};
