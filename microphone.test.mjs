import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {MicrophoneInput,createMicrophoneRecognition,encodeWav} from './public/microphone-asr.mjs';
import {HandsFreeConversation} from './public/hands-free.mjs';
import {validateAudio,createChatService,createChatHandler} from './chat-service.mjs';
const flush=()=>new Promise(r=>setImmediate(r));
const audio=()=> 'data:audio/wav;base64,'+Buffer.from(encodeWav([new Float32Array(16000).fill(.1)],16000)).toString('base64');
const env={DASHSCOPE_API_KEY:'private-test-key'};
const success=text=>new Response(JSON.stringify({choices:[{message:{content:text}}]}));

test('recorder WAV resampling produces bounded PCM and server rejects remote or malformed audio',()=>{
 const wav=encodeWav([new Float32Array(48000).fill(.5)],48000);
 assert.equal(wav.length,32044);const b=Buffer.from(wav);assert.equal(b.readInt16LE(44),16384);
 const valid=audio();assert.equal(validateAudio({audio:valid}),valid);
 for(const invalid of ['https://example.com/audio.wav',valid.slice(0,-8),'data:audio/wav;base64,'+Buffer.alloc(100).toString('base64'),valid+'A'.repeat(700000)])assert.throws(()=>validateAudio({audio:invalid}));
 const stereo=Buffer.from(valid.slice(22),'base64');stereo.writeUInt16LE(2,22);assert.throws(()=>validateAudio({audio:'data:audio/wav;base64,'+stereo.toString('base64')}));
});

test('ASR auto-detects language, keeps authorization on server and shares chat quota',async()=>{
 let calls=0;const service=createChatService({env:{...env,QWEN_MAX_DAILY_REQUESTS:'4'},fetchImpl:async(url,options)=>{
  calls++;const body=JSON.parse(options.body);assert.equal(body.model,'qwen3-asr-flash');assert.deepEqual(body.asr_options,{enable_itn:false});
  assert.equal(options.headers.Authorization,'Bearer private-test-key');assert.equal(options.redirect,'error');
  return success(['你好，你听得到吗？','오늘 날씨가 좋아','Hello there',''][calls-1]);
 }});
 for(const expected of ['你好，你听得到吗？','오늘 날씨가 좋아','Hello there','']){const result=await service.transcribe({audio:audio()});assert.equal(result.text,expected);assert.ok(!JSON.stringify(result).includes(env.DASHSCOPE_API_KEY));}
 await assert.rejects(service.reply({soul:'lumi',language:'en',messages:[{role:'user',content:'Hi'}]}),{code:'rate_limited'});
 assert.equal(calls,4);
});

test('ASR HTTP endpoint enforces same origin, body bounds and sanitized upstream failures',async t=>{
 let calls=0;const handler=createChatHandler({env,fetchImpl:async()=>{calls++;return new Response(JSON.stringify({error:{code:'AccessDenied.Unpurchased',message:'private-test-key'}}),{status:403});}});
 const app=http.createServer(async(req,res)=>{if(!await handler(req,res)){res.statusCode=404;res.end();}});
 await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>app.close(r)));const base='http://127.0.0.1:'+app.address().port;
 const post=(body,headers={})=>fetch(base+'/api/transcribe',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 assert.equal((await fetch(base+'/api/transcribe')).status,405);
 assert.equal((await post({audio:audio()},{Origin:'https://elsewhere.example'})).status,403);
 assert.equal((await post({audio:'not-a-wave'})).status,400);
 assert.equal((await post({audio:'x'.repeat(700000)})).status,413);assert.equal(calls,0);
 const result=await post({audio:audio()});assert.equal(result.status,503);assert.equal(result.headers.get('cache-control'),'no-store');assert.deepEqual(await result.json(),{error:'provider_not_activated'});
});

test('ASR cancellation and timeout abort requests without forwarding provider details',async()=>{
 const pending=(_,options)=>new Promise((_,reject)=>{if(options.signal.aborted)reject(Error());else options.signal.addEventListener('abort',()=>reject(Error()));});
 await assert.rejects(createChatService({env,timeoutMs:5,fetchImpl:pending}).transcribe({audio:audio()}),{code:'timeout'});
 const controller=new AbortController();controller.abort();await assert.rejects(createChatService({env,fetchImpl:pending}).transcribe({audio:audio()},{signal:controller.signal}),{code:'cancelled'});
});

function recorder(fetchImpl=async()=>new Response(JSON.stringify({text:'你好'}))){
 const levels=[],calls=[];
 const input={onLevel:v=>levels.push(v),attach:async r=>{input.receiver=r;},detach:r=>{if(input.receiver===r)input.receiver=null;},release(){this.receiver=null;}};
 const Recognition=createMicrophoneRecognition({input,fetchImpl:(url,options)=>{calls.push({url,...options});return fetchImpl(url,options);},toBase64:s=>Buffer.from(s,'binary').toString('base64')});
 const feed=(value,ms)=>{for(let n=0;n<ms/100;n++)input.receiver?.samples(new Float32Array(1600).fill(value),16000);};
 return {input,Recognition,feed,levels,calls};
}
test('actual PCM triggers listening, level meter, one transcription after silence; quiet input sends nothing',async()=>{
 const a=recorder(),r=new a.Recognition(),states=[],transcripts=[];r.onstart=()=>states.push('started');r.onquiet=()=>states.push('quiet');r.onspeechstart=()=>states.push('speech');r.ontranscribing=()=>states.push('transcribing');r.onresult=e=>transcripts.push(e.results[0][0].transcript);
 r.start();await flush();assert.deepEqual(states,[]);a.feed(0,9000);assert.deepEqual(states,['started','quiet']);assert.equal(a.calls.length,0);
 a.feed(.08,600);assert.ok(a.levels.at(-1)>.5);a.feed(0,1100);await flush();assert.equal(a.calls.length,1);assert.deepEqual(transcripts,['你好']);assert.ok(states.includes('transcribing'));
 assert.equal(a.calls[0].url,'/api/transcribe');validateAudio(JSON.parse(a.calls[0].body));assert.equal(r.active,false);
});
test('a short click is not uploaded; continuous audio is capped; stopping ignores late recognition',async()=>{
 let resolve;const a=recorder(()=>new Promise(r=>resolve=r)),r=new a.Recognition();let results=0;r.onresult=()=>results++;r.start();await flush();a.feed(.1,100);a.feed(0,1200);assert.equal(a.calls.length,0);
 a.feed(.1,16000);assert.equal(a.calls.length,1);const b=Buffer.from(JSON.parse(a.calls[0].body).audio.slice(22),'base64');assert.ok(b.length<=490000);
 r.abort();assert.equal(a.calls[0].signal.aborted,true);resolve(new Response(JSON.stringify({text:'late'})));await flush();assert.equal(results,0);
});
test('cloud recognition completes the hands-free loop without browser SpeechRecognition',async()=>{
 const a=recorder(),states=[],spoken=[],timers=new Map();let id=0;
 const session=new HandsFreeConversation({Recognition:a.Recognition,releaseInput:()=>a.input.release(),getContext:()=>({}),fetchImpl:async(_,options)=>{
  assert.equal(JSON.parse(options.body).language,'en');return new Response(JSON.stringify({soul:'lumi',reply:'I can hear you.'}));
 },onState:s=>states.push(s),speak:(text,lang,soul,callback)=>{assert.equal(a.input.receiver,null);spoken.push({text,callback});},setTimer:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimer:i=>timers.delete(i)});
 session.start('lumi','en');assert.equal(session.state,'starting');await flush();a.feed(.08,700);a.feed(0,1100);await flush();await flush();
 assert.deepEqual(states.slice(-4),['hearing','transcribing','thinking','synthesizing']);assert.equal(spoken[0].text,'I can hear you.');
 spoken[0].callback('ended');const resume=[...timers.values()].find(t=>t.ms===250);resume.fn();await flush();a.feed(0,100);assert.equal(session.state,'listening');
 session.stop();assert.equal(a.input.receiver,null);
});

function fakeAudio(){
 const contexts=[],tracks=[],processors=[];
 class Context{constructor(){this.state='running';this.sampleRate=48000;this.destination={};contexts.push(this);}resume(){return Promise.resolve();}close(){this.closed=true;return Promise.resolve();}createMediaStreamSource(){return {connect(){},disconnect(){}};}createGain(){return {gain:{},connect(){},disconnect(){}};}createScriptProcessor(){const p={connect(){},disconnect(){this.disconnected=true;}};processors.push(p);return p;}}
 const stream=()=>{const track={stop(){this.stopped=true;},addEventListener(){}};tracks.push(track);return {getTracks:()=>[track]};};
 return {Context,contexts,tracks,processors,stream};
}
test('microphone keeps one stream between turns and releases tracks/context on exit',async()=>{
 const a=fakeAudio();let grants=0;const input=new MicrophoneInput({Context:a.Context,WorkletNode:null,mediaDevices:{getUserMedia:async options=>{assert.equal(options.audio.echoCancellation,true);grants++;return a.stream();}}});
 let samples=0;const receiver={active:true,samples:()=>samples++,fail:()=>{}};await input.attach(receiver);a.processors[0].onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(2048)}});assert.equal(samples,1);
 input.detach(receiver);await input.attach(receiver);assert.equal(grants,1);input.release();assert.ok(a.tracks[0].stopped);assert.ok(a.contexts[0].closed);assert.equal(a.processors[0].onaudioprocess,null);
});
test('leaving before microphone permission resolves releases a late stream',async()=>{
 const a=fakeAudio();let grant;const input=new MicrophoneInput({Context:a.Context,mediaDevices:{getUserMedia:()=>new Promise(r=>grant=r)}});
 const receiver={active:true},pending=input.attach(receiver);receiver.active=false;input.release();grant(a.stream());await pending;assert.ok(a.tracks[0].stopped);assert.ok(a.contexts[0].closed);assert.equal(input.receiver,null);
});

test('AudioWorklet path delivers PCM and resumes a briefly suspended audio device',async()=>{
 const a=fakeAudio();let processor,loaded,failed;
 class Context extends a.Context{constructor(){super();this.audioWorklet={addModule:async url=>{loaded=url;}};}}
 class Node{constructor(){this.port={};processor=this;}connect(){}disconnect(){this.disconnected=true;}}
 const input=new MicrophoneInput({Context,WorkletNode:Node,mediaDevices:{getUserMedia:async()=>a.stream()}});
 let received;const receiver={active:true,samples:(data,rate)=>{received={data,rate};},fail:code=>failed=code};await input.attach(receiver);
 const pcm=new Float32Array(2048);processor.port.onmessage({data:pcm});assert.equal(received.data,pcm);assert.equal(received.rate,48000);assert.match(loaded,/^\/mic-worklet.js/);
 a.contexts[0].resume=async()=>{a.contexts[0].state='running';};a.contexts[0].state='suspended';a.contexts[0].onstatechange();await flush();assert.equal(failed,undefined);assert.equal(a.contexts[0].state,'running');input.release();assert.equal(processor.port.onmessage,null);
});

test('cloud interruption uses recognized stop commands and aborts late monitor results',async()=>{
 const a=recorder(async()=>new Response(JSON.stringify({text:'等一下'}))),timers=new Map();let id=0,stopped=0,callback;
 const session=new HandsFreeConversation({Recognition:a.Recognition,releaseInput:()=>a.input.release(),stopSpeech:()=>stopped++,speak:(text,lang,soul,cb)=>callback=cb,setTimer:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimer:i=>timers.delete(i)});
 session.start('lumi','zh');await flush();a.feed(0,100);assert.equal(session.announce('Hello, I can see a cafe.','en'),true);
 callback('playing');[...timers.values()].find(t=>t.ms===150).fn();await flush();const before=stopped;a.feed(.08,500);a.feed(0,1100);await flush();
 assert.ok(stopped>before);assert.equal(session.state,'listening');assert.equal(a.calls.length,1);session.stop();
});

test('end of speech submits within half a second while shorter pauses remain in the same turn',async()=>{
 const a=recorder(),r=new a.Recognition();r.start();await flush();a.feed(.08,700);a.feed(0,300);assert.equal(a.calls.length,0);a.feed(.08,300);a.feed(0,400);assert.equal(a.calls.length,0);a.feed(0,100);assert.equal(a.calls.length,1);r.abort();
});
