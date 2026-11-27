import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {createShutterGesture,rememberScan,readScanHistory,mobileScanner,mobileDiaryEntry} from './public/mobile-flow.mjs';
import {rideTalkPanel,paintRideTalk,rideVoiceStatus,rideTextChatLabel} from './public/ride-voice-controls.mjs';
import {HANDS_FREE_COPY} from './public/hands-free.mjs';
import {COMMUNICATION_LIMIT_COPY} from './public/conversation-limits.mjs';
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

test('the camera has the reference microphone and pause buttons, including on a direct camera launch',async()=>{
 const entry=await readFile(new URL('./public/reference-entry.generated.mjs',import.meta.url),'utf8');
 const view=entry.slice(entry.indexOf('  function Jo(riding)'),entry.indexOf('  function ze('));
 for(const control of ['pause','mic'])assert.ok(view.includes('cameraControlMarkup("'+control+'")'));
 assert.doesNotMatch(view,/rideTalkPanel|ride-text-chat/);
 assert.match(entry,/case "companion-mic":\s*toggleCameraMicrophone\(\)/);
 assert.match(entry,/case "companion-pause":\s*toggleCameraPause\(\)/);
 assert.match(entry,/case "ride-text-chat":\s*openRideTextChat\(\)/);
 const languages=entry.indexOf('const rideLanguages ='), startup=entry.indexOf('\n  Vo();');
 assert.ok(languages>=0&&startup>languages,'all ride settings must exist before a direct camera launch');
});

test('all companions open the stock encounter settings and share the four ride language choices',async()=>{
 const [entry,index]=await Promise.all(['reference-entry.generated.mjs','index.html'].map(file=>readFile(new URL('./public/'+file,import.meta.url),'utf8')));
 const encounter=entry.slice(entry.indexOf('  var dr ='),entry.indexOf('  var Xn ='));
 const settings=entry.slice(entry.indexOf('  function bl()'),entry.indexOf('  function Jo(riding)'));
 const table=entry.match(/const rideLanguages = .*?;/)[0];
 const picker=index.match(/<select id="voiceSelect"[^>]*>(.*?)<\/select>/s)[1];
 const values=['auto','en','ko','zh'];
 assert.deepEqual([...picker.matchAll(/<option value="([^"]+)"/g)].map(m=>m[1]),values);
 assert.match(index,/<span id="voiceSelectLabel" role="button" tabindex="0"/);
 assert.match(entry,/case "settings":\s*p\("appSettingsDialog"\)\.showModal\(\)/);
 assert.match(entry,/if\(M\?\.active\)M\.setLanguage\(language\)/);
 for(const id of ['lumi','mori','bori']){
  const companion={en:id,name:id,greeting:{en:'Hello'},story:{en:'A ride'}};
  const html=runInNewContext(encounter+'\nZn({id,puppet:""});',{id,ne:{[id]:companion}});
  assert.match(html,/<div class="encounter-toolbar">[\s\S]*?data-action="settings"/);
 }
 for(const language of values){
  const html=runInNewContext(table+settings+'\nbl();',{S:()=>'en',Ao:{en:{}},yi:()=>language});
  const options=[...html.matchAll(/name="ride-language" value="([^"]+)"\s*(checked)?/g)];
  assert.deepEqual(options.map(match=>match[1]),values);
  assert.deepEqual(options.filter(match=>match[2]).map(match=>match[1]),[language]);
 }
});

test('ride microphone status, retry and text fallback follow the live session in each language',()=>{
 for(const language of ['en','ko','zh']){
  const labels=HANDS_FREE_COPY[language];
  const initial=rideTalkPanel(language,false,'off',false,'Replay');
  assert.ok(initial.includes(labels.start)&&initial.includes(rideTextChatLabel[language]));
  const caption={}, fallback={}, replay={}, buttonLabel={};
  const toggle={setAttribute(key,value){this[key]=value;},querySelector:()=>buttonLabel};
  const elements={'.ride-talk-toggle':toggle,'[role="status"]':caption,'[data-action="ride-text-chat"]':fallback,'[data-action="audio-unlock"]':replay};
  const panel={querySelector:selector=>elements[selector]};
  paintRideTalk(panel,language,false,'denied',false);
  assert.equal(buttonLabel.textContent,labels.start);assert.equal(caption.textContent,labels.denied);assert.equal(fallback.hidden,false);
  paintRideTalk(panel,language,true,'listening',false);
  assert.equal(toggle['aria-pressed'],'true');assert.equal(buttonLabel.textContent,labels.stop);assert.equal(fallback.hidden,true);assert.ok(caption.textContent);
  paintRideTalk(panel,language,true,'audio_retry',true);assert.equal(replay.hidden,false);
  const limits=COMMUNICATION_LIMIT_COPY[language];
  assert.equal(new Set(Object.values(limits)).size,Object.keys(limits).length);
  for(const [code,message] of Object.entries(limits)){
   paintRideTalk(panel,language,!['daily_limit','provider_quota'].includes(code),code,false);
   assert.equal(caption.textContent,message);assert.equal(rideVoiceStatus(language,code),message);
  }
  paintRideTalk(panel,language,false,'off',true);
  assert.equal(toggle['aria-pressed'],'false');assert.equal(replay.hidden,true);assert.equal(caption.textContent,'');
 }
});
