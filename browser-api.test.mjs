import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SoulSpeechPlayer} from './public/soul-speech.mjs';
import {HandsFreeConversation} from './public/hands-free.mjs';
import {SoulVisionObserver} from './public/soul-vision.mjs';

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
