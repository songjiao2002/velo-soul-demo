import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {SpeechAudioCache} from './public/speech-cache.mjs';
import {CloudSpeechPlayer} from './public/cloud-speech.mjs';
import {FAST_OPENINGS, getFastOpeningSource} from './public/fast-openings.mjs';
import {RIDE_QUICK_REPLIES} from './public/ride-quick-replies.mjs';
import {readVoiceReply} from './public/chat-stream.mjs';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('quick replies are decoded once while listening and can start from the ready audio buffer',async t=>{
 const a=setup();t.after(()=>a.player.dispose());await a.player.prepare();
 const role='mori',language='zh';
 let downloads=0,decodes=0;
 a.player.fetchImpl=async path=>{
  assert.ok(path.startsWith('/audio/ride-quick/'));downloads++;
  const data=await readFile(new URL('./public'+path.split('?')[0],import.meta.url));
  return new Response(data,{headers:{'Content-Type':'audio/wav'}});
 };
 a.player.context.decodeAudioData=async()=>{decodes++;return a.player.context.createBuffer(1,480,24000);};
 a.player.primeRideReplies(role,language);
 await Promise.all([...a.player.preloads.values()].map(entry=>entry.decoded));
 assert.equal(downloads,3);assert.equal(decodes,3);
 const clip=RIDE_QUICK_REPLIES.find(item=>item.soul===role&&item.language===language);
 await a.speak(clip.text,{soul:role,language,quickReplySource:clip.path,firstReplySegment:true});
 assert.equal(downloads,3);assert.equal(decodes,3);
});
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

test('each packaged opening matches the exact first phrase emitted by the reply reader',async()=>{
 const lulu={soul:'mori',language:'en'};
 assert.notEqual(getFastOpeningSource('Mm,',lulu),getFastOpeningSource('Mm.',lulu));
 for(const text of ['mm,','Mm','Mm!','Mm, let’s go.',' Mm,'])assert.equal(getFastOpeningSource(text,lulu),undefined);
 assert.equal(getFastOpeningSource('Mm,',{soul:'bori',language:'en'}),undefined);
 assert.equal(getFastOpeningSource('Mm,',{...lulu,language:'ko'}),undefined);
 const combinations=new Set();
 for(const clip of FAST_OPENINGS){
  combinations.add(`${clip.soul}-${clip.language}`);
  const {soul,language,text}=clip;
  const first=language==='zh'?text:`${text} `;
  const tail={en:'Here we go.',ko:'함께 가자.',zh:'一起走吧。'}[language];
  const frames=[{type:'delta',text:first},{type:'delta',text:tail},{type:'complete',soul,reply:first+tail}];
  const stream=new Response(frames.map(frame=>JSON.stringify(frame)+'\n').join(''));
  const phrases=[];
  await readVoiceReply(stream,{soul,onText:()=>{},onSentence:phrase=>phrases.push(phrase)});
  assert.equal(phrases[0],text,clip.path);
  assert.equal(new URL(getFastOpeningSource(phrases[0],clip),'https://example.test').pathname,clip.path);
 }
 assert.equal(combinations.size,9);
});

for(const [name,recordings] of [['openings',FAST_OPENINGS],['quick replies',RIDE_QUICK_REPLIES]]){
test(`packaged character ${name} contain distinct audible PCM and little leading silence`,async()=>{
 const manifest=JSON.parse(await readFile(new URL('./public/.asset-manifest.json',import.meta.url),'utf8'));
 const hashes=new Set();
 for(const {path} of recordings){
  const wave=await readFile(new URL(`./public${path}`,import.meta.url));
  assert.equal(manifest.files[path]?.sha256,createHash('sha256').update(wave).digest('hex'),path);
  assert.equal(wave.toString('ascii',0,4),'RIFF',path);
  assert.equal(wave.toString('ascii',8,16),'WAVEfmt ',path);
  assert.equal(wave.readUInt32LE(4),wave.length-8,path);
  assert.equal(wave.readUInt16LE(20),1,path); // PCM mono, 24 kHz, 16 bit
  assert.equal(wave.readUInt16LE(22),1,path);
  assert.equal(wave.readUInt32LE(24),24000,path);
  assert.equal(wave.readUInt16LE(34),16,path);
  assert.equal(wave.toString('ascii',36,40),'data',path);
  assert.equal(wave.readUInt32LE(40),wave.length-44,path);
  const pcm=wave.subarray(44),energy=[];
  for(let offset=0;offset+240<=pcm.length;offset+=240){
   let sum=0;
   for(let at=offset;at<offset+240;at+=2)sum+=pcm.readInt16LE(at)**2;
   energy.push(Math.sqrt(sum/120)); // RMS for each five milliseconds of decoded samples
  }
  const peak=Math.max(...energy);
  assert.ok(peak>280,path);
  const audible=Math.max(60,peak*.04),onset=energy.findIndex(level=>level>=audible);
  assert.ok(onset>=0 && onset*5<=100,path);
  assert.ok(energy.filter(level=>level>=audible).length>=7,path);
  const digest=createHash('sha256').update(pcm).digest('hex');
  assert.ok(!hashes.has(digest),path);
  hashes.add(digest);
 }
});
}
