import {CHARACTERS} from './character-art.mjs';
import {BUILD} from './build-version.mjs';
// Names and exact opening lines share the visual identity catalog. Weather is
// announced separately only after a fresh location-based weather response.
export const SOUL_INTRO=Object.fromEntries(Object.entries(CHARACTERS).map(([id,c])=>[id,{ko:`안녕, 나는 ${c.name}야. ${c.greeting.ko}`,en:`Hi, I’m ${c.en}. ${c.greeting.en}`}]));
export function soulIntroduction(soul,language='en',fallback='en'){
 const locale=(language==='auto'?fallback:language)==='ko'?'ko':'en';
 return SOUL_INTRO[soul]?{text:SOUL_INTRO[soul][locale],language:locale}:null;
}
export function introductionClip(text,soul,language){const locale=language==='ko'?'ko':'en';return SOUL_INTRO[soul]?.[locale]===text?`/audio/characters13/${soul}-${locale}.wav?v=${BUILD}`:null;}
