import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SpeechAudioCache} from './public/speech-cache.mjs';
import {CloudSpeechPlayer} from './public/cloud-speech.mjs';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
const pcm=Buffer.from([0,64,0,192,0,32,0,224]);
const audioFrame={audio:pcm.toString('base64'),rate:24000};
const response=(frames=[audioFrame,{done:true}])=>new Response(frames.map(f=>JSON.stringify(f)+'\n').join(''),{headers:{'Content-Type':'application/x-ndjson'}});
function setup(fetchImpl=async()=>response()){
 const sources=[],requests=[];
 class Context {
  constructor(){this.state='running';this.currentTime=0;this.sampleRate=24000;this.destination={};}
  resume(){return Promise.resolve();}close(){return Promise.resolve();}
  createBuffer(channels,length,sampleRate){const samples=new Float32Array(length);return {length,sampleRate,numberOfChannels:channels,duration:length/sampleRate,getChannelData:()=>samples};}
  createBufferSource(){const node={playbackRate:{value:1},connect(){},disconnect(){},start(){},stop(){this.stopped=true;}};sources.push(node);return node;}
 }
 const player=new CloudSpeechPlayer({Context,fetchImpl:(url,options)=>{requests.push(JSON.parse(options.body));return fetchImpl(url,options);}});
 async function speak(text,options={}){const states=[],pending=player.speak(text,{...options,onState:s=>states.push(s)});await flush();const node=sources.at(-1);assert.equal(states.at(-1),'playing');node.onended();await pending;assert.equal(states.at(-1),'ended');return node;}
 return {player,sources,requests,speak};
}

test('replaying streamed speech reuses exact PCM without a second cloud request',async t=>{
 const a=setup();t.after(()=>a.player.dispose());await a.player.prepare();
 const first=await a.speak('안녕하세요.',{language:'ko',soul:'mori'});
 const replay=await a.speak('안녕하세요.',{language:'ko',soul:'mori'});
 assert.equal(a.requests.length,1);assert.equal(replay.playbackRate.value,.94);
 assert.deepEqual(replay.buffer.getChannelData(0),first.buffer.getChannelData(0));
 assert.deepEqual([...replay.buffer.getChannelData(0)],[.5,-.5,.25,-.25]);
 assert.equal(a.player.cache.bytes,16);
});

test('speech cache keeps personality and language separate, with an exact text key',async t=>{
 const a=setup();t.after(()=>a.player.dispose());await a.player.prepare();
 for(const options of [{language:'en',soul:'lumi'},{language:'ko',soul:'lumi'},{language:'en',soul:'bori'}])await a.speak('Hello',options);
 await a.speak('Hello');assert.equal(a.requests.length,3);
 await a.speak('Hello!');assert.equal(a.requests.length,4);
});

test('missing completion, provider errors and cancellation never populate the speech cache',async t=>{
 for(const failure of ['truncated','provider','cancelled']){
  const a=setup(async()=>response(failure==='provider'?[audioFrame,{error:'provider_quota'}]:failure==='truncated'?[audioFrame]:undefined));
  t.after(()=>a.player.dispose());await a.player.prepare();const states=[];
  const pending=a.player.speak('Try again',{onState:s=>states.push(s)});await flush();
  if(failure==='cancelled')a.player.stop();await pending;
  assert.equal(a.player.cache.size,0);assert.ok(!states.includes('ended'));
  assert.ok(a.sources.slice(1).every(s=>s.stopped));
 }
});

test('speech cache evicts least recently played entries and never exceeds its byte budget',()=>{
 const cache=new SpeechAudioCache({maxBytes:32,maxEntries:3});
 const buffer={length:4,numberOfChannels:1};cache.set('a',buffer);cache.set('b',buffer);cache.get('a');cache.set('c',buffer);
 assert.equal(cache.has('b'),false);assert.equal(cache.has('a'),true);assert.equal(cache.bytes,32);
 assert.equal(cache.set('oversize',{length:9}),false);assert.equal(cache.bytes,32);
 cache.set('a',{length:2});assert.equal(cache.bytes,24);
 cache.clear();assert.equal(cache.bytes,0);assert.equal(cache.size,0);
});

test('oversized streams still play but do not retain audio, and dispose clears cached replies',async()=>{
 const a=setup();await a.player.prepare();a.player.cache=new SpeechAudioCache({maxBytes:8});
 await a.speak('A');await a.speak('A');assert.equal(a.requests.length,2);assert.equal(a.player.cache.bytes,0);
 a.player.cache=new SpeechAudioCache();await a.speak('B');assert.equal(a.player.cache.size,1);
 a.player.dispose();assert.equal(a.player.cache.bytes,0);assert.equal(a.player.cache.size,0);
});
