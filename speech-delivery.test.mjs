import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSpeechWave,relaySpeech,trimSpeechWave} from './speech-stream.mjs';
import {deliveryTone,pandaDirection,spokenPunctuation} from './voice-delivery.mjs';
import {createChatService} from './chat-service.mjs';

test('the spoken line and current rider select restrained delivery in all three languages',()=>{
 for(const rider of ['I am exhausted','我有点累','오늘 좀 피곤해'])assert.equal(deliveryTone('Okay.',rider),'gentle');
 for(const rider of ['We did it!','好耶！','드디어 해냈어!'])assert.equal(deliveryTone('Okay.',rider),'playful');
 for(const rider of ['Watch out!','小心来车！','조심해!'])assert.equal(deliveryTone('Haha, I know.',rider),'serious');
 for(const rider of ['I am not tired.','我不累。','피곤하지 않아.'])assert.equal(deliveryTone('Okay.',rider),'neutral');
 assert.equal(spokenPunctuation('真的？','playful','Chinese'),'真的？');
 assert.equal(spokenPunctuation('太棒了。','playful','Chinese'),'太棒了！');
});

test('Lulu retains the cloned voice and receives a distinct delivery direction for each mood',async()=>{
 let sent;
 const service=createChatService({env:{DASHSCOPE_API_KEY:'test-only'},fetchImpl:async(url,options)=>{
  if(url.endsWith('/SpeechSynthesizer')){sent=JSON.parse(options.body);return Response.json({output:{audio:{url:'https://dashscope-result-sgp.oss-ap-southeast-1.aliyuncs.com/sample.wav'}}});}
  return new Response(fixture);
 }});
 let voice;
 for(const [text,tone] of [['太棒了！','playful'],['累了就歇一会儿。','gentle'],['小心来车。','serious']]){
  await service.speech({soul:'mori',language:'zh',text});
  voice??=sent.input.voice;
  assert.equal(sent.input.voice,voice);assert.equal(sent.input.text,text);
  assert.ok(sent.input.instruction.includes(pandaDirection[tone]));
 }
});

test('a cached spoken phrase cannot reuse another turn’s emotional delivery',async()=>{
 const requests=[];
 const service=createChatService({env:{DASHSCOPE_API_KEY:'test-only'},fetchImpl:async(_,options)=>{
  const body=JSON.parse(options.body);requests.push(body);
  return new Response(audioFrame(Buffer.alloc(4800,6))+stop,{headers:{'content-type':'text/event-stream'}});
 }});
 for(const rider of ['private rider is exhausted','private rider says we did it!','private rider says we did it!']){
  await service.speechStream({soul:'mori',language:'en',text:'Okay.'},{tone:deliveryTone('Okay.',rider),emit:()=>{}});
 }
 assert.equal(requests.length,2);
 assert.equal(requests[0].input.text,'Okay.');
 assert.ok(requests[0].input.instruction.includes(pandaDirection.gentle));
 assert.ok(requests[1].input.instruction.includes(pandaDirection.playful));
 assert.doesNotMatch(JSON.stringify(requests),/private rider/);
});

const tones=['playful','gentle','serious'];
const recordings=['lumi-en','bori-ko','lumi-zh'].map(name=>readFileSync(new URL('./public/audio/characters13/'+name+'.wav',import.meta.url)));
const fixture=recordings[0];
const samples=wave=>new Int16Array(Uint8Array.from(wave.subarray(wave.indexOf('data')+8)).buffer);
function audioFrame(bytes){return 'data: '+JSON.stringify({output:{audio:{data:bytes.toString('base64')}}})+'\n';}
const stop='data: {"output":{"finish_reason":"stop"}}\n';
const asResponse=stream=>new Response(stream,{headers:{'Content-Type':'text/event-stream'}});

function compare(a,b){
 assert.equal(a.length,b.length);
 let aa=0,bb=0,ab=0,peak=0,first=-1,last=-1;
 for(let i=0;i<a.length;i++){
  aa+=a[i]**2;bb+=b[i]**2;ab+=a[i]*b[i];
  peak=Math.max(peak,Math.abs(b[i]));
  if(Math.abs(b[i])>100){if(first<0)first=i;last=i;}
 }
 return {rmsRatio:Math.sqrt(bb/aa),correlation:ab/Math.sqrt(aa*bb),peak,first,last};
}
test('real English, Korean and Mandarin recordings retain syllable timing, intelligible level and voice contour',()=>{
 for(const original of recordings){
  const neutral=trimSpeechWave(original);
  assert.deepEqual(trimSpeechWave(original,{tone:'neutral'}),neutral);
  assert.deepEqual(trimSpeechWave(original,{tone:'unknown'}),neutral);
  const basic=samples(neutral),reference=compare(basic,basic);
  const variants={};
  for(const tone of tones){
   const variant=samples(trimSpeechWave(original,{tone})),m=compare(basic,variant);
   assert.ok(m.correlation>.985&&m.correlation<.99999,tone+' retains the contour without merely scaling the volume');
   assert.ok(m.rmsRatio>.85&&m.rmsRatio<1.18,tone+' speech level');
   assert.ok(m.peak<32767,tone+' headroom');
   assert.ok(Math.abs(m.first-reference.first)<240&&Math.abs(m.last-reference.last)<240,tone+' onset and tail within 10 ms');
   variants[tone]=variant;
  }
  assert.ok(compare(variants.gentle,variants.playful).rmsRatio>1.06);
 }
});
test('all expressive modes emit PCM immediately, align split samples, and match the WAV path byte for byte',async()=>{
 for(const tone of tones){
  let feed;
  const input=new ReadableStream({start(controller){feed=controller;}}),encode=new TextEncoder(),frames=[];
  const running=relaySpeech(asResponse(input),frame=>frames.push(frame),{trimPadding:true,tone});
  const cut=44+48001;
  feed.enqueue(encode.encode(audioFrame(fixture.subarray(0,cut))));
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(frames.some(frame=>frame.audio),'first packet emitted before the next input or end');
  for(let at=cut;at<fixture.length;at+=373)feed.enqueue(encode.encode(audioFrame(fixture.subarray(at,at+373))));
  feed.enqueue(encode.encode(stop));feed.close();await running;
  const wave=createSpeechWave();
  for(const frame of frames)wave.append(frame);
  assert.deepEqual(wave.finish(),trimSpeechWave(fixture,{tone}));
 }
});
test('raw PCM split on an odd byte is shaped consistently, with headroom and no extra sound in silence',async()=>{
 const pcm=Buffer.alloc(800);
 for(let at=150;at<390;at+=2)pcm.writeInt16LE(at%4===0?32767:-32768,at);
 const fake=createSpeechWave();fake.append({rate:24000,audio:pcm.toString('base64')});fake.append({done:true});
 for(const tone of tones){
  const frames=[];
  await relaySpeech(asResponse(audioFrame(pcm.subarray(0,155))+audioFrame(pcm.subarray(155))+stop),f=>frames.push(f),{tone});
  const raw=Buffer.concat(frames.filter(f=>f.audio).map(f=>Buffer.from(f.audio,'base64')));
  assert.deepEqual(raw,trimSpeechWave(fake.finish(),{tone}).subarray(44));
  assert.ok(!raw.subarray(0,150).some(Boolean)&&!raw.subarray(390).some(Boolean));
  for(let at=150;at<390;at+=2)assert.ok(Math.abs(raw.readInt16LE(at))<32767);
  await assert.rejects(relaySpeech(asResponse(audioFrame(pcm.subarray(0,155))+stop),()=>{},{tone}),/invalid_audio/);
 }
});
