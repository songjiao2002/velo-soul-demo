import {SOULS,routeDistance} from './soul-core.mjs';

export const DIARY_COPY={
 en:{title:'Ride diary',saving:'Saving your diary…',saved:'Saved on this device. Your note saves automatically.',failed:'Could not save on this device. Retry or export your diary before leaving.',note:'A note to remember',placeholder:'What would you like to remember?',view:'Open ride diaries',share:'Export to Notes',copy:'Copy diary',copied:'Diary copied. Paste it into your notes app.',exported:'Choose your notes app in the share sheet.',downloaded:'Diary text downloaded.',error:'Could not export. Try copying the diary.',back:'Back to companions',intro:'Your ride is already becoming a memory.',local:'Diaries stay in this app on this device. Export a copy to keep a backup.',image:'Save card image',remove:'Delete diary',empty:'No photos from this ride.'},
 ko:{title:'라이딩 일기',saving:'일기를 저장하고 있어요…',saved:'이 기기에 저장했어요. 메모도 자동으로 저장돼요.',failed:'이 기기에 저장하지 못했어요. 다시 시도하거나 나가기 전에 일기를 내보내 주세요.',note:'기억하고 싶은 한마디',placeholder:'오늘 어떤 순간을 기억하고 싶나요?',view:'라이딩 일기 보기',share:'메모 앱으로 내보내기',copy:'일기 복사',copied:'일기를 복사했어요. 메모 앱에 붙여 넣으세요.',exported:'공유 화면에서 메모 앱을 선택해 주세요.',downloaded:'일기 텍스트를 다운로드했어요.',error:'내보내지 못했어요. 일기 복사를 이용해 주세요.',back:'친구들에게 돌아가기',intro:'오늘의 여정이 작은 기억으로 남아요.',local:'일기는 이 기기의 앱에 보관해요. 오래 간직하려면 사본을 내보내 주세요.',image:'카드 이미지 저장',remove:'일기 삭제',empty:'이번 여정에는 사진을 담지 않았어요.'},
 zh:{title:'骑行日记',saving:'正在自动保存日记…',saved:'已保存在这台设备，补写的文字也会自动保存。',failed:'未能保存到这台设备。请重试，或先导出日记再离开。',note:'想记住的一句话',placeholder:'今天有什么值得记住的瞬间？',view:'查看骑行日记',share:'导出到备忘录',copy:'复制日记',copied:'日记已复制，可粘贴到手机备忘录。',exported:'请在系统分享面板选择备忘录。',downloaded:'已下载日记文本。',error:'导出未完成，请尝试复制日记。',back:'返回伙伴首页',intro:'今天的骑行，已经成为一段回忆。',local:'日记保存在本设备的 App 内，可导出备份。',image:'保存卡片图片',remove:'删除日记',empty:'这次骑行没有抓拍照片。'}
};
const names={lumi:'Mori',bori:'Popo',mori:'Lulu'};
// A factual, offline diary: no invented places, weather or camera observations.
export function rideDiary(record,language='en'){
 const lang=DIARY_COPY[language]?language:'en',r=record||{},name=names[r.soul]||'Soul';
 const seconds=Math.max(0,Math.floor(Number(r.seconds)||0)),minutes=Math.floor(seconds/60),remainder=seconds%60;
 const route=Array.isArray(r.route)?r.route.filter(p=>Number.isFinite(p?.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p?.lon)&&Math.abs(p.lon)<=180):[];
 const km=route.length>1?(routeDistance(route)/1000).toFixed(2):null,photos=Array.isArray(r.photos)?r.photos.length:0;
 const at=Number(r.createdAt),date=new Date(Number.isFinite(at)&&at>0?at:0).toLocaleString({en:'en-GB',ko:'ko-KR',zh:'zh-CN'}[lang]);
 const ending={
  en:{lumi:'A small journey, with room for curiosity.',bori:'A little ride to remember, with Popo by my side.',mori:'Time together, at our own pace.'},
  ko:{lumi:'작은 호기심을 나눌 수 있는 여정이었다.',bori:'포포와 함께한 작은 여정을 기억해 둔다.',mori:'우리의 속도로 함께한 시간을 남긴다.'},
  zh:{lumi:'和 Mori 一起，为小小的好奇心留一点空间。',bori:'记下这段有 Popo 陪伴的小旅程。',mori:'和 Lulu 按自己的节奏，留住相伴的时光。'}
 };
 const paragraphs=lang==='zh'?[`今天和 ${name} 一起骑行了 ${minutes} 分 ${remainder} 秒。`,km===null?'这次没有足够的 GPS 轨迹，未计算距离。':`记录的 GPS 距离约 ${km} 公里。`,photos?`留下了 ${photos} 张抓拍照片。`:'这次没有抓拍照片。']:lang==='ko'?[`오늘 ${SOULS[r.soul]?.name||name}와 ${minutes}분 ${remainder}초 동안 함께 달렸다.`,km===null?'GPS 경로가 충분하지 않아 거리는 계산하지 않았다.':`기록된 GPS 거리는 약 ${km}km였다.`,photos?`함께한 순간을 사진 ${photos}장으로 남겼다.`:'이번 여정에는 사진을 담지 않았다.']:[`I rode with ${name} for ${minutes} min ${remainder} sec.`,km===null?'There was not enough GPS data to calculate a distance.':`The recorded GPS distance was about ${km} km.`,photos?`I kept ${photos} photo${photos===1?'':'s'} from our ride.`:'No photos were taken on this ride.'];
 paragraphs.push(ending[lang][r.soul]||ending[lang].mori);
 const title=`${name} · ${DIARY_COPY[lang].title}`,body=paragraphs.join(' '),note=typeof r.note==='string'?r.note.slice(0,2000):'';
 return {title,date,body,text:[title,date,'',body,...(note?['',DIARY_COPY[lang].note,note]:[])].join('\n')};
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
