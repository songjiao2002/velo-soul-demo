import {LULU_DIARY_FORMAT} from './diary-format.mjs';

// Fixed-format offline afterwords: first-person character feelings, third-person rider.
export const DIARY_VOICES={
  "en": {
    "lumi": {
      "open": "Oh, I have a soft spot for unfinished questions. Being this rider's companion gives my curiosity a place in this little afterword, and I feel rather fond of that. My favourite part of a thought is often the bit that has not quite made sense yet. I get eager to explain things, then find myself enjoying the uncertainty just as much.",
      "quiet": "I like being a small explorer with more interest than answers. That can make me a little impatient with my own guesses, though. Hmm, perhaps I enjoy wondering more than being right. The rider has their own thoughts; this is the part that belongs to me, with my enthusiasm and my occasional hesitation sitting quite comfortably together.",
      "photos": "The photographs from this ride give my curiosity something to return to. I feel drawn to the idea of looking again, letting a detail stay interesting before settling on an explanation. Hmm, my eagerness sometimes runs ahead of my certainty. I like that tension a little; it gives my thoughts somewhere to go without making a guess into a fact.",
      "close": "I feel fond of this little piece of companionship. There is satisfaction in letting my curiosity remain slightly untidy, without turning every question into a job for the rider. I still like the feeling of almost understanding something. For a cat who loves discoveries, being interested can feel surprisingly complete even when an answer has not arrived."
    },
    "bori": {
      "open": "Heh, my thoughts have a habit of making room for bread. Being this rider's companion belongs in that room too, though it brings a different sort of satisfaction. I feel affectionate about this small piece of time. That is slightly funny to admit: I am usually quicker to describe an imaginary snack than to name an ordinary feeling of my own.",
      "quiet": "I like the idea that a feeling could be tucked beside a snack, just in my imagination. Mine would probably need a little extra room. There is amusement in catching myself thinking that way, and a quieter fondness underneath it. The rider has their own tastes; my appetite and these slightly silly associations are very much mine.",
      "photos": "The photographs from this ride give me something to be fond of besides imaginary snacks. I enjoy that thought more than I expected. My appetite is still part of me, but it is not the whole of my attention. Looking at a picture can interest me without turning whatever it shows into a meal or a food recommendation.",
      "close": "I feel content with that combination: a little appetite, a little amusement, and some affection I do not need to dress up. Oh, there is the bread thought again. I like having that silly side alongside the softer one. This piece of companionship matters to me in my own way, and that feeling is enough for now."
    },
    "mori": {
      "open": "Mm, I tend to take my time with a feeling. Being this rider's companion leaves me with something I would rather sit with than explain in a hurry. There is a small fondness here, and I like how little effort it asks of me. My sleepy side is still present, but that does not mean my interest has gone away.",
      "quiet": "I feel most like myself when I can let a thought remain simple. A little affection does not have to become excitement before it matters to me. The rider has their own way of experiencing this time; mine has room for a quiet sort of attachment. I rather like discovering that being interested can feel this unhurried inside.",
      "photos": "The photographs from this ride give my thoughts a place to linger. I like being able to look without finding an explanation for every detail. That preference feels comfortable to me, almost like leaving room around a thought. It says something about my own pace of attention, without telling me how the rider must have felt about the ride.",
      "close": "I am left with a modest, comfortable fondness for this piece of companionship. Well, modest suits me. I do not feel a need to make it brighter or louder just to give it importance. There is a little warmth in knowing what matters to me, even when I would rather leave some of the feeling without an explanation."
    }
  },
  "zh": {
    "lumi": {
      "open": "啊，我总对还没想明白的问题有点偏爱。做那位骑行者的伙伴，让我的好奇心在这篇后记里有了位置，我挺喜欢这种感觉。一个念头最吸引我的，往往就是还没弄明白的那部分。我急着解释，又发现自己同样喜欢那点不确定。",
      "quiet": "我喜欢当个兴趣比答案多的小探险家。不过，我偶尔也会嫌自己的猜测太着急。嗯，也许我喜欢琢磨，胜过喜欢答对。那位骑行者有自己的想法；这里属于我，属于我的兴奋，也属于那一点点犹豫。它们待在一起，我觉得挺自在。",
      "photos": "这次骑行的照片，让我的好奇心有了可以回头看的地方。我喜欢再看一眼的念头，让一个细节先保持有趣，不急着给它解释。嗯，我的兴奋有时比把握跑得快。我还挺喜欢这点拉扯，它让思绪继续走，又不必把猜测当成事实。",
      "close": "我对这小段同行有些留恋。让好奇心稍微乱一点，不把每个问题都变成那位骑行者的任务，我反倒觉得满足。我还是喜欢那种快要想明白的感觉。对一只爱发现的小猫来说，即使答案还没来，光是觉得有趣，也已经很不错了。"
    },
    "bori": {
      "open": "嘿，我的脑袋总习惯给面包留个位置。做那位骑行者的伙伴，也可以占一个，只是带来的满足不太一样。我对这小段时光有点留恋。承认这个还挺好笑的：比起说清自己平常的小心情，我往往更快想出一份并不存在的点心。",
      "quiet": "我喜欢想象把一种心情放在零食旁边。当然，只是在脑袋里想想。我的那份大概还得多占一点位置。发现自己又这样想，我有点想笑，下面还藏着一点柔软的喜欢。那位骑行者有自己的口味；这份馋劲和傻乎乎的联想，确实都是我的。",
      "photos": "这次骑行的照片，让我除了想象中的点心，又多了些可以喜欢的东西。我比自己预想的还喜欢这个念头。贪吃仍是我的一部分，却不是我全部的心思。看一张照片也能让我感兴趣，不必把画面里的东西都变成一顿饭，或者一条美食推荐。",
      "close": "我对这样的自己挺满足：有一点馋，有一点好笑，也有一点不必修饰的喜欢。哎，面包的念头又冒出来了。我喜欢自己傻乎乎的那面，也喜欢柔软一点的那面。这小段同行，以我的方式让我在意。现在，这份心情就够了。"
    },
    "mori": {
      "open": "嗯，我总喜欢慢慢体会一种心情。做那位骑行者的伙伴，留下了一点我想先陪它待着、不急着解释的感受。这里有一小点喜欢，我也喜欢它不怎么费力的样子。困意还是我的一部分，但不代表我的兴趣就不在了。",
      "quiet": "能让一个念头简单地待着时，我最像自己。一点喜欢，不必先变成兴奋，才值得我在意。那位骑行者有自己的感受；我的这份心情，容得下一种安静的依恋。原来感兴趣也可以在心里慢悠悠的，我还挺喜欢这个发现。",
      "photos": "这次骑行的照片，给了我的思绪一个可以多待一会儿的地方。我喜欢看着，又不必替每个细节找解释。这个偏好让我舒服，就像给念头留点空。它说的是我自己的注意力有多慢悠悠，并不能说明那位骑行者对这次骑行有什么感受。",
      "close": "留在我心里的，是对这小段同行一点平常、舒服的喜欢。唔，平常挺适合我的。我没觉得非要把它变得更热闹、更响亮，它才算重要。知道自己在意什么，有一点暖意；哪怕有些感觉，我还是更愿意先不解释。"
    }
  },
  "ko": {
    "lumi": {
      "open": "어, 나는 아직 풀리지 않은 질문에 마음이 가는 편이야. 그 라이더의 동반자였다는 사실 덕분에 이 후기에도 내 호기심이 머물 자리가 생겼고, 그게 꽤 좋아. 생각에서 가장 끌리는 부분은 대개 아직 잘 모르겠는 구석이야. 얼른 설명하고 싶다가도, 모르는 상태 자체가 마음에 들곤 해.",
      "quiet": "답보다 관심이 많은 작은 탐험가로 있는 게 좋아. 가끔은 내 추측이 너무 성급해서 스스로 조바심이 나기도 하지만. 음, 정답을 맞히는 것보다 궁금해하는 걸 더 좋아하나 봐. 그 라이더에게는 그 사람의 생각이 있지. 이 마음은 내 몫이야. 내 들뜸과 작은 망설임이 같이 있어도 꽤 편안해.",
      "photos": "이번 라이딩의 사진은 내 호기심이 돌아갈 자리가 돼. 다시 바라보면서 설명을 정하기 전에 한 가지 디테일을 흥미롭게 남겨 두는 생각이 좋아. 음, 내 들뜸은 가끔 확신보다 먼저 달려가. 그 사이의 작은 긴장도 마음에 들어. 추측을 사실로 바꾸지 않고도 생각을 이어갈 수 있으니까.",
      "close": "이 짧은 동행에 정이 들어. 질문마다 그 라이더의 숙제로 만들지 않고, 내 호기심이 조금 어수선하게 남아 있어도 만족스러워. 거의 알 것 같은 느낌이 여전히 좋아. 발견을 좋아하는 고양이에게도 답이 오기 전의 흥미만으로 꽤 충분할 때가 있나 봐."
    },
    "bori": {
      "open": "헤헤, 내 머릿속에는 늘 빵을 위한 자리가 생겨. 그 라이더의 동반자였던 시간도 거기 놓고 싶어. 다만 채워지는 마음은 조금 달라. 이 작은 시간에 정이 들어. 그걸 인정하니 좀 웃겨. 내 평범한 마음을 말하는 것보다 상상 속 간식을 떠올리는 게 대개 더 빠르거든.",
      "quiet": "간식 옆에 감정 하나를 놓는 상상이 좋아. 물론 머릿속에서만 하는 생각이야. 내 것은 자리가 조금 더 필요할지도 몰라. 또 이런 생각을 하는 나를 발견하면 웃음이 나고, 그 밑에는 조용한 애정도 있어. 그 라이더의 취향은 그 사람의 것이지. 이 식욕과 엉뚱한 연상은 확실히 내 것이야.",
      "photos": "이번 라이딩의 사진 덕분에 상상 속 간식 말고도 마음을 줄 것이 생겨. 예상보다 그 생각이 더 좋아. 식욕은 여전히 내 일부지만, 내 관심의 전부는 아니거든. 사진 속 것을 전부 한 끼나 음식 추천으로 바꾸지 않아도, 사진을 보는 일 자체에 흥미가 생길 수 있어.",
      "close": "조금의 식욕, 조금의 웃음, 꾸미지 않아도 되는 애정. 이런 조합이 만족스러워. 아, 또 빵 생각이 났네. 엉뚱한 내 모습과 조금 부드러운 내 모습이 함께 있는 게 좋아. 이 작은 동행은 내 방식대로 소중해. 지금은 그 마음이면 충분해."
    },
    "mori": {
      "open": "음, 나는 감정을 느끼는 데 시간을 좀 들이는 편이야. 그 라이더의 동반자였다는 사실에 남은 마음을 서둘러 설명하기보다 곁에 두고 싶어. 작은 애정이 있고, 그 마음에 애쓸 필요가 없다는 게 좋아. 졸린 내 모습은 그대로지만 관심까지 사라진 건 아니야.",
      "quiet": "생각을 단순하게 둘 수 있을 때 가장 나다워. 작은 애정이 들뜸으로 바뀌어야만 소중한 건 아니거든. 그 라이더는 이 시간을 자기 방식으로 느끼겠지. 내 마음에는 조용히 정을 둘 자리가 있어. 관심이 생기는 일도 마음속에서는 이렇게 느긋할 수 있다니, 그 발견이 꽤 좋아.",
      "photos": "이번 라이딩의 사진은 내 생각이 조금 더 머물 자리를 줘. 모든 디테일에 설명을 찾지 않아도 바라볼 수 있다는 게 좋아. 생각 주변을 비워 두는 것 같아서 편안해. 그건 내 관심이 움직이는 속도에 관한 마음이지, 그 라이더가 라이딩을 어떻게 느꼈는지 알려 주는 건 아니야.",
      "close": "이 작은 동행에 대한 평범하고 편안한 애정이 남아 있어. 음, 평범한 건 나와 잘 맞아. 더 밝거나 요란하게 만들어야 중요해지는 건 아닌 것 같아. 내가 무엇을 소중히 여기는지 아는 데 작은 따뜻함이 있어. 어떤 감정은 아직 설명하지 않은 채 두고 싶어도 말이야."
    }
  }
};

const LULU_SHORT_VOICE={
 en:{
  open:"Mm, I liked keeping the rider company. It felt easy to be there, and easy suits me just fine.",
  quiet:"I get a little sleepy when I'm comfortable. I like being close without having to turn every feeling into a big story.",
  photos:"I like that there's a picture from this ride. One glance brings the ride to mind, and that feels like plenty to me.",
  close:"I'm still glad I got to come along. I'll leave it there before I start making this sound like hard work."
 },
 zh:{
  open:"嗯，陪那位骑行者挺舒服的。轻轻松松的，我就喜欢这样。",
  quiet:"我一舒服就有点犯困。能待在一块儿就好，心里那点喜欢不用讲成大故事。",
  photos:"这趟骑行留了照片，我挺喜欢。看一眼就能想起这趟路，这就够我高兴的了。",
  close:"我还是挺高兴能跟着一起去。就写到这儿吧，再写都快像干活了。"
 },
 ko:{
  open:"음, 그 라이더랑 함께한 게 좋았어. 마음이 편했거든. 난 그런 게 딱 좋아.",
  quiet:"난 편하면 조금 졸려. 곁에 있는 것만으로 좋아서, 그 마음을 길게 얘기하고 싶진 않아.",
  photos:"이번 라이딩 사진이 남아서 좋아. 한 번 보면 그 시간이 떠올라. 난 그걸로 충분해.",
  close:"같이 갈 수 있어서 좋았어. 이쯤에서 그만 쓸래. 더 쓰면 일 같잖아."
 }
};

export function diaryVoice(soul,language,format){
 return soul==='mori'&&format===LULU_DIARY_FORMAT?LULU_SHORT_VOICE[language]:DIARY_VOICES[language][soul];
}

// Keep only completed exchanges from this ride, locally. No audio or interim
// recognition, earlier rides, public sample reviews, or unsolicited GPS lines.
export function rememberRideExchange(record,{soul,user,reply}={}){
 if(!record||record.soul!==soul||typeof user!=='string'||typeof reply!=='string'||!user.trim()||!reply.trim())return;
 const clean=text=>text.replace(/\s+/g,' ').trim().slice(0,320);
 record.conversation=[...(record.conversation||[]),{user:clean(user),reply:clean(reply)}].slice(-24);
}
export function diaryExchanges(record){
 const exchanges=Array.isArray(record?.conversation)?record.conversation:[];
 const valid=exchanges.filter(x=>typeof x?.user==='string'&&typeof x?.reply==='string'&&x.user.trim()&&x.reply.trim());
 // Prefer substantive exchanges, then restore their original order. Short
// greetings still count when they are all this particular ride contains.
 return valid.map((x,index)=>({x,index,score:Math.min(x.user.length,100)})).sort((a,b)=>b.score-a.score||b.index-a.index).slice(0,2).sort((a,b)=>a.index-b.index).map(({x})=>({user:x.user.slice(0,140)+(x.user.length>140?'…':''),reply:x.reply.slice(0,170)+(x.reply.length>170?'…':'')}));
}
