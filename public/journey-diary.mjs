import {routeDistance} from './soul-core.mjs';

export const DIARY_COPY={
 en:{title:'Ride diary',saving:'Saving your diary…',saved:'Saved on this device. Your note saves automatically.',failed:'Could not save on this device. Retry or export your diary before leaving.',note:'A note to remember',placeholder:'What would you like to remember?',view:'Open ride diaries',share:'Export to Notes',copy:'Copy diary',copied:'Diary copied. Paste it into your notes app.',exported:'Choose your notes app in the share sheet.',downloaded:'Diary text downloaded.',error:'Could not export. Try copying the diary.',back:'Back to companions',intro:'Your ride is already becoming a memory.',local:'Diaries stay in this app on this device. Export a copy to keep a backup.',image:'Save card image',remove:'Delete diary',empty:'No photos from this ride.'},
 ko:{title:'라이딩 일기',saving:'일기를 저장하고 있어요…',saved:'이 기기에 저장했어요. 메모도 자동으로 저장돼요.',failed:'이 기기에 저장하지 못했어요. 다시 시도하거나 나가기 전에 일기를 내보내 주세요.',note:'기억하고 싶은 한마디',placeholder:'오늘 어떤 순간을 기억하고 싶나요?',view:'라이딩 일기 보기',share:'메모 앱으로 내보내기',copy:'일기 복사',copied:'일기를 복사했어요. 메모 앱에 붙여 넣으세요.',exported:'공유 화면에서 메모 앱을 선택해 주세요.',downloaded:'일기 텍스트를 다운로드했어요.',error:'내보내지 못했어요. 일기 복사를 이용해 주세요.',back:'친구들에게 돌아가기',intro:'오늘의 여정이 작은 기억으로 남아요.',local:'일기는 이 기기의 앱에 보관해요. 오래 간직하려면 사본을 내보내 주세요.',image:'카드 이미지 저장',remove:'일기 삭제',empty:'이번 여정에는 사진을 담지 않았어요.'},
 zh:{title:'骑行日记',saving:'正在自动保存日记…',saved:'已保存在这台设备，补写的文字也会自动保存。',failed:'未能保存到这台设备。请重试，或先导出日记再离开。',note:'想记住的一句话',placeholder:'今天有什么值得记住的瞬间？',view:'查看骑行日记',share:'导出到备忘录',copy:'复制日记',copied:'日记已复制，可粘贴到手机备忘录。',exported:'请在系统分享面板选择备忘录。',downloaded:'已下载日记文本。',error:'导出未完成，请尝试复制日记。',back:'返回伙伴首页',intro:'今天的骑行，已经成为一段回忆。',local:'日记保存在本设备的 App 内，可导出备份。',image:'保存卡片图片',remove:'删除日记',empty:'这次骑行没有抓拍照片。'}
};
const names={lumi:'Mori',bori:'Popo',mori:'Lulu'};
// Character voices frame the recorded facts. Wishes and questions never claim
// an unrecorded meal, landmark, weather condition or camera observation.
const VOICES={
 en:{
  lumi:{open:'Mori here! Another page for our little field notebook.',photos:'I want to look through those snapshots again. What tiny detail might I have missed?',empty:'My questions will have to be our souvenirs this time.',close:'Where does the next turning lead? I’m saving that question for our next ride!'},
  bori:{open:'Popo here! I’m saving this ride in my notebook, with a little space left for my bread wish list.',photos:'Those snapshots go in my memory basket. I wonder what snack would suit our next ride?',empty:'No snapshots in my basket today, but I still want to keep this page.',close:'Next time, could we leave a little room for bread? Just a little. All right, maybe two bites!'},
  mori:{open:'It’s Lulu. Let’s put this memory down slowly; there’s no hurry.',photos:'We can look at those snapshots later, one at a time.',empty:'It’s all right to leave a page without a picture.',close:'I’d like to keep a little quiet space at the end. We can rest here, and start again when we feel ready.'}
 },
 ko:{
  lumi:{open:'나 모리! 우리 탐험 수첩에 새 페이지를 펼쳤어.',photos:'사진을 다시 들여다보고 싶어. 혹시 내가 놓친 작은 힌트가 있을까?',empty:'오늘은 사진 대신 물음표들을 기념으로 남겨 둘래.',close:'다음 모퉁이 너머엔 뭐가 있을까? 그 질문은 다음 라이딩까지 아껴 둘게!'},
  bori:{open:'포포의 일기 시간이야! 이 여정도 수첩에 넣어 둘래. 빵 목록을 쓸 자리는 조금 남겨 두고.',photos:'사진들은 내 추억 바구니에 쏙. 다음 라이딩에는 어떤 간식이 어울릴까?',empty:'오늘 바구니에 사진은 없지만, 이 페이지는 꼭 간직할래.',close:'다음엔 빵 한 입 먹을 여유도 있으면 좋겠다. 딱 한 입… 아니, 두 입만!'},
  mori:{open:'루루야. 서두르지 말고 오늘의 기억을 천천히 적어 볼게.',photos:'사진은 나중에 한 장씩 느긋하게 다시 봐도 좋겠어.',empty:'사진이 없는 페이지도 괜찮아. 빈자리는 그대로 두자.',close:'일기 끝에는 작은 여백을 남겨 두고 싶어. 잠깐 쉬었다가, 마음이 내킬 때 다시 함께 가자.'}
 },
 zh:{
  lumi:{open:'我是 Mori！我们的探险手账，又可以翻开新的一页啦。',photos:'真想把照片再翻一遍：里面会不会藏着我没注意到的小线索？',empty:'这次就把我的小问号当作纪念，先收进手账吧。',close:'下一个转弯通向哪里呢？这个问题，我要留到下次和你一起找答案！'},
  bori:{open:'Popo 的日记时间到！把这段骑行收进我的小本子，也给面包愿望清单留点位置。',photos:'这些照片就放进我的回忆篮子。下次骑行，配什么小点心才合适呢？',empty:'今天篮子里没有照片，不过，这一页我还是想好好收着。',close:'下次能不能给面包留一点时间？就一小口……好吧，也许两口！'},
  mori:{open:'我是 Lulu。别急，我们慢慢把这段记忆写下来。',photos:'照片可以以后再看，一张一张，慢慢来。',empty:'没有照片的一页也没关系，就让这里留一点空白吧。',close:'日记的末尾，我想留一小块安静的位置。先休息一下，等想出发了，再一起走。'}
 }
};
// A factual, offline diary: no invented places, weather or camera observations.
export function rideDiary(record,language='en'){
 const lang=DIARY_COPY[language]?language:'en',r=record||{},name=Object.hasOwn(names,r.soul)?names[r.soul]:'Soul';
 const seconds=Math.max(0,Math.floor(Number(r.seconds)||0)),minutes=Math.floor(seconds/60),remainder=seconds%60;
 const route=Array.isArray(r.route)?r.route.filter(p=>Number.isFinite(p?.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p?.lon)&&Math.abs(p.lon)<=180):[];
 const km=route.length>1?(routeDistance(route)/1000).toFixed(2):null,photos=Array.isArray(r.photos)?r.photos.length:0;
 const at=Number(r.createdAt),date=new Date(Number.isFinite(at)&&at>0?at:0).toLocaleString({en:'en-GB',ko:'ko-KR',zh:'zh-CN'}[lang]);
 const voice=Object.hasOwn(names,r.soul)?VOICES[lang][r.soul]:null;
 const paragraphs=lang==='zh'?[`今天我们一起骑行了 ${minutes} 分 ${remainder} 秒。`,km===null?'这次没有足够的 GPS 轨迹，未计算距离。':`记录的 GPS 距离约 ${km} 公里。`,photos?`留下了 ${photos} 张抓拍照片。`:'这次没有抓拍照片。']:lang==='ko'?[`오늘 우리는 ${minutes}분 ${remainder}초 동안 함께 달렸어.`,km===null?'GPS 경로가 충분하지 않아 거리는 계산하지 않았어.':`기록된 GPS 거리는 약 ${km}km야.`,photos?`함께한 순간을 사진 ${photos}장으로 남겼어.`:'이번 여정에는 사진을 담지 않았어.']:[`We rode together for ${minutes} min ${remainder} sec.`,km===null?'There was not enough GPS data to calculate a distance.':`The recorded GPS distance was about ${km} km.`,photos?`We kept ${photos} photo${photos===1?'':'s'} from our ride.`:'No photos were taken on this ride.'];
 if(voice){paragraphs.unshift(voice.open);paragraphs.push(photos?voice.photos:voice.empty,voice.close);}
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
