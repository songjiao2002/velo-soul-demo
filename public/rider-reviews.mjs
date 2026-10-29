// Fictional study fixtures only: never sent to memory storage or AI context.
export const RIDER_REVIEWS={
 "lumi": [
  {
   "stars": 5,
   "en": "Mori made an ordinary street feel like a little expedition.",
   "ko": "모리 덕분에 평범한 골목이 작은 탐험길이 됐어요.",
   "zh": "Mori 把普通的小巷变成了一场小探险。",
   "name": "민서"
  },
  {
   "stars": 4,
   "en": "I liked how excited Mori got about tiny things I usually miss.",
   "ko": "늘 지나치던 작은 것에 모리가 신나 하는 게 좋았어요.",
   "zh": "我喜欢 Mori 对平时忽略的小事兴奋起来的样子。",
   "name": "haru"
  },
  {
   "stars": 3,
   "en": "The questions were fun, but sometimes I wanted a quiet stretch.",
   "ko": "질문은 재미있었지만 가끔은 조용히 달리고 싶었어요.",
   "zh": "问题很有趣，但有时我也想安静地骑一会儿。",
   "name": "Jae"
  }
 ],
 "bori": [
  {
   "stars": 5,
   "en": "Popo talking about warm bread made our break feel like a tiny picnic.",
   "ko": "포포의 따뜻한 빵 이야기에 잠깐의 휴식이 소풍처럼 느껴졌어요.",
   "zh": "Popo 说起热面包，让短暂的休息像一场小野餐。",
   "name": "소라"
  },
  {
   "stars": 4,
   "en": "That little bread basket was the best company on my way to a café.",
   "ko": "카페 가는 길에 작은 빵 바구니가 든든한 동행이었어요.",
   "zh": "去咖啡馆的路上，那个小面包篮是很可爱的陪伴。",
   "name": "bread.walk"
  },
  {
   "stars": 3,
   "en": "Cute, but I was already full and the food talk kept coming.",
   "ko": "귀엽지만 이미 배부른데 먹는 이야기가 계속됐어요.",
   "zh": "很可爱，可我已经饱了，话题还是一直绕着吃的。",
   "name": "유진"
  }
 ],
 "mori": [
  {
   "stars": 5,
   "en": "Lulu helped me notice the breeze instead of watching my speed.",
   "ko": "루루와 함께하니 속도보다 바람이 먼저 느껴졌어요.",
   "zh": "和 Lulu 一起，先感受到的是风，而不是速度。",
   "name": "연두"
  },
  {
   "stars": 4,
   "en": "A quiet companion for a slow ride by the river.",
   "ko": "강변을 천천히 달릴 때 잘 어울리는 조용한 친구예요.",
   "zh": "沿河慢慢骑时，它是个很合拍的安静伙伴。",
   "name": "slow.sunday"
  },
  {
   "stars": 3,
   "en": "The calm mood was nice, but I wished Lulu had a little more to say.",
   "ko": "차분해서 좋았지만 루루가 조금 더 말해줬으면 했어요.",
   "zh": "悠闲的氛围不错，不过希望 Lulu 能多说一点。",
   "name": "지우"
  }
 ]
};
const copy={en:{tag:'A little trace left with this bicycle',sample:'Preset notes',rider:'Rider',rating:n=>`${n} out of 5 stars`},ko:{tag:'이 자전거에 남은 작은 여운',sample:'미리 작성한 글',rider:'라이더',rating:n=>`별점 5점 중 ${n}점`},zh:{tag:'留在这辆车上的一点余韵',sample:'预设留言',rider:'骑行者',rating:n=>`评分 ${n} / 5`}};
export function riderReviewsMarkup(bike,language='en'){
 const lang=Object.hasOwn(copy,language)?language:'en',c=copy[lang],reviews=RIDER_REVIEWS[bike]||RIDER_REVIEWS.lumi;
 return `<div class="rider-reviews-heading"><small>${c.sample}</small></div><ul class="rider-reviews">${reviews.map((review,i)=>`<li><div class="rider-review-meta"><span>${review.name}</span><span class="rider-review-stars" role="img" aria-label="${c.rating(review.stars)}"><span aria-hidden="true">${'★'.repeat(review.stars)}<span class="empty-stars">${'☆'.repeat(5-review.stars)}</span></span></span></div><p>${review[lang]}</p></li>`).join('')}</ul>`;
}
