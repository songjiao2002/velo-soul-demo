import {test} from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {EventEmitter,once} from 'node:events';
import WebSocket from 'ws';
import {attachRealtimeAsr} from './asr-realtime.mjs';
import {createChatService} from './chat-service.mjs';
import {createMicrophoneRecognition} from './public/microphone-asr.mjs';
import {createPcm16Encoder,StreamingTranscriber} from './public/asr-stream.mjs';
import {HandsFreeConversation} from './public/hands-free.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
const wait=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,5));}throw Error('Timed out');};

class Upstream extends EventEmitter{
 constructor(){super();this.readyState=1;this.bufferedAmount=0;this.sent=[];queueMicrotask(()=>this.emit('open'));}
 send(data){
  if(Buffer.isBuffer(data)){this.sent.push(data);return;}
  const event=JSON.parse(data);this.sent.push(event);
  if(event.type==='session.update')queueMicrotask(()=>this.event({type:'session.updated'}));
  if(event.header?.action==='run-task')queueMicrotask(()=>this.task('task-started'));
 }
 task(event,payload){
  const task_id=this.sent[0].header.task_id;
  this.event({header:{event,task_id},payload});
 }
 event(event){this.emit('message',Buffer.from(JSON.stringify(event)));}
 terminate(){this.readyState=3;this.emit('close');}
}
async function relay(t,model='qwen3-asr-flash-realtime',env={}){
 let upstream,options,endpoint,active=0;
 const app=http.createServer((req,res)=>res.end());
 attachRealtimeAsr(app,{env:{DASHSCOPE_API_KEY:'secret-test-value',QWEN_ASR_REALTIME_MODEL:model,...env},reserve:()=>{active++;let done=false;return ()=>{if(!done){done=true;active--;}};},connect:(url,opts)=>{endpoint=url;options=opts;return upstream=new Upstream();}});
 await new Promise(r=>app.listen(0,'127.0.0.1',r));
 t.after(()=>new Promise(r=>app.close(r)));
 const origin='http://127.0.0.1:'+app.address().port;
 return {app,origin,url:origin.replace('http:','ws:')+'/api/transcribe/live',get upstream(){return upstream;},get options(){return options;},get endpoint(){return endpoint;},get active(){return active;}};
}

test('realtime relay streams partials, revises them, combines VAD segments and submits only confirmed text after finish',async t=>{
 const a=await relay(t),ws=new WebSocket(a.url+'?language=ko',{origin:a.origin});t.after(()=>ws.terminate());const events=[];ws.on('message',raw=>events.push(JSON.parse(raw)));await wait(()=>events.some(e=>e.type==='ready'));
 assert.equal(a.options.headers.Authorization,'Bearer secret-test-value');assert.equal(new URL(a.endpoint).hostname,'dashscope-intl.aliyuncs.com');assert.equal(a.upstream.sent[0].session.input_audio_transcription.language,'ko');
 ws.send(Buffer.alloc(3200));await wait(()=>a.upstream.sent.some(e=>e.type==='input_audio_buffer.append'));
 a.upstream.event({type:'conversation.item.input_audio_transcription.text',item_id:'a',text:'O'});
 a.upstream.event({type:'conversation.item.input_audio_transcription.text',item_id:'a',text:'我那'});
 a.upstream.event({type:'conversation.item.input_audio_transcription.text',item_id:'a',text:'擦干八'});
 a.upstream.event({type:'conversation.item.input_audio_transcription.text',item_id:'a',text:'안',stash:'녕'});await wait(()=>events.some(e=>e.text==='안녕'));
 assert.deepEqual(events.filter(e=>e.type==='partial').map(e=>e.text),['안녕']);
 assert.equal(events.some(e=>e.text==='O'),false);
 a.upstream.event({type:'conversation.item.input_audio_transcription.completed',item_id:'a',transcript:'안녕하세요.'});
 a.upstream.event({type:'conversation.item.input_audio_transcription.text',item_id:'b',text:'날씨',stash:'가'});await wait(()=>events.some(e=>e.text==='안녕하세요. 날씨가'));assert.ok(!events.some(e=>e.type==='final'));
 ws.send(JSON.stringify({type:'finish'}));await wait(()=>a.upstream.sent.some(e=>e.type==='session.finish'));
 a.upstream.event({type:'conversation.item.input_audio_transcription.completed',item_id:'b',transcript:'날씨가 좋아요.'});a.upstream.event({type:'session.finished'});
 await wait(()=>events.some(e=>e.type==='final'));assert.deepEqual(events.at(-1),{type:'final',text:'안녕하세요. 날씨가 좋아요.'});assert.ok(!JSON.stringify(events).includes('secret-test-value'));await wait(()=>a.active===0);
});

test('3.1 streaming relay uses native PCM and language hints, revises subtitles and ignores heartbeat',async t=>{
 const a=await relay(t,''),ws=new WebSocket(a.url+'?language=zh',{origin:a.origin}),events=[];
 t.after(()=>ws.terminate());
 ws.on('message',raw=>events.push(JSON.parse(raw)));
 await wait(()=>events.some(e=>e.type==='ready'));
 const request=a.upstream.sent[0].payload;
 assert.equal(request.model,'qwen-audio-3.1-asr-flash-streaming');
 assert.equal(request.parameters.vad_model,'near_meeting_16k');
 assert.deepEqual(request.parameters.language_hints,['zh']);
 assert.ok(request.parameters.vocabulary['露露']>0);
 assert.equal(new URL(a.endpoint).pathname,'/api-ws/v1/inference');
 ws.send(Buffer.alloc(3200,1));await wait(()=>Buffer.isBuffer(a.upstream.sent[1]));
 const sentence=(id,text,final=false)=>a.upstream.task('result-generated',{output:{sentence:{sentence_id:id,text,sentence_end:final}}});
 sentence(1,'我过弯以前总。');await wait(()=>events.some(e=>e.type==='partial'&&e.text==='我过弯以前总'));
 sentence(1,'你');await wait(()=>events.some(e=>e.text==='你'));
 a.upstream.task('result-generated',{output:{sentence:{heartbeat:true}}});
 sentence(1,'你好',true);sentence(1,'过期的草稿');sentence(2,'露露');
 await wait(()=>events.some(e=>e.text==='你好 露露'));
 assert.ok(!events.some(e=>e.type==='final'||e.text?.includes('过期')));
 ws.send(JSON.stringify({type:'finish'}));
 await wait(()=>a.upstream.sent.some(x=>x.header?.action==='finish-task'));
 sentence(2,'露露。',true);a.upstream.task('task-finished',{});
 await wait(()=>events.some(e=>e.type==='final'));
 assert.deepEqual(events.at(-1),{type:'final',text:'你好 露露。'});
});

test('English Flash Message emits revised text while the microphone is open and confirms one final',async t=>{
 const a=await relay(t,''),events=[];
 const ws=new WebSocket(a.url+'?language=en',{origin:a.origin});
 t.after(()=>ws.terminate());
 ws.on('message',raw=>events.push(JSON.parse(raw)));
 await wait(()=>events.some(e=>e.type==='ready'));
 const request=a.upstream.sent[0].payload;
 assert.equal(request.model,'qwen-audio-3.1-asr-flash-message');
 assert.equal(new URL(a.endpoint).pathname,'/api-ws/v1/inference');
 assert.equal(request.parameters.sample_rate,16000);
 assert.deepEqual(request.parameters.language_hints,['en']);
 assert.ok(request.parameters.vocabulary.Mori>0);
 assert.equal(request.parameters.vad_model,'near_meeting_16k');
 assert.equal(request.parameters.intermediate_result_enabled,true);
 assert.equal(request.parameters.disfluency_removal_enabled,false);
 ws.send(Buffer.alloc(3200,1));
 await wait(()=>Buffer.isBuffer(a.upstream.sent[1]));
 const sentence=(text,sentence_end)=>a.upstream.task('result-generated',{output:{sentence:{sentence_id:1,text,sentence_end}}});
 sentence('无',false);
 sentence('We can',false);
 await wait(()=>events.some(e=>e.type==='partial'&&e.text==='We can'));
 assert.equal(events.some(e=>e.text==='无'),false);
 sentence('We cannot',false);
 await wait(()=>events.some(e=>e.type==='partial'&&e.text==='We cannot'));
 assert.ok(!a.upstream.sent.some(e=>e.header?.action==='finish-task'));
 assert.ok(!events.some(e=>e.type==='final'));
 ws.send(JSON.stringify({type:'finish'}));
 await wait(()=>a.upstream.sent.some(e=>e.header?.action==='finish-task'));
 sentence('We cannot.',true);
 a.upstream.task('task-finished',{});
 await wait(()=>events.some(e=>e.type==='final'));
 assert.deepEqual(events.filter(e=>e.type==='final'),[{type:'final',text:'We cannot.'}]);
});

test('live ASR status respects language defaults, explicit model settings, provider credentials and disable switch',()=>{
 const models=env=>{
  const status=createChatService({env}).status();
  assert.ok(!JSON.stringify(status).includes('secret-provider-key'));
  return [status.realtimeAsrModel,status.realtimeAsrModelEn,status.realtimeAsrModelKo,status.realtimeAsrModelZh];
 };
 const streaming='qwen-audio-3.1-asr-flash-streaming',message='qwen-audio-3.1-asr-flash-message',legacy='qwen3-asr-flash-realtime';
 assert.deepEqual(models({}),[streaming,message,streaming,streaming]);
 assert.deepEqual(models({QWEN_ASR_REALTIME_MODEL:legacy}),[legacy,legacy,legacy,legacy]);
 assert.deepEqual(models({QWEN_ASR_REALTIME_MODEL:legacy,QWEN_ASR_REALTIME_MODEL_EN:message}),[legacy,message,legacy,legacy]);
 assert.deepEqual(models({VELO_ASR_PROVIDER:'elevenlabs',ELEVENLABS_API_KEY:' '}),[streaming,message,streaming,streaming]);
 assert.deepEqual(models({ELEVENLABS_API_KEY:'secret-provider-key'}),[streaming,message,streaming,streaming]);
 const scribe={VELO_ASR_PROVIDER:'elevenlabs',ELEVENLABS_API_KEY:'secret-provider-key'};
 assert.deepEqual(models(scribe),[streaming,'scribe_v3_live','scribe_v3_live','scribe_v3_live']);
 assert.deepEqual(models({...scribe,QWEN_REALTIME_ASR:'off'}),[null,null,null,null]);
});

test('selected Mandarin uses Scribe on live and activated standby; legacy Mandarin and Auto keep Qwen',async t=>{
 const configured={VELO_ASR_PROVIDER:'elevenlabs',ELEVENLABS_API_KEY:'test-only'};
 for(const [query,standby,env,scribe] of [
  ['language=zh&provider=scribe',false,configured,true],
  ['language=zh&provider=scribe',true,configured,true],
  ['language=zh',false,configured,false],
  ['language=auto&provider=scribe',false,configured,false],
  ['language=zh&provider=scribe',false,{},false],
 ]){
  const a=await relay(t,undefined,env),url=standby?a.url.replace('/live','/standby'):a.url;
  const ws=new WebSocket(url+'?'+query,{origin:a.origin});t.after(()=>ws.terminate());
  await once(ws,'open');
  if(standby){assert.equal(a.upstream,undefined);ws.send(JSON.stringify({type:'start'}));}
  await wait(()=>a.upstream);
  assert.equal(new URL(a.endpoint).hostname,scribe?'api.elevenlabs.io':'dashscope-intl.aliyuncs.com');
  if(scribe)assert.equal(new URL(a.endpoint).searchParams.get('language_code'),'zh');
  ws.close();await wait(()=>a.active===0);
 }
});

test('realtime rejects cross-origin requests before spending quota and enforces PCM bounds',async t=>{
 const a=await relay(t);const denied=new WebSocket(a.url,{origin:'https://elsewhere.example'});let status;denied.on('unexpected-response',(_,res)=>{status=res.statusCode;res.resume();denied.terminate();});denied.on('error',()=>{});await wait(()=>status);assert.equal(status,403);assert.equal(a.active,0);assert.equal(a.upstream,undefined);
 const ws=new WebSocket(a.url,{origin:a.origin});t.after(()=>ws.terminate());const messages=[];ws.on('message',raw=>messages.push(JSON.parse(raw)));await wait(()=>messages.some(e=>e.type==='ready'));ws.send(Buffer.alloc(3));await wait(()=>messages.some(e=>e.type==='error'));assert.equal(messages.at(-1).error,'invalid_request');await wait(()=>a.active===0);
});

test('realtime cancellation releases upstream and shares the existing daily budget',async t=>{
 const a=await relay(t),ws=new WebSocket(a.url,{origin:a.origin});t.after(()=>ws.terminate());await once(ws,'open');await wait(()=>a.upstream);ws.close();await wait(()=>a.active===0);assert.equal(a.upstream.readyState,3);
 const service=createChatService({env:{DASHSCOPE_API_KEY:'test',QWEN_CONVERSATION_MAX_DAILY_REQUESTS:'1'}});const release=service.reserveRealtime();release();release();assert.throws(()=>service.reserveRealtime(),{code:'daily_limit'});
});

test('malformed JSON frames close only the affected connection and release quota',async t=>{
 const a=await relay(t);
 for(const value of [null,[],42,'finish',{}]){
  const ws=new WebSocket(a.url,{origin:a.origin}),events=[];ws.on('message',raw=>events.push(JSON.parse(raw)));t.after(()=>ws.terminate());
  await wait(()=>events.some(e=>e.type==='ready'));ws.send(JSON.stringify(value));await wait(()=>events.some(e=>e.error==='invalid_request'));await wait(()=>a.active===0);
 }
 const ws=new WebSocket(a.url,{origin:a.origin}),events=[];ws.on('message',raw=>events.push(JSON.parse(raw)));t.after(()=>ws.terminate());
 await wait(()=>events.some(e=>e.type==='ready'));a.upstream.event(null);await wait(()=>events.some(e=>e.error==='invalid_response'));await wait(()=>a.active===0);
});

test('completed transcription segments are bounded even without interim events',async t=>{
 const a=await relay(t),ws=new WebSocket(a.url,{origin:a.origin}),events=[];ws.on('message',raw=>events.push(JSON.parse(raw)));t.after(()=>ws.terminate());
 await wait(()=>events.some(e=>e.type==='ready'));
 for(let i=0;i<41;i++)a.upstream.event({type:'conversation.item.input_audio_transcription.completed',item_id:String(i),transcript:'hello'});
 await wait(()=>events.some(e=>e.error==='invalid_response'));await wait(()=>a.active===0);
});

test('malformed upgrade URL and handshake are rejected before quota or provider access',async t=>{
 const a=await relay(t);
 for(const path of ['http://[','/api/transcribe/live']){
  const status=await new Promise((resolve,reject)=>{const req=http.request(a.origin,{path,headers:{Origin:a.origin,Connection:'Upgrade',Upgrade:'websocket','Sec-WebSocket-Version':'13','Sec-WebSocket-Key':'invalid'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});
  assert.equal(status,400);assert.equal(a.active,0);assert.equal(a.upstream,undefined);
 }
});

test('streaming resampler preserves 16kHz duration across uneven 44.1/48kHz chunks',()=>{
 for(const rate of [44100,48000,16000]){const encode=createPcm16Encoder();let bytes=0;for(let i=0;i<rate;i+=2048){const frame=encode(new Float32Array(Math.min(2048,rate-i)).fill(.5),rate);bytes+=frame.length;for(let j=0;j<frame.length;j+=2)assert.ok(Math.abs(new DataView(frame.buffer).getInt16(j,true)-16384)<=1);}assert.equal(bytes,32000);}
});

test('a legacy session-creating endpoint waits for activation before reserving or connecting',async t=>{
 const a=await relay(t),url=a.url.replace('/live','/standby')+'?language=en';
 const quiet=new WebSocket(url,{origin:a.origin});await once(quiet,'open');
 assert.equal(a.active,0);assert.equal(a.upstream,undefined);quiet.close();await once(quiet,'close');
 const invalid=new WebSocket(url,{origin:a.origin});await once(invalid,'open');
 invalid.send(Buffer.alloc(16));await once(invalid,'close');assert.equal(a.upstream,undefined);assert.equal(a.active,0);
 const rider=new WebSocket(url,{origin:a.origin}),events=[];t.after(()=>rider.terminate());
 rider.on('message',raw=>events.push(JSON.parse(raw)));await once(rider,'open');
 rider.send(JSON.stringify({type:'start'}));rider.send(Buffer.alloc(320));
 await wait(()=>events.some(e=>e.type==='ready'));
 assert.equal(a.active,1);
 assert.equal(a.upstream.sent.filter(e=>e.type==='input_audio_buffer.append').length,1);
 rider.close();await wait(()=>a.active===0);
});

const voiceFrame=(level,length)=>Float32Array.from({length},(_,i)=>level*Math.sin(2*Math.PI*225*i/16000));

function client(now=Date.now,standby=false){
 const sockets=[],uploads=[];
 class Socket{constructor(url){this.url=url;this.readyState=0;this.bufferedAmount=0;this.sent=[];sockets.push(this);}send(data){this.sent.push(data);}close(){this.readyState=3;}open(){this.readyState=1;this.onopen?.();this.event({type:'ready'});}event(event){this.onmessage?.({data:JSON.stringify(event)});}}
 const input={onLevel(){},attach:async r=>input.receiver=r,detach:r=>{if(input.receiver===r)input.receiver=null;},release(){input.receiver=null;}};
 const Recognition=createMicrophoneRecognition({now,Socket,standby,location:new URL('https://demo.example/?bike=lumi'),input,fetchImpl:async(url,options)=>{uploads.push({url,options});return new Response(JSON.stringify({text:'Fallback complete sentence'}));}});
 const feed=(level,ms)=>{for(let i=0;i<ms/100;i++)input.receiver?.samples(voiceFrame(level,1600),16000);};
 return {Recognition,sockets,uploads,feed,input};
}

test('prepared client stays silent, activates once with its first audio, and falls back if its standby expired',async()=>{
 for(const expired of [false,true]){
  const a=client(Date.now,true),r=new a.Recognition();r.inputLanguage='ko';r.start();await tick();
  const idle=a.sockets[0];assert.equal(new URL(idle.url).pathname,'/api/transcribe/standby');idle.open();
  a.feed(0,1000);assert.deepEqual(idle.sent,[]);
  if(expired){idle.close();idle.onclose?.();}
  a.feed(.1,300);
  if(expired){
   assert.equal(a.sockets.length,2);assert.match(a.sockets[1].url,/\/live\?language=ko$/);
   a.sockets[1].open();assert.ok(a.sockets[1].sent[0] instanceof Uint8Array);
  }else{
   assert.equal(a.sockets.length,1);assert.equal(idle.sent[0],'{"type":"start"}');
   assert.ok(idle.sent[1] instanceof Uint8Array);assert.equal(idle.sent.filter(v=>typeof v==='string').length,1);
  }
  r.abort();
 }
});

test('only an explicit Mandarin selection negotiates Scribe on standby and live reconnect',async()=>{
 for(const selected of ['zh','auto',undefined]){
  const a=client(Date.now,true),r=new a.Recognition();r.inputLanguage=selected;r.lang='zh-CN';r.start();await tick();
  const standby=a.sockets[0];assert.equal(new URL(standby.url).searchParams.get('provider'),selected==='zh'?'scribe':null);
  standby.open();standby.close();standby.onclose?.();a.feed(.1,300);
  const live=new URL(a.sockets[1].url);assert.equal(live.pathname,'/api/transcribe/live');
  assert.equal(live.searchParams.get('provider'),selected==='zh'?'scribe':null);
  assert.equal(live.searchParams.get('language'),selected??'zh');
  r.abort();
 }
});

test('speech arriving during the standby handshake is retained through success or an unsupported standby route',async()=>{
 for(const unsupported of [false,true]){
  const a=client(Date.now,true),r=new a.Recognition();r.start();await tick();a.feed(.1,300);
  const standby=a.sockets[0];assert.equal(a.sockets.length,1);assert.deepEqual(standby.sent,[]);
  if(unsupported)standby.onerror();
  const active=a.sockets.at(-1);active.open();
  assert.equal(active.sent.filter(v=>typeof v==='string').length,unsupported?0:1);
  assert.equal(active.sent.filter(v=>v instanceof Uint8Array).reduce((n,v)=>n+v.length,0),9600);
  r.abort();
 }
});

test('browser sends PCM before silence, displays interim revisions, then sends one confirmed chat turn',async()=>{
 const a=client(),transcripts=[],chats=[],timers=new Map();let id=0;
 const session=new HandsFreeConversation({Recognition:a.Recognition,onTranscript:(text,final)=>transcripts.push({text,final}),fetchImpl:async(url,options)=>{chats.push(JSON.parse(options.body));return new Response(JSON.stringify({soul:'lumi',reply:'반가워요.'}));},speak(){},releaseInput:()=>a.input.release(),setTimer:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimer:key=>timers.delete(key)});
 session.start('lumi','ko');await tick();a.feed(0,100);assert.equal(a.sockets.length,0,'Idle listening makes no cloud connection');a.feed(.1,300);const ws=a.sockets[0];assert.match(ws.url,/language=ko/);ws.open();assert.ok(ws.sent.some(x=>x instanceof Uint8Array));ws.event({type:'partial',text:'안녕'});assert.deepEqual(transcripts.at(-1),{text:'안녕',final:false});assert.equal(chats.length,0);
 ws.event({type:'partial',text:'안녕하세요'});a.feed(.1,300);a.feed(0,700);assert.equal(JSON.parse(ws.sent.at(-1)).type,'finish');assert.equal(chats.length,0);ws.event({type:'final',text:'안녕하세요.'});await tick();assert.equal(chats.length,1);assert.equal(chats[0].language,'ko');assert.equal(chats[0].messages.at(-1).content,'안녕하세요.');assert.equal(a.uploads.length,0);session.stop();
});

test('disconnect retains the whole utterance for one fallback and ignores stale partial/final events',async()=>{
 const a=client(),r=new a.Recognition(),events=[];r.inputLanguage='zh';r.onresult=e=>events.push(e.results[0]);r.start();await tick();a.feed(.1,300);const ws=a.sockets[0];ws.open();const late=ws.onmessage;ws.event({type:'partial',text:'你好'});ws.onerror();a.feed(.1,300);a.feed(0,700);await tick();assert.equal(a.uploads.length,1);assert.equal(a.uploads[0].url,'/api/transcribe?language=zh');assert.equal(events.at(-1).isFinal,true);assert.equal(events.at(-1)[0].transcript,'Fallback complete sentence');const length=events.length;late({data:JSON.stringify({type:'final',text:'stale'})});assert.equal(events.length,length);
});

test('an empty streaming result retries the retained short utterance once',async()=>{
 const a=client(),r=new a.Recognition(),events=[];
 r.onresult=e=>events.push(e.results[0]);r.start();await tick();
 a.input.receiver.samples(voiceFrame(.025,2240),16000);
 const ws=a.sockets[0];ws.open();
 a.feed(0,400);ws.event({type:'final',text:''});await tick();
 assert.equal(a.uploads.length,1);assert.equal(events.length,1);
 assert.equal(events[0][0].transcript,'Fallback complete sentence');assert.equal(events[0].isFinal,true);
});

test('leaving during transcription closes streaming and never uploads fallback audio',async()=>{
 const a=client(),r=new a.Recognition();let results=0;r.onresult=()=>results++;r.start();await tick();a.feed(.1,400);const ws=a.sockets[0];ws.open();const late=ws.onmessage;a.feed(0,700);r.abort();late({data:JSON.stringify({type:'final',text:'late'})});assert.equal(ws.readyState,3);assert.equal(a.uploads.length,0);assert.equal(results,0);
});

test('malformed browser streaming responses fall back once without losing the utterance',async()=>{
 for(const invalid of [null,[],42,{}, {type:'partial',text:null}, {type:'final'}, {type:'unknown'}]){
  const a=client(),r=new a.Recognition(),events=[];r.onresult=e=>events.push(e.results[0]);r.start();await tick();a.feed(.1,300);
  const ws=a.sockets[0];ws.open();const late=ws.onmessage;
  assert.doesNotThrow(()=>ws.event(invalid));assert.equal(ws.readyState,3);
  a.feed(.1,300);a.feed(0,700);await tick();
  assert.equal(a.uploads.length,1);assert.equal(events.length,1);assert.equal(events[0].isFinal,true);assert.equal(events[0][0].transcript,'Fallback complete sentence');
  late({data:JSON.stringify({type:'final',text:'stale'})});assert.equal(events.length,1);r.abort();
 }
});


test('a brief sound cannot start a live provider task; confirmed speech streams through a 300ms pause',async()=>{
 const a=client(),r=new a.Recognition();r.start();await tick();
 a.input.receiver.samples(voiceFrame(.1,1280),16000);
 assert.equal(a.sockets.length,0);
 a.feed(.1,300);assert.equal(a.sockets.length,1);const ws=a.sockets[0];ws.open();a.feed(0,300);
 assert.ok(!ws.sent.some(x=>typeof x==='string'&&JSON.parse(x).type==='finish'));
 a.feed(.1,200);a.input.receiver.samples(new Float32Array(8640),16000);
 assert.equal(JSON.parse(ws.sent.at(-1)).type,'finish');r.abort();
});

test('after a long quiet ride a fresh standby can connect without activating for a brief sound',async()=>{
 let now=0;
 const a=client(()=>now,true),r=new a.Recognition();r.start();await tick();
 const idle=a.sockets[0];idle.close();idle.onclose();
 now=46000;
 a.input.receiver.samples(voiceFrame(.1,1280),16000);
 assert.equal(a.sockets.length,2);
 const fresh=a.sockets[1];assert.match(fresh.url,/\/standby\?/);fresh.open();
 assert.deepEqual(fresh.sent,[]);
 a.feed(0,300);assert.deepEqual(fresh.sent,[]);
 a.feed(.1,300);assert.equal(fresh.sent[0],'{"type":"start"}');
 assert.equal(fresh.sent.filter(x=>typeof x==='string').length,1);
 assert.equal(a.sockets.length,2);r.abort();
});

test('buffered onset is sent in order in fewer frames while subsequent mic callbacks are sent immediately',()=>{
 const sent=[];
 class Socket{constructor(){this.readyState=1;this.bufferedAmount=0;}send(data){sent.push(data);}close(){}}
 const stream=new StreamingTranscriber({Socket,setTimer:()=>1,clearTimer(){}});
 const rate=44100;
 const material=Float32Array.from({length:43171},(_,i)=>.24*Math.sin(.04*i));
 const chunks=[];
 for(let i=0;i<material.length;i+=1024)chunks.push(material.subarray(i,i+1024));
 const encode=createPcm16Encoder();
 stream.writeBuffered(chunks,rate);
 assert.equal(sent.length,Math.ceil(material.length/(rate*.1)));
 assert.deepEqual(Buffer.concat(sent),Buffer.from(encode(material,rate)));
 const frames=sent.length;
 stream.write(material.subarray(0,512),rate);
 assert.equal(sent.length,frames+1);
 assert.deepEqual(Buffer.from(sent.at(-1)),Buffer.from(encode(material.subarray(0,512),rate)));
 stream.close();
});

test('temporary streaming failure retries after five seconds instead of blocking the next minute',async()=>{
 let time=0;const a=client(()=>time),r=new a.Recognition();r.start();await tick();a.feed(.1,300);a.sockets[0].open();a.sockets[0].onerror();r.abort();
 time=4000;const waiting=new a.Recognition();waiting.start();await tick();a.feed(.1,300);assert.equal(a.sockets.length,1);waiting.abort();
 time=5001;const retry=new a.Recognition();retry.start();await tick();a.feed(.1,300);assert.equal(a.sockets.length,2);retry.abort();
});

test('streaming ASR carries quota and backoff details without uploading the same audio again',async()=>{
 for(const error of ['service_busy','minute_limit','provider_rate_limited','daily_limit','provider_quota','rate_limited']){
  const a=client(),recognition=new a.Recognition(),errors=[];
  recognition.onerror=event=>errors.push(event);
  recognition.start();await tick();a.feed(.1,300);
  const socket=a.sockets[0];socket.open();socket.event({type:'error',error,retryAfter:7});
  a.feed(0,700);await tick();
  assert.deepEqual(errors,[{error,retryAfter:7}]);assert.equal(a.uploads.length,0);
 }
});
