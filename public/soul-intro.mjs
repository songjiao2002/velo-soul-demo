// The introduction is independent of GPS, weather and a language-model request.
export const SOUL_INTRO={
 lumi:{en:'Hi, I’m Lumi, the curious soul living in this bike. I love little discoveries. I’m happy to ride with you.',ko:'안녕, 나는 이 자전거에 사는 루미야. 작은 발견을 좋아하는 호기심 많은 소울이야. 오늘 함께 달리자!'},
 mori:{en:'Hi, I’m Mori, your easygoing bicycle companion. We can take things at your pace. I’ll be right here.',ko:'안녕, 나는 느긋한 자전거 소울 모리야. 오늘은 네 속도에 맞춰서 함께 갈게. 편하게 이야기해줘.'},
 bori:{en:'Hi, I’m Bori, the foodie soul living in this bike. I love a good snack story. Let’s enjoy the ride together.',ko:'안녕, 나는 맛있는 이야기를 좋아하는 자전거 소울 보리야. 오늘도 네 옆에서 즐겁게 달릴게!'}
};
export function soulIntroduction(soul,language='en',fallback='en'){
 const locale=(language==='auto'?fallback:language)==='ko'?'ko':'en';
 return SOUL_INTRO[soul]?{text:SOUL_INTRO[soul][locale],language:locale}:null;
}
export function introductionClip(text,soul,language){
 const locale=language==='ko'?'ko':'en';
 return SOUL_INTRO[soul]?.[locale]===text?`/audio/intro/${soul}-${locale}.wav?v=20261018-voice9`:null;
}
