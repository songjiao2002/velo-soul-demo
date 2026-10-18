import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyseMouth,SpeechMouthClock} from './public/speech-mouth.mjs';
import {CloudSpeechPlayer} from './public/cloud-speech.mjs';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
const samples=new Float32Array(2400).fill(.18);
function frames(clock){
 const pending=new Map();let serial=0,wall=0;
 clock.requestFrame=fn=>{pending.set(++serial,fn);return serial;};clock.cancelFrame=id=>pending.delete(id);
 return {pending,tick(){wall+=33;const jobs=[...pending.values()];pending.clear();for(const fn of jobs)fn(wall);}};
}
test('mouth analysis distinguishes silence and sound in short windows with bounded poses',()=>{
 const pcm=new Float32Array(1440);pcm.set(samples.subarray(0,480),480);
 const result=analyseMouth(pcm,24000);
 assert.equal(result.frames.length,3);assert.equal(result.step,.02);
 assert.deepEqual(result.frames.map(f=>f.open),[0,1,0]);
 for(const frame of result.frames)for(const value of Object.values(frame))assert.ok(Number.isFinite(value)&&value>=0&&value<=1);
});
test('mouth follows the playback clock, closes in gaps and pauses, and respects playback rate',()=>{
 const history=[];let time=0;
 const clock=new SpeechMouthClock({onFrame:f=>history.push(f)}),raf=frames(clock);
 const token=clock.begin(()=>time,'mori');clock.enqueue(samples,24000,1,.5,token);clock.enqueue(samples,24000,2,1,token);
 raf.tick();assert.equal(history.at(-1).open,0);
 time=1.15;raf.tick();assert.ok(history.at(-1).open>.2,'half speed extends the first sound past 1.1 seconds');
 time=1.25;raf.tick();assert.equal(history.at(-1).open,0,'network playback gap');
 time=2.02;raf.tick();assert.ok(history.at(-1).open>.2);
 time=null;raf.tick();assert.equal(history.at(-1).open,0,'suspended audio');
 clock.stop();assert.equal(history.at(-1).active,false);assert.equal(raf.pending.size,0);
});
test('an interrupted utterance cannot close or animate a newer one through stale callbacks',()=>{
 const history=[];const clock=new SpeechMouthClock({onFrame:f=>history.push(f)}),raf=frames(clock);
 const old=clock.begin(()=>0,'lumi'),oldFrame=[...raf.pending.values()][0];
 const current=clock.begin(()=>.02,'bori');clock.enqueue(samples,24000,0,1,current);
 clock.enqueue(samples,24000,0,1,old);clock.stop(old);oldFrame(500);
 raf.tick();assert.equal(history.at(-1).soul,'bori');assert.ok(history.at(-1).open>0);assert.equal(clock.segments.length,1);
 clock.stop();
});
test('decoration failures do not interrupt audio clock cleanup',()=>{
 const clock=new SpeechMouthClock({onFrame:()=>{throw Error('DOM removed');}}),raf=frames(clock);
 assert.doesNotThrow(()=>{clock.begin(()=>.02,'lumi');clock.enqueue(samples,24000,0);raf.tick();clock.stop();});assert.equal(raf.pending.size,0);
});

function player(fetchImpl){
 const sources=[],history=[],timers=new Map();let id=0;
 class Context {
  constructor(){this.state='running';this.sampleRate=24000;this.currentTime=1;this.destination={};}
  resume(){return Promise.resolve();}close(){return Promise.resolve();}
  createBuffer(_,n,rate){const data=new Float32Array(n);return {duration:n/rate,sampleRate:rate,getChannelData:()=>data};}
  decodeAudioData(){return Promise.resolve({duration:.1,sampleRate:24000,getChannelData:()=>samples});}
  createBufferSource(){const node={playbackRate:{value:1},connect(){},disconnect(){},start(at){this.at=at;},stop(){this.stopped=true;}};sources.push(node);return node;}
 }
 const p=new CloudSpeechPlayer({Context,fetchImpl,onMouth:f=>history.push(f),setTimer:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimer:id=>timers.delete(id)});
 return {p,sources,history,timers,raf:frames(p.mouth)};
}
test('streaming mouth waits for scheduled audio, continues through the tail, then closes',async()=>{
 let stream;const a=player(async()=>new Response(new ReadableStream({start(c){stream=c;}}),{headers:{'content-type':'application/x-ndjson'}}));await a.p.prepare();
 const states=[],speaking=a.p.speak('Hello',{soul:'mori',onState:s=>states.push(s)});await flush();
 const pcm=Buffer.alloc(4800);for(let i=0;i<2400;i++)pcm.writeInt16LE(6000,i*2);
 stream.enqueue(new TextEncoder().encode(JSON.stringify({audio:pcm.toString('base64'),rate:24000})+'\n'));await flush();
 assert.equal(states.at(-1),'playing');a.raf.tick();assert.equal(a.history.at(-1).open,0,'arrival is earlier than playback');
 const source=a.sources.at(-1);a.p.context.currentTime=source.at+.02;a.raf.tick();assert.ok(a.history.at(-1).open>0);
 stream.enqueue(new TextEncoder().encode('{"done":true}\n'));stream.close();await flush();
 assert.equal(a.history.at(-1).active,true,'HTTP completion must not stop the mouth early');
 source.onended();await speaking;assert.equal(a.history.at(-1).active,false);assert.equal(a.raf.pending.size,0);assert.equal(a.timers.size,0);a.p.dispose();
});
test('cached introductions animate, while interruption prevents their late ended callback resetting the next reply',async()=>{
 const a=player(async()=>new Response(new Uint8Array(100)));await a.p.prepare();
 const first=a.p.speak('Hello',{source:'/audio/intro/lumi-en.wav'});await flush();const oldSource=a.sources.at(-1),late=oldSource.onended;
 a.p.context.currentTime=1.02;a.raf.tick();assert.ok(a.history.at(-1).open>0);
 a.p.stop();await first;assert.equal(a.history.at(-1).active,false);assert.equal(oldSource.stopped,true);
 const second=a.p.speak('Hello',{source:'/audio/intro/lumi-en.wav'});await flush();const source=a.sources.at(-1);late();
 a.p.context.currentTime=1.04;a.raf.tick();assert.ok(a.history.at(-1).active&&a.history.at(-1).open>0);
 source.onended();await second;assert.equal(a.history.at(-1).active,false);a.p.dispose();
});
test('packaged HTML audio uses its own time and pauses, without changing the original player',async()=>{
 let requests=0;const a=player(async()=>{requests++;return new Response(new Uint8Array(100));});await a.p.prepare();
 const audio={currentTime:.02,paused:false,ended:false,readyState:4};await a.p.followMedia(audio,'/audio/hello.wav','bori');a.raf.tick();
 assert.ok(a.history.at(-1).open>0);assert.equal(a.sources.length,1,'only the unlock pulse, no duplicate audio');
 audio.paused=true;a.raf.tick();assert.equal(a.history.at(-1).open,0);
 audio.paused=false;await a.p.followMedia(audio,'/audio/hello.wav','bori');a.raf.tick();assert.ok(a.history.at(-1).open>0);assert.equal(requests,1);
 audio.ended=true;a.raf.tick();assert.equal(a.history.at(-1).open,0);a.p.stop();assert.equal(a.raf.pending.size,0);a.p.dispose();
});
test('stopped packaged audio cannot restart mouth animation after a late download',async()=>{
 let resolve;const a=player(()=>new Promise(r=>resolve=r));await a.p.prepare();
 const pending=a.p.followMedia({currentTime:0,paused:false,ended:false,readyState:4},'/audio/hello.wav','lumi');a.p.stop();resolve(new Response(new Uint8Array(100)));await pending;
 assert.equal(a.history.at(-1).active,false);assert.equal(a.raf.pending.size,0);assert.equal(a.timers.size,0);a.p.dispose();
});
