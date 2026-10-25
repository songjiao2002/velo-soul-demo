import {test} from 'node:test';
import assert from 'node:assert/strict';
import {translate} from './public/i18n.mjs';
import {chooseEnglishVoice,phrasePlan,EnglishVoicePlayer} from './public/voice-engine.mjs';
test('translation preserves brands and numeric data while translating dynamic UI',()=>{
 for(const lang of ['ko','en','zh']){assert.equal(translate('VELO SOUL',lang),'VELO SOUL');assert.equal(translate('03:19',lang),'03:19');}
 assert.equal(translate('모리 만나기 ↗','en'),'Meet Mori ↗');assert.equal(translate('루루와 출발하기 →','zh'),'和露露一起出发 →');assert.equal(translate('카메라 켜기','ko'),'카메라 켜기');
 assert.equal(translate('실제 GPS 기록 중 · 정확도 ±12m','zh'),'实际 GPS 记录中 · 精度 ±12 米');
 assert.equal(translate('오늘은, 누구와 달릴까요?','en'),"Today, who's coming along?");
});
test('voice casting prioritizes actual accent and reports fallback honestly',()=>{
 const us={lang:'en-US',name:'Microsoft Zira'},gb={lang:'en-GB',name:'Microsoft Sonia'},ko={lang:'ko-KR',name:'Korean'};
 assert.equal(chooseEnglishVoice([us,gb,ko],'mori').voice,gb);assert.equal(chooseEnglishVoice([gb,us],'lumi').voice,us);assert.equal(chooseEnglishVoice([us],'mori').matchedAccent,false);assert.equal(chooseEnglishVoice([ko],'bori').voice,undefined);
});
test('personality pacing retains sentence meaning and avoids exaggerated pitch',()=>{
 const text="Hey, I'm Mori! What's around that corner? Let's find out.";
 const bright=phrasePlan(text,'lumi'),calm=phrasePlan(text,'mori');assert.equal(bright.map(p=>p.text).join(' '),text);assert.ok(calm[0].pause>bright[0].pause);assert.ok(calm[0].rate<bright[0].rate);assert.ok(bright.every(p=>p.pitch>=.9&&p.pitch<=1.1));
});
test('cancelling speech prevents late events from starting the next phrase',()=>{
 let utterance;const states=[];const synth={getVoices:()=>[{lang:'en-US',name:'Zira'}],cancel(){},speak:u=>{utterance=u;},addEventListener(){},removeEventListener(){}};
 const player=new EnglishVoicePlayer({synth,Utterance:class{constructor(text){this.text=text;}},onState:s=>states.push(s)});player.speak('Hello. Ready?','lumi');const first=utterance;player.stop();first.onstart();first.onend();assert.deepEqual(states,[]);assert.equal(utterance,first);
});
