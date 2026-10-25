import {characterSVG} from './character-2d.mjs';
// The original design board is the illustration reference. Legacy bike IDs
// preserve printed QR codes, server persona routing and saved bicycle memories.
export const CHARACTER_SOURCE='/assets/characters-original-20261025.jpg';
export const CHARACTER_SOURCE_SIZE=[1536,1024];
export const CHARACTER_ORDER=['lumi','bori','mori'];
export const CHARACTERS={
 lumi:{name:'모리',en:'Mori',zh:'莫里',species:'cat',color:'#db793e',tint:'#fff0e4',
  title:{ko:'호기심 많은 탐험가',en:'A curious explorer',zh:'好奇的探险家'},
  greeting:{ko:'오늘은 어떤 재밌는걸 보러갈까?',en:'What fun things shall we go and see today?',zh:'今天去看点什么有趣的东西呢？'},
  rest:{ko:'내려서 주변을 구경해요',en:'Hops off to look around',zh:'下车看看四周'},
  story:{ko:'처음 가는 길도 궁금한 세상을 발견하는 게 좋아요. 언제나 먼저 달리며 새로운 곳을 찾아내는 모험가예요.',en:'Even an unfamiliar road is full of discoveries. An eager little explorer, always curious about what comes next.',zh:'喜欢在陌生的路上发现新世界，总是好奇前方还有什么的探险家。'},
  poses:{cover:[232,16,268,313],greeting:[19,583,109,127],rest:[43,355,132,150],restAlt:[211,354,151,150],riding:[322,772,144,156],slow:[174,772,135,156],fast:[480,772,139,156],stopping:[628,772,137,156]}},
 bori:{name:'포포',en:'Popo',zh:'波波',species:'hamster',color:'#de9d2f',tint:'#fff6df',
  title:{ko:'먹보 라이더',en:'A foodie rider',zh:'贪吃的骑行伙伴'},
  greeting:{ko:'오늘은 어떤 맛있는걸 먹으러갈까?',en:'What delicious things shall we go and eat today?',zh:'今天去吃点什么好吃的呢？'},
  rest:{ko:'가방에서 빵을 꺼내 먹어요',en:'Takes bread from the bag for a snack',zh:'从包里拿出面包吃'},
  story:{ko:'달리는 것도 좋지만, 맛있는 걸 발견하는 게 더 좋아요. 라이딩 코스의 맛집과 카페를 찾아내는 든든한 친구예요.',en:'Riding is lovely, but discovering something delicious is even better. A warm friend with a soft spot for bread and café breaks.',zh:'喜欢骑行，更喜欢发现美食。惦记面包和咖啡馆的可靠伙伴。'},
  poses:{cover:[752,24,240,303],greeting:[752,588,108,124],rest:[752,588,108,124],restAlt:[704,351,142,161],riding:[752,24,240,303]}},
 mori:{name:'루루',en:'Lulu',zh:'露露',species:'panda',color:'#6b9665',tint:'#edf5e9',
  title:{ko:'느긋한 힐링 라이더',en:'An easygoing companion',zh:'悠闲的治愈系伙伴'},
  greeting:{ko:'오늘은 네 속도에 맞춰 함께 갈게.',en:'We can take things at your pace today.',zh:'今天，就按照你舒服的速度一起走吧。'},
  goodWeather:{ko:'날씨가 좋으니 천천히가자',en:'The weather is lovely, so let’s take it slowly.',zh:'天气这么好，我们慢慢走吧。'},
  badWeather:{ko:'오늘은 그냥 쉬면 안되?',en:'Could we just take a rest today?',zh:'今天就休息一下，不行吗？'},
  rest:{ko:'누워서 잠깐 잠들어요',en:'Lies down for a little nap',zh:'躺下来睡一会儿'},
  story:{ko:'빨리 가는 것보다 천천히, 즐겁게 달리는 걸 좋아해요. 좋은 풍경, 시원한 바람, 여유로운 시간을 함께하는 편안한 친구예요.',en:'Happiest taking the scenic, unhurried way. A gentle friend for fresh air, quiet company and an occasional nap.',zh:'比起赶路，更喜欢慢慢享受风景、清风和闲暇时光，也爱打个小盹。'},
  poses:{cover:[1238,15,273,314],greeting:[1050,355,143,159],rest:[1427,589,98,124],restAlt:[1427,589,98,124],riding:[1238,15,273,314]}}
};
export function characterName(id,language='ko'){const c=CHARACTERS[id];return c?.[language==='en'?'en':language==='zh'?'zh':'name']||'';}
export function poseBox(id,pose='cover'){return CHARACTERS[id]?.poses[pose]||CHARACTERS[id]?.poses.cover;}
// Exclude neighboring editorial text from the display window, leaving every
// character pixel intact. Paths use coordinates of the untouched source board.
export function poseOutline(id,pose='cover'){
 if(!['cover','riding'].includes(pose))return null;
 if(id==='bori')return 'M752 24H992V327H752V304H780V154H752Z';
 if(id==='mori')return 'M1238 15H1511V329H1238V305H1278V143H1238Z';
 return null;
}

// Hand-drawn vector layers follow the supplied design board.
export function characterArtwork(id,pose='cover',className=''){
 const c=CHARACTERS[id];if(!c)return '';
 const activity=pose==='cover'||pose==='riding'?'riding':pose==='rest'?'resting':'idle';
 return '<span class="character-view '+className+'" data-character-2d data-character-toon data-turnable tabindex="0" data-soul="'+id+'" data-pose="'+activity+'" role="img" aria-label="'+c.en+' · illustrated character · drag or use arrow keys to turn" data-no-translate><canvas class="toon-canvas" aria-hidden="true"></canvas>'+characterSVG(id,activity)+'</span>';
}
export function characterPuppet(id){const c=CHARACTERS[id];if(!c)return '';return '<span class="soul-puppet character-puppet '+id+'" data-character-2d data-character-toon data-turnable tabindex="0" data-soul="'+id+'" data-expression="greeting" data-activity="greeting" role="img" aria-label="'+c.en+' · illustrated companion · drag or use arrow keys to turn" data-no-translate><canvas class="toon-canvas" aria-hidden="true"></canvas>'+characterSVG(id,'greeting')+'</span>';}
