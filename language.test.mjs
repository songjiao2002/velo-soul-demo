import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSpeechLanguagePreferences} from './public/input-language.mjs';
import {rideTextChatLabel} from './public/ride-voice-controls.mjs';
import {translate} from './public/i18n.mjs';
import {chooseEnglishVoice,phrasePlan,EnglishVoicePlayer} from './public/voice-engine.mjs';
test('speech input follows the interface until a rider chooses a language, then survives interface and companion changes',()=>{
 const stored=new Map(),storage={getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value)};
 let prefs=createSpeechLanguagePreferences(()=>storage);
 assert.equal(prefs.input('en'),'en');
 assert.equal(prefs.input('ko'),'ko');
 assert.equal(prefs.input('zh'),'zh');
 assert.equal(prefs.voice('ko','lumi'),'ko');
 assert.equal(stored.size,0);
 prefs.select('ko');
 prefs.select('auto');
 prefs=createSpeechLanguagePreferences(()=>storage);
 assert.equal(prefs.input('en'),'auto');
 assert.equal(prefs.voice('en','bori'),'ko');
 prefs.select('zh');
 assert.equal(prefs.voice('ko','bori'),'zh');
 assert.equal(prefs.input('ko'),'zh');
 assert.equal(prefs.voice('ko','mori'),'zh');
});
test('legacy voice-only preferences survive and an explicit language takes precedence',()=>{
 const stored=new Map([['velo-soul-voice-language','ko']]);
 const storage={getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value)};
 assert.equal(createSpeechLanguagePreferences(()=>storage).input('en'),'ko');
 stored.set('velo-soul-input-language','en');
 const prefs=createSpeechLanguagePreferences(()=>storage);
 assert.equal(prefs.input('ko'),'en');
 assert.equal(prefs.voice('en','lumi'),'en');
 const sessionPrefs=createSpeechLanguagePreferences(()=>{throw Error('Storage blocked');});
 sessionPrefs.select('auto');
 assert.equal(sessionPrefs.input('en'),'auto');
 sessionPrefs.select('en');
 assert.equal(sessionPrefs.input('ko'),'en');
});
test('packaged home and ride selectors use the saved input after a stopped conversation',async()=>{
 const html=await readFile(new URL('./public/index.html',import.meta.url),'utf8');
 const source=await readFile(new URL('./public/reference-entry.generated.mjs',import.meta.url),'utf8');
 const voiceSelect=html.match(/<select id="voiceSelect"[^>]*>([\s\S]*?)<\/select>/)[1];
 assert.deepEqual([...voiceSelect.matchAll(/value="([^"]+)"/g)].map(match=>match[1]),['auto','en','ko','zh']);
 const rideSettings=source.slice(source.indexOf('function bl()'),source.indexOf('function Jo(riding)'));
 const render=Function('M','yi','S','Ao','rideLanguages','liveVoicePrivacy','rideTextChatLabel',rideSettings+'\nreturn bl();');
 const options=[['auto','Auto'],['en','English'],['ko','한국어'],['zh','中文']];
 for(const saved of ['en','ko','auto']){
  const page=render({active:false,language:'zh'},()=>saved,()=>'en',{en:{}},options,{en:''},rideTextChatLabel);
  assert.ok(page.includes(rideTextChatLabel.en));
  const selected=page.match(/name="ride-language" value="([^"]+)" checked/);
  assert.equal(selected?.[1],saved);
 }
});
test('panda Chinese selection stays Chinese from opening through reply and synthesis',async()=>{
 const {replyLanguage}=await import('./public/input-language.mjs');
 const {soulIntroduction,introductionClip}=await import('./public/soul-intro.mjs');
 const {encounterScreen}=await import('./public/encounter-screen.mjs');
 const {validateChat,validateSpeech,createChatService}=await import('./chat-service.mjs');
 assert.equal(replyLanguage('你好','auto','mori'),'zh');assert.equal(replyLanguage('OK','zh','mori'),'zh');
 assert.equal(replyLanguage('你好','auto','lumi'),'zh');
 const intro=soulIntroduction('mori','zh');assert.equal(intro.language,'zh');assert.match(intro.text,/露露/);assert.match(introductionClip(intro.text,'mori','zh'),/mori-zh\.wav/);
 const page=encounterScreen({id:'mori',language:'zh',voiceLanguage:'zh',puppet:'',reviews:''});assert.match(page,/value="zh" selected>中文/);assert.match(page,/encounterVoiceLanguage/);
 const payload={soul:'mori',language:'zh',messages:[{role:'user',content:'你好'}]};assert.equal(validateChat(payload).language,'zh');assert.equal(validateSpeech({soul:'mori',language:'zh',text:intro.text}).language,'Chinese');
 const service=createChatService({env:{DASHSCOPE_API_KEY:'test'},fetchImpl:async(_,o)=>{const body=JSON.parse(o.body);assert.match(body.messages[0].content,/Simplified Chinese/);assert.doesNotMatch(body.messages[0].content,/Chinese input currently receives English/);return new Response(JSON.stringify({choices:[{message:{content:'咱们慢慢走吧。'}}]}));}});
 assert.equal((await service.reply(payload)).reply,'咱们慢慢走吧。');
});
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
