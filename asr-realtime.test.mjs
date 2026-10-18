import {test} from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {EventEmitter,once} from 'node:events';
import WebSocket from 'ws';
import {attachRealtimeAsr} from './asr-realtime.mjs';
import {createChatService} from './chat-service.mjs';
import {createMicrophoneRecognition} from './public/microphone-asr.mjs';
import {createPcm16Encoder} from './public/asr-stream.mjs';
import {HandsFreeConversation} from './public/hands-free.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
const wait=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,5));}throw Error('Timed out');};

class Upstream extends EventEmitter{
 constructor(){super();this.readyState=1;this.bufferedAmount=0;this.sent=[];queueMicrotask(()=>this.emit('open'));}
 send(data){const event=JSON.parse(data);this.sent.push(event);if(event.type==='session.update')queueMicrotask(()=>this.event({type:'session.updated'}));}
 event(event){this.emit('message',Buffer.from(JSON.stringify(event)));}
 terminate(){this.readyState=3;this.emit('close');}
}
async function relay(t){
 let upstream,options,endpoint,active=0;
 const app=http.createServer((req,res)=>res.end());
 attachRealtimeAsr(app,{env:{DASHSCOPE_API_KEY:'secret-test-value'},reserve:()=>{active++;let done=false;return ()=>{if(!done){done=true;active--;}};},connect:(url,opts)=>{endpoint=url;options=opts;return upstream=new Upstream();}});
 await new Promise(r=>app.listen(0,'127.0.0.1',r));
 t.after(()=>new Promise(r=>app.close(r)));
 const origin='http://127.0.0.1:'+app.address().port;
 return {app,origin,url:origin.replace('http:','ws:')+'/api/transcribe/live',get upstream(){return upstream;},get options(){return options;},get endpoint(){return endpoint;},get active(){return active;}};
}

test('realtime relay streams partials, revises them, combines VAD segments and submits only confirmed text after finish',async t=>{
 const a=await relay(t),ws=new WebSocket(a.url+'?language=ko',{origin:a.origin});t.after(()=>ws.terminate());const events=[];ws.on('message',raw=>events.push(JSON.parse(raw)));await wait(()=>events.some(e=>e.type==='ready'));
 assert.equal(a.options.headers.Authorization,'Bearer secret-test-value');assert.equal(new URL(a.endpoint).hostname,'dashscope-intl.aliyuncs.com');assert.equal(a.upstream.sent[0].session.input_audio_transcription.language,'ko');
 ws.send(Buffer.alloc(3200));await wait(()=>a.upstream.sent.some(e=>e.type==='input_audio_buffer.append'));
 a.upstream.event({type:'conversation.item.input_audio_transcription.text',item_id:'a',text:'안',stash:'녕'});await wait(()=>events.some(e=>e.text==='안녕'));
 a.upstream.event({type:'conversation.item.input_audio_transcription.completed',item_id:'a',transcript:'안녕하세요.'});
 a.upstream.event({type:'conversation.item.input_audio_transcription.text',item_id:'b',text:'날씨',stash:'가'});await wait(()=>events.some(e=>e.text==='안녕하세요. 날씨가'));assert.ok(!events.some(e=>e.type==='final'));
 ws.send(JSON.stringify({type:'finish'}));await wait(()=>a.upstream.sent.some(e=>e.type==='session.finish'));
 a.upstream.event({type:'conversation.item.input_audio_transcription.completed',item_id:'b',transcript:'날씨가 좋아요.'});a.upstream.event({type:'session.finished'});
 await wait(()=>events.some(e=>e.type==='final'));assert.deepEqual(events.at(-1),{type:'final',text:'안녕하세요. 날씨가 좋아요.'});assert.ok(!JSON.stringify(events).includes('secret-test-value'));await wait(()=>a.active===0);
});

test('realtime rejects cross-origin requests before spending quota and enforces PCM bounds',async t=>{
 const a=await relay(t);const denied=new WebSocket(a.url,{origin:'https://elsewhere.example'});let status;denied.on('unexpected-response',(_,res)=>{status=res.statusCode;res.resume();denied.terminate();});denied.on('error',()=>{});await wait(()=>status);assert.equal(status,403);assert.equal(a.active,0);assert.equal(a.upstream,undefined);
 const ws=new WebSocket(a.url,{origin:a.origin});t.after(()=>ws.terminate());const messages=[];ws.on('message',raw=>messages.push(JSON.parse(raw)));await wait(()=>messages.some(e=>e.type==='ready'));ws.send(Buffer.alloc(3));await wait(()=>messages.some(e=>e.type==='error'));assert.equal(messages.at(-1).error,'invalid_request');await wait(()=>a.active===0);
});

test('realtime cancellation releases upstream and shares the existing daily budget',async t=>{
 const a=await relay(t),ws=new WebSocket(a.url,{origin:a.origin});t.after(()=>ws.terminate());await once(ws,'open');await wait(()=>a.upstream);ws.close();await wait(()=>a.active===0);assert.equal(a.upstream.readyState,3);
 const service=createChatService({env:{DASHSCOPE_API_KEY:'test',QWEN_MAX_DAILY_REQUESTS:'1'}});const release=service.reserveRealtime();release();release();assert.throws(()=>service.reserveRealtime(),{code:'rate_limited'});
});

test('streaming resampler preserves 16kHz duration across uneven 44.1/48kHz chunks',()=>{
 for(const rate of [44100,48000,16000]){const encode=createPcm16Encoder();let bytes=0;for(let i=0;i<rate;i+=2048){const frame=encode(new Float32Array(Math.min(2048,rate-i)).fill(.5),rate);bytes+=frame.length;for(let j=0;j<frame.length;j+=2)assert.ok(Math.abs(new DataView(frame.buffer).getInt16(j,true)-16384)<=1);}assert.equal(bytes,32000);}
});

function client(){
 const sockets=[],uploads=[];
 class Socket{constructor(url){this.url=url;this.readyState=0;this.bufferedAmount=0;this.sent=[];sockets.push(this);}send(data){this.sent.push(data);}close(){this.readyState=3;}open(){this.readyState=1;this.onopen?.();this.event({type:'ready'});}event(event){this.onmessage?.({data:JSON.stringify(event)});}}
 const input={onLevel(){},attach:async r=>input.receiver=r,detach:r=>{if(input.receiver===r)input.receiver=null;},release(){input.receiver=null;}};
 const Recognition=createMicrophoneRecognition({Socket,location:new URL('https://demo.example/?bike=lumi'),input,fetchImpl:async(url,options)=>{uploads.push({url,options});return new Response(JSON.stringify({text:'Fallback complete sentence'}));}});
 const feed=(level,ms)=>{for(let i=0;i<ms/100;i++)input.receiver?.samples(new Float32Array(1600).fill(level),16000);};
 return {Recognition,sockets,uploads,feed,input};
}

test('browser sends PCM before silence, displays interim revisions, then sends one confirmed chat turn',async()=>{
 const a=client(),transcripts=[],chats=[],timers=new Map();let id=0;
 const session=new HandsFreeConversation({Recognition:a.Recognition,onTranscript:(text,final)=>transcripts.push({text,final}),fetchImpl:async(url,options)=>{chats.push(JSON.parse(options.body));return new Response(JSON.stringify({soul:'lumi',reply:'반가워요.'}));},speak(){},releaseInput:()=>a.input.release(),setTimer:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimer:key=>timers.delete(key)});
 session.start('lumi','ko');await tick();a.feed(0,100);assert.equal(a.sockets.length,0,'Idle listening makes no cloud connection');a.feed(.1,300);const ws=a.sockets[0];assert.match(ws.url,/language=ko/);ws.open();assert.ok(ws.sent.some(x=>x instanceof Uint8Array));ws.event({type:'partial',text:'안녕'});assert.deepEqual(transcripts.at(-1),{text:'안녕',final:false});assert.equal(chats.length,0);
 ws.event({type:'partial',text:'안녕하세요'});a.feed(.1,300);a.feed(0,500);assert.equal(JSON.parse(ws.sent.at(-1)).type,'finish');assert.equal(chats.length,0);ws.event({type:'final',text:'안녕하세요.'});await tick();assert.equal(chats.length,1);assert.equal(chats[0].language,'ko');assert.equal(chats[0].messages.at(-1).content,'안녕하세요.');assert.equal(a.uploads.length,0);session.stop();
});

test('disconnect retains the whole utterance for one fallback and ignores stale partial/final events',async()=>{
 const a=client(),r=new a.Recognition(),events=[];r.inputLanguage='zh';r.onresult=e=>events.push(e.results[0]);r.start();await tick();a.feed(.1,300);const ws=a.sockets[0];ws.open();const late=ws.onmessage;ws.event({type:'partial',text:'你好'});ws.onerror();a.feed(.1,300);a.feed(0,500);await tick();assert.equal(a.uploads.length,1);assert.equal(JSON.parse(a.uploads[0].options.body).language,'zh');assert.equal(events.at(-1).isFinal,true);assert.equal(events.at(-1)[0].transcript,'Fallback complete sentence');const length=events.length;late({data:JSON.stringify({type:'final',text:'stale'})});assert.equal(events.length,length);
});

test('leaving during transcription closes streaming and never uploads fallback audio',async()=>{
 const a=client(),r=new a.Recognition();let results=0;r.onresult=()=>results++;r.start();await tick();a.feed(.1,400);const ws=a.sockets[0];ws.open();const late=ws.onmessage;a.feed(0,500);r.abort();late({data:JSON.stringify({type:'final',text:'late'})});assert.equal(ws.readyState,3);assert.equal(a.uploads.length,0);assert.equal(results,0);
});
