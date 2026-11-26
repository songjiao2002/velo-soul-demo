const lines={
  lumi:{
    en:{pace:"Let's slow down. I like having time to look around.",rest:"Let's find a safe spot to stop. I could use a minute to look around.",quiet:"Got it."},
    ko:{pace:'천천히 가자. 난 여유 있게 둘러보는 게 좋아.',rest:'안전한 데서 잠깐 쉬자. 나도 느긋하게 둘러보고 싶어.',quiet:'알겠어.'},
    zh:{pace:'慢点骑吧，我喜欢有空四处看看。',rest:'找个安全的地方歇会儿吧。我正想慢慢看看四周呢。',quiet:'好。'}
  },
  mori:{
    en:{pace:'Slow sounds good to me.',rest:"Rest somewhere safe? My specialty.",quiet:'Okay.'},
    ko:{pace:'천천히 가는 게 좋지.',rest:'안전한 데서 쉬자. 그건 자신 있어.',quiet:'응.'},
    zh:{pace:'慢慢骑，我喜欢。',rest:'找个安全的地方歇着。这我在行。',quiet:'好，听你的。'}
  },
  bori:{
    en:{pace:"Take it easy. I'm happy at your pace.",rest:"Let's take a break somewhere safe. I'm in.",quiet:'Okay.'},
    ko:{pace:'천천히 가자. 난 같이 맞춰 가는 게 좋아.',rest:'안전한 데서 잠깐 쉬자. 나도 찬성!',quiet:'응, 알겠어.'},
    zh:{pace:'慢慢来，跟着你的节奏就好。',rest:'找个安全的地方歇歇吧，我也想缓口气。',quiet:'好。'}
  }
};

export const RIDE_QUICK_REPLIES=Object.entries(lines).flatMap(([soul,languages])=>
  Object.entries(languages).flatMap(([language,replies])=>
    Object.entries(replies).map(([intent,text])=>({
      soul,language,intent,text,path:`/audio/ride-quick/${soul}-${language}-${intent}.wav`
    }))
  )
);

// The entire utterance must be a self-contained request. Extra clauses, safety
// concerns and requests about the app or its voice go through normal dialogue.
const english={
  pace:[
    /^(?:(?:can|could|should|shall) we|let's) (?:slow down(?: a (?:bit|little))?|(?:ride|pedal|cycle) (?:a (?:bit|little) )?(?:slower|more slowly))(?: (?:here|on (?:this|the) hill|uphill))?$/u,
    /^i(?:'d like| want) to (?:ride|pedal|cycle) (?:a (?:bit|little) )?(?:slower|more slowly)$/u
  ],
  rest:[
    /^(?:(?:can|could|should|shall) we|let's|i (?:need|want) to|i'd like to) (?:take a (?:(?:short|little|quick) )?(?:break|rest|breather)|(?:stop|pull over) for (?:a (?:break|rest|breather)|a minute))$/u,
    /^i (?:need|could use) a (?:break|breather|short rest)$/u
  ],
  quiet:[
    /^(?:(?:can|could|would) you )?(?:be quiet|stay quiet|stop talking)(?: for (?:now|a (?:bit|while|minute)))?$/u,
    /^(?:(?:can|could) we|let's) ride (?:in silence|quietly)(?: for a (?:bit|while))?$/u,
    /^don't (?:talk|speak) (?:for (?:now|a (?:bit|while|minute))|to me right now)$/u
  ]
};
const chinese={
  pace:[
    /^(?:(?:这段|这个|这条)(?:上坡路|上坡|坡)(?:上)?[,，]?)?(?:我们|咱们)?(?:可以|要不要|能不能|不如|还是)?(?:稍微)?(?:骑(?:得)?慢(?:一些|一点点|一点儿|一点|点儿|点)?|慢(?:一些|一点儿|一点|点儿|点)?骑|慢慢骑)(?:好吗|好不好|怎么样|吧|吗|呀)?$/u,
    /^我想(?:骑慢(?:一点儿|一点|点儿|点)|慢慢骑)$/u
  ],
  rest:[
    /^(?:我们|咱们)?(?:可以|要不要|能不能|不如)?(?:停下来|停下|停一停)?(?:休息|歇)(?:一下|一会儿|一会|会儿|会|口气)(?:好吗|好不好|吧|吗|呀)?$/u,
    /^(?:我们|咱们)(?:要不要|不如)?(?:休息|歇歇)(?:吧|呀)?$/u,
    /^我想(?:休息|歇)(?:一下|一会儿|一会|会儿|会|口气)$/u
  ],
  quiet:[
    /^(?:请|麻烦你)?(?:先|暂时)?(?:别说话|不要说话|不要讲话|别讲话|不用说话了)(?:了|好吗|好不好)?$/u,
    /^(?:我们|咱们)(?:先)?安静地骑(?:一会儿|一会|会儿|会)(?:吧|好吗)?$/u
  ]
};
// Korean ASR may join or separate the words in the same ending. Spaces are
// removed for these anchored Korean patterns only, never across Latin words.
const korean={
  pace:[
    /^(?:이(?:오르막(?:길)?|언덕)(?:에서는|에서|은)?[,，]?)?(?:우리)?(?:조금|좀)?(?:더)?천천히(?:가자|가요|갈까|갈까요|갈래|갈래요|가볼까|가고싶어|가고싶어요|가도될까|가도될까요|가도돼|가도돼요|달리자|달릴까|달릴까요|타자|탈까|탈까요)$/u,
    /^(?:우리)?(?:조금|좀)?속도(?:를)?(?:조금|좀)?(?:줄이자|줄일까|줄일까요|줄여볼까|늦추자|늦출까|늦출까요)$/u
  ],
  rest:[
    /^(?:우리)?(?:잠깐|잠시|조금|좀)?(?:쉬자|쉬어갈까|쉬어갈까요|쉬고갈까|쉬고갈까요|쉴까|쉴까요|쉴래|쉴래요|쉬어도될까|쉬어도될까요|쉬고싶어|쉬고싶어요)$/u
  ],
  quiet:[
    /^(?:잠깐|잠시|지금은|이제)?(?:조용히해줘|조용히해줄래|조용히해줄래요|말하지마|말하지말아줘|말걸지마|말걸지말아줘)(?:요)?$/u,
    /^(?:우리)?(?:잠깐|잠시)?조용히(?:타자|달리자|탈까|달릴까)$/u
  ]
};
export function rideIntent(transcript){
  if(typeof transcript!=='string'||transcript.length>140)return;
  let text=transcript.normalize('NFKC').replace(/[’‘]/gu,"'").trim().toLowerCase()
    .replace(/[.!?。！？]+$/u,'').trim().replace(/\s+/gu,' ');
  let phrases;
  if(/^[a-z]/u.test(text)){
    text=text.replace(/^please[, ]+|[, ]+please$/gu,'');
    phrases=english;
  }else if(/\p{Script=Hangul}/u.test(text)){
    text=text.replaceAll(' ','');
    phrases=korean;
  }else if(/\p{Script=Han}/u.test(text)){
    text=text.replaceAll(' ','');
    phrases=chinese;
  }else return;
  return Object.keys(phrases).find(intent=>phrases[intent].some(pattern=>pattern.test(text)));
}

export function getRideQuickReply(transcript,{soul,language}={}){
  const intent=rideIntent(transcript);
  if(intent)return RIDE_QUICK_REPLIES.find(reply=>reply.intent===intent&&reply.soul===soul&&reply.language===language);
}

// Once the rider has shared something personal, let the next answer reflect
// that exchange. Purely practical turns and requests for quiet can stay local.
export function contextualRideQuickReply(transcript,options,previous){
  const clip=getRideQuickReply(transcript,options);
  if(!clip||!previous||clip.intent==='quiet')return clip;
  if(previous.role==='assistant'&&previous.content!==clip.text&&RIDE_QUICK_REPLIES.some(
    other=>other.soul===options.soul&&other.text===previous.content))return clip;
}
