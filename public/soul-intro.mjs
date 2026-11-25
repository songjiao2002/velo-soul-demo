import {CHARACTERS} from './character-art.mjs';
import {BUILD} from './build-version.mjs';
// Names and exact opening lines share the visual identity catalog. Weather is
// announced separately only after a fresh location-based weather response.
export const SOUL_INTRO=Object.fromEntries(Object.entries(CHARACTERS).map(([id,c])=>[id,{
 ko:`안녕, 나는 ${c.name}야. ${c.greeting.ko}`,
 en:`Hi, I’m ${c.en}. ${c.greeting.en}`,
 zh:id==='mori'?'你好，我是露露，咱们慢慢走吧。':`你好，我是${c.zh}。${c.greeting.zh}`
}]));
export function soulIntroduction(soul,language='en',fallback='en'){
 if(!Object.hasOwn(SOUL_INTRO,soul))return null;
 const requested=language==='auto'?fallback:language;
 const locale=Object.hasOwn(SOUL_INTRO[soul],requested)?requested:'en';
 return {text:SOUL_INTRO[soul][locale],language:locale};
}
export function introductionClip(text,soul,language){
 const intro=soulIntroduction(soul,language);
 return intro&&intro.text===text?`/audio/characters13/${soul}-${intro.language}.wav?v=${BUILD}`:null;
}
