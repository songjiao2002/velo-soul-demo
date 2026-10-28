import {DIARY_VOICES,diaryExchanges} from './diary-voices.mjs';

export const DIARY_COPY={
 en:{title:'Ride diary',saving:'Saving your diary…',saved:'Saved on this device. Your note saves automatically.',failed:'Could not save on this device. Retry or export your diary before leaving.',note:'A note to remember',placeholder:'What would you like to remember?',view:'Open ride diaries',share:'Export to Notes',copy:'Copy diary',copied:'Diary copied. Paste it into your notes app.',exported:'Choose your notes app in the share sheet.',downloaded:'Diary text downloaded.',error:'Could not export. Try copying the diary.',back:'Back to companions',intro:'Your ride is already becoming a memory.',local:'Your photos and conversation excerpts help your companion write this diary with Qwen. It stays on this device.',image:'Save card image',remove:'Delete diary',empty:'No photos from this ride.'},
 ko:{title:'라이딩 일기',saving:'일기를 저장하고 있어요…',saved:'이 기기에 저장했어요. 메모도 자동으로 저장돼요.',failed:'이 기기에 저장하지 못했어요. 다시 시도하거나 나가기 전에 일기를 내보내 주세요.',note:'기억하고 싶은 한마디',placeholder:'오늘 어떤 순간을 기억하고 싶나요?',view:'라이딩 일기 보기',share:'메모 앱으로 내보내기',copy:'일기 복사',copied:'일기를 복사했어요. 메모 앱에 붙여 넣으세요.',exported:'공유 화면에서 메모 앱을 선택해 주세요.',downloaded:'일기 텍스트를 다운로드했어요.',error:'내보내지 못했어요. 일기 복사를 이용해 주세요.',back:'친구들에게 돌아가기',intro:'오늘의 여정이 작은 기억으로 남아요.',local:'사진과 대화 일부를 Qwen에 보내 친구의 일기를 써요. 완성된 일기는 이 기기에 보관해요.',image:'카드 이미지 저장',remove:'일기 삭제',empty:'이번 여정에는 사진을 담지 않았어요.'},
 zh:{title:'骑行日记',saving:'正在自动保存日记…',saved:'已保存在这台设备，补写的文字也会自动保存。',failed:'未能保存到这台设备。请重试，或先导出日记再离开。',note:'想记住的一句话',placeholder:'今天有什么值得记住的瞬间？',view:'查看骑行日记',share:'导出到备忘录',copy:'复制日记',copied:'日记已复制，可粘贴到手机备忘录。',exported:'请在系统分享面板选择备忘录。',downloaded:'已下载日记文本。',error:'导出未完成，请尝试复制日记。',back:'返回伙伴首页',intro:'今天的骑行，已经成为一段回忆。',local:'角色会结合照片和对话摘录，通过千问写下日记。完成的日记保存在本机。',image:'保存卡片图片',remove:'删除日记',empty:'这次骑行没有抓拍照片。'}
};
const names={lumi:'Mori',bori:'Popo',mori:'Lulu'};
// Offline fallback remains personal and grounded when the diary service is unavailable.
export function rideDiary(record,language='en'){
 const lang=DIARY_COPY[language]?language:'en',r=record||{},name=Object.hasOwn(names,r.soul)?names[r.soul]:'Soul';
 const at=Number(r.createdAt),date=new Date(Number.isFinite(at)&&at>0?at:0).toLocaleString({en:'en-GB',ko:'ko-KR',zh:'zh-CN'}[lang]);
 const voice=DIARY_VOICES[lang][Object.hasOwn(names,r.soul)?r.soul:'mori'];
 const exchanges=diaryExchanges(r),paragraphs=[voice.open];
 if(r.photos?.length)paragraphs.push(voice.photos);
 if(exchanges.length){
  const pair=exchanges.at(-1);
  paragraphs.push(lang==='ko'?'네가 “'+pair.user+'”라고 말했지. '+voice.reflection:lang==='zh'?'你说：“'+pair.user+'” '+voice.reflection:'You said, “'+pair.user+'” '+voice.reflection);
 }else paragraphs.push(voice.quiet);
 paragraphs.push(voice.close);
 const generated=r.generatedDiary,ready=generated&&typeof generated.body==='string'&&generated.body.trim()&&typeof generated.title==='string';
 const title=ready?name+' · '+generated.title:name+' · '+DIARY_COPY[lang].title,body=ready?generated.body:paragraphs.join('\n\n'),note=typeof r.note==='string'?r.note.slice(0,2000):'';
 return {title,date,body,language:ready?generated.language:lang,text:[title,date,'',body,...(note?['',DIARY_COPY[lang].note,note]:[])].join('\n')};
}

// Serialize writes so an older, slower save cannot overwrite the latest note.
export class DiaryAutosave{
 constructor({store,onState=()=>{}}){this.store=store;this.onState=onState;this.queue=Promise.resolve();this.revision=0;this.savedRevision=0;}
 save(record){
  const snapshot={...record},revision=++this.revision;this.onState('saving',snapshot.id);
  this.queue=this.queue.then(async()=>{
   try{await this.store.run('readwrite',s=>s.put(snapshot));this.savedRevision=revision;if(revision===this.revision)this.onState('saved',snapshot.id);return true;}
   catch{if(revision===this.revision)this.onState('failed',snapshot.id);return false;}
  });return this.queue;
 }
 get saved(){return this.revision>0&&this.revision===this.savedRevision;}
}
