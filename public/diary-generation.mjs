import {appFetch} from './app-network.mjs';
export const DIARY_GENERATION_COPY={en:{writing:'Writing our little memory…',failed:'Our photos and a short diary are saved. The longer letter could not be written yet.',retry:'Try writing again'},ko:{writing:'우리의 작은 추억을 쓰고 있어요…',failed:'사진과 짧은 일기는 저장했어요. 긴 편지는 아직 완성하지 못했어요.',retry:'다시 써 보기'},zh:{writing:'正在写下我们的小小回忆…',failed:'照片和简短日记已保存，角色的长信暂时没有写好。',retry:'再写一次'}};
export function diaryPayload(record,language){
 const all=(record.photos||[]).filter(p=>typeof p==='string'&&p.length<=650000&&/^data:image\/jpeg;base64,/.test(p));
 const indexes=[0,Math.floor((all.length-1)/2),all.length-1];
 return {rideId:record.id,soul:record.soul,language,photos:[...new Set(indexes)].filter(i=>i>=0&&i<all.length).map(i=>all[i]),conversation:(record.conversation||[]).slice(-8).map(x=>({user:x.user.slice(0,320),reply:x.reply.slice(0,320)})),observations:(record.visionEvents||[]).filter(x=>typeof x.scene==='string'&&typeof x.reply==='string'&&x.reply.trim()).slice(-6).map(x=>({scene:x.scene.slice(0,50),impression:x.reply.slice(0,400)}))};
}
export async function generateRideDiary(record,language,{signal,fetchImpl=appFetch}={}){
 const response=await fetchImpl('/api/diary',{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify(diaryPayload(record,language))});
 if(!response.ok)throw Error('diary_failed');const result=await response.json();
 if(result.rideId!==record.id||result.soul!==record.soul||result.language!==language||typeof result.title!=='string'||!result.title.trim()||result.title.length>80||typeof result.body!=='string'||!result.body.trim()||result.body.length>2400)throw Error('invalid_diary');
 return {title:result.title,body:result.body,language,source:'qwen',createdAt:Date.now()};
}
