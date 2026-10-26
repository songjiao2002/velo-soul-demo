import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SoulSpeechPlayer} from './public/soul-speech.mjs';
import {HandsFreeConversation} from './public/hands-free.mjs';
import {SoulVisionObserver} from './public/soul-vision.mjs';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('startup cache recovery keeps script URLs local and accepts only a numeric retry value',()=>{
 const boot=readFileSync(new URL('./public/boot.js',import.meta.url),'utf8');
 for(const value of [null,'1793000000000','https://elsewhere.example/a.js','//elsewhere.example/a.js','1&redirect=https://elsewhere.example','Infinity','-1','9007199254740992']){
  let script;const elements=new Map();
  const document={getElementById(id){if(!elements.has(id))elements.set(id,{innerHTML:'<main>fallback</main>',addEventListener(){}});return elements.get(id);},createElement(){return {};},head:{appendChild(el){script=el;}},documentElement:{dataset:{}}};
  const href='https://demo.example/?bike=lumi'+(value===null?'':'&reload='+encodeURIComponent(value));
  runInNewContext(boot,{document,window:{location:{href},addEventListener(){}},URL,setTimeout(){return 1;},clearTimeout(){}});
  const url=new URL(script.src,href);assert.equal(url.origin,'https://demo.example');assert.equal(url.pathname,'/app.bundle.js');
  assert.equal(url.searchParams.get('reload'),value==='1793000000000'?value:null);assert.deepEqual([...url.searchParams.keys()],value==='1793000000000'?['v','reload']:['v']);
 }
});

test('browser timer and fetch defaults retain the Window receiver during startup and replies',async t=>{
 const calls=[];
 function check(receiver,name){if(receiver!==undefined&&receiver!==globalThis)throw new TypeError('Illegal invocation: '+name);calls.push(name);}
 t.mock.method(globalThis,'setTimeout',function(){check(this,'setTimeout');return 1;});
 t.mock.method(globalThis,'clearTimeout',function(){check(this,'clearTimeout');});
 t.mock.method(globalThis,'fetch',async function(){check(this,'fetch');return new Response(JSON.stringify({soul:'lumi',reply:'Hello!',configured:true}));});
 const player=new SoulSpeechPlayer({synth:{cancel(){},getVoices:()=>[],resume(){},addEventListener(){},removeEventListener(){}},Utterance:class{}});
 assert.doesNotThrow(()=>player.stop());
 assert.doesNotThrow(()=>player.speak('Hello'));
 player.stop();
 const states=[];
 const conversation=new HandsFreeConversation({onState:s=>states.push(s)});
 assert.doesNotThrow(()=>conversation.stop());
 conversation.active=true;conversation.soul='lumi';conversation.language='en';
 await conversation.submit('Hello',conversation.epoch);
 assert.equal(states.at(-1),'synthesizing');
 conversation.stop();
 const observer=new SoulVisionObserver();
 assert.doesNotThrow(()=>observer.stop());
 assert.equal((await observer.request('/api/chat/status',{},observer.epoch)).configured,true);
 assert.ok(calls.includes('setTimeout'));assert.ok(calls.includes('clearTimeout'));assert.equal(calls.filter(x=>x==='fetch').length,2);
});
