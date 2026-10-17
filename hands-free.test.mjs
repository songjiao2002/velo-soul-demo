import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HandsFreeConversation} from './public/hands-free.mjs';
const flush=()=>new Promise(r=>setImmediate(r));
function setup(fetchImpl){
 const recognizers=[],calls=[],voices=[],states=[],timers=new Map();let timerId=0,stops=0;
 class Recognition{constructor(){recognizers.push(this);}start(){this.active=true;this.onstart?.();}abort(){this.active=false;}stop(){this.active=false;this.onend?.();}hear(text){this.onspeechstart?.();this.onresult?.({results:[{0:{transcript:text},isFinal:true}]});}}
 const session=new HandsFreeConversation({Recognition,fetchImpl:async(url,options)=>{calls.push({url,body:JSON.parse(options.body),signal:options.signal});return fetchImpl?fetchImpl(url,options):new Response(JSON.stringify({soul:'bori',reply:'A little cafe break sounds lovely.'}));},getContext:()=>({context:{location:{placeId:'daelim-changgo'}},image:'synthetic-image-for-client-unit-test'}),speak:(text,lang,soul,callback)=>{assert.equal(recognizers.some(r=>r.active),false);voices.push({text,lang,callback});},stopSpeech:()=>stops++,onState:s=>states.push(s),setTimer:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimer:id=>timers.delete(id)});
 const run=ms=>{const entry=[...timers.entries()].find(([,t])=>t.ms===ms);assert.ok(entry,'timer '+ms);timers.delete(entry[0]);entry[1].fn();};
 return {session,recognizers,calls,voices,states,timers,run,get stops(){return stops;}};
}
test('spoken input sends automatically with context, replies aloud, then resumes and preserves history',async()=>{
 const a=setup();a.session.start('bori','zh');assert.equal(a.recognizers[0].lang,'zh-CN');
 a.recognizers[0].hear('你看到什么？');await flush();assert.equal(a.calls.length,1);assert.equal(a.calls[0].url,'/api/chat/scene');assert.equal(a.calls[0].body.language,'en');assert.equal(a.voices.length,1);
 assert.equal(a.recognizers[0].active,false);a.voices[0].callback('ended');a.run(450);assert.equal(a.recognizers.at(-1).active,true);
 a.recognizers.at(-1).hear('Tell me more');await flush();assert.equal(a.calls[1].body.messages.length,3);a.session.stop();assert.equal(a.timers.size,0);
});
test('reply-time monitoring accepts Chinese, English and Korean interruption without forwarding the command',async()=>{
 for(const [language,command] of [['zh','等一下'],['en','stop'],['ko','잠깐']]){
  const a=setup();a.session.start('bori',language);a.recognizers[0].hear('Hello');await flush();const old=a.voices[0];old.callback('playing');a.run(150);
  const monitor=a.recognizers.at(-1);assert.equal(monitor.interimResults,false);assert.equal(a.recognizers[0].active,false);
  monitor.hear(command);assert.equal(monitor.active,false);assert.equal(a.calls.length,1);assert.equal(a.session.state,'listening');
  old.callback('ended');a.run(150);assert.equal(a.recognizers.at(-1).interimResults,true);assert.equal(a.timers.size,1);a.session.stop();
 }
});
test('an interrupt may include a new question; late playback events cannot restart the old turn',async()=>{
 const a=setup();a.session.start('bori','zh');a.recognizers[0].hear('Hello');await flush();const old=a.voices[0];old.callback('playing');a.run(150);
 a.recognizers.at(-1).hear('等一下，我想喝咖啡');await flush();assert.equal(a.calls.at(-1).body.messages.at(-1).content,'我想喝咖啡');assert.equal(a.voices.length,2);
 old.callback('ended');assert.equal(a.session.state,'synthesizing');a.session.stop();assert.equal(a.timers.size,0);
});
test('stopping aborts an in-flight answer and ignores its eventual response',async()=>{
 let resolve;const a=setup(()=>new Promise(r=>resolve=r));a.session.start('bori','en');a.recognizers[0].hear('Hello');a.session.stop();assert.ok(a.calls[0].signal.aborted);
 resolve(new Response(JSON.stringify({soul:'bori',reply:'Too late'})));await flush();assert.equal(a.voices.length,0);assert.equal(a.session.active,false);
});
test('voice stop and permission denial end the loop; playback failure preserves the conversation',async()=>{
 const a=setup();a.session.start('bori','zh');a.recognizers[0].hear('停止对话');assert.equal(a.session.active,false);assert.equal(a.calls.length,0);
 a.session.start('bori','en');a.recognizers.at(-1).onerror({error:'not-allowed'});assert.equal(a.states.at(-1),'denied');assert.equal(a.timers.size,0);
 a.session.start('bori','en');a.recognizers.at(-1).hear('Hello');await flush();a.voices.at(-1).callback('blocked');assert.equal(a.states.at(-1),'audio_retry');assert.equal(a.session.active,true);a.run(1500);assert.equal(a.recognizers.at(-1).active,true);a.session.stop();assert.equal(a.timers.size,0);
});
test('automatic scene speech waits while the rider is talking',()=>{
 const a=setup();a.session.start('bori','en');a.recognizers[0].onspeechstart();assert.equal(a.session.announce('A cafe!','en'),false);assert.equal(a.recognizers[0].active,true);a.session.stop();
});

test('temporary recognition failures reconnect automatically with a bounded retry count',()=>{
 const a=setup();a.session.start('bori','en');
 for(const delay of [1500,3000,4500]){a.recognizers.at(-1).onerror({error:'network'});assert.equal(a.session.active,true);assert.equal(a.session.state,'reconnecting');a.run(delay);assert.equal(a.recognizers.at(-1).active,true);}
 a.recognizers.at(-1).onerror({error:'network'});assert.equal(a.session.active,false);assert.equal(a.session.state,'network');assert.equal(a.timers.size,0);
});
