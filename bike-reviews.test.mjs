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
 const bodies=[];let reject=true;const c=client({fetchImpl:async(_,o={})=>{if(!o.method)return Response.json({available:true,reviews:[]});const body=JSON.parse(o.body);bodies.push(body);if(reject)throw Error('offline');return Response.json({review:{...body,createdAt:Date.now()}});}});
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
