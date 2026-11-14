import {CHARACTERS,characterArtwork} from './character-art.mjs';
const companionProfileCopy = {
  en: {
    region:"Riding companions", likes:"Likes", story:"A little story",
    lumi:["New routes, colourful details, and leaf shadows","On an unfamiliar turn, Mori spots a leaf shadow racing beside the wheel. That small discovery is enough to make the whole ride an adventure."],
    mori:["Scenic routes, cool breezes, and naps","One afternoon, Lulu takes the long way home along the river. A quiet stop under a tree becomes the best part of the ride."],
    bori:["Fresh bread, tucked-away cafés, and snack breaks","Popo catches the smell of warm bread on a side street. The café at the end of the lane becomes a favourite stop on the next ride."],
  },
  ko: {
    region:"라이딩 친구", likes:"좋아하는 것", story:"작은 이야기",
    lumi:["새로운 길, 알록달록한 풍경, 나뭇잎 그림자","낯선 모퉁이를 돌던 모리는 바퀴 옆을 따라가는 나뭇잎 그림자를 발견했어요. 그 작은 발견 덕분에 평범한 라이딩이 모험이 되었어요."],
    mori:["풍경 좋은 길, 시원한 바람, 낮잠","어느 오후 루루는 강변을 따라 집으로 천천히 돌아갔어요. 나무 아래서 잠시 쉰 순간이 그날 라이딩에서 가장 좋았어요."],
    bori:["갓 구운 빵, 골목 카페, 간식 시간","골목에서 따뜻한 빵 냄새를 맡은 포포는 길 끝의 작은 카페를 발견했어요. 그곳은 다음 라이딩에서도 들르고 싶은 장소가 되었어요."],
  },
  zh: {
    region:"骑行伙伴", likes:"喜欢的事", story:"小故事",
    lumi:["探索新路线、发现鲜艳的颜色、追着树叶的影子","转过陌生的街角时，莫里发现树叶的影子正和车轮并排跑。这点小发现，就让平常的骑行变成了一场冒险。"],
    mori:["慢慢看风景、吹凉风、在树荫下打盹","有个下午，露露沿着河边绕远路回家。骑得不快，在树下停一会儿，成了那趟骑行最舒服的时刻。"],
    bori:["刚出炉的面包、巷子里的咖啡馆、骑行途中的加餐","波波在小巷里闻到热面包的香味，循着味道找到一家小店。后来每次骑到附近，都想再去看看今天烤了什么。"],
  },
};

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const mobileLabels={en:['Home','Scan QR','Diaries'],ko:['홈','QR 스캔','라이딩 일기'],zh:['首页','扫码','骑行日记']};
export function companionHome(language='en',selected='lumi'){
 const ids=['lumi','mori','bori'],copy=companionProfileCopy[language]||companionProfileCopy.en;
 const tabs=ids.map(id=>`<button type="button" lang="en" data-companion-profile="${id}" aria-controls="profile-${id}" aria-pressed="${id===selected}">${CHARACTERS[id].en}</button>`).join('');
 const cards=ids.map(id=>{const c=CHARACTERS[id],name=language==='ko'?c.name:language==='zh'?c.zh:c.en;return `<article id="profile-${id}" class="companion-profile" data-companion-card="${id}" ${id===selected?'':'hidden'}><div class="companion-profile-art">${characterArtwork(id,'riding')}</div><div class="companion-profile-copy"><h2>${esc(name)}</h2><p class="profile-personality">${esc(c.title[language]||c.title.en)}</p><h3>${copy.likes}</h3><p>${copy[id][0]}</p><h3>${copy.story}</h3><p>${copy[id][1]}</p></div></article>`;}).join('');
 return `<section class="companions-page" data-no-translate><div class="journal-modes profile-modes" role="group" aria-label="${copy.region}"><span class="journal-mode-track" aria-hidden="true"><span></span></span>${tabs}</div>${cards}</section>`;
}
export function mountMobileUI({document,getLanguage,build}){
 const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/mobile-v2.css?v='+build;document.head.append(sheet);
 document.documentElement.dataset.mobileUi='2';
 const toolbar=document.querySelector('.app-utilities');
 toolbar.querySelector('.app-home-link').hidden=true;
 const headings=document.createElement('div');headings.dataset.noTranslate='';
 headings.innerHTML=['companions','scan','diaries'].map((cls,i)=>'<h1 class="screen-title '+cls+'-heading">'+Object.entries(mobileLabels).map(([lang,labels])=>'<span lang="'+lang+'">'+labels[i]+'</span>').join('')+'</h1>').join('');toolbar.prepend(headings);
 const back=document.createElement('button');back.className='diary-back';back.dataset.nav='journal';back.textContent='‹';toolbar.prepend(back);
 const update=()=>{const c=mobileLabels[getLanguage()]||mobileLabels.en;back.setAttribute('aria-label',c[2]);};update();document.addEventListener('velo:screen',update);
}
export function mobileDiaryCard(record,diary,art){
 return `<article class="post diary-summary"><button class="diary-card-open" data-open-diary="${esc(record.id)}" aria-label="${esc(diary.title)}"><div class="diary-summary-cover">${record.photos?.length?'<img src="'+esc(record.photos[0])+'" alt="">':art}</div><div class="diary-summary-head"><h2>${esc(diary.title)}</h2><small>${esc(diary.date)}</small></div></button></article>`;
}

export function mountMobileSettings(document){
 const dialog=document.getElementById('appSettingsDialog'),states=[];
 for(const select of dialog.querySelectorAll('.preference-controls select')){
  const old=select.closest('label'),row=document.createElement('div');row.className=old.className;while(old.firstChild)row.append(old.firstChild);old.replaceWith(row);
  const title=row.querySelector('span');title.id=select.id+'Label';
  const group=document.createElement('div');group.className='language-options';group.dataset.noTranslate='';group.setAttribute('role','radiogroup');group.setAttribute('aria-labelledby',title.id);
  const radios=Array.from(select.options,(option,index)=>{const label=document.createElement('label'),input=document.createElement('input'),caption=document.createElement('span');input.type='radio';input.name=select.id+'Choice';input.value=option.value;caption.lang=option.lang;caption.textContent=option.textContent;label.append(input,caption);group.append(label);input.addEventListener('change',()=>group.style.setProperty('--choice-index',index));return {input,label,option};});
  const sync=()=>{radios.forEach(({input,label,option},index)=>{input.checked=option.value===select.value;input.disabled=option.hidden||option.disabled;label.hidden=input.disabled;if(input.checked)group.style.setProperty('--choice-index',index);});};
  select.hidden=true;group.style.setProperty('--choice-count',radios.length);select.after(group);sync();states.push({select,radios,sync});
 }
 const actions=document.createElement('div');actions.className='settings-actions';actions.dataset.noTranslate='';actions.innerHTML='<button type="button" data-action="settings-close"><span lang="en">Exit</span><span lang="ko">닫기</span><span lang="zh">退出</span></button><button type="button" data-save-settings><span lang="en">Save</span><span lang="ko">저장</span><span lang="zh">保存</span></button>';dialog.append(actions);
 document.addEventListener('click',event=>{if(event.target.closest('[data-action="settings"]'))states.forEach(s=>s.sync());},{capture:true});dialog.addEventListener('close',()=>states.forEach(s=>s.sync()));
 actions.querySelector('[data-save-settings]').addEventListener('click',()=>{const changes=states.map(s=>({select:s.select,value:s.radios.find(r=>r.input.checked&&!r.input.disabled)?.input.value||s.select.value}));dialog.close();for(const {select,value} of changes)if(select.value!==value){select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));}});
}

export function journalModes(language){const labels={en:['Ride records','Ride ratings'],ko:['라이딩 기록','라이딩 평가'],zh:['骑行记录','骑行评价']}[language]||['Ride records','Ride ratings'];return '<div class="journal-modes" data-no-translate role="group" aria-label="'+labels.join(' / ')+'">'+labels.map((label,i)=>'<button type="button" data-journal-mode="'+(i?'ratings':'records')+'" aria-pressed="'+(!i)+'">'+label+'</button>').join('')+'</div>';}
