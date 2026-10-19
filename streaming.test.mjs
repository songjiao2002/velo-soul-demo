import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {relaySpeech} from './speech-stream.mjs';
import {createChatHandler,createChatService} from './chat-service.mjs';
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
test('SSE relay strips split WAV headers, preserves PCM, and requires provider completion',async()=>{
 const frames=[];await relaySpeech(response([sse(wav.subarray(0,20)),sse(wav.subarray(20,40)),sse(wav.subarray(40)),done]),f=>frames.push(f));
 assert.deepEqual(Buffer.concat(frames.filter(f=>f.audio).map(f=>Buffer.from(f.audio,'base64'))),wav.subarray(44));assert.deepEqual(frames.at(-1),{done:true});
 await assert.rejects(relaySpeech(response([sse(pcm)]),()=>{}),/incomplete/);
 const stereo=Buffer.from(wav);stereo.writeUInt16LE(2,22);await assert.rejects(relaySpeech(response([sse(stereo),done]),()=>{}),/invalid_audio/);
 await assert.rejects(relaySpeech(response(['data: {"code":"secret-provider-error"}\n']),()=>{}));
});
test('stream HTTP sends the first audio before upstream completion, keeps Korean voice and applies quota/origin checks',async t=>{
 let upstream,request;const handler=createChatHandler({env:{DASHSCOPE_API_KEY:'private',QWEN_MAX_DAILY_REQUESTS:'1'},fetchImpl:async(_,options)=>{
  request=JSON.parse(options.body);assert.equal(options.headers['X-DashScope-SSE'],'enable');return new Response(new ReadableStream({start(c){upstream=c;}}),{headers:{'Content-Type':'text/event-stream'}});
 }});
 const server=http.createServer(async(req,res)=>{if(!await handler(req,res))res.end();});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 const post=origin=>fetch(base+'/api/speech/stream',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin||base},body:JSON.stringify(payload)});
 assert.equal((await post('https://elsewhere.example')).status,403);const pending=post();while(!upstream)await flush();upstream.enqueue(new TextEncoder().encode(sse(wav)));
 const r=await pending;assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'application/x-ndjson');const reader=r.body.getReader();const first=new TextDecoder().decode((await reader.read()).value);assert.match(first,/"audio"/);assert.ok(!first.includes('private'));assert.deepEqual(request.input,{text:payload.text,voice:'Serena',language_type:'Korean'});
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
test('Korean selection reaches the microphone POST, ASR language hint, reply and TTS locale',async()=>{
 const input={attach:async r=>input.r=r,detach(){},onLevel(){}};let post;
 const Recognition=createMicrophoneRecognition({input,fetchImpl:async(_,options)=>{post=JSON.parse(options.body);return new Response(JSON.stringify({text:payload.text}));}});
 const r=new Recognition();r.lang='ko-KR';r.start();await flush();for(let i=0;i<7;i++)r.samples(new Float32Array(1600).fill(.1),16000);for(let i=0;i<7;i++)r.samples(new Float32Array(1600),16000);await flush();assert.equal(post.language,'ko');
 let options;const service=createChatService({env:{DASHSCOPE_API_KEY:'private'},fetchImpl:async(_,o)=>{options=JSON.parse(o.body);return new Response(JSON.stringify({choices:[{message:{content:payload.text}}]}));}});await service.transcribe(post);assert.equal(options.asr_options.language,'ko');await assert.rejects(service.transcribe({...post,language:'invalid'}),{code:'invalid_request'});
 let recognizer,reply,speech;class FakeRecognition{constructor(){recognizer=this;}start(){this.onstart?.();}abort(){}}
 const session=new HandsFreeConversation({Recognition:FakeRecognition,fetchImpl:async(_,o)=>{reply=JSON.parse(o.body);return new Response(JSON.stringify({soul:'mori',reply:'응, 잘 들려!'}));},speak:(text,language)=>speech={text,language}});
 session.start('mori','ko');recognizer.onresult({results:[{0:{transcript:payload.text},isFinal:true}]});await flush();assert.equal(recognizer.inputLanguage,'ko');assert.equal(reply.language,'ko');assert.equal(speech.language,'ko');session.stop();
 assert.equal(replyLanguage('OK','ko'),'ko');assert.equal(replyLanguage('你好','ko'),'en');assert.equal(replyLanguage('안녕','auto'),'ko');assert.equal(needsCamera('How are you?'),false);assert.equal(needsCamera('저거 보여?'),true);assert.equal(needsCamera('你看到什么？'),true);
});
test('short acknowledgements are recognized while a brief click is still ignored',async()=>{
 const input={attach:async r=>input.r=r,detach(){},onLevel(){}};let calls=0;
 const Recognition=createMicrophoneRecognition({input,fetchImpl:async()=>{calls++;return new Response(JSON.stringify({text:'네'}));}});
 for(const frames of [1,2]){const r=new Recognition();r.lang='ko-KR';r.start();await flush();for(let i=0;i<frames;i++)r.samples(new Float32Array(1600).fill(.1),16000);for(let i=0;i<7;i++)r.samples(new Float32Array(1600),16000);await flush();if(frames===1){assert.equal(calls,0);r.abort();}else assert.equal(calls,1);}
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
