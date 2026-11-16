import {DIARY_VOICES} from './public/diary-voices.mjs';
import {diaryFormat} from './public/diary-format.mjs';

// A complete authored closing keeps sparse memories within the fixed format
// without cutting sentences or asking the model to invent another incident.
const reflections={
 zh:{
  lumi:'我的好奇心总喜欢在小地方多待一会儿。一个普通的念头，也可以有它自己的意思，这正是我喜欢当探险小伙伴的原因。',
  bori:'我这个爱惦记零食的家伙，也有不靠吃就能满足的小心思。给一段同行写下几句话，就是我表达喜欢的方式，有点笨，但很认真。',
  mori:'我的想法有时转得慢，却也愿意在一个念头旁边多待一会儿。对我来说，陪伴可以很平常，不需要每一次都讲成一个精彩的故事。'
 },
 ko:{
  lumi:'나는 작은 생각 하나에도 오래 궁금해하는 편이야. 답을 정하지 않은 마음에도 나름의 자리가 있다고 생각하거든.',
  bori:'먹는 걸 좋아하는 나에게도 간식과 상관없는 마음이 있어. 함께한 시간에 내 식대로 몇 마디 남기는 것도 그중 하나야.',
  mori:'내 생각은 조금 느리게 움직여. 그래서 하나의 마음 곁에 오래 머물기도 해. 평범한 마음도 내게는 충분히 소중하거든.'
 },
 en:{
  lumi:'I like that curiosity can belong to an ordinary thought. There is no prize for finding the most surprising explanation, and I do not need to turn my interest into a task for you. That feels like a good way to be a little explorer.',
  bori:'For someone who thinks about snacks so often, I have quite a few feelings that have nothing to do with eating. Giving this time a few words of my own is one way I like to show that it matters to me.',
  mori:'My thoughts tend to move slowly, and I like letting a small feeling have its own space. Being a companion can be something ordinary. I do not need to make every piece of our time into an extraordinary story to care about it.'
 }
};
export function fitDiaryClosing(body,{soul,language}){
 if(diaryFormat(body,language).valid)return body;
 const parts=body.trim().split(/\n\s*\n/),voice=DIARY_VOICES[language]?.[soul];
 if(parts.length!==3||!voice)return body;
 for(const closing of [voice.close,reflections[language][soul]+' '+voice.close]){
  const candidate=[parts[0],parts[1],closing].join('\n\n');
  if(diaryFormat(candidate,language).valid)return candidate;
 }
 return body;
}
