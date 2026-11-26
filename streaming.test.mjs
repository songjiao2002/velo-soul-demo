import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {createVoiceOpeningStream,FirstSpeechStreams} from './first-speech.mjs';
import {createVoiceSentenceReader,readVoiceReply} from './public/chat-stream.mjs';
import {relaySpeech,trimSpeechWave} from './speech-stream.mjs';
import {createChatHandler,createChatService} from './chat-service.mjs';
import {CHARACTER_REACTIONS,characterReactionAudio} from './character-reactions.mjs';
import {CloudSpeechPlayer} from './public/cloud-speech.mjs';
import {encodeWav,createMicrophoneRecognition} from './public/microphone-asr.mjs';
import {HandsFreeConversation} from './public/hands-free.mjs';
import {replyLanguage,needsCamera} from './public/input-language.mjs';
const flush=()=>new Promise(r=>setImmediate(r));
const payload={soul:'mori',language:'ko',text:'안녕, 내 말 들려?'};
const pcm=Buffer.alloc(4800);for(let i=0;i<2400;i++)pcm.writeInt16LE(i%2?1000:-1000,i*2);
const wav=Buffer.from(encodeWav([new Float32Array(2400).fill(.1)],16000));wav.writeUInt32LE(24000,24);wav.writeUInt32LE(48000,28);
const sse=audio=>'data: '+JSON.stringify({output:{audio:{data:audio.toString('base64')}}})+'\n\n';
const done='data: {"output":{"finish_reason":"stop"}}\n\n';
const response=chunks=>new Response(chunks.join(''),{headers:{'Content-Type':'text/event-stream'}});
function speechAfterQuiet(quietMs){
 const quiet=Buffer.alloc(quietMs*48);
 for(let i=0;i<quiet.length;i+=2)quiet.writeInt16LE(i%4?3:-3,i);
 const audio=Buffer.concat([quiet,pcm,Buffer.alloc(240*48),pcm,Buffer.alloc(100)]);
 audio.writeInt16LE(-256,quiet.length);
 const header=Buffer.from(wav.subarray(0,44));
 header.writeUInt32LE(audio.length+36,4);
 header.writeUInt32LE(audio.length,40);
 return Buffer.concat([header,audio]);
}
const frameAudio=frames=>Buffer.concat(frames.filter(f=>f.audio).map(f=>Buffer.from(f.audio,'base64')));

const chatDelta=content=>'data: '+JSON.stringify({choices:[{delta:{content}}]})+'\n\n';
const chatStop='data: {"choices":[{"finish_reason":"stop"}]}\n\n';
function deferred(){
 let resolve;
 const promise=new Promise(r=>{resolve=r;});
 return {promise,resolve};
}
const reactionPrompts={
 en:{summit:'I finally made it up that hill!',boundary:"I'm a bit annoyed, please don't ask why."},
 ko:{summit:'나 드디어 정상에 올라왔어!',boundary:'오늘 좀 짜증 나, 이유는 묻지 마.'},
 zh:{summit:'我终于骑上来了！',boundary:'今天有点烦，不想说原因。'}
};

test('each recorded emotional reply reaches existing voice readers as one complete sentence and both speech routes serve that recording',async t=>{
 let paid=0;
 const handler=createChatHandler({env:{DASHSCOPE_API_KEY:'fixture',QWEN_CONVERSATION_MAX_DAILY_REQUESTS:'0'},fetchImpl:()=>{paid++;throw Error('unexpected cloud call');}});
 const server=http.createServer(handler);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
 const origin='http://127.0.0.1:'+server.address().port;
 const post=(path,data)=>fetch(origin+path,{method:'POST',headers:{origin,'content-type':'application/json',accept:'application/x-ndjson'},body:JSON.stringify(data)});
 for(const [i,row] of CHARACTER_REACTIONS.entries()){
  const {soul,language,intent,text}=row,id=randomUUID();
  const ids=i%3===0?{firstSpeechId:id}:i%3===1?{voiceTurnId:id}:{firstSpeechId:id,voiceTurnId:id};
  const message={role:'user',content:reactionPrompts[language][intent]};
  const response=await post('/api/chat',{soul,language,voice:true,...ids,messages:[message]});
  assert.equal(response.status,200,`${soul} ${language} ${intent}`);
  const segments=[];
  const reply=await readVoiceReply(response,{soul,onText:()=>{},onSentence:line=>segments.push(line),joinReactions:Boolean(ids.voiceTurnId)});
  assert.deepEqual(segments,[text]);assert.equal(reply.reply,text);
  assert.equal(reply.provider,'VELO SOUL');assert.equal(reply.truncated,false);
  const wavBytes=characterReactionAudio(row);
  const stream=await post('/api/speech/stream',{soul,language,text,...ids});
  assert.equal(stream.status,200);
  const frames=(await stream.text()).trim().split('\n').map(JSON.parse);
  assert.deepEqual(frames.at(-1),{done:true});assert.deepEqual(frameAudio(frames),wavBytes.subarray(44));
  const wave=await post('/api/speech',{soul,language,text,voiceTurnId:id});
  assert.equal(wave.status,200);assert.deepEqual(Buffer.from(await wave.arrayBuffer()),wavBytes);
 }
 assert.equal(paid,0);
});

test('recordings require the exact turn, role, language and line; personal history and repeated disclosures reach the live model',async()=>{
 let time=500,calls=0;
 const service=createChatService({env:{DASHSCOPE_API_KEY:'fixture'},now:()=>time,fetchImpl:async(url)=>{
  calls++;
  return url.endsWith('/chat/completions')?Response.json({choices:[{message:{content:'I remember what you said.'},finish_reason:'stop'}]}):response([sse(wav),done]);
 }});
 const voiceTurnId=randomUUID(),base={soul:'mori',language:'en',voiceTurnId},user={role:'user',content:reactionPrompts.en.summit};
 const turn={...base,voice:true,messages:[user]},reply=await service.reply(turn);
 assert.equal(reply.provider,'VELO SOUL');assert.equal(calls,0);
 const text=reply.reply,opts={emit:()=>{}};
 for(const patch of [{voiceTurnId:undefined},{voiceTurnId:randomUUID()},{firstSpeechId:randomUUID()},{language:'ko'},{soul:'bori'},{text:text+'!'}]){
  const before=calls;
  await service.speechStream({...base,text,...patch},opts);assert.equal(calls,before+1);
 }
 const repeats={...turn,messages:[user,{role:'assistant',content:text},user]};
 await assert.rejects(service.reply(repeats),{code:'invalid_request',status:409});
 for(const request of [repeats,{...turn,messages:[{...user,content:user.content+' My sister came with me.'}]},
  {...turn,context:{deviceMemory:{soul:turn.soul,visits:2,lastSeen:time,exchanges:[{user:'My nickname is Jo.',reply:'Hi Jo.',at:time}]}}}]){
  const live=await service.reply({...request,voiceTurnId:randomUUID()});assert.equal(live.provider,'Qwen');
 }
 time+=5*60000;const prior=calls;
 await service.speechStream({...base,text},opts);assert.equal(calls,prior+1);
});

test('an aborted recorded turn revokes its claim and a concurrent chat cannot take it over',async()=>{
 let paid=0;
 const service=createChatService({env:{DASHSCOPE_API_KEY:'fixture'},fetchImpl:async()=>{paid++;return response([sse(wav),done]);}});
 const id=randomUUID(),turn={voice:true,soul:'mori',language:'en',voiceTurnId:id,messages:[{role:'user',content:reactionPrompts.en.summit}]};
 const started=deferred(),release=deferred(),controller=new AbortController();
 const pending=service.reply(turn,{signal:controller.signal,onDelta:async text=>{started.resolve(text);await release.promise;}});
 const text=await started.promise;
 await assert.rejects(service.reply({...turn,soul:'lumi'}),{code:'invalid_request',status:409});
 controller.abort();release.resolve();
 await assert.rejects(pending,{code:'cancelled'});assert.equal(paid,0);
 await service.speechStream({voiceTurnId:id,soul:'mori',language:'en',text},{emit:()=>{}});assert.equal(paid,1);
});
async function firstSpeechFixture(t,{text='Breezy! ',deferChat=false,ttsFailure=false,env={}}={}){
 const first=deferred(),endChat=deferred(),endTts=deferred(),receivedWave=deferred(),calls=[];
 const handler=createChatHandler({env:{DASHSCOPE_API_KEY:'fixture',...env},fetchImpl:async(url,options)=>{
  if(url.endsWith('/chat/completions')){
   const body=new ReadableStream({start(controller){
    const send=value=>controller.enqueue(Buffer.from(value));
    for(const part of Array.isArray(text)?text:[text])send(chatDelta(part));
    const finish=()=>{send(chatStop);controller.close();};
    if(deferChat)endChat.promise.then(finish);else finish();
   }});
   return new Response(body,{headers:{'Content-Type':'text/event-stream'}});
  }
  const request=JSON.parse(options.body);
  calls.push(request.input.text);first.resolve(options.signal);
  if(ttsFailure)return Response.json({error:{code:'Arrearage'}},{status:429});
  assert.equal(options.headers['X-DashScope-SSE'],'enable');
  return new Response(new ReadableStream({start(controller){
   options.signal.addEventListener('abort',()=>{try{controller.error(options.signal.reason);}catch{}},{once:true});
   controller.enqueue(Buffer.from(sse(wav)));
   endTts.promise.then(()=>{try{controller.enqueue(Buffer.from(done));controller.close();}catch{}});
  }}),{headers:{'Content-Type':'text/event-stream'}});
 }});
 const server=http.createServer((req,res)=>{
  if(req.url==='/api/speech')req.once('end',receivedWave.resolve);
  return handler(req,res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>{endChat.resolve();endTts.resolve();return new Promise(r=>{server.close(r);server.closeAllConnections();});});
 const base='http://127.0.0.1:'+server.address().port;
 const post=(path,body,signal)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/x-ndjson',Origin:base},body:JSON.stringify(body),signal});
 const chat=(firstSpeechId,language='en',soul='bori',signal)=>post('/api/chat',{firstSpeechId,voice:true,soul,language,messages:[{role:'user',content:'Hello'}]},signal);
 return {first,endChat,endTts,receivedWave,calls,chat,post};
}

function observeOpening(soul,language,settings,voiceTurnId){
 const deltas=[],phrases=[];let subtitle='';
 const reader=createVoiceSentenceReader(soul,p=>phrases.push(p));
 const stream=createVoiceOpeningStream({soul,language,voiceTurnId},delta=>{
  deltas.push(delta);subtitle+=delta;reader(subtitle);
 },settings);
 return {stream,deltas,phrases,finish:async()=>{await stream.finish();reader(subtitle,true);stream.stop();}};
}

test('an unrecorded opening is visible immediately and the shipped reader receives the whole first sentence',async()=>{
 for(const [language,parts,first] of [
  ['en',['Y','eah',',',' take',' it',' easy','.'],'Yeah, take it easy.'],
  ['en',['Yeah',' ','take it easy.',' Next'],'Yeah take it easy.'],
  ['ko',['그','래',',',' 천천히',' 가자','.'],'그래, 천천히 가자.'],
  ['zh',['好','呀','，','一起','出发','。'],'好呀，一起出发。'],
  ['zh',['哎，','看看','那只鸟','！'],'哎，看看那只鸟！'],
 ]){
  const t=observeOpening('mori',language);
  await t.stream.push(parts[0]);
  assert.ok(t.deltas[0].trim());
  assert.deepEqual(t.phrases,[]);
  for(const part of parts.slice(1))await t.stream.push(part);
  await t.finish();
  assert.equal(t.deltas.join('').trim(),parts.join('').trim());
  assert.equal(t.phrases[0],first);
 }
});

test('a turn with its own delivery speaks the emotional opener and its thought together',async()=>{
 const t=observeOpening('mori','zh',undefined,randomUUID());
 for(const part of ['嗯','，','我也','替你高兴','。'])await t.stream.push(part);
 await t.finish();
 assert.deepEqual(t.phrases,['嗯，我也替你高兴。']);
});

test('surprise and the first substantive thought share one clip without changing the spoken wording',()=>{
 for(const [opening,thought] of [['Really?',' That blue is lovely!'],['真的吗？','我喜欢那个颜色。'],['정말로요?',' 그 색이 참 좋아요!']]){
  const phrases=[],read=createVoiceSentenceReader('bori',part=>phrases.push(part),{joinReactions:true});
  read(opening);
  assert.deepEqual(phrases,[]);
  read(opening+thought);
  assert.deepEqual(phrases,[opening+thought]);
  const single=[],standalone=createVoiceSentenceReader('bori',part=>single.push(part),{joinReactions:true});
  standalone(opening,true);assert.deepEqual(single,[opening]);
 }
});

test('English, Korean and Chinese compound acknowledgments share one utterance with the actual answer',async()=>{
 for(const [language,full] of [
  ['en','Sure thing—take it easy.'],['en','Of course, we can slow down!'],
  ['ko','그럼 당연하지, 천천히 가자.'],['zh','当然可以，我们慢点骑。']
 ]){
  for(const soul of ['lumi','mori','bori']){
   const t=observeOpening(soul,language);
   for(const part of Array.from(full))await t.stream.push(part);
   await t.finish();
   assert.equal(t.deltas[0],Array.from(full)[0]);
   assert.equal(t.deltas.join('').trim(),full);
   assert.deepEqual(t.phrases,[full],soul+' '+full);
  }
 }
});

test('a standalone compound answer finishes immediately, and an ordinary word sharing the prefix stays intact',async()=>{
 for(const [language,full] of [['en','Sure thing.'],['ko','그럼 당연하지!'],['zh','没问题。']]){
  const t=observeOpening('mori',language,{setTimer:()=>1,clearTimer:()=>{}});
  for(const part of Array.from(full))await t.stream.push(part);
  await t.finish();
  assert.equal(t.deltas.join('').trim(),full);
  assert.deepEqual(t.phrases,[full]);
 }
 const normal=observeOpening('bori','en');
 for(const part of ['A ','sure thing—','for me.'])await normal.stream.push(part);
 assert.deepEqual(normal.deltas,['A ','sure thing—','for me.']);
 const almost=observeOpening('bori','en');
 for(const part of ['Sure',' ','thing','s are tricky.'])await almost.stream.push(part);
 assert.deepEqual(almost.deltas,['Sure',' ','thing','s are tricky.']);
});

test('a slow compound continuation respects the wait window and flushes the exact remaining stream',async()=>{
 let timer;
 const t=observeOpening('bori','en',{setTimer:fn=>{timer=fn;return 1;},clearTimer:()=>{}});
 for(const part of ['Sure',' thing','—','take'])await t.stream.push(part);
 assert.equal(t.deltas.join(''),'Sure thing');assert.deepEqual(t.phrases,[]);
 timer();await t.stream.push(' it easy.');await t.finish();
 assert.equal(t.deltas.join(''),'Sure thing—take it easy.');
 assert.deepEqual(t.phrases,['Sure thing—','take it easy.']);
});

test('ordinary starts, standalone sentences and exact recorded openings retain their original delta cadence',async()=>{
 for(const [soul,language,parts] of [
  ['mori','en',['Mm',',',' take it easy.']],['bori','en',['Oh,',' nice.']],
  ['lumi','zh',['嗯','，','我们慢慢来。']],['mori','ko',['음',',',' 천천히 가자.']],
  ['lumi','en',['Yeah',' ','we can stop.']],['mori','en',['Wind',',',' rain.']],
  ['mori','en',['Yeah','!']],['mori','en',['Yes','.',' Take your time.']]
 ]){
  const t=observeOpening(soul,language);
  for(let i=0;i<parts.length;i++){
   await t.stream.push(parts[i]);
   assert.equal(t.deltas.join(''),parts.slice(0,i+1).join(''),parts.join(''));
  }
  await t.finish();assert.equal(t.deltas.join(''),parts.join(''));
 }
});

test('opening wait has a timer and a size bound, and pending output flushes in order on provider error',async()=>{
 const fake=()=>{let fire;return {timers:{setTimer:fn=>{fire=fn;return 1;},clearTimer:()=>{fire=null;}},fire:()=>fire?.()};};
 const f=fake(),slow=observeOpening('mori','en',f.timers);
 await slow.stream.push('Yeah,');await slow.stream.push(' take');
 assert.deepEqual(slow.deltas,['Yeah']);
 f.fire();await slow.stream.push(' it easy.');
 await slow.finish();assert.deepEqual(slow.deltas,['Yeah',', take',' it easy.']);
 const big=observeOpening('mori','en',{maxChars:12});
 await big.stream.push('Yeah,');await big.stream.push(' a very long one');
 assert.deepEqual(big.deltas,['Yeah',', a very long one']);await big.finish();
 const failed=observeOpening('mori','en');
 await failed.stream.push('Yeah,');await failed.stream.push(' take');
 await failed.stream.finish(false);failed.stream.stop();
 assert.deepEqual(failed.deltas,['Yeah',', take']);
 const noPeriod=observeOpening('mori','en');
 await noPeriod.stream.push('Yeah,');await noPeriod.stream.push(' take it easy');
 await noPeriod.finish();
 assert.equal(noPeriod.deltas.join(''),'Yeah, take it easy');
 const controller=new AbortController(),c=fake(),lost=observeOpening('mori','en',{signal:controller.signal,...c.timers});
 await lost.stream.push('Yeah,');controller.abort();c.fire();await lost.finish();
 assert.deepEqual(lost.deltas,['Yeah']);
});

test('streaming chat and the shipped player claim one synthesis for observed Lulu and Popo replies', {timeout:5000},async t=>{
 for(const [soul,text] of [
  ['mori',['Yeah',',',' take',' it',' easy','.']],
  ['bori',['Sure',' thing','—','take',' it',' easy',', I’ve got your back','.']]
 ]){
  const f=await firstSpeechFixture(t,{text}),id=randomUUID();
  const response=await f.chat(id,'en',soul);
  const full=text.join(''),captions=[],sentences=[];
  const result=await readVoiceReply(response,{soul,onText:s=>captions.push(s),onSentence:s=>sentences.push(s)});
  assert.equal(result.reply,full);assert.equal(captions[0],text[0]);assert.deepEqual(sentences,[full]);
  await f.first.promise;f.endTts.resolve();
  const input={firstSpeechId:id,soul,language:'en',text:sentences[0]};
  assert.match(await (await f.post('/api/speech/stream',input)).text(),/"done":true/);
  assert.equal((await f.post('/api/speech',input)).status,409);
  assert.deepEqual(f.calls,[full]);
 }
});

test('first speech starts before the rest of the reply and live PCM is claimed exactly once', {timeout:5000},async t=>{
 const f=await firstSpeechFixture(t,{deferChat:true}),id=randomUUID();
 const pendingChat=f.chat(id),signal=await f.first.promise;
 assert.deepEqual(f.calls,['Breezy!']);assert.equal(signal.aborted,false);
 const input={firstSpeechId:id,text:'Breezy!',soul:'bori',language:'en'};
 const pending=await f.post('/api/speech/stream',input);
 const reader=pending.body.getReader();
 const first=JSON.parse(new TextDecoder().decode((await reader.read()).value).trim());
 assert.equal(first.audio,wav.subarray(44).toString('base64'));
 assert.equal((await f.post('/api/speech/stream',input)).status,409);
 f.endTts.resolve();f.endChat.resolve();
 assert.match(new TextDecoder().decode((await reader.read()).value),/"done":true/);
 assert.match(await (await pendingChat).text(),/complete/);
 assert.equal((await f.post('/api/speech',input)).status,409);
 assert.deepEqual(f.calls,['Breezy!']);
});

test('Android can claim the actual final phrase as one exact WAV, never starting another synthesis', {timeout:5000},async t=>{
 const f=await firstSpeechFixture(t,{text:'山'}),id=randomUUID();
 const chat=await f.chat(id,'zh','lumi');
 assert.match(await chat.text(),/complete/);
 await f.first.promise;f.endTts.resolve();
 const input={firstSpeechId:id,soul:'lumi',language:'zh',text:'山'};
 const r=await f.post('/api/speech',input);
 assert.equal(r.headers.get('content-type'),'audio/wav');assert.deepEqual(Buffer.from(await r.arrayBuffer()),wav);
 assert.equal((await f.post('/api/speech/stream',input)).status,409);assert.deepEqual(f.calls,['山']);
});

test('an opted-in first phrase reports a real provider quota error once on either endpoint', {timeout:5000},async t=>{
 for(const path of ['/api/speech','/api/speech/stream']){
  const f=await firstSpeechFixture(t,{ttsFailure:true}),id=randomUUID();
  await (await f.chat(id)).text();await f.first.promise;
  const r=await f.post(path,{firstSpeechId:id,text:'Breezy!',soul:'bori',language:'en'});
  assert.equal(r.status,429);assert.deepEqual(await r.json(),{error:'provider_quota'});assert.equal(f.calls.length,1);
 }
});

test('aborting an Android WAV download cancels upstream audio before EOF and frees the shared slot', {timeout:5000},async t=>{
 const f=await firstSpeechFixture(t,{env:{QWEN_MAX_CONCURRENT_REQUESTS:'2'}}),id=randomUUID();
 await (await f.chat(id)).text();
 const upstream=await f.first.promise,input={firstSpeechId:id,soul:'bori',language:'en',text:'Breezy!'};
 const controller=new AbortController();
 const download=f.post('/api/speech',input,controller.signal);
 await f.receivedWave.promise;
 assert.equal((await f.post('/api/speech/stream',input)).status,409);
 controller.abort();await assert.rejects(download);
 if(!upstream.aborted)await new Promise(resolve=>upstream.addEventListener('abort',resolve,{once:true}));
 assert.equal((await f.post('/api/speech/stream',input)).status,409);
 const next=randomUUID();
 await (await f.chat(next)).text();
 f.endTts.resolve();
 assert.equal((await f.post('/api/speech',{...input,firstSpeechId:next})).status,200);
 assert.deepEqual(f.calls,['Breezy!','Breezy!']);
});

test('offline openings, older clients, malformed IDs and occupied shared slots leave normal synthesis available', {timeout:5000},async t=>{
 for(const [id,text,env] of [[undefined,'Swift!',{}],['not-a-uuid','Swift!',{}],[randomUUID(),'Oh,',{}],[randomUUID(),'Swift!',{QWEN_MAX_CONCURRENT_REQUESTS:'1'}]]){
  const f=await firstSpeechFixture(t,{text,env});
  await (await f.chat(id)).text();
  assert.equal(f.calls.length,0);
  const normal=f.post('/api/speech/stream',{firstSpeechId:id,soul:'bori',language:'en',text});
  await f.first.promise;f.endTts.resolve();
  assert.match(await (await normal).text(),/"done":true/);assert.deepEqual(f.calls,[text]);
 }
});

test('a first-speech claim binds the exact role, language and full text, and orphans release capacity',async()=>{
 const timers=new Map();let tick=0,upstream;
 const registry=new FirstSpeechStreams(async(_input,{signal,emit})=>{
  upstream=signal;await emit({audio:'AQI=',rate:24000});await emit({done:true});
 },{maxEntries:1,setTimer:fn=>{timers.set(++tick,fn);return tick;},clearTimer:id=>timers.delete(id)});
 const id=randomUUID(),chat=new AbortController(),stream=new AbortController();
 const options={signal:stream.signal,emit:()=>{}};
 assert.ok(registry.start(id,payload,chat.signal));
 for(const different of [{soul:'lumi'},{language:'zh'},{text:payload.text+' '}]){
  assert.equal(await registry.deliver(id,{...payload,...different},options),'missing');
 }
 assert.equal(registry.start(randomUUID(),payload,chat.signal),undefined);
 timers.get(1)();
 assert.ok(upstream.aborted);assert.equal(await registry.deliver(id,payload,options),'missing');
 assert.ok(registry.start(randomUUID(),payload,chat.signal));chat.abort();assert.ok(upstream.aborted);
});

test('disconnecting or timing out a backpressured claimant aborts synthesis and releases its reader', {timeout:3000},async()=>{
 for(const cancellation of ['client','deadline','chat']){
  const entered=deferred(),released=deferred(),timers=new Map();let tick=0;
  const registry=new FirstSpeechStreams(async(input,{signal,emit})=>{
   try{
    const frame={audio:'A'.repeat(65536),rate:24000};
    for(let i=0;i<4;i++)await emit(frame);
   }finally{released.resolve(signal);}
  },{setTimer:fn=>{timers.set(++tick,fn);return tick;},clearTimer:id=>timers.delete(id)});
  const id=randomUUID(),chat=new AbortController(),client=new AbortController();
  registry.start(id,payload,chat.signal);
  const serving=registry.deliver(id,payload,{signal:client.signal,emit:async(frame,signal)=>{
   entered.resolve();
   await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
  }});
  await entered.promise;
  if(cancellation==='client')client.abort();else if(cancellation==='chat')chat.abort();else timers.get(2)();
  await assert.rejects(serving);assert.ok((await released.promise).aborted);
  assert.equal(await registry.deliver(id,payload,{signal:new AbortController().signal,emit:()=>{}}),'used');
 }
});

test('an exact public acknowledgement replays complete identical audio without another synthesis',async()=>{
 const clip=speechAfterQuiet(220),url='https://dashscope-result-sgp.oss-ap-southeast-1.aliyuncs.com/ack.wav';
 let synthesis=0,downloads=0;
 const service=createChatService({env:{DASHSCOPE_API_KEY:'fixture'},fetchImpl:async(path,options)=>{
  if(path===url){downloads++;return new Response(clip);}
  synthesis++;
  return options.headers['X-DashScope-SSE']?response([sse(clip.subarray(0,153)),sse(clip.subarray(153)),done]):Response.json({output:{audio:{url}}});
 }});
 for(const [soul,text,language] of [['lumi','Oh,','en'],['mori','嗯，','zh'],['bori','응,','ko']]){
  const input={soul,text,language},before=synthesis;
  const cold=[],hot=[];
  await service.speechStream(input,{emit:f=>cold.push(f)});
  await service.speechStream(input,{emit:f=>hot.push(f)});
  assert.equal(synthesis,before+1);assert.deepEqual(frameAudio(cold),frameAudio(hot));
  assert.deepEqual(hot.at(-1),{done:true});
  const wavCold=await service.speech(input),waveSnapshot=Buffer.from(wavCold);
  wavCold.fill(0);
  const wavHot=await service.speech(input);
  assert.equal(synthesis,before+2);assert.deepEqual(wavHot,waveSnapshot);assert.deepEqual(wavHot.subarray(44),frameAudio(hot));
 }
 assert.equal(downloads,3);
});

test('short speech cache keys respect exact inputs, voice configuration and fixed TTL; arbitrary text is never stored',async()=>{
 let calls=0,now=0;
 const env={DASHSCOPE_API_KEY:'fixture'};
 const service=createChatService({env,now:()=>now,fetchImpl:async()=>{calls++;return response([sse(pcm),done]);}});
 const say=(text,soul='lumi',language='en')=>service.speechStream({text,soul,language},{emit:()=>{}});
 await say('Okay.');await say('Okay.');assert.equal(calls,1);
 await say('Okay,');await say('Okay.','bori');await say('Okay.','lumi','zh');assert.equal(calls,4);
 env.QWEN_TTS_MODEL='another-voice-model';await say('Okay.');assert.equal(calls,5);
 await say('home address 32');await say('home address 32');
 await say(' Okay.');await say(' Okay.');assert.equal(calls,9);
 now+=5*60000;await say('Okay.');assert.equal(calls,10);
});

test('cached clip replays remain available when an explicit cloud budget is exhausted',async()=>{
 let calls=0,broken=true;
 const service=createChatService({env:{DASHSCOPE_API_KEY:'fixture',QWEN_CONVERSATION_MAX_DAILY_REQUESTS:'3'},now:()=>0,fetchImpl:async()=>{
  calls++;return response(broken?[sse(pcm)]:[sse(pcm),done]);
 }});
 const input={soul:'mori',language:'en',text:'Mm,'};
 await assert.rejects(service.speechStream(input,{emit:()=>{}}));
 broken=false;const controller=new AbortController();
 const cancelled=service.speechStream(input,{signal:controller.signal,emit:f=>{if(f.audio)controller.abort();}});
 await assert.rejects(cancelled,{code:'cancelled'});
 assert.equal(calls,2);
 await service.speechStream(input,{emit:()=>{}});assert.equal(calls,3);
 for(let n=0;n<125;n++)await service.speechStream(input,{emit:()=>{}});
 await assert.rejects(service.speechStream({...input,text:'private phrase'},{emit:()=>{}}),{code:'daily_limit'});
 assert.equal(calls,3);
});

test('all three companions keep listening, answering and speaking past the legacy deployment limits of 200 per day and 60 per minute',async()=>{
 let providerCalls=0;
 const service=createChatService({env:{DASHSCOPE_API_KEY:'fixture',QWEN_MAX_DAILY_REQUESTS:'200',QWEN_MAX_REQUESTS_PER_MINUTE:'60'},now:()=>0,fetchImpl:async(url)=>{
  providerCalls++;
  return url.endsWith('/chat/completions')?Response.json({choices:[{message:{content:'Let’s ride.'}}]}):response([sse(pcm),done]);
 }});
 for(let turn=0;turn<204;turn++){
  const soul=['lumi','mori','bori'][turn%3],language=['en','ko','zh'][Math.floor(turn/3)%3];
  const releaseAsr=service.reserveRealtime();releaseAsr();
  await service.reply({soul,language,voice:true,messages:[{role:'user',content:'Ready?'}]});
  await Promise.all(['First phrase.','Next phrase.'].map(text=>service.speechStream({soul,language,text},{emit:()=>{}})));
 }
 assert.equal(providerCalls,612);
 assert.deepEqual(service.status().conversationLimits,{dailyRequests:null,requestsPerMinute:null,maxConcurrentRequests:8});
});

test('Lulu streams the first audible sample as soon as both PCM bytes arrive and preserves all following pauses',async()=>{
 const wave=speechAfterQuiet(300);
 const onset=44+300*48,retained=onset-80*48;
 let producer;const frames=[];
 const body=new ReadableStream({start(controller){producer=controller;}});
 const running=relaySpeech(new Response(body,{headers:{'Content-Type':'text/event-stream'}}),f=>frames.push(f),{trimPadding:true});
 const send=part=>producer.enqueue(new TextEncoder().encode(sse(part)));
 send(wave.subarray(0,9));
 send(wave.subarray(9,onset+1));
 await flush();
 assert.deepEqual(frames,[],'a single low byte cannot establish an audible signed sample');
 send(wave.subarray(onset+1,onset+2));
 await flush();
 assert.deepEqual(frameAudio(frames),wave.subarray(retained,onset+2),'the first sound arrives before the provider finishes generating');
 send(wave.subarray(onset+2,onset+9));
 send(wave.subarray(onset+9));
 producer.enqueue(new TextEncoder().encode(done));
 producer.close();await running;
 assert.deepEqual(frameAudio(frames),wave.subarray(retained));
 assert.deepEqual(frames.at(-1),{done:true});
});

test('short silence is preserved at EOF and very long silence can only lose the bounded prefix',async()=>{
 const silent=Buffer.alloc(100*48);
 const frames=[];
 await relaySpeech(response([sse(silent),done]),f=>frames.push(f),{trimPadding:true});
 assert.deepEqual(frameAudio(frames),silent);
 for(const [beforeMs,removedMs] of [[50,0],[800,640]]){
  const wave=speechAfterQuiet(beforeMs);
  const out=[];
  await relaySpeech(response([sse(wave),done]),f=>out.push(f),{trimPadding:true});
  assert.deepEqual(frameAudio(out),wave.subarray(44+removedMs*48));
  assert.deepEqual(trimSpeechWave(wave).subarray(44),frameAudio(out));
 }
});

test('all three characters trim outside padding in PCM and whole WAV with exact RIFF and data lengths',async()=>{
 const wave=speechAfterQuiet(240),original=Buffer.from(wave);
 const url='https://dashscope-result-sgp.oss-ap-southeast-1.aliyuncs.com/file.wav';
 const service=createChatService({env:{DASHSCOPE_API_KEY:'fixture'},fetchImpl:async(input,{headers})=>{
  if(input===url)return new Response(wave);
  if(headers['X-DashScope-SSE'])return response([sse(wave),done]);
  return Response.json({output:{audio:{url}}});
 }});
 for(const soul of ['lumi','mori','bori']){
  const voice={...payload,soul},frames=[];
  await service.speechStream(voice,{emit:f=>frames.push(f)});
  const file=await service.speech(voice);
  const expected=wave.subarray(44+160*48);
  assert.deepEqual(frameAudio(frames),expected,soul);
  assert.equal(file.readUInt32LE(4),file.length-8);
  assert.equal(file.readUInt32LE(40),expected.length);
  assert.deepEqual(file.subarray(8,40),wave.subarray(8,40));
  assert.deepEqual(file.subarray(44),expected,soul);
 }
 assert.deepEqual(wave,original);
});

test('near-silence trimming leaves non-PCM, unsupported, truncated, and nonterminal WAV data untouched',()=>{
 const valid=speechAfterQuiet(240);
 const unchanged=(file,reason)=>{
  const original=Buffer.from(file);
  assert.deepEqual(trimSpeechWave(file),original,reason);
  assert.deepEqual(file,original,reason);
 };
 for(const [name,mutate] of [
  ['non-RIFF signature',b=>b.write('RIFX',0)],
  ['non-WAVE form',b=>b.write('NOPE',8)],
  ['RIFF length',b=>b.writeUInt32LE(b.length-7,4)],
  ['data length',b=>b.writeUInt32LE(b.length-43,40)],
  ['non-PCM encoding',b=>b.writeUInt16LE(3,20)],
  ['stereo',b=>b.writeUInt16LE(2,22)],
  ['sample rate',b=>b.writeUInt32LE(48000,24)],
  ['byte rate',b=>b.writeUInt32LE(96000,28)],
  ['block alignment',b=>b.writeUInt16LE(4,32)],
  ['precision',b=>b.writeUInt16LE(8,34)]
 ]){
  const file=Buffer.from(valid);mutate(file);
  unchanged(file,name);
 }
 const odd=valid.subarray(0,-1);
 odd.writeUInt32LE(odd.length-8,4);odd.writeUInt32LE(odd.length-44,40);
 unchanged(odd,'incomplete sample');
 const metadata=Buffer.concat([speechAfterQuiet(240),Buffer.from('JUNK\x00\x00\x00\x00','latin1')]);
 metadata.writeUInt32LE(metadata.length-8,4);
 unchanged(metadata,'post-audio chunks may contain offsets into the audio');
});

test('Qwen download length sentinels match only the known pair and a terminal even-sized PCM body',()=>{
 const fixed=speechAfterQuiet(310),provider=Buffer.from(fixed);
 provider.writeUInt32LE(0x7fffffbf,4);provider.writeUInt32LE(0x7fffff9b,40);
 assert.deepEqual(trimSpeechWave(provider),trimSpeechWave(fixed));
 for(const [offset,value] of [[4,0xffffffff],[40,0xffffffff],[4,fixed.length-8],[40,fixed.length-44],[32,1]]){
  const malformed=Buffer.from(provider);
  if(offset===32)malformed.writeUInt16LE(value,offset);else malformed.writeUInt32LE(value,offset);
  assert.equal(trimSpeechWave(malformed),malformed);
 }
 const odd=provider.subarray(0,-1);
 assert.equal(trimSpeechWave(odd),odd);
 const metadata=Buffer.concat([provider,Buffer.from('JUNK\x04\0\0\0test','latin1')]);
 assert.equal(trimSpeechWave(metadata),metadata);
});

test('split chunks immediately deliver faint breaths and preserve a long interior pause byte-for-byte',async()=>{
 const padding=ms=>Buffer.alloc(ms*48,0);
 const breath=Buffer.from([16,0,239,255]); // 16, -17: both below the previous onset threshold
 const start=padding(450),between=padding(1950),end=padding(410);
 // Keep quantization noise in the preserved margins and the interior.
 for(const part of [start,between,end])for(let i=0;i<part.length;i+=2)part.writeInt16LE((i/2)%13-6,i);
 const wave=Buffer.concat([wav.subarray(0,44),start,breath,between,breath,end]);
 wave.writeUInt32LE(wave.length-8,4);wave.writeUInt32LE(wave.length-44,40);
 const expected=wave.subarray(44+(450-80)*48,wave.length-(410-150)*48);
 assert.deepEqual(trimSpeechWave(wave).subarray(44),expected);
 let producer;const frames=[];
 const body=new ReadableStream({start(c){producer=c;}});
 const run=relaySpeech(new Response(body,{headers:{'Content-Type':'text/event-stream'}}),f=>frames.push(f),{trimPadding:true});
 const send=data=>producer.enqueue(Buffer.from(sse(data)));
 send(wave.subarray(0,44+start.length+1));await flush();assert.equal(frames.length,0);
 send(wave.subarray(44+start.length+1,44+start.length+2));await flush();
 assert.deepEqual(frameAudio(frames),Buffer.concat([start.subarray(-80*48),breath.subarray(0,2)]));
 let pos=44+start.length+2;
 while(pos<wave.length){const stop=Math.min(pos+1001,wave.length);send(wave.subarray(pos,stop));pos=stop;}
 producer.enqueue(Buffer.from(done));producer.close();await run;
 assert.deepEqual(frameAudio(frames),expected);
 assert.deepEqual(frames.at(-1),{done:true});
 const unfinished=wave.subarray(0,-1);
 await assert.rejects(relaySpeech(response([sse(unfinished),done]),()=>{},{trimPadding:true}),/invalid_audio/);
});

test('streaming and WAV preserve natural short tails and bound trimming on extended final silence',async()=>{
 for(const trailingMs of [50,150,410,900,1750]){
  const sample=Buffer.concat([pcm,Buffer.alloc(trailingMs*48)]);
  const wave=Buffer.concat([wav.subarray(0,44),sample]);
  wave.writeUInt32LE(wave.length-8,4);wave.writeUInt32LE(sample.length,40);
  const expected=sample.subarray(0,sample.length-Math.min(720,Math.max(0,trailingMs-150))*48);
  assert.deepEqual(trimSpeechWave(wave).subarray(44),expected);
  const frames=[];
  await relaySpeech(response([sse(wave.subarray(0,13001)),sse(wave.subarray(13001)),done]),f=>frames.push(f),{trimPadding:true});
  assert.deepEqual(frameAudio(frames),expected);
 }
});
test('SSE relay strips split WAV headers, preserves PCM, and requires provider completion',async()=>{
 const frames=[];await relaySpeech(response([sse(wav.subarray(0,20)),sse(wav.subarray(20,40)),sse(wav.subarray(40)),done]),f=>frames.push(f));
 assert.deepEqual(Buffer.concat(frames.filter(f=>f.audio).map(f=>Buffer.from(f.audio,'base64'))),wav.subarray(44));assert.deepEqual(frames.at(-1),{done:true});
 await assert.rejects(relaySpeech(response([sse(pcm)]),()=>{}),/incomplete/);
 const stereo=Buffer.from(wav);stereo.writeUInt16LE(2,22);await assert.rejects(relaySpeech(response([sse(stereo),done]),()=>{}),/invalid_audio/);
 await assert.rejects(relaySpeech(response(['data: {"code":"secret-provider-error"}\n']),()=>{}));
});
test('stream HTTP sends the first audio before upstream completion, keeps Korean voice and applies quota/origin checks',async t=>{
 let upstream,request;const handler=createChatHandler({env:{DASHSCOPE_API_KEY:'private',QWEN_CONVERSATION_MAX_DAILY_REQUESTS:'1'},fetchImpl:async(_,options)=>{
  request=JSON.parse(options.body);assert.equal(options.headers['X-DashScope-SSE'],'enable');return new Response(new ReadableStream({start(c){upstream=c;}}),{headers:{'Content-Type':'text/event-stream'}});
 }});
 const server=http.createServer(async(req,res)=>{if(!await handler(req,res))res.end();});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));const base='http://127.0.0.1:'+server.address().port;
 const post=origin=>fetch(base+'/api/speech/stream',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin||base},body:JSON.stringify(payload)});
 assert.equal((await post('https://elsewhere.example')).status,403);const pending=post();while(!upstream)await flush();upstream.enqueue(new TextEncoder().encode(sse(wav)));
 const r=await pending;assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'application/x-ndjson');const reader=r.body.getReader();const first=new TextDecoder().decode((await reader.read()).value);assert.match(first,/"audio"/);assert.ok(!first.includes('private'));assert.deepEqual(request.input,{text:payload.text,voice:'qwen-audio-3.1-tts-flash-pandako-9a5d436c173c4bd8ac8b7f7b5a00462d',format:'wav',sample_rate:24000,instruction:'Speak in Korean. Use the same adult male speaker identity as the reference, with a warm low male register and natural Korean pronunciation. Warm, relaxed animated panda voice, preserving the cloned speaker. Start speaking promptly. Keep words clear at a conversational pace; gently stretch only the final vowel of occasional phrases by about 200–300 ms, with a small pitch rise then fall and a subtle sleepy throat rumble. No added words, opening sighs, or long pauses.'});
 upstream.enqueue(new TextEncoder().encode(done));upstream.close();let rest='';while(true){const next=await reader.read();if(next.done)break;rest+=new TextDecoder().decode(next.value);}assert.match(rest,/"done":true/);assert.equal((await post()).status,429);
});
function player(){
 const sources=[],timers=new Map();let clock=0,stream;class Context{constructor(){this.state='running';this.sampleRate=24000;this.currentTime=1;this.destination={};}resume(){return Promise.resolve();}close(){return Promise.resolve();}createBuffer(c,n,rate){return {duration:n/rate,getChannelData:()=>new Float32Array(n)};}createBufferSource(){const node={playbackRate:{value:1},connect(){},disconnect(){},start(at){this.at=at;},stop(){this.stopped=true;}};sources.push(node);return node;}}
 const p=new CloudSpeechPlayer({Context,fetchImpl:async()=>new Response(new ReadableStream({start(c){stream=c;}}),{headers:{'Content-Type':'application/x-ndjson'}}),setTimer:(fn,ms)=>{timers.set(++clock,{fn,ms});return clock;},clearTimer:id=>timers.delete(id)});
 const send=data=>stream.enqueue(new TextEncoder().encode(JSON.stringify(data)+'\n'));
 return {p,sources,timers,send,close:()=>stream.close()};
}
test('browser starts PCM before stream ends and resumes only after the last scheduled sound',async()=>{
 const a=player(),states=[];await a.p.prepare();const speaking=a.p.speak(payload.text,{soul:'mori',language:'ko',onState:s=>states.push(s)});await flush();
 // Odd byte boundaries must not drop half a sample.
 a.send({audio:pcm.subarray(0,2401).toString('base64'),rate:24000});await flush();assert.deepEqual(states,['loading','playing']);const first=a.sources.at(-1);
 a.send({audio:pcm.subarray(2401).toString('base64'),rate:24000});a.send({done:true});a.close();await flush();const last=a.sources.at(-1);assert.equal(last.at,first.at+first.buffer.duration/.94);assert.notEqual(last,first);assert.equal(states.at(-1),'playing');first.onended();last.onended();await speaking;assert.equal(states.at(-1),'ended');assert.equal(a.timers.size,0);a.p.dispose();
});
test('interrupt stops all queued PCM; a truncated stream cannot report success',async()=>{
 for(const cancel of [true,false]){const a=player(),states=[];await a.p.prepare();const speaking=a.p.speak('Hello',{onState:s=>states.push(s)});await flush();a.send({audio:pcm.toString('base64'),rate:24000});a.send({audio:pcm.toString('base64'),rate:24000});await flush();const queued=a.sources.slice(1);if(cancel)a.p.stop();else a.close();await speaking;assert.ok(queued.every(s=>s.stopped));assert.ok(!states.includes('ended'));if(!cancel)assert.equal(states.at(-1),'unavailable');assert.equal(a.timers.size,0);a.p.dispose();}
});
test('a quota error after real PCM is scheduled preserves the limit and never caches the truncated phrase',async()=>{
 const a=player(),events=[];await a.p.prepare();
 const speaking=a.p.speak('Hello',{onState:(s,e)=>events.push([s,e?.retryAfter])});await flush();
 a.send({audio:pcm.toString('base64'),rate:24000});await flush();
 a.send({error:'provider_rate_limited',retryAfter:9});await speaking;
 assert.deepEqual(events,[['loading',undefined],['playing',undefined],['provider_rate_limited',9]]);
 assert.equal(a.sources.at(-1).stopped,true);assert.equal(a.p.cache.has(JSON.stringify(['Hello','en','lumi'])),false);
 assert.equal(a.timers.size,0);a.p.dispose();
});
test('Korean selection reaches the microphone POST, ASR language hint, reply and TTS locale',async()=>{
 const input={attach:async r=>input.r=r,detach(){},onLevel(){}};let post;
 const Recognition=createMicrophoneRecognition({input,fetchImpl:async(url,options)=>{post={language:new URL(url,'https://localhost').searchParams.get('language'),audio:Buffer.from(options.body)};return new Response(JSON.stringify({text:payload.text}));}});
 const r=new Recognition();r.lang='ko-KR';r.start();await flush();for(let i=0;i<7;i++)r.samples(Float32Array.from({length:1600},(_,i)=>.1*Math.sin(2*Math.PI*230*i/16000)),16000);for(let i=0;i<7;i++)r.samples(new Float32Array(1600),16000);await flush();assert.equal(post.language,'ko');
 let options;const service=createChatService({env:{DASHSCOPE_API_KEY:'private'},fetchImpl:async(_,o)=>{options=JSON.parse(o.body);return new Response(JSON.stringify({choices:[{message:{content:payload.text}}]}));}});await service.transcribe(post);assert.equal(options.asr_options.language,'ko');await assert.rejects(service.transcribe({...post,language:'invalid'}),{code:'invalid_request'});
 let recognizer,reply,speech;class FakeRecognition{constructor(){recognizer=this;}start(){this.onstart?.();}abort(){}}
 const session=new HandsFreeConversation({Recognition:FakeRecognition,fetchImpl:async(_,o)=>{reply=JSON.parse(o.body);return new Response(JSON.stringify({soul:'mori',reply:'응, 잘 들려!'}));},speak:(text,language)=>speech={text,language}});
 session.start('mori','ko');recognizer.onresult({results:[{0:{transcript:payload.text},isFinal:true}]});await flush();assert.equal(recognizer.inputLanguage,'ko');assert.equal(reply.language,'ko');assert.equal(speech.language,'ko');session.stop();
 assert.equal(replyLanguage('OK','ko'),'ko');assert.equal(replyLanguage('你好','ko'),'ko');assert.equal(replyLanguage('안녕','auto'),'ko');assert.equal(needsCamera('How are you?'),false);assert.equal(needsCamera('저거 보여?'),true);assert.equal(needsCamera('你看到什么？'),true);
});
test('short acknowledgements are recognized while a brief click is still ignored',async()=>{
 const input={attach:async r=>input.r=r,detach(){},onLevel(){}};let calls=0;
 const Recognition=createMicrophoneRecognition({input,fetchImpl:async()=>{calls++;return new Response(JSON.stringify({text:'네'}));}});
 for(const frames of [1,2]){const r=new Recognition();r.lang='ko-KR';r.start();await flush();for(let i=0;i<frames;i++)r.samples(Float32Array.from({length:1600},(_,i)=>.1*Math.sin(2*Math.PI*230*i/16000)),16000);for(let i=0;i<7;i++)r.samples(new Float32Array(1600),16000);await flush();if(frames===1){assert.equal(calls,0);r.abort();}else assert.equal(calls,1);}
});
test('disconnecting the audio stream aborts upstream work and releases the shared active slot',async t=>{
 const signals=[];const handler=createChatHandler({env:{DASHSCOPE_API_KEY:'private'},fetchImpl:async(_,options)=>{
  signals.push(options.signal);return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(sse(wav)));options.signal.addEventListener('abort',()=>c.error(new Error('aborted')),{once:true});}}),{headers:{'Content-Type':'text/event-stream'}});
 }});
 const server=http.createServer(async(req,res)=>{await handler(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));const base='http://127.0.0.1:'+server.address().port;
 for(let i=0;i<4;i++){const controller=new AbortController();const r=await fetch(base+'/api/speech/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});assert.equal(r.status,200);await r.body.getReader().read();controller.abort();for(let tries=0;tries<100&&!signals[i].aborted;tries++)await new Promise(r=>setTimeout(r,2));assert.equal(signals[i].aborted,true);await flush();}
});

test('provider completion releases the upstream reader without waiting for connection EOF',async()=>{
 let cancelled=false;const frames=[];
 const body=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(sse(wav)+done));},cancel(){cancelled=true;}});
 const relay=relaySpeech(new Response(body,{headers:{'Content-Type':'text/event-stream'}}),f=>frames.push(f));
 await flush();assert.equal(cancelled,true);assert.deepEqual(frames.at(-1),{done:true});await relay;
});

test('browser finishes received audio even when the response remains open after done',async()=>{
 const a=player(),states=[];await a.p.prepare();const playing=a.p.speak('Hello',{onState:s=>states.push(s)});await flush();
 a.send({audio:pcm.toString('base64'),rate:24000});a.send({done:true});await flush();
 assert.equal([...a.timers.values()].some(t=>t.ms===35000),false,'network deadline cleared at protocol completion');
 a.sources.at(-1).onended();await playing;assert.equal(states.at(-1),'ended');assert.equal(a.timers.size,0);a.p.dispose();
});
