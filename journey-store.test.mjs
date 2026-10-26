import {test} from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory,IDBKeyRange} from 'fake-indexeddb';
import {JourneyStore,JourneyPager} from './public/journey-store.mjs';
import {rideDiary,DiaryAutosave} from './public/journey-diary.mjs';

test('offline diaries describe actual ride facts in all three languages without inventing places',()=>{
 const r={id:'diary',createdAt:1700000000000,soul:'bori',seconds:125,route:[{lat:37.5,lon:127},{lat:37.51,lon:127}],photos:['photo1','photo2'],note:'A peaceful afternoon <script>'};
 for(const lang of ['en','ko','zh']){const d=rideDiary(r,lang);assert.match(d.title,/Popo/);assert.match(d.body,/2/);assert.match(d.body,/1\.11/);assert.ok(d.text.includes(r.note));assert.doesNotMatch(d.text,/cafe|rain|카페|비가|咖啡|下雨/i);}
 assert.match(rideDiary({...r,route:[],photos:[]},'en').body,/not enough GPS.*No photos/);
});

test('automatic diary writes survive reopen and serialize note changes into one record',async()=>{
 const {store}=setup(),states=[];const autosave=new DiaryAutosave({store,onState:s=>states.push(s)});
 const r={...record('diary'),seconds:80};const first=autosave.save(r);r.note='First thought';const second=autosave.save(r);r.note='Final thought';const third=autosave.save(r);
 assert.deepEqual(await Promise.all([first,second,third]),[true,true,true]);assert.equal(autosave.saved,true);assert.equal(states.at(-1),'saved');
 const page=await store.page();assert.equal(page.total,1);assert.equal(page.records[0].note,'Final thought');assert.deepEqual(page.records[0].photos,r.photos);
});

test('failed automatic storage stays unsaved and retries without duplicating the diary',async()=>{
 const {store}=setup();let fail=true;const states=[];const autosave=new DiaryAutosave({store:{run(...args){if(fail)throw Error('Quota exceeded');return store.run(...args);}},onState:s=>states.push(s)});
 assert.equal(await autosave.save(record('retry')),false);assert.equal(autosave.saved,false);assert.equal(states.at(-1),'failed');fail=false;
 assert.equal(await autosave.save({...record('retry'),note:'Recovered'}),true);assert.equal(autosave.saved,true);assert.equal((await store.page()).total,1);
});

const setup=()=>{const indexedDB=new IDBFactory();return {indexedDB,store:new JourneyStore({indexedDB,KeyRange:IDBKeyRange})};};
const record=(id,time=100)=>({id,createdAt:time,soul:'lumi',photos:['data:image/jpeg;base64,cGhvdG8='],route:[],note:'kept'});
function legacy(indexedDB,values){return new Promise((resolve,reject)=>{const request=indexedDB.open('velo-soul-final',1);request.onupgradeneeded=()=>{const store=request.result.createObjectStore('journeys',{keyPath:'id'});for(const value of values)store.put(value);};request.onsuccess=()=>{request.result.close();resolve();};request.onerror=()=>reject(request.error);});}

test('v1 upgrade preserves photos and provides stable descending pages with equal timestamps',async()=>{
 const {indexedDB,store}=setup(),values=['a','b','c','d','e','f','g','h','i'].map(id=>record(id));await legacy(indexedDB,values);
 const first=await store.page(),second=await store.page({before:first.after}),third=await store.page({before:second.after});
 assert.deepEqual([...first.records,...second.records,...third.records].map(r=>r.id),['i','h','g','f','e','d','c','b','a']);
 assert.equal(first.total,9);assert.equal(first.hasMore,true);assert.equal(third.hasMore,false);
 for(const r of [...first.records,...second.records,...third.records])assert.deepEqual(r,values.find(v=>v.id===r.id));
});

test('deleting a page boundary or adding a newer journey does not skip or repeat older records',async()=>{
 const {store}=setup();for(let i=1;i<=9;i++)await store.run('readwrite',s=>s.put(record(String(i),i)));
 const first=await store.page();await store.run('readwrite',s=>s.delete(first.records.at(-1).id));await store.run('readwrite',s=>s.put(record('new',100)));
 const second=await store.page({before:first.after}),third=await store.page({before:second.after});
 assert.deepEqual(second.records.map(r=>r.id),['5','4','3','2']);assert.deepEqual(third.records.map(r=>r.id),['1']);
 assert.equal((await store.page()).records[0].id,'new');
});

test('a photo-heavy history returns only the current page of payloads',async()=>{
 const {store}=setup();for(let i=0;i<30;i++)await store.run('readwrite',s=>s.put({...record(String(i),i),photos:Array(30).fill('x'.repeat(4000))}));
 const page=await store.page();assert.equal(page.records.length,4);assert.equal(page.total,30);assert.equal(page.hasMore,true);
 assert.deepEqual(page.records.map(r=>r.id),['29','28','27','26']);assert.equal(page.records.flatMap(r=>r.photos).length,120);
});

test('empty history, failed writes and later retries retain correct storage behavior',async()=>{
 const {store}=setup();assert.deepEqual(await store.page(),{records:[],total:0,hasMore:false,after:null});
 await assert.rejects(store.run('readwrite',()=>{throw Error('failed write');}),/failed write/);
 await store.run('readwrite',s=>s.put(record('ok')));assert.equal(await store.run('readonly',s=>s.count()),1);
 await assert.rejects(store.page({limit:0}),/Invalid page size/);
});

test('gallery ignores late pages after leaving and prevents overlapping load-more requests',async()=>{
 const pending=[];const pager=new JourneyPager({page:()=>new Promise(resolve=>pending.push(resolve))});
 const old=pager.next();assert.equal(await pager.next(),null);assert.equal(pending.length,1);
 pager.reset();const current=pager.next();
 pending[0]({records:[record('stale')],total:1,hasMore:false,after:[100,'stale']});assert.equal(await old,null);assert.deepEqual(pager.records,[]);assert.equal(pager.busy,true);
 pending[1]({records:[record('current')],total:1,hasMore:false,after:[100,'current']});await current;assert.equal(pager.records[0].id,'current');assert.equal(pager.busy,false);assert.equal(await pager.next(),null);
 pager.reset();assert.deepEqual(pager.records,[]);
});

test('a failed gallery page can retry the same position',async()=>{
 let requests=0;const positions=[];const pager=new JourneyPager({async page(options){positions.push(options.before);if(++requests===1)throw Error('storage');return {records:[record('ok')],total:1,hasMore:false,after:[100,'ok']};}});
 await assert.rejects(pager.next(),/storage/);assert.equal(pager.busy,false);await pager.next();assert.deepEqual(positions,[null,null]);assert.equal(pager.records.length,1);
});
