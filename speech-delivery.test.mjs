import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSpeechWave,relaySpeech,trimSpeechWave} from './speech-stream.mjs';
import {deliveryTone,contextualTone,pandaDirection,spokenPunctuation} from './voice-delivery.mjs';
import {createChatService} from './chat-service.mjs';
import {CHARACTER_REACTIONS,characterReactionAudio,matchCharacterReaction} from './character-reactions.mjs';

test('narrow first-person reactions have a distinct, verified original-voice recording with a prompt audible start',()=>{
 const cases={
  zh:['我终于骑上来了！','今天有点烦，不想说原因。'],
  en:['I finally made it up that hill!', "I'm a little annoyed, don't ask me why."],
  ko:['드디어 언덕을 올라왔어!', '오늘 좀 짜증 나, 이유는 말하고 싶지 않아.']
 };
 const files=new Set();
 for(const row of CHARACTER_REACTIONS){
  const content=cases[row.language][row.intent==='summit'?0:1];
  assert.deepEqual(matchCharacterReaction({...row,messages:[{role:'user',content}]}),row);
  const wave=characterReactionAudio(row);
  assert.ok(Buffer.isBuffer(wave));
  let onset;
  for(let pos=44;pos+240<=wave.length;pos+=240){
   let energy=0;
   for(let j=pos;j<pos+240;j+=2)energy+=wave.readInt16LE(j)**2;
   if(Math.sqrt(energy/120)>=90){onset=(pos-44)/48;break;}
  }
  assert.ok(onset>=0&&onset<=80,row.file+' onset '+onset);
  files.add(row.file);
  assert.equal(characterReactionAudio({...row,text:row.text+'!'}),undefined);
 }
 assert.equal(files.size,18);
});

test('character reactions preserve personal details, questions, safety, negation, and continuity',()=>{
 const examples={
  en:{line:'I finally reached the summit!',topic:'I like the colors of the trees.',ordinary:'Those trees are bright green.',followup:'What color do you see?',danger:'I almost crashed.',boundary:"I am annoyed, please don't ask why.",miss:["I did not make it up that hill.","Did I finally reach the summit?","I finally reached the summit but I hurt my knee.","I am annoyed, why?"]},
  zh:{line:'我终于骑上来了！',topic:'河边这些树的颜色真绿。',ordinary:'树叶已经变绿了。',followup:'我们接着看树吧。',danger:'我刚才差点撞车。',boundary:'今天有点烦，不想说原因。',miss:['我还没骑上来。','我终于骑上来了吗？','朋友终于骑上来了。','我终于骑上来了，但刹车坏了。']},
  ko:{line:'드디어 언덕을 올라왔어!',topic:'나무 색깔이 초록이야.',ordinary:'나무가 초록빛이네.',followup:'무슨 색이 보여?',danger:'넘어질 뻔했어.',boundary:'오늘 좀 짜증 나, 이유는 말하고 싶지 않아.',miss:['아직 정상에 못 올라왔어.','드디어 언덕을 올라왔어?','친구가 드디어 언덕을 올라왔어.','드디어 언덕을 올라왔어, 근데 넘어졌어.']}
 };
 const user=content=>({role:'user',content}),assistant=content=>({role:'assistant',content});
 for(const [language,t] of Object.entries(examples)){
  const match=(...messages)=>matchCharacterReaction({soul:'mori',language,messages});
  const previous=[user(t.topic),assistant(t.ordinary)];
  const recorded=match(user(t.line));
  assert.equal(match(...previous,user(t.line))?.text,recorded.text);
  assert.equal(match(...previous,user(t.boundary)),undefined);
  assert.equal(match(user(t.topic),assistant(t.followup),user(t.line)),undefined);
  assert.equal(match(user(t.danger),assistant(t.ordinary),...previous,user(t.line)),undefined);
  assert.equal(match(user(t.line),assistant(recorded.text),...previous,user(t.line)),undefined);
  assert.equal(match(user(t.line),assistant(t.ordinary),...previous,user(t.line)),undefined);
  for(const other of t.miss)assert.equal(match(user(other)),undefined,other);
 }
});

test('the spoken line and current rider select restrained delivery in all three languages',()=>{
 for(const rider of ['I am exhausted','我有点累','오늘 좀 피곤해'])assert.equal(deliveryTone('Okay.',rider),'gentle');
 for(const rider of ['We did it!','好耶！','드디어 해냈어!'])assert.equal(deliveryTone('Okay.',rider),'playful');
 for(const rider of ['I finally made it.','第一次骑上这段坡了。','처음으로 완주했어.'])assert.equal(deliveryTone('Nice.',rider),'playful');
 for(const rider of ["I feel proud of myself.",'我挺有成就感的。','나도 좀 뿌듯해.'])assert.equal(deliveryTone('Nice.',rider),'playful');
 for(const rider of ['I feel a little less nervous.','今天过弯我没那么紧张了。','이제 긴장이 좀 풀렸어.'])assert.equal(deliveryTone('Okay.',rider),'gentle');
 for(const rider of ['Watch out!','小心来车！','조심해!'])assert.equal(deliveryTone('Haha, I know.',rider),'serious');
 for(const rider of ['I am not tired.','我不累。','피곤하지 않아.'])assert.equal(deliveryTone('Okay.',rider),'neutral');
 assert.equal(spokenPunctuation('真的？','playful','Chinese'),'真的？');
 assert.equal(spokenPunctuation('太棒了。','playful','Chinese'),'太棒了！');
 for(const rider of ['The traffic light is blue.','那个路口有个雕像。','교차로 이름은 뭐야?','其实我没那么失望。','That was not funny.'])assert.equal(deliveryTone('Okay.',rider),'neutral');
 for(const rider of ["It didn't work out.",'我白跑了一趟。','기대했는데 아쉽다.'])assert.equal(deliveryTone('All right.',rider),'disappointed');
 for(const line of ['I wonder what it sounds like.','我有点好奇，它是什么声音？','그 소리가 궁금해.'])assert.equal(deliveryTone(line),'curious');
 assert.equal(contextualTone('Watch out!', 'disappointed'),'serious');
 assert.equal(spokenPunctuation('Okay.','playful','English','bori'),'Okay.');
 for(const rider of ['I feel irritated and don’t want to talk about it.','今天有点烦，不想说原因。','오늘 좀 짜증 나.'])assert.equal(deliveryTone('Okay.',rider),'gentle');
 for(const rider of ['I nearly crashed.','别逗了，刚刚差点撞车。','차랑 부딪힐 뻔했어.'])assert.equal(deliveryTone('Haha.',rider),'serious');
 for(const rider of ['I’m not annoyed.','并不心烦。','짜증이 나지 않아.'])assert.equal(deliveryTone('Okay.',rider),'neutral');
 for(const rider of ['We made it, but the store was closed.','终于到了，却发现店关门了。','드디어 도착했지만 문을 닫았어.'])assert.equal(deliveryTone('Okay.',rider),'disappointed');
 assert.equal(deliveryTone('Okay.','I nearly crashed, but I’m safe now.'),'neutral');
});

test('Lulu retains the cloned voice and receives a distinct delivery direction for each mood',async()=>{
 let sent;
 const service=createChatService({env:{DASHSCOPE_API_KEY:'test-only'},fetchImpl:async(url,options)=>{
  if(url.endsWith('/SpeechSynthesizer')){sent=JSON.parse(options.body);return Response.json({output:{audio:{url:'https://dashscope-result-sgp.oss-ap-southeast-1.aliyuncs.com/sample.wav'}}});}
  return new Response(fixture);
 }});
 let voice;
 for(const [text,tone] of [['太棒了！','playful'],['累了就歇一会儿。','gentle'],['小心来车。','serious'],['白跑一趟了。','disappointed'],['我有点好奇。','curious']]){
  await service.speech({soul:'mori',language:'zh',text});
  voice??=sent.input.voice;
  assert.equal(sent.input.voice,voice);assert.equal(sent.input.text,text);
  assert.ok(sent.input.instruction.includes(pandaDirection[tone]));
 }
});

test('later WAV and streamed phrases inherit a successful turn mood only for that id, soul and language',async()=>{
 const ids=[crypto.randomUUID(),crypto.randomUUID()],calls=[];let time=10000;
 const service=createChatService({env:{DASHSCOPE_API_KEY:'test-only'},now:()=>time,fetchImpl:async(url,opts)=>{
  if(url.endsWith('/chat/completions'))return Response.json({choices:[{message:{content:'I hear you.'},finish_reason:'stop'}]});
  if(url.includes('oss-'))return new Response(fixture);
  calls.push(JSON.parse(opts.body));
  if(opts.headers['X-DashScope-SSE'])return new Response(audioFrame(fixture)+stop,{headers:{'content-type':'text/event-stream'}});
  return Response.json({output:{audio:{url:'https://dashscope-result-sgp.oss-ap-southeast-1.aliyuncs.com/sample.wav'}}});
 }});
 for(const [i,content] of ['I was disappointed.','We did it!'].entries())await service.reply({voice:i===0,soul:'mori',language:'en',voiceTurnId:ids[i],messages:[{role:'user',content}]});
 const speech={soul:'mori',language:'en',text:'Okay.',voiceTurnId:ids[0]};
 await service.speech(speech);assert.ok(calls.at(-1).input.instruction.includes(pandaDirection.disappointed));
 await service.speechStream({...speech,voiceTurnId:ids[1]},{emit:()=>{}});assert.ok(calls.at(-1).input.instruction.includes(pandaDirection.playful));
 await service.speech({...speech,language:'ko'});assert.ok(calls.at(-1).input.instruction.includes(pandaDirection.neutral));
 await service.speech({...speech,soul:'bori'});assert.deepEqual(calls.at(-1).input,{text:'Okay.',voice:'Chelsie',language_type:'English'});
 time+=5*60000;
 await service.speech(speech);assert.ok(calls.at(-1).input.instruction.includes(pandaDirection.neutral));
 assert.ok(calls.every(c=>!JSON.stringify(c).includes('I was disappointed.')));
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

const tones=['playful','gentle','serious','curious','disappointed'];
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

test('each original voice accents syllables differently without shifting the sample clock',()=>{
 for(const original of recordings){
  const neutral=samples(trimSpeechWave(original));
  for(const tone of ['playful','gentle','curious','disappointed']){
   const cat=samples(trimSpeechWave(original,{tone,soul:'lumi'}));
   const hamster=samples(trimSpeechWave(original,{tone,soul:'bori'}));
   const panda=samples(trimSpeechWave(original,{tone,soul:'mori'}));
   assert.notDeepEqual(cat,hamster);
   assert.notDeepEqual(panda,hamster);
   for(const variant of [cat,hamster,panda]){
    const m=compare(neutral,variant);
    assert.ok(m.correlation>.985&&m.rmsRatio>.85&&m.rmsRatio<1.18&&m.peak<32767);
   }
  }
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
