import test from 'node:test';
import assert from 'node:assert/strict';
import {createShutterGesture,rememberScan,readScanHistory,mobileScanner,mobileDiaryEntry} from './public/mobile-flow.mjs';
test('shutter short press captures once, hold finishes once, cancellation does neither',()=>{
 let task,photo=0,finish=0;const gesture=createShutterGesture({capture:()=>photo++,finish:()=>finish++,setTimer:fn=>(task=fn,1),clearTimer:()=>task=null});
 gesture.begin();gesture.end();gesture.end();assert.equal(photo,1);assert.equal(finish,0);
 gesture.begin();task();gesture.end();assert.equal(finish,1);assert.equal(photo,1);
 gesture.begin();gesture.cancel();gesture.end();assert.equal(finish,1);assert.equal(photo,1);
 gesture.begin(false);assert.equal(task,null);gesture.end();assert.equal(photo,2);
});
test('scan history persists verified companion IDs, deduplicates and tolerates corrupt storage',()=>{
 const values=new Map();const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 rememberScan('mori',storage,1000);rememberScan('lumi',storage,2000);rememberScan('mori',storage,3000);rememberScan('__proto__',storage,4000);
 assert.deepEqual(readScanHistory(storage),[{soul:'mori',at:3000},{soul:'lumi',at:2000}]);
 assert.match(mobileScanner('zh',readScanHistory(storage)),/扫码历史/);
 storage.setItem('velo-soul-scan-history','broken');assert.deepEqual(readScanHistory(storage),[]);
});
test('diary renders escaped paragraphs and original notes without duplicating its character cover',()=>{
 const html=mobileDiaryEntry({id:'ride-1',soul:'mori',photos:[],note:'<script>bad()</script>'},{diary:{title:'<title>',body:'First\n\nSecond',date:'14 Nov',language:'en'}});
 assert.match(html,/&lt;title&gt;/);assert.match(html,/<p>First<\/p><p>Second<\/p>/);assert.doesNotMatch(html,/<script>/);assert.equal((html.match(/class="diary-entry-cover"/g)||[]).length,1);
});
