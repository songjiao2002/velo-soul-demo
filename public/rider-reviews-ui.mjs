import {appFetch} from './app-network.mjs';
import {BIKE_IDS} from './bike-memory-core.mjs';
import {riderReviewsMarkup} from './rider-reviews.mjs';
const KEY='velo-soul-review-profile-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const REVIEW_COPY={
 en:{title:'Rider reviews',empty:'Leave the first little trace.',loading:'Loading rider reviews…',unavailable:'Reviews could not load.',retry:'Try again',write:'Leave a review',edit:'Edit your review',name:'Your name',nameHint:'Saved on this device. You can change it.',rating:'Your rating',stars:n=>`${n} out of 5 stars`,text:'Your review',placeholder:'What was it like riding together?',notice:'Your name, rating and review will be public for up to 30 days. Avoid personal information.',post:'Post review',update:'Update review',cancel:'Cancel',remove:'Delete my review',saving:'Posting…',saved:'Your review is now shared.',deleted:'Your review was deleted.',failed:'Could not save. Your words are still here; try again.',required:'Add a name, a rating and a review.',contact:'Please leave out links, email addresses and phone numbers.',localFail:'Allow local storage to post and manage your review on this device.',rate:'Too many reviews just now. Please try again later.',you:'You',more:'More reviews'},
 ko:{title:'라이더 후기',empty:'첫 여운을 남겨주세요.',loading:'라이더 후기를 불러오는 중…',unavailable:'후기를 불러오지 못했어요.',retry:'다시 시도',write:'후기 남기기',edit:'내 후기 수정',name:'닉네임',nameHint:'이 기기에 저장돼요. 자유롭게 바꿀 수 있어요.',rating:'별점',stars:n=>`별점 5점 중 ${n}점`,text:'나의 후기',placeholder:'함께 달린 시간은 어땠나요?',notice:'닉네임, 별점과 후기는 최대 30일간 공개돼요. 개인정보는 적지 마세요.',post:'후기 게시',update:'후기 수정',cancel:'취소',remove:'내 후기 삭제',saving:'게시 중…',saved:'후기를 공유했어요.',deleted:'후기를 삭제했어요.',failed:'저장하지 못했어요. 작성한 내용은 그대로예요. 다시 시도해주세요.',required:'닉네임, 별점과 후기를 입력해주세요.',contact:'링크, 이메일과 전화번호는 빼주세요.',localFail:'후기 게시와 관리를 위해 이 기기의 저장소를 허용해주세요.',rate:'잠시 후 다시 시도해주세요.',you:'나',more:'후기 더 보기'},
 zh:{title:'游客评论',empty:'留下第一份感受吧。',loading:'正在读取游客评论…',unavailable:'评论暂时无法加载。',retry:'重试',write:'写一条评论',edit:'编辑我的评论',name:'你的昵称',nameHint:'保存在这台设备上，可以自行修改。',rating:'你的评分',stars:n=>`评分 ${n} / 5`,text:'你的评论',placeholder:'和它一起骑行，感觉怎么样？',notice:'昵称、星级和评论将公开显示，最多保留30天。请勿填写个人隐私。',post:'发表评论',update:'更新评论',cancel:'取消',remove:'删除我的评论',saving:'正在发布…',saved:'评论已发布。',deleted:'评论已删除。',failed:'暂时未能保存，内容已保留，请重试。',required:'请填写昵称、星级和评论。',contact:'请去掉链接、邮箱和电话号码。',localFail:'请允许本机存储，以便发布并管理自己的评论。',rate:'评论提交较频繁，请稍后再试。',you:'你',more:'更多评论'}
};

Object.assign(REVIEW_COPY.en,{random:'Random nickname',saveName:'Save name',nameHint:'Save to update your earlier comments and replies on this device.',nameSaved:'Your name is updated on all your comments and replies.',nameFailed:'Name not synced. Save your name to try again.',nameRequired:'Enter a nickname of up to 24 characters.',reply:'Reply',replyText:'Your reply',replyPlaceholder:'Add to the conversation…',postReply:'Post reply',editReply:'Edit',updateReply:'Save reply',removeReply:'Delete',replySaved:'Reply posted.',replyDeleted:'Reply deleted.',replyRequired:'Enter a nickname and a reply.',replyingTo:n=>'Replying to '+n,viewReplies:n=>'View replies ('+n+')',hideReplies:'Hide replies',noReplies:'No replies yet.',missing:'This comment is no longer available. Refresh the reviews.',full:'This conversation has reached its reply limit.',notice:'Your name and posts are public for up to 30 days. Replies disappear with the original review. Avoid personal information.'});
Object.assign(REVIEW_COPY.ko,{random:'랜덤 닉네임',saveName:'닉네임 저장',nameHint:'저장하면 이 기기에서 쓴 이전 후기와 답글에도 반영돼요.',nameSaved:'내 후기와 답글의 닉네임을 모두 바꿨어요.',nameFailed:'닉네임을 동기화하지 못했어요. 다시 저장해주세요.',nameRequired:'닉네임은 24자 이내로 입력해주세요.',reply:'답글',replyText:'나의 답글',replyPlaceholder:'이야기를 이어주세요…',postReply:'답글 게시',editReply:'수정',updateReply:'답글 저장',removeReply:'삭제',replySaved:'답글을 게시했어요.',replyDeleted:'답글을 삭제했어요.',replyRequired:'닉네임과 답글을 입력해주세요.',replyingTo:n=>n+' 님에게 답글',viewReplies:n=>'답글 '+n+'개 보기',hideReplies:'답글 숨기기',noReplies:'아직 답글이 없어요.',missing:'이 글은 더 이상 볼 수 없어요. 후기를 새로 불러와주세요.',full:'이 대화의 답글 수가 한도에 도달했어요.',notice:'닉네임과 글은 최대 30일간 공개돼요. 원래 후기가 삭제되면 답글도 사라져요. 개인정보는 적지 마세요.'});
Object.assign(REVIEW_COPY.zh,{random:'随机昵称',saveName:'保存昵称',nameHint:'保存后，本机以前发表的评论和回复会同步改名。',nameSaved:'自己所有评论和回复的昵称已同步修改。',nameFailed:'昵称还未同步，请点保存昵称重试。',nameRequired:'请输入24字以内的昵称。',reply:'回复',replyText:'你的回复',replyPlaceholder:'接着聊两句…',postReply:'发布回复',editReply:'编辑',updateReply:'保存回复',removeReply:'删除',replySaved:'回复已发布。',replyDeleted:'回复已删除。',replyRequired:'请填写昵称和回复内容。',replyingTo:n=>'回复 '+n,viewReplies:n=>'查看 '+n+' 条回复',hideReplies:'收起回复',noReplies:'还没有回复。',missing:'这条评论已不存在，请刷新评论。',full:'这条评论的回复数量已达上限。',notice:'昵称和内容将公开显示，最多保留30天。原评论删除时，其下回复也会移除。请勿填写个人隐私。'});
const names={en:[['Little','Sunny','Quiet','Wandering','River','Silver','Mellow','Evening','Morning','Maple','Gentle','Sleepy','April','Autumn','Happy','Golden'],['Willow','Cloud','Fern','Pebble','Robin','Clover','Moon','Breeze','Cedar','Otter','Sparrow','Acorn','Moss','Daisy','Leaf','Peach']],ko:[['작은','느린','노란','초록','고요한','산책하는','웃는','잠든','봄날의','가벼운','느긋한','반짝이는','동네','새벽','포근한','바람난'],['구름','달','바람','나무','클로버','고양이','참새','조약돌','수달','새싹','복숭아','민들레','단풍','햇살','솔방울','숲']],zh:[['散步的','慢悠悠的','微笑的','河边的','晒太阳的','听风的','贪睡的','旅行的','春天的','安静的','清晨的','轻快的','雨后的','午后的','转角的','傍晚的'],['云朵','小猫','月亮','叶子','小熊','橘子','麻雀','石头','水獭','桃子','松果','微风','小鹿','苔藓','雏菊','枫叶']]};
const validId=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(s);
const validToken=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const validEntry=(r,bike)=>r&&validId(r.id)&&r.bike===bike&&typeof r.nickname==='string'&&r.nickname.length<=48&&typeof r.text==='string'&&r.text.length<=560&&Number.isFinite(r.createdAt);
const validReview=(r,bike)=>validEntry(r,bike)&&Number.isInteger(r.rating)&&r.rating>=1&&r.rating<=5;
const validReply=(r,bike,parent)=>validEntry(r,bike)&&r.parentId===parent&&validId(parent)&&(r.replyToId==null||validId(r.replyToId));
const proof=({id,bike,token})=>({id,bike,token});
export class RiderReviewsUI{
 constructor({document=globalThis.document,storage,fetchImpl=appFetch,getLanguage=()=> 'en',crypto=globalThis.crypto}={}){
  Object.assign(this,{document,storage,fetchImpl,getLanguage,crypto});
  this.bike=null;this.epoch=0;this.reviews=[];this.state='loading';this.open=false;this.busy=false;this.status='';this.limit=5;
  this.drafts=new Map();this.threads=new Map();this.expanded=new Set();this.replyDrafts=new Map();this.replyForm=null;
  this.onInput=e=>{
   const form=e.target.closest?.('[data-review-form]');if(!form||this.busy)return;
   const draft=form.dataset?.reviewForm==='reply'?this.replyDraft():this.draft();if(!draft)return;
   if(e.target.name==='nickname')this.setName(e.target.value);
   if(e.target.name==='text')draft.text=e.target.value;
   if(e.target.name==='rating'){draft.rating=Number(e.target.value);for(const star of this.document.querySelectorAll('[data-review-star]'))star.textContent=Number(star.dataset.reviewStar)<=draft.rating?'★':'☆';}
  };
  this.onSubmit=e=>{if(e.target.matches?.('[data-review-form]')){e.preventDefault();void(e.target.dataset.reviewForm==='reply'?this.submitReply():this.submit());}};
  this.onClick=e=>{
   const b=e.target.closest?.('[data-review-action]');if(!b||this.busy)return;
   const {reviewAction:action,parent,replyId}=b.dataset;
   if(action==='retry')void this.load();
   if(action==='more'){this.limit+=5;this.render();}
   if(action==='open'){this.open=true;this.replyForm=null;this.status='';this.render();}
   if(action==='cancel'){this.open=false;this.replyForm=null;this.status='';this.render();}
   if(action==='random'){this.setName(this.randomName(this.profile.nickname));this.render();}
   if(action==='save-name')void this.rename();
   if(action==='edit-name'){this.nameEditor=!this.nameEditor;this.render();}
   if(action==='delete')void this.remove();
   if(action==='toggle-replies'){if(this.expanded.has(parent)){this.expanded.delete(parent);if(this.replyForm?.parentId===parent)this.replyForm=null;this.render();}else{this.expanded.add(parent);void this.loadReplies(parent);}}
   if(action==='retry-replies')void this.loadReplies(parent);
   if(action==='reply')this.startReply(parent,replyId);
   if(action==='edit-reply')this.startReply(parent,null,replyId);
   if(action==='delete-reply')void this.removeReply(replyId);
  };
  document.addEventListener('input',this.onInput);document.addEventListener('change',this.onInput);document.addEventListener('submit',this.onSubmit);document.addEventListener('click',this.onClick);
 }
 copy(){return REVIEW_COPY[this.getLanguage()]||REVIEW_COPY.en;}
 token(){return Array.from(this.crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');}
 randomName(current=''){
  const parts=names[this.getLanguage()]||names.en,bytes=this.crypto.getRandomValues(new Uint8Array(2)),join=this.getLanguage()==='zh'?'':' ';
  const first=parts[0][bytes[0]%parts[0].length];let index=bytes[1]%parts[1].length;
  if(first+join+parts[1][index]===current)index=(index+1)%parts[1].length;
  return first+join+parts[1][index];
 }
 ensureProfile(){
  if(this.profile)return;let raw;try{this.storage??=globalThis.localStorage;raw=JSON.parse(this.storage.getItem(KEY)||'null');}catch{}
  const nickname=typeof raw?.nickname==='string'&&raw.nickname.trim()&&raw.nickname.length<=48?raw.nickname:this.randomName();
  const owned={},ownedReplies={},fresh=r=>Date.now()-r.createdAt<30*86400000&&validToken(r.token);
  for(const bike of BIKE_IDS){const r=raw?.owned?.[bike];if(validReview(r,bike)&&fresh(r))owned[bike]=r;}
  for(const r of Object.values(raw?.ownedReplies||{}).slice(-500))if(BIKE_IDS.includes(r?.bike)&&validReply(r,r.bike,r.parentId)&&fresh(r))ownedReplies[r.id]=r;
  this.profile={nickname,owned,ownedReplies,authorToken:validToken(raw?.authorToken)?raw.authorToken:this.token(),confirmedName:raw?.confirmedName||'',remoteIdentity:raw?.remoteIdentity===true};
  try{this.persist();}catch{}
 }
 persist(){this.storage.setItem(KEY,JSON.stringify(this.profile));}
 setName(value){this.ensureProfile();this.profile.nickname=value;for(const d of this.drafts.values())d.nickname=value;try{this.persist();}catch{}}
 draft(){this.ensureProfile();if(!this.drafts.has(this.bike)){const own=this.profile.owned[this.bike];this.drafts.set(this.bike,{nickname:this.profile.nickname,text:own?.text||'',rating:own?.rating||0});}return this.drafts.get(this.bike);}
 markup(mode='welcome'){return '<section class="bike-memory rider-review-section '+mode+'" data-rider-reviews="'+mode+'" data-no-translate aria-label="'+esc(this.copy().title)+'"></section>';}
 select(bike){if(!BIKE_IDS.includes(bike))return;this.ensureProfile();this.bike=bike;this.open=false;this.replyForm=null;this.limit=5;this.status='';this.reviews=[];this.expanded.clear();return this.load();}
 async request(url,options={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);if(options.method)this.writeController=controller;
  try{const response=await this.fetchImpl(url,{...options,signal:options.signal||controller.signal});const data=await response.json();if(!response.ok)throw Error(data.error);return data;}finally{clearTimeout(timer);}
 }
 write(url,body,method='POST'){return this.request(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
 async load(){
  const bike=this.bike,serial=++this.epoch;this.controller?.abort();const controller=new AbortController();this.controller=controller;
  const timer=setTimeout(()=>controller.abort(),8000);this.state='loading';this.render();
  try{const data=await this.request('/api/bike-reviews?bike='+bike,{signal:controller.signal});if(serial!==this.epoch)return;if(data.available!==true||!Array.isArray(data.reviews))throw Error();this.reviews=data.reviews.filter(r=>validReview(r,bike)).slice(0,50);this.state='ready';}
  catch{if(serial===this.epoch)this.state='unavailable';}finally{clearTimeout(timer);if(serial===this.epoch)this.render();}
 }
 async loadReplies(parentId){
  const bike=this.bike;if(!this.reviews.some(r=>r.id===parentId))return;
  const thread=this.threads.get(parentId)||{rows:[],version:0};this.threads.set(parentId,thread);
  thread.controller?.abort();const serial=++thread.version,controller=new AbortController();thread.controller=controller;thread.state='loading';this.render();
  const timer=setTimeout(()=>controller.abort(),8000);
  try{const data=await this.request('/api/bike-reviews/replies?bike='+bike+'&id='+parentId,{signal:controller.signal});if(thread.version!==serial)return;if(data.available!==true||!Array.isArray(data.replies))throw Error();thread.rows=data.replies.filter(r=>validReply(r,bike,parentId)).slice(0,50);thread.state='ready';for(const r of thread.rows)if(this.profile.ownedReplies[r.id])Object.assign(this.profile.ownedReplies[r.id],r,{pending:false});try{this.persist();}catch{}const root=this.reviews.find(r=>r.id===parentId);if(root)root.replyCount=thread.rows.length;}
  catch{if(thread.version===serial)thread.state='unavailable';}finally{clearTimeout(timer);if(this.bike===bike&&thread.version===serial)this.render();}
 }
 begin(){
  this.busy=true;this.status='';this.controller?.abort();++this.epoch;if(this.state==='loading')this.state='unavailable';
  for(const t of this.threads.values()){t.controller?.abort();++t.version;if(t.state==='loading')t.state='unavailable';}
  this.render();return this.epoch;
 }
 async syncName(){
  const nickname=this.profile.nickname.trim();
  if(!nickname||[...nickname].length>24)throw Error('invalid_name');
  try{this.persist();}catch{throw Error('local_storage');}
  const records=Object.values(this.profile.owned),remote=this.profile.remoteIdentity||records.length||Object.keys(this.profile.ownedReplies).length;
  let saved=nickname;
  if(remote){const result=await this.write('/api/bike-reviews/nickname',{authorToken:this.profile.authorToken,nickname,proofs:records.map(proof)});if(typeof result.nickname!=='string'||!result.nickname.trim()||[...result.nickname].length>24)throw Error('invalid_response');saved=result.nickname;}
  this.profile.nickname=saved;this.profile.confirmedName=saved;
  for(const d of this.drafts.values())d.nickname=saved;
  for(const r of [...records,...Object.values(this.profile.ownedReplies)])r.nickname=saved;
  const ownedIds=new Set(records.map(r=>r.id)),replyIds=new Set(Object.keys(this.profile.ownedReplies));
  for(const r of this.reviews)if(ownedIds.has(r.id))r.nickname=saved;
  for(const t of this.threads.values())for(const r of t.rows){if(replyIds.has(r.id))r.nickname=saved;if(replyIds.has(r.replyToId))r.replyToNickname=saved;}
  try{this.persist();}catch{throw Error('local_storage');}
  return saved;
 }
 async rename(){if(this.busy)return;this.ensureProfile();this.begin();try{await this.syncName();this.status='nameSaved';}catch(error){this.status=error.message==='invalid_name'?'nameRequired':error.message==='local_storage'?'localFail':error.message==='review_contact'?'contact':error.message==='rate_limited'?'rate':'nameFailed';}finally{this.busy=false;this.render();}}
 nameMarkup(){
  const c=this.copy(),disabled=this.busy?'disabled':'';
  return '<div class="review-name-control"><label>'+c.name+'<input name="nickname" autocomplete="nickname" maxlength="24" required value="'+esc(this.profile.nickname)+'" '+disabled+'></label><button type="button" class="review-random" data-review-action="random" aria-label="'+c.random+'" title="'+c.random+'" '+disabled+'><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 7h3c5 0 7 10 12 10h3M3 17h3c2 0 3-2 4-4m4-2c1-2 2-4 4-4h3m-4-4 4 4-4 4m0 2 4 4-4 4"/></svg></button></div><div class="review-name-hint"><small>'+c.nameHint+'</small><button type="button" class="text-button" data-review-action="save-name" '+disabled+'>'+c.saveName+'</button></div>';
 }
 formMarkup(reply=false){
  const c=this.copy(),d=reply?this.replyDraft():this.draft(),disabled=this.busy?'disabled':'',own=this.profile.owned[this.bike];if(!d)return '';
  const label=reply?c.replyText:c.text,placeholder=reply?c.replyPlaceholder:c.placeholder;
  const rating=reply?'':'<fieldset '+disabled+'><legend>'+c.rating+'</legend><div class="review-rating">'+[1,2,3,4,5].map(n=>'<label><input type="radio" name="rating" value="'+n+'" aria-label="'+c.stars(n)+'" '+(d.rating===n?'checked':'')+' required><span data-review-star="'+n+'" aria-hidden="true">'+(n<=d.rating?'★':'☆')+'</span></label>').join('')+'</div></fieldset>';
  const action=reply?(this.replyForm.editId?c.updateReply:c.postReply):(own&&!own.pending?c.update:c.post);
  if(reply)return '<form data-review-form="reply" class="review-form reply-form"><div class="reply-composer-heading"><span>'+esc(c.replyingTo(this.replyForm.targetName))+'</span>'+this.action('cancel',c.cancel)+'</div><label class="sr-only" for="reply-text">'+c.replyText+'</label><div class="reply-composer-row"><textarea id="reply-text" name="text" maxlength="280" rows="2" required placeholder="'+esc(c.replyPlaceholder)+'" '+disabled+'>'+esc(d.text)+'</textarea><button class="reply-send" type="submit" aria-label="'+action+'" title="'+action+'" '+disabled+'><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m4 12 16-8-6 16-3-6-7-2Z M11 14l9-10"/></svg></button></div><div class="reply-identity"><span>'+esc(this.profile.nickname)+'</span>'+this.action('edit-name',c.editReply)+'</div>'+(this.nameEditor?this.nameMarkup():'')+'<small class="review-disclosure">'+c.notice+'</small></form>';
  return '<form data-review-form="'+(reply?'reply':'review')+'" class="review-form'+(reply?' reply-form':'')+'">'+(reply?'<p class="reply-target">'+esc(c.replyingTo(this.replyForm.targetName))+'</p>':'')+this.nameMarkup()+rating+'<label>'+label+'<textarea name="text" maxlength="280" rows="'+(reply?'2':'3')+'" required placeholder="'+esc(placeholder)+'" '+disabled+'>'+esc(d.text)+'</textarea></label><small class="review-disclosure">'+c.notice+'</small><div class="review-form-actions"><button class="primary" type="submit" '+disabled+'>'+(this.busy?c.saving:action)+'</button><button class="text-button" type="button" data-review-action="cancel" '+disabled+'>'+c.cancel+'</button></div></form>';
 }
 action(action,label,parent='',replyId='',extra=''){return '<button type="button" class="text-button" data-review-action="'+action+'"'+(parent?' data-parent="'+esc(parent)+'"':'')+(replyId?' data-reply-id="'+esc(replyId)+'"':'')+' '+extra+' '+(this.busy?'disabled':'')+'>'+label+'</button>';}
 threadMarkup(root){
  const c=this.copy(),open=this.expanded.has(root.id),count=root.replyCount||0;
  let html='<div class="review-conversation-actions">'+this.action('reply',c.reply,root.id)+(count||open?this.action('toggle-replies',open?c.hideReplies:c.viewReplies(count),root.id,'','aria-expanded="'+open+'"'):'')+'</div>';
  if(!open)return html;
  const thread=this.threads.get(root.id);
  html+='<div class="review-thread">';
  if(!thread||thread.state==='loading')html+='<p class="review-empty" role="status">'+c.loading+'</p>';
  else if(thread.state==='unavailable')html+='<p class="review-empty">'+c.unavailable+'</p>'+this.action('retry-replies',c.retry,root.id);
  else html+='<ul class="review-replies">'+thread.rows.map(r=>'<li><div class="reply-byline"><span class="review-avatar" aria-hidden="true">'+esc([...r.nickname][0]||'·')+'</span><span class="review-author">'+esc(r.nickname)+(this.profile.ownedReplies[r.id]?' <small>· '+c.you+'</small>':'')+'</span></div><p>'+(r.replyToNickname?'<span class="reply-mention">@'+esc(r.replyToNickname)+'</span> ':'')+esc(r.text)+'</p><div class="review-conversation-actions">'+this.action('reply',c.reply,root.id,r.id)+(this.profile.ownedReplies[r.id]?this.action('edit-reply',c.editReply,root.id,r.id)+this.action('delete-reply',c.removeReply,root.id,r.id):'')+'</div></li>').join('')+'</ul>';
  if(this.replyForm?.parentId===root.id)html+=this.formMarkup(true);
  return html+'</div>';
 }
 render(){
  if(!this.bike)return;const c=this.copy(),own=this.profile.owned[this.bike];this.draft();
  for(const el of this.document.querySelectorAll('[data-rider-reviews]')){
   const focused=el.contains(this.document.activeElement)?this.document.activeElement:null,focusName=focused?.name,selection=focused?.type!=='radio'?[focused?.selectionStart,focused?.selectionEnd]:null;
   let list='';
   if(el.dataset.riderReviews==='welcome'){
    if(this.state==='ready')list=this.reviews.length?'<ul class="rider-reviews real-reviews">'+this.reviews.slice(0,this.limit).map(r=>'<li class="review-root"><span class="review-avatar" aria-hidden="true">'+esc([...r.nickname][0]||'·')+'</span><div class="review-root-content"><div class="rider-review-meta"><span class="review-author">'+esc(r.nickname)+(r.id===own?.id?' <small>· '+c.you+'</small>':'')+'</span><span class="rider-review-stars" role="img" aria-label="'+c.stars(r.rating)+'"><span aria-hidden="true">'+'★'.repeat(r.rating)+'<span class="empty-stars">'+'☆'.repeat(5-r.rating)+'</span></span></span></div><p>'+esc(r.text)+'</p>'+this.threadMarkup(r)+'</div></li>').join('')+'</ul>'+(this.reviews.length>this.limit?this.action('more',c.more):''):'<p class="review-empty">'+c.empty+'</p>';
    else list='<p class="review-empty" role="status">'+(this.state==='loading'?c.loading:c.unavailable)+'</p>'+(this.state==='unavailable'?this.action('retry',c.retry):'');
   }
   const form=this.open?this.formMarkup():this.action('open',own&&!own.pending?c.edit:c.write);
   el.setAttribute?.('aria-label',c.title);
   el.innerHTML='<div class="rider-reviews-heading"><span class="eyebrow">'+c.title+'</span></div>'+list+form+(own?this.action('delete',c.remove):'')+'<p class="small review-status" role="status">'+esc(c[this.status]||'')+'</p>'+(el.dataset.riderReviews==='welcome'?'<div class="sample-reviews">'+riderReviewsMarkup(this.bike,this.getLanguage())+'</div>':'');
   if(focusName){const input=el.querySelector('[name="'+focusName+'"]'+(focused.type==='radio'?'[value="'+focused.value+'"]':''));input?.focus({preventScroll:true});if(selection&&selection[0]!=null)input?.setSelectionRange(...selection);}
  }
 }
 error(error){return ({rate_limited:'rate',review_contact:'contact',invalid_review:'required',invalid_name:'nameRequired',local_storage:'localFail',review_missing:'missing',thread_full:'full'})[error.message]||'failed';}
 async submit(){
  if(this.busy)return;const bike=this.bike,draft=this.draft(),nickname=draft.nickname.trim(),text=draft.text.trim();
  if(!nickname||!text||[...nickname].length>24||[...text].length>280||![1,2,3,4,5].includes(draft.rating)){this.status='required';this.render();return;}
  this.setName(nickname);const serial=this.begin();
  try{
   await this.syncName();
   const previous=this.profile.owned[bike],record={...previous,id:previous?.id||this.crypto.randomUUID(),token:previous?.token||this.token(),bike,nickname:this.profile.nickname,text,rating:draft.rating,createdAt:previous?.createdAt||Date.now(),pending:true};
   this.profile.owned[bike]=record;
   try{this.persist();}catch{if(previous)this.profile.owned[bike]=previous;else delete this.profile.owned[bike];throw Error('local_storage');}
   const data=await this.write('/api/bike-reviews',{...record,authorToken:this.profile.authorToken,consent:true});
   if(!validReview(data.review,bike)||data.review.id!==record.id)throw Error('invalid_response');
   Object.assign(record,data.review,{pending:false});this.profile.remoteIdentity=true;try{this.persist();}catch{}
   if(this.bike===bike&&serial===this.epoch){this.reviews=[data.review,...this.reviews.filter(r=>r.id!==record.id)].slice(0,50);this.state='ready';this.status='saved';this.open=false;}
  }catch(error){if(this.bike===bike&&serial===this.epoch)this.status=this.error(error);}finally{this.busy=false;this.render();}
 }
 startReply(parentId,replyToId=null,editId=null){
  const root=this.reviews.find(r=>r.id===parentId),edit=editId?this.profile.ownedReplies[editId]:null;
  const target=replyToId?this.threads.get(parentId)?.rows.find(r=>r.id===replyToId):root;
  if(!root||(editId&&!edit)||(!editId&&!target))return;
  const key=editId||parentId+':'+(replyToId||'root');
  if(!this.replyDrafts.has(key)){const pending=edit||Object.values(this.profile.ownedReplies).find(r=>r.pending&&r.parentId===parentId&&(r.replyToId||null)===(replyToId||null));this.replyDrafts.set(key,{text:pending?.text||'',record:pending||null});}
  this.replyForm={key,parentId,replyToId:edit?edit.replyToId:replyToId,editId,targetName:edit?root.nickname:target.nickname};
  this.open=false;this.nameEditor=false;this.status='';this.expanded.add(parentId);
  if(!this.threads.has(parentId)||this.threads.get(parentId).state!=='ready')void this.loadReplies(parentId);else this.render();
 }
 replyDraft(){return this.replyForm?this.replyDrafts.get(this.replyForm.key):null;}
 async submitReply(){
  if(this.busy||!this.replyForm)return;const bike=this.bike,form={...this.replyForm},draft=this.replyDraft(),text=draft.text.trim();
  if(!text||[...text].length>280){this.status='replyRequired';this.render();return;}
  const serial=this.begin();
  try{
   await this.syncName();
   const old=draft.record,record={...old,id:old?.id||this.crypto.randomUUID(),token:old?.token||this.token(),bike,parentId:form.parentId,replyToId:form.replyToId||null,nickname:this.profile.nickname,text,createdAt:old?.createdAt||Date.now(),pending:true};
   draft.record=record;this.profile.ownedReplies[record.id]=record;
   try{this.persist();}catch{if(old)this.profile.ownedReplies[record.id]=old;else delete this.profile.ownedReplies[record.id];draft.record=old;throw Error('local_storage');}
   const data=await this.write('/api/bike-reviews/replies',{...record,authorToken:this.profile.authorToken,consent:true});
   if(!validReply(data.reply,bike,form.parentId)||data.reply.id!==record.id)throw Error('invalid_response');
   Object.assign(record,data.reply,{pending:false});this.profile.remoteIdentity=true;try{this.persist();}catch{}
   const thread=this.threads.get(form.parentId)||{rows:[],version:0,state:'unavailable'};
   const known=thread.rows.some(r=>r.id===record.id);thread.rows=[...thread.rows.filter(r=>r.id!==record.id),data.reply].sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id));this.threads.set(form.parentId,thread);
   if(this.bike===bike&&serial===this.epoch){
    const root=this.reviews.find(r=>r.id===form.parentId);if(root&&!known&&!old?.pending&&!form.editId)root.replyCount=(root.replyCount||0)+1;
    this.status='replySaved';this.replyForm=null;this.replyDrafts.delete(form.key);
   }
  }catch(error){if(this.bike===bike&&serial===this.epoch)this.status=this.error(error);}finally{this.busy=false;this.render();}
  if(this.bike===bike&&this.status==='replySaved')await this.loadReplies(form.parentId);
 }
 async removeReply(id){
  if(this.busy)return;const record=this.profile.ownedReplies[id];if(!record)return;const bike=this.bike,serial=this.begin();
  try{
   await this.write('/api/bike-reviews/replies',proof(record),'DELETE');delete this.profile.ownedReplies[id];
   for(const r of Object.values(this.profile.ownedReplies))if(r.replyToId===id)r.replyToId=null;
   try{this.persist();}catch{}
   const thread=this.threads.get(record.parentId);if(thread){thread.rows=thread.rows.filter(r=>r.id!==id);for(const r of thread.rows)if(r.replyToId===id){r.replyToId=null;r.replyToNickname=null;}}
   if(this.bike===bike&&serial===this.epoch){const root=this.reviews.find(r=>r.id===record.parentId);if(root)root.replyCount=Math.max(0,(root.replyCount||0)-1);this.replyForm=null;this.replyDrafts.clear();this.status='replyDeleted';}
  }catch(error){if(this.bike===bike&&serial===this.epoch)this.status=this.error(error);}finally{this.busy=false;this.render();}
 }
 async remove(){
  if(this.busy)return;const bike=this.bike,record=this.profile.owned[bike];if(!record)return;const serial=this.begin();
  try{
   await this.write('/api/bike-reviews',proof(record),'DELETE');delete this.profile.owned[bike];
   for(const r of Object.values(this.profile.ownedReplies))if(r.parentId===record.id)delete this.profile.ownedReplies[r.id];
   try{this.persist();}catch{}this.drafts.delete(bike);this.threads.delete(record.id);this.expanded.delete(record.id);
   if(this.bike===bike&&serial===this.epoch){this.reviews=this.reviews.filter(r=>r.id!==record.id);this.open=false;this.replyForm=null;this.status='deleted';}
  }catch(error){if(this.bike===bike&&serial===this.epoch)this.status=this.error(error);}finally{this.busy=false;this.render();}
 }
 dispose(){this.controller?.abort();this.writeController?.abort();for(const t of this.threads.values())t.controller?.abort();this.document.removeEventListener('input',this.onInput);this.document.removeEventListener('change',this.onInput);this.document.removeEventListener('submit',this.onSubmit);this.document.removeEventListener('click',this.onClick);}
}


