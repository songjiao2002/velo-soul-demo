import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID,randomBytes,webcrypto} from 'node:crypto';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {BikeReviewStore,normalizeReview,createReviewHandler} from './bike-reviews.mjs';
import {RiderReviewsUI} from './public/rider-reviews-ui.mjs';
import {RIDER_REVIEWS,riderReviewsMarkup} from './public/rider-reviews.mjs';
const review=(patch={})=>({id:randomUUID(),token:randomBytes(32).toString('hex'),bike:'lumi',nickname:'민서',rating:4,text:'작은 것들을 함께 보는 게 좋았어요.',consent:true,...patch});
const client=(options={})=>{
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 const document={addEventListener(){},removeEventListener(){},querySelectorAll(){return[];}};
 return new RiderReviewsUI({document,storage,crypto:webcrypto,fetchImpl:async()=>Response.json({available:true,reviews:[]}),...options});
};
test('reviews require an explicit post, real rating, bounded name/text and an owner token',()=>{
 for(const patch of [{consent:false},{nickname:''},{nickname:'a'.repeat(25)},{text:' '},{text:'a'.repeat(281)},{rating:0},{rating:6},{rating:2.5},{bike:'__proto__'},{token:'x'},{id:'-'.repeat(36)}])assert.throws(()=>normalizeReview(review(patch)),{code:'invalid_review'});
 for(const patch of [{nickname:'a@example.com'},{text:'https://example.com'},{text:'010-1234-5678'}])assert.throws(()=>normalizeReview(review(patch)),{code:'review_contact'});
 assert.equal(normalizeReview(review({nickname:'  小\n云  '})).nickname,'小 云');
});
test('reviews survive reopening, remain bike scoped and can only be edited or deleted by their owner',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'velo-review-')),file=path.join(dir,'reviews.sqlite');let db=new DatabaseSync(file),store=new BikeReviewStore(db);
 try{const body=review(),row=store.put(body);assert.equal(store.list('bori').length,0);assert.equal(store.list('lumi').length,1);assert.equal(JSON.stringify(row).includes(body.token),false);assert.equal('tokenHash' in row,false);db.close();db=new DatabaseSync(file);store=new BikeReviewStore(db);
  assert.equal(store.list('lumi')[0].nickname,'민서');assert.equal(store.put(body).id,body.id);assert.equal(store.list('lumi').length,1);
  for(const patch of [{token:'0'.repeat(64)},{bike:'mori'}]){assert.throws(()=>store.put({...body,...patch}),{code:'review_forbidden'});assert.throws(()=>store.remove({...body,...patch}),{code:'review_forbidden'});}
  const updated=store.put({...body,nickname:'하루',rating:2,text:'조금 조용히 달리고 싶었어요.'});assert.equal(updated.createdAt,row.createdAt);assert.equal(updated.rating,2);assert.equal(store.list('lumi').length,1);store.remove(body);store.remove(body);assert.deepEqual(store.list('lumi'),[]);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test('review retention and persistent write budgets stay bounded, including after deletion',()=>{
 let now=1700000000000;const db=new DatabaseSync(':memory:'),store=new BikeReviewStore(db,{now:()=>now});
 try{for(let n=0;n<55;n++){store.put(review());now+=61000;}assert.equal(store.list('lumi').length,50);now+=31*86400000;assert.equal(store.list('lumi').length,0);for(let n=0;n<20;n++){const body=review();store.put(body);store.remove(body);}assert.throws(()=>store.put(review()),{code:'rate_limited'});}finally{db.close();}
});
test('HTTP reviews are visible to another client; cross-origin writes and unbounded payloads are rejected',async()=>{
 const db=new DatabaseSync(':memory:');let handler=createReviewHandler(new BikeReviewStore(db));const server=http.createServer((req,res)=>void handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{const body=review(),write=(method,body,headers={})=>fetch(base+'/api/bike-reviews',{method,headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  assert.equal((await write('POST',body,{Origin:'https://other.example'})).status,403);assert.equal((await write('POST',body,{Origin:'https://localhost'})).status,200);
  const result=await fetch(base+'/api/bike-reviews?bike=lumi');assert.equal(result.headers.get('cache-control'),'no-store');const data=await result.json();assert.equal(data.reviews[0].nickname,body.nickname);assert.equal(JSON.stringify(data).includes(body.token),false);
  assert.equal((await write('POST',{...body,text:'x'.repeat(5000)})).status,413);assert.equal((await write('DELETE',{...body,token:'0'.repeat(64)})).status,403);assert.equal((await write('DELETE',body)).status,200);
  handler=createReviewHandler(null);assert.equal((await (await fetch(base+'/api/bike-reviews?bike=lumi')).json()).available,false);assert.equal((await write('POST',body)).status,503);
 }finally{await new Promise(r=>server.close(r));db.close();}
});
test('scanning creates a stable local nickname without posting; edits survive a new client',async()=>{
 let posts=0;const first=client({fetchImpl:async(_,o={})=>{if(o.method)posts++;return Response.json({available:true,reviews:[]});}});await first.select('lumi');const name=first.profile.nickname;assert.ok(name.length>3);assert.equal(posts,0);const second=client({storage:first.storage});await second.select('bori');assert.equal(second.profile.nickname,name);
 first.onInput({target:{name:'nickname',value:'Sunday walker',closest:()=>true}});const third=client({storage:first.storage});await third.select('mori');assert.equal(third.profile.nickname,'Sunday walker');for(const c of [first,second,third])c.dispose();
});
test('failed posts preserve text and owner identity; retry and later edits do not duplicate reviews',async()=>{
 const bodies=[];let reject=true;const c=client({fetchImpl:async(url,o={})=>{if(!o.method)return Response.json({available:true,reviews:[]});const body=JSON.parse(o.body);if(url.endsWith('/nickname'))return Response.json({nickname:body.nickname});bodies.push(body);if(reject)throw Error('offline');return Response.json({review:{...body,createdAt:Date.now()}});}});
 await c.select('lumi');Object.assign(c.draft(),{nickname:'하루',rating:3,text:'느긋한 시간이었어요.'});await c.submit();assert.equal(c.status,'failed');assert.equal(c.draft().text,'느긋한 시간이었어요.');reject=false;await c.submit();assert.equal(bodies[0].id,bodies[1].id);assert.equal(bodies[0].token,bodies[1].token);assert.equal(c.reviews.length,1);c.draft().rating=4;await c.submit();assert.equal(bodies[2].id,bodies[0].id);assert.equal(c.reviews.length,1);assert.equal(c.reviews[0].rating,4);c.dispose();
});
test('storage failure blocks posting before it loses the local edit/delete token',async()=>{
 let posts=0;const c=client({storage:{getItem(){return null;},setItem(){throw Error('storage full');}},fetchImpl:async(_,o={})=>{if(o.method)posts++;return Response.json({available:true,reviews:[]});}});await c.select('lumi');Object.assign(c.draft(),{text:'A nice ride',rating:4});await c.submit();assert.equal(posts,0);assert.equal(c.status,'localFail');c.dispose();
});
test('late review reads cannot overwrite a newly posted review or another bicycle',async()=>{
 let resolveGet;const c=client({fetchImpl:async(_,o={})=>{if(!o.method)return new Promise(r=>resolveGet=r);const body=JSON.parse(o.body);return Response.json({review:{...body,createdAt:Date.now()}});}});
 const loading=c.select('lumi');Object.assign(c.draft(),{text:'A nice ride',rating:4});await c.submit();resolveGet(Response.json({available:true,reviews:[]}));await loading;assert.equal(c.reviews.length,1);assert.equal(c.state,'ready');c.dispose();
});
test('deleting an owned review updates both the public list and the local management record',async()=>{
 const c=client({fetchImpl:async(_,o={})=>!o.method?Response.json({available:true,reviews:[]}):o.method==='DELETE'?Response.json({removed:true}):Response.json({review:{...JSON.parse(o.body),createdAt:Date.now()}})});await c.select('bori');Object.assign(c.draft(),{text:'Warm bread',rating:5});await c.submit();await c.remove();assert.deepEqual(c.reviews,[]);assert.equal(c.profile.owned.bori,undefined);assert.equal(c.draft().text,'');c.dispose();
});
test('review markup escapes visitor content; samples stay labelled with three natural nicknames',async()=>{
 const section={dataset:{riderReviews:'welcome'},contains(){return false;},innerHTML:''},document={addEventListener(){},removeEventListener(){},querySelectorAll(){return [section];}};
 const c=client({document});await c.select('lumi');c.reviews=[{...review({nickname:'<img src=x>',text:'<script>alert(1)</script>'}),createdAt:Date.now()}];c.render();assert.match(section.innerHTML,/&lt;script&gt;/);assert.doesNotMatch(section.innerHTML,/<script>|<img src=x>/);
 for(const bike of ['lumi','bori','mori']){assert.equal(RIDER_REVIEWS[bike].length,3);for(const lang of ['en','ko','zh']){const html=riderReviewsMarkup(bike,lang);assert.doesNotMatch(html,/Rider 0\d|라이더 0\d|骑行者 0\d/);assert.match(html,/Preset notes|미리 작성한 글|预设留言/);}}
 assert.doesNotMatch(readFileSync(new URL('./diary-service.mjs',import.meta.url),'utf8'),/bike-reviews|RIDER_REVIEWS/);c.dispose();
});


const reply=(parent,patch={})=>({...review(),authorToken:randomBytes(32).toString('hex'),parentId:parent.id,replyToId:null,...patch});
const storeFetch=store=>async(url,o={})=>{
 const u=new URL(url,'https://test.example'),body=o.body?JSON.parse(o.body):null;
 try{
  if(u.pathname.endsWith('/nickname'))return Response.json(store.rename(body));
  if(u.pathname.endsWith('/replies')){
   if(o.method==='POST')return Response.json({reply:store.putReply(body)});
   if(o.method==='DELETE'){store.remove(body,true);return Response.json({removed:true});}
   return Response.json({available:true,replies:store.replies(u.searchParams.get('bike'),u.searchParams.get('id'))});
  }
  if(o.method==='POST')return Response.json({review:store.put(body)});
  if(o.method==='DELETE'){store.remove(body);return Response.json({removed:true});}
  return Response.json({available:true,reviews:store.list(u.searchParams.get('bike'))});
 }catch(error){return Response.json({error:error.code||'failed'},{status:error.status||500});}
};
test('nickname migration updates all proven legacy reviews and replies, never a same-name stranger',()=>{
 const db=new DatabaseSync(':memory:'),store=new BikeReviewStore(db),token=randomBytes(32).toString('hex');
 try{
  const a=review(),b=review({bike:'bori'}),stranger=review();for(const r of [a,b,stranger])store.put(r);
  const self=reply(a,{authorToken:token});store.putReply(self);
  store.rename({authorToken:token,nickname:'산책하는 하루',proofs:[a,b]});
  assert.equal(store.list('bori')[0].nickname,'산책하는 하루');
  assert.equal(store.list('lumi').find(r=>r.id===a.id).nickname,'산책하는 하루');
  assert.equal(store.list('lumi').find(r=>r.id===stranger.id).nickname,'민서');
  assert.equal(store.replies('lumi',a.id)[0].nickname,'산책하는 하루');
  const writes=db.prepare('SELECT COUNT(*) AS n FROM review_writes').get().n;
  store.rename({authorToken:token,nickname:'산책하는 하루',proofs:[a,b]});
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM review_writes').get().n,writes);
  assert.doesNotMatch(JSON.stringify(store.list('lumi'))+JSON.stringify(store.replies('lumi',a.id)),/authorHash|tokenHash|authorToken/);
 }finally{db.close();}
});
test('one bad nickname proof rejects the whole change; expired proofs and empty identity do not create records',()=>{
 const db=new DatabaseSync(':memory:'),store=new BikeReviewStore(db),token=randomBytes(32).toString('hex'),a=review(),b=review({bike:'bori'});
 try{
  store.put(a);store.put(b);
  assert.throws(()=>store.rename({authorToken:token,nickname:'New name',proofs:[a,{...b,token:'0'.repeat(64)}]}),{code:'review_forbidden'});
  assert.equal(store.list('lumi')[0].nickname,'민서');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM review_authors').get().n,0);
  assert.throws(()=>store.rename({authorToken:token,nickname:'New name',proofs:[a,a]}),{code:'invalid_review'});
  store.rename({authorToken:token,nickname:'New name',proofs:[review()]});
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM review_authors').get().n,0);
 }finally{db.close();}
});
test('replies support self replies and replies to others with owner-only edits and same-thread targets',()=>{
 const db=new DatabaseSync(':memory:'),store=new BikeReviewStore(db),a=review({authorToken:randomBytes(32).toString('hex')}),b=review();
 try{
  store.put(a);store.put(b);
  const self=reply(a,{authorToken:a.authorToken}),other=reply(a,{replyToId:self.id,nickname:'Jae'});
  store.putReply(self);store.putReply(other);store.putReply(other);
  assert.equal(store.replies('lumi',a.id).length,2);assert.equal(store.list('lumi').find(r=>r.id===a.id).replyCount,2);
  assert.equal(store.replies('lumi',a.id).find(r=>r.id===other.id).replyToNickname,'민서');
  assert.throws(()=>store.putReply({...other,token:'0'.repeat(64),text:'Hijack'}),{code:'review_forbidden'});
  assert.throws(()=>store.remove({...other,token:'0'.repeat(64)},true),{code:'review_forbidden'});
  assert.throws(()=>store.putReply(reply(b,{replyToId:self.id})),{code:'review_missing'});
  assert.throws(()=>store.putReply({...other,parentId:b.id}),{code:'review_forbidden'});
  assert.throws(()=>store.putReply(reply(a,{consent:false})),{code:'invalid_review'});
  assert.throws(()=>store.putReply(reply(a,{text:'https://spam.example'})),{code:'review_contact'});
  store.putReply({...other,text:'Another thought'});
  assert.equal(store.replies('lumi',a.id).find(r=>r.id===other.id).text,'Another thought');
  store.rename({authorToken:a.authorToken,nickname:'Cloud',proofs:[a]});
  assert.equal(store.replies('lumi',a.id).find(r=>r.id===other.id).replyToNickname,'Cloud');
  store.remove(self,true);
  assert.equal(store.replies('lumi',a.id)[0].replyToId,null);
  store.remove(a);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM review_replies').get().n,0);
 }finally{db.close();}
});
test('reply caps, parent expiry and schema upgrade preserve the old database',()=>{
 let now=Date.now();const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE reviews (id TEXT PRIMARY KEY,bike TEXT NOT NULL,nickname TEXT NOT NULL,text TEXT NOT NULL,rating INTEGER NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL,tokenHash TEXT NOT NULL)');
 const store=new BikeReviewStore(db,{now:()=>now}),a=review();
 try{
  store.put(a);new BikeReviewStore(db);
  for(let i=0;i<50;i++){now+=61000;store.putReply(reply(a));}
  now+=61000;assert.throws(()=>store.putReply(reply(a)),{code:'thread_full'});
  assert.equal(store.replies('lumi',a.id).length,50);
  now+=31*86400000;assert.throws(()=>store.replies('lumi',a.id),{code:'review_missing'});
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM review_replies').get().n,0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM review_authors').get().n,0);
 }finally{db.close();}
});
test('reply and nickname HTTP endpoints enforce origin, method, payload and ownership',async()=>{
 const db=new DatabaseSync(':memory:'),store=new BikeReviewStore(db),handler=createReviewHandler(store);
 const server=http.createServer((req,res)=>void handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  const a=review();store.put(a);const r=reply(a);
  const send=(route,body,origin=base)=>fetch(base+'/api/bike-reviews/'+route,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});
  assert.equal((await send('replies',r,'https://bad.example')).status,403);
  assert.equal((await send('replies',r,'capacitor://localhost')).status,200);
  assert.equal((await send('nickname',{authorToken:r.authorToken,nickname:'Haru',proofs:[]})).status,200);
  assert.equal((await send('nickname',{authorToken:r.authorToken,nickname:'x'.repeat(5000)})).status,413);
  assert.equal((await fetch(base+'/api/bike-reviews/nickname')).status,405);
  const result=await (await fetch(base+'/api/bike-reviews/replies?bike=lumi&id='+a.id)).json();
  assert.equal(result.replies[0].nickname,'Haru');assert.equal(JSON.stringify(result).includes(r.token),false);
 }finally{await new Promise(r=>server.close(r));db.close();}
});
test('random nickname always changes, stays local until saved, and sync survives a reload across bikes',async()=>{
 const db=new DatabaseSync(':memory:'),store=new BikeReviewStore(db),fetchImpl=storeFetch(store),c=client({fetchImpl});
 try{
  await c.select('lumi');Object.assign(c.draft(),{nickname:'River Moon',text:'A nice ride',rating:5});await c.submit();
  await c.select('bori');Object.assign(c.draft(),{text:'Bread',rating:4});await c.submit();
  const old=c.profile.nickname;
  for(let i=0;i<300;i++)assert.notEqual(c.randomName(old),old);
  const stranger=review({nickname:old});store.put(stranger);
  c.onClick({target:{closest:()=>({dataset:{reviewAction:'random'}})}});
  const desired=c.profile.nickname;assert.notEqual(desired,old);assert.equal(store.list('bori')[0].nickname,old);
  await c.rename();assert.equal(c.status,'nameSaved');
  assert.equal(store.list('bori')[0].nickname,desired);assert.equal(store.list('lumi').find(r=>r.id===stranger.id).nickname,old);
  const reloaded=client({storage:c.storage,fetchImpl});await reloaded.select('lumi');assert.equal(reloaded.profile.nickname,desired);assert.equal(reloaded.draft().nickname,desired);reloaded.dispose();
 }finally{c.dispose();db.close();}
});
test('client can reply to a stranger and itself, edit, rename its previous replies, then delete',async()=>{
 const db=new DatabaseSync(':memory:'),store=new BikeReviewStore(db),root=review();store.put(root);const c=client({fetchImpl:storeFetch(store)});
 try{
  await c.select('lumi');c.startReply(root.id);c.replyDraft().text='안녕!';await c.submitReply();
  assert.equal(c.status,'replySaved');assert.equal(store.replies('lumi',root.id).length,1);
  const first=store.replies('lumi',root.id)[0];
  c.startReply(root.id,first.id);c.replyDraft().text='One more thing';await c.submitReply();
  assert.equal(store.replies('lumi',root.id).length,2);
  c.startReply(root.id,null,first.id);c.replyDraft().text='Hello again';await c.submitReply();
  assert.equal(store.replies('lumi',root.id).find(r=>r.id===first.id).text,'Hello again');
  c.setName('Quiet Clover');await c.rename();
  assert.ok(store.replies('lumi',root.id).every(r=>r.nickname==='Quiet Clover'));
  assert.equal(store.list('lumi')[0].nickname,'민서');
  assert.equal(store.replies('lumi',root.id).find(r=>r.replyToId===first.id).replyToNickname,'Quiet Clover');
  await c.removeReply(first.id);assert.equal(store.replies('lumi',root.id).length,1);assert.equal(c.profile.ownedReplies[first.id],undefined);
 }finally{c.dispose();db.close();}
});
test('failed nickname sync preserves draft and old public name; reply retries reuse identity after reload',async()=>{
 const db=new DatabaseSync(':memory:'),store=new BikeReviewStore(db),root=review();store.put(root);let offline=false,loseReply=false;
 const api=storeFetch(store),fetchImpl=async(url,o)=>{if(offline&&o?.method)throw Error('offline');const result=await api(url,o);if(loseReply&&o?.method==='POST'&&url.endsWith('/replies'))throw Error('lost response');return result;};
 const c=client({fetchImpl});let restored;
 try{
  await c.select('lumi');c.startReply(root.id);c.replyDraft().text='Still here';loseReply=true;await c.submitReply();assert.equal(c.status,'failed');
  const firstId=Object.keys(c.profile.ownedReplies)[0];assert.equal(store.replies('lumi',root.id).length,1);
  loseReply=false;restored=client({fetchImpl,storage:c.storage});await restored.select('lumi');restored.startReply(root.id);assert.equal(restored.replyDraft().record.id,firstId);assert.equal(restored.replyDraft().text,'Still here');await restored.submitReply();assert.equal(store.replies('lumi',root.id).length,1);
  const old=store.replies('lumi',root.id)[0].nickname;offline=true;restored.setName('New Cloud');await restored.rename();assert.equal(restored.status,'nameFailed');assert.equal(store.replies('lumi',root.id)[0].nickname,old);
  offline=false;await restored.rename();assert.equal(store.replies('lumi',root.id)[0].nickname,'New Cloud');
 }finally{c.dispose();restored?.dispose();db.close();}
});
test('reply markup escapes mentions; own reviews use the same Reply action and random controls never submit',async()=>{
 const section={dataset:{riderReviews:'welcome'},contains(){return false;},innerHTML:''},document={addEventListener(){},removeEventListener(){},querySelectorAll(){return [section];}};
 const db=new DatabaseSync(':memory:'),store=new BikeReviewStore(db),c=client({document,fetchImpl:storeFetch(store)});
 try{
  await c.select('lumi');Object.assign(c.draft(),{text:'Sunny ride',rating:4});await c.submit();
  const root=c.reviews[0];c.startReply(root.id);await c.loadReplies(root.id);
  assert.match(section.innerHTML,/data-review-action="reply"/);assert.doesNotMatch(section.innerHTML,/follow.up|追评|추가 후기/i);
  c.replyDraft().text='<img src=x>';await c.submitReply();
  c.threads.get(root.id).rows[0].replyToNickname='<script>bad</script>';c.render();
  assert.match(section.innerHTML,/@&lt;script&gt;/);assert.doesNotMatch(section.innerHTML,/<script>|<img src=x>/);
  c.open=true;c.replyForm=null;c.render();assert.match(section.innerHTML,/type="button" class="review-random"/);
 }finally{c.dispose();db.close();}
});

