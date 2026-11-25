import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
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

test('both ride scenes use the conversation controls, including on a direct camera launch',async()=>{
 const entry=await readFile(new URL('./public/reference-entry.generated.mjs',import.meta.url),'utf8');
 const view=entry.slice(entry.indexOf('  function Jo(riding)'),entry.indexOf('  function ze('));
 assert.match(view,/rideTalkPanel\(language/);
 for(const mode of ['camera','map'])assert.ok(view.includes(`data-scene-mode="${mode}"`));
 assert.match(entry,/case "ride-voice-toggle":\s*ct = false; Sl\(\)/);
 assert.match(entry,/case "ride-text-chat":\s*openRideTextChat\(\)/);
 assert.ok(entry.includes('Ga=rideVoiceControlsMarkup;')&&entry.includes('fs=paintRideVoiceControls;'));
 const languages=entry.indexOf('const rideLanguages ='), startup=entry.indexOf('\n  Vo();');
 assert.ok(languages>=0&&startup>languages,'all ride settings must exist before a direct camera launch');
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
