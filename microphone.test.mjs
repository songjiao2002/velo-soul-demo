import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {MicrophoneInput,createMicrophoneRecognition,encodeWav} from './public/microphone-asr.mjs';
import {HandsFreeConversation} from './public/hands-free.mjs';
import {IdlePurr} from './public/idle-purr.mjs';
import {validateAudio,createChatService,createChatHandler} from './chat-service.mjs';
const flush=()=>new Promise(r=>setImmediate(r));
const audio=()=> 'data:audio/wav;base64,'+Buffer.from(encodeWav([new Float32Array(16000).fill(.1)],16000)).toString('base64');
const env={DASHSCOPE_API_KEY:'private-test-key'};
test('idle purr waits for silence, stays sparse and stops immediately on activity or leaving',()=>{
 let time=0,allowed=true;const sources=[];
 const context={state:'running',sampleRate:24000,createBuffer:(_,length)=>({getChannelData:()=>new Float32Array(length)}),createBufferSource:()=>{const source={connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;}};sources.push(source);return source;}};
 const purr=new IdlePurr({session:{context,getOutput:()=>({})},canPlay:()=>allowed,now:()=>time,random:()=>0});
 time=29999;purr.tick();assert.equal(sources.length,0);time=30000;purr.tick();assert.equal(sources.length,1);
 purr.activity();assert.equal(sources[0].stopped,true);time=60000;purr.tick();assert.equal(sources.length,1);
 time=105000;purr.tick();assert.equal(sources.length,2);allowed=false;purr.tick();assert.equal(sources[1].stopped,true);
 time=300000;purr.tick();assert.equal(sources.length,2);allowed=true;purr.tick();assert.equal(sources.length,2);
});
const success=text=>new Response(JSON.stringify({choices:[{message:{content:text}}]}));

test('recorder WAV resampling produces bounded PCM and server rejects remote or malformed audio',()=>{
 const wav=encodeWav([new Float32Array(48000).fill(.5)],48000);
 assert.equal(wav.length,32044);const b=Buffer.from(wav);assert.equal(b.readInt16LE(44),16384);
 const valid=audio();assert.equal(validateAudio({audio:valid}),valid);
 for(const invalid of ['https://example.com/audio.wav',valid.slice(0,-8),'data:audio/wav;base64,'+Buffer.alloc(100).toString('base64'),valid+'A'.repeat(700000)])assert.throws(()=>validateAudio({audio:invalid}));
 const stereo=Buffer.from(valid.slice(22),'base64');stereo.writeUInt16LE(2,22);assert.throws(()=>validateAudio({audio:'data:audio/wav;base64,'+stereo.toString('base64')}));
});

test('ASR auto-detects language, keeps authorization on server and shares chat quota',async()=>{
 const transcripts=['你好，你听得到吗？','오늘 날씨가 좋아','Hello there. '.repeat(120).trim(),''];
 let calls=0;const service=createChatService({env:{...env,QWEN_CONVERSATION_MAX_DAILY_REQUESTS:'4'},fetchImpl:async(url,options)=>{
  calls++;const body=JSON.parse(options.body);assert.equal(body.model,'qwen3-asr-flash');assert.deepEqual(body.asr_options,{enable_itn:false});
  assert.equal(options.headers.Authorization,'Bearer private-test-key');assert.equal(options.redirect,'error');
  return success(transcripts[calls-1]);
 }});
 for(const expected of transcripts){const result=await service.transcribe({audio:audio()});assert.equal(result.text,expected);assert.ok(!JSON.stringify(result).includes(env.DASHSCOPE_API_KEY));}
 await assert.rejects(service.reply({soul:'lumi',language:'en',messages:[{role:'user',content:'Hi'}]}),{code:'daily_limit'});
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

test('binary and legacy microphone uploads deliver the same samples and language to ASR',async t=>{
 const requests=[];
 const handler=createChatHandler({env,fetchImpl:async(_,options)=>{requests.push(JSON.parse(options.body));return success('안녕하세요.');}});
 const app=http.createServer(handler);
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>app.close(resolve)));
 const url='http://127.0.0.1:'+app.address().port+'/api/transcribe';
 const legacy=audio(),wav=Buffer.from(legacy.slice(22),'base64');
 const sendWave=(body,language='ko')=>fetch(url+'?language='+language,{method:'POST',headers:{'Content-Type':'audio/wav'},body});
 assert.equal((await sendWave(wav)).status,200);
 assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({audio:legacy,language:'ko'})})).status,200);
 assert.deepEqual(requests[0],requests[1]);
 assert.equal((await sendWave(wav,'invalid')).status,400);
 assert.equal((await sendWave(wav.subarray(0,100))).status,400);
 assert.equal((await sendWave(Buffer.alloc(490001))).status,413);
 assert.equal(requests.length,2);
});

test('ASR cancellation and timeout abort requests without forwarding provider details',async()=>{
 const pending=(_,options)=>new Promise((_,reject)=>{if(options.signal.aborted)reject(Error());else options.signal.addEventListener('abort',()=>reject(Error()));});
 await assert.rejects(createChatService({env,timeoutMs:5,fetchImpl:pending}).transcribe({audio:audio()}),{code:'timeout'});
 const controller=new AbortController();controller.abort();await assert.rejects(createChatService({env,fetchImpl:pending}).transcribe({audio:audio()},{signal:controller.signal}),{code:'cancelled'});
});

function recorder(fetchImpl=async()=>new Response(JSON.stringify({text:'你好'}))){
 const levels=[],calls=[];
 const input={onLevel:v=>levels.push(v),attach:async r=>{input.receiver=r;},detach:r=>{if(input.receiver===r)input.receiver=null;},release(){this.receiver=null;}};
 const Recognition=createMicrophoneRecognition({input,fetchImpl:(url,options)=>{calls.push({url,...options});return fetchImpl(url,options);}});
 const feed=(value,ms)=>{
  for(let n=0;n<ms/100;n++)input.receiver?.samples(Float32Array.from({length:1600},(_,i)=>value*Math.sin(2*Math.PI*230*i/16000)),16000);
 };
 return {input,Recognition,feed,levels,calls};
}
test('actual PCM triggers listening, level meter, one transcription after silence; quiet input sends nothing',async()=>{
 const a=recorder(),r=new a.Recognition(),states=[],transcripts=[];r.onstart=()=>states.push('started');r.onquiet=()=>states.push('quiet');r.onspeechstart=()=>states.push('speech');r.ontranscribing=()=>states.push('transcribing');r.onresult=e=>transcripts.push(e.results[0][0].transcript);
 r.start();await flush();assert.deepEqual(states,[]);a.feed(0,9000);assert.deepEqual(states,['started','quiet']);assert.equal(a.calls.length,0);
 a.feed(.08,600);assert.ok(a.levels.at(-1)>.5);a.feed(0,1100);await flush();assert.equal(a.calls.length,1);assert.deepEqual(transcripts,['你好']);assert.ok(states.includes('transcribing'));
 assert.equal(a.calls[0].url,'/api/transcribe?language=auto');assert.equal(a.calls[0].headers['Content-Type'],'audio/wav');validateAudio({audio:Buffer.from(a.calls[0].body)});assert.equal(r.active,false);
});
test('a short click is not uploaded; continuous audio is capped; stopping ignores late recognition',async()=>{
 let resolve;const a=recorder(()=>new Promise(r=>resolve=r)),r=new a.Recognition();let results=0;r.onresult=()=>results++;r.start();await flush();a.feed(.1,100);a.feed(0,1200);assert.equal(a.calls.length,0);
 a.feed(.1,16000);assert.equal(a.calls.length,1);assert.ok(a.calls[0].body.length<=490000);
 r.abort();assert.equal(a.calls[0].signal.aborted,true);resolve(new Response(JSON.stringify({text:'late'})));await flush();assert.equal(results,0);
});
test('long file-backed speech is recorded across bounded parts and delivered once in recording order',async()=>{
 for(const [first,second,full] of [
  ['We should stop by the river','the river and get water.','We should stop by the river and get water.'],
  ['We should stop by the riv','the river and get water.','We should stop by the river and get water.'],
  ['우리 바람을 느껴','바람을 느껴 보고 싶어.','우리 바람을 느껴 보고 싶어.'],
  ['자전거를 타','타고 갈게.','자전거를 타고 갈게.'],
  ['我们一起去河边','去河边看看吧。','我们一起去河边看看吧。']
 ]){
  const resolvers=[],a=recorder(()=>new Promise(resolve=>resolvers.push(resolve))),r=new a.Recognition(),final=[];
  let endings=0;r.onspeechend=()=>endings++;r.onresult=e=>{if(e.results[0].isFinal)final.push(e.results[0][0].transcript);};
  r.start();await flush();a.feed(.08,15300);
  assert.equal(endings,0);assert.equal(a.calls.length,1);assert.equal(r.active,true);
  a.feed(0,800);assert.equal(endings,1);assert.equal(a.calls.length,2);
  for(const call of a.calls)assert.doesNotThrow(()=>validateAudio({audio:Buffer.from(call.body)}));
  resolvers[1](Response.json({text:second}));await flush();assert.deepEqual(final,[]);
  resolvers[0](Response.json({text:first}));await flush();assert.deepEqual(final,[full]);assert.equal(r.active,false);
 }
});
test('live ASR moves to the next segment without ending the turn or talking over a short breath',async()=>{
 const sockets=[],interims=[],finals=[];
 class Socket{
  constructor(){sockets.push(this);this.readyState=1;this.bufferedAmount=0;}
  send(frame){if(typeof frame==='string'&&JSON.parse(frame).type==='finish')this.finishes=(this.finishes||0)+1;}
  close(){this.readyState=3;}
  event(type,text){this.onmessage({data:JSON.stringify({type,text})});}
 }
 const input={onLevel(){},attach:async()=>{},detach(){}};
 const R=createMicrophoneRecognition({input,Socket,location:new URL('https://ride.test'),setTimer:()=>1,clearTimer(){},fetchImpl:()=>assert.fail('live ASR should cover the entire turn')});
 const r=new R();r.onresult=e=>{const result=e.results[0];(result.isFinal?finals:interims).push(result[0].transcript);};r.start();
 const frame=new Float32Array(320).map((_,i)=>.08*Math.sin(2*Math.PI*185*i/16000));
 const quiet=new Float32Array(320),feed=(ms,pcm)=>{for(let n=0;n<ms;n+=20)r.samples(pcm,16000);};
 feed(12100,frame);feed(200,quiet);
 assert.equal(sockets.length,1);assert.equal(sockets[0].finishes,1);
 sockets[0].event('final','Slow');assert.deepEqual(finals,[]);
 feed(500,frame);assert.equal(sockets.length,2);sockets[1].event('partial','slow please');
 assert.equal(interims.at(-1),'Slow slow please');
 feed(600,quiet);sockets[1].event('final','slow please.');
 assert.deepEqual(finals,['Slow slow please.']);
});
test('a real ending at a segment boundary uses only one upload, and a route change discards a pending segment',async()=>{
 const resolvers=[],a=recorder(()=>new Promise(resolve=>resolvers.push(resolve))),r=new a.Recognition(),finals=[];
 r.onresult=e=>{if(e.results[0].isFinal)finals.push(e.results[0][0].transcript);};
 r.start();await flush();a.feed(.08,12400);a.feed(0,300);
 assert.equal(a.calls.length,1);assert.equal(r.finalizing,undefined);
 r.resetCapture();assert.equal(a.calls[0].signal.aborted,true);
 resolvers[0](Response.json({text:'old route'}));await flush();assert.deepEqual(finals,[]);
 a.feed(.08,12400);a.feed(0,1000);assert.equal(a.calls.length,2);
 resolvers[1](Response.json({text:'새 기기로 말했어.'}));await flush();assert.deepEqual(finals,['새 기기로 말했어.']);
});
test('cloud recognition completes the hands-free loop without browser SpeechRecognition',async()=>{
 const a=recorder(),states=[],spoken=[],timers=new Map();let id=0;
 const session=new HandsFreeConversation({Recognition:a.Recognition,releaseInput:()=>a.input.release(),getContext:()=>({}),fetchImpl:async(_,options)=>{
  assert.equal(JSON.parse(options.body).language,'en');return new Response(JSON.stringify({soul:'lumi',reply:'I can hear you.'}));
 },onState:s=>states.push(s),speak:(text,lang,soul,callback)=>{assert.equal(a.input.receiver,null);spoken.push({text,callback});},setTimer:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimer:i=>timers.delete(i)});
 session.start('lumi','en');assert.equal(session.state,'starting');await flush();a.feed(.08,700);a.feed(0,1100);await flush();await flush();
 assert.deepEqual(states.slice(-4),['hearing','transcribing','thinking','synthesizing']);assert.equal(spoken[0].text,'I can hear you.');
 spoken[0].callback('ended');const resume=[...timers.values()].find(t=>t.ms===100);resume.fn();await flush();a.feed(0,100);assert.equal(session.state,'listening');
 session.stop();assert.equal(a.input.receiver,null);
});

test('background hum and broadband hiss never upload hallucinated thanks; spoken thanks remains valid',async()=>{
 const a=recorder(async()=>new Response(JSON.stringify({text:'Thank you.'}))),r=new a.Recognition(),results=[];
 r.onresult=e=>results.push(e.results[0][0].transcript);r.start();await flush();
 a.feed(.004,16000);
 let seed=42;
 for(let n=0;n<160;n++){
  const data=Float32Array.from({length:1600},()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed/4294967296*2-1)*.07;});
  a.input.receiver?.samples(data,16000);
 }
 a.feed(0,1000);assert.equal(a.calls.length,0);assert.deepEqual(results,[]);
 // A voiced utterance with a varying envelope must still reach the recognizer.
 for(let n=0;n<6;n++)a.input.receiver?.samples(Float32Array.from({length:1600},(_,i)=>Math.sin(2*Math.PI*180*i/16000)*(.06+n*.008)),16000);
 a.feed(0,800);await flush();assert.equal(a.calls.length,1);assert.deepEqual(results,['Thank you.']);r.abort();
});

test('a steady soft motor tone stays local while a quieter syllable with a varying envelope triggers speech',async()=>{
 const a=recorder(),r=new a.Recognition();let starts=0;
 r.onspeechstart=()=>starts++;
 r.start();await flush();
 let offset=0;
 function feedFrames(frames,amplitude){
  for(let n=0;n<frames;n++){
   const frame=Float32Array.from({length:320},(_,i)=>amplitude(n)*Math.sin(2*Math.PI*250*(offset+i)/16000));
   offset+=frame.length;r.samples(frame,16000);
  }
 }
 feedFrames(60,()=>.007);
 feedFrames(20,()=>0);
 assert.equal(starts,0);assert.equal(a.calls.length,0);
 feedFrames(12,n=>[.0062,.0075,.0092,.0079][n%4]);
 assert.equal(starts,1);
 feedFrames(40,()=>0);
 assert.equal(a.calls.length,1);r.abort();
});

test('cycling rumble and a click stay local at common sample rates, while a quiet short word reaches ASR',async()=>{
 for(const rate of [16000,44100,48000]){
  const a=recorder(),r=new a.Recognition(),results=[];
  r.onresult=e=>results.push(e.results[0][0].transcript);r.start();await flush();
  const frame=Math.round(rate*.02);let offset=0,seed=19;
  const feed=(samples,kind)=>{
   for(let n=0;n<samples;n++){
    const pcm=Float32Array.from({length:frame},(_,i)=>{
      const t=(offset+i)/rate;
      if(kind==='wind')return .09*Math.sin(2*Math.PI*42*t)+.035*Math.sin(2*Math.PI*61*t)+.02;
      if(kind==='hiss'){
       seed=(Math.imul(seed,1664525)+1013904223)>>>0;
       return (seed/4294967296*2-1)*.06;
      }
      if(kind==='click')return i<5?.8:0;
      if(kind==='short')return .025*Math.sin(2*Math.PI*195*t)+.013*Math.sin(2*Math.PI*390*t);
      return 0;
    });
    offset+=frame;r.samples(pcm,rate);
   }
  };
  feed(100,'wind');feed(100,'hiss');feed(1,'click');feed(40,'silence');
  assert.equal(a.calls.length,0,rate+' Hz noise gate');
  feed(7,'short');feed(17,'silence');assert.equal(a.calls.length,0);
  feed(1,'silence');await flush();
  assert.equal(a.calls.length,1,rate+' Hz 140 ms utterance');
  assert.deepEqual(results,['你好']);
 }
});

test('a provider result without confirmed speech cannot become a user message',async()=>{
 const a=recorder(),r=new a.Recognition(),results=[],errors=[];r.onresult=e=>results.push(e);r.onerror=e=>errors.push(e.error);
 r.start();await flush();a.feed(0,500);r.deliver('Thank you.');assert.deepEqual(results,[]);assert.deepEqual(errors,['no-speech']);
});

test('file transcription exposes the server retry interval even when it is only in a header',async()=>{
 const a=recorder(async()=>Response.json({error:'minute_limit'},{status:429,headers:{'Retry-After':'12'}}));
 const r=new a.Recognition(),errors=[];
 r.onerror=event=>errors.push(event);
 r.start();await flush();a.feed(.08,700);a.feed(0,1100);await flush();
 assert.deepEqual(errors,[{error:'minute_limit',retryAfter:12}]);
});

test('wind and steady low motor noise stay local while faint syllables above the rumble form one complete turn',async()=>{
 const a=recorder(),r=new a.Recognition(),rate=48000,size=1024;
 let offset=0,starts=0;
 r.onspeechstart=()=>starts++;r.start();await flush();
 function feed(count,voice=()=>0){
  for(let n=0;n<count;n++){
   const frame=Float32Array.from({length:size},(_,i)=>{
    const t=(offset+i)/rate;
    return .035*Math.sin(2*Math.PI*44*t)+.014*Math.sin(2*Math.PI*67*t)
      +.0015*Math.sin(2*Math.PI*610*t)+voice(t,n);
   });
   offset+=size;r.samples(frame,rate);
  }
 }
 const syllables=(t,n)=>(.005+.00275*Math.sin(n*.73))*Math.sin(2*Math.PI*850*t);
 feed(60);assert.equal(starts,0);
 feed(20,syllables);assert.equal(starts,1);
 feed(14);assert.equal(a.calls.length,0);
 feed(14,syllables);assert.equal(a.calls.length,0);
 feed(42);await flush();
 assert.equal(starts,1);assert.equal(a.calls.length,1);
});

test('a faint initial fragment is buffered through hesitation and included in the uploaded waveform',async()=>{
 const a=recorder(),r=new a.Recognition(),rate=16000,size=320;
 r.start();await flush();
 function feed(count,amplitude,frequency){
  for(let n=0;n<count;n++)r.samples(Float32Array.from({length:size},(_,i)=>amplitude*Math.sin(2*Math.PI*frequency*(n*size+i)/rate)),rate);
 }
 feed(5,0,0);feed(2,.002,800);feed(26,0,0);
 assert.equal(a.calls.length,0);
 feed(18,.06,250);feed(40,0,0);await flush();
 assert.equal(a.calls.length,1);
 const wav=Buffer.from(a.calls[0].body);
 const fragment=Array.from({length:size},(_,i)=>Math.abs(wav.readInt16LE(44+2*(rate*.1+i))));
 assert.ok(Math.max(...fragment)>45,'quiet prefix is present before the main voice');
});

function fakeAudio(){
 const contexts=[],tracks=[],processors=[];
 class Context{constructor(){this.state='running';this.sampleRate=48000;this.destination={};contexts.push(this);}resume(){return Promise.resolve();}close(){this.closed=true;return Promise.resolve();}createMediaStreamSource(){return {connect(){},disconnect(){}};}createGain(){return {gain:{},connect(){},disconnect(){}};}createScriptProcessor(){const p={connect(){},disconnect(){this.disconnected=true;}};processors.push(p);return p;}}
 const stream=()=>{const track={stop(){this.stopped=true;},addEventListener(){}};tracks.push(track);return {getTracks:()=>[track]};};
 return {Context,contexts,tracks,processors,stream};
}
test('microphone keeps one stream between turns and releases tracks/context on exit',async()=>{
 const a=fakeAudio();let grants=0;const input=new MicrophoneInput({Context:a.Context,WorkletNode:null,mediaDevices:{getUserMedia:async options=>{assert.equal(options.audio.echoCancellation,true);assert.equal(options.audio.noiseSuppression,true);assert.equal(options.audio.autoGainControl,false);grants++;return a.stream();}}});
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

test('end of speech submits in about half a second while shorter pauses remain in the same turn',async()=>{
 const a=recorder(),r=new a.Recognition();r.start();await flush();a.feed(.08,700);a.feed(0,300);assert.equal(a.calls.length,0);a.feed(.08,300);a.feed(0,300);assert.equal(a.calls.length,0);a.feed(0,300);assert.equal(a.calls.length,1);r.abort();
});

test('batch ASR can finish clean, strong speech sooner while keeping a 400 ms pause and weak Korean tail',()=>{
 const rate=16000;
 function capture(){
  let ended=0;
  const input={attach:async()=>{},detach(){},onLevel(){}};
  const R=createMicrophoneRecognition({input,Socket:null,setTimer:()=>1,clearTimer(){},fetchImpl:async()=>Response.json({text:'네'})});
  const r=new R();r.onspeechend=()=>ended++;r.start();
  return {feed(ms,amp=0){for(let n=0;n<ms;n+=20)r.samples(Float32Array.from({length:320},(_,i)=>amp*Math.sin(2*Math.PI*200*i/rate)),rate);},ended:()=>ended,stop:()=>r.abort()};
 }
 const clean=capture();clean.feed(640,.06);clean.feed(400);assert.equal(clean.ended(),0);
 clean.feed(240,.06);clean.feed(440);assert.equal(clean.ended(),0);clean.feed(40);assert.equal(clean.ended(),1);clean.stop();
 const faint=capture();faint.feed(640,.06);faint.feed(200,.006);faint.feed(480);
 assert.equal(faint.ended(),0);faint.feed(80);assert.equal(faint.ended(),1);faint.stop();
 const low=capture();low.feed(680,.012);low.feed(480);
 assert.equal(low.ended(),0);low.feed(80);assert.equal(low.ended(),1);low.stop();
 const noisy=capture();noisy.feed(640,.06);noisy.feed(480,.002);
 assert.equal(noisy.ended(),0);noisy.feed(80);assert.equal(noisy.ended(),1);noisy.stop();
});

test('streaming previews shorten a clear endpoint only after acoustic silence, across input languages',()=>{
 const rate=16000,frame=320;
 function capture(){
  let socket,finished=0;
  class Socket{
   constructor(){socket=this;this.readyState=1;this.bufferedAmount=0;}
   close(){this.readyState=3;}
   send(message){if(typeof message==='string'&&JSON.parse(message).type==='finish')finished++;}
  }
  const R=createMicrophoneRecognition({input:{attach:async()=>{},detach(){},onLevel(){}},Socket,location:new URL('https://ride.test'),setTimer:()=>1,clearTimer(){}});
  const r=new R();r.start();
  return {
   feed(ms,amplitude=0){
    for(let elapsed=0;elapsed<ms;elapsed+=20)r.samples(Float32Array.from({length:frame},(_,i)=>amplitude*Math.sin(2*Math.PI*200*i/rate)),rate);
   },
   preview:text=>socket.onmessage({data:JSON.stringify({type:'partial',text})}),
   finished:()=>finished,stop:()=>r.abort()
  };
 }
 for(const [text,target] of [['Should we stop?',320],['We can stop here',460],['이제 같이 갈게',360],['我们停一下吧',360],['yes',280]]){
  const a=capture();a.feed(400,.04);a.preview(text);
  a.feed(target-20);assert.equal(a.finished(),0,text);
  a.feed(40);assert.equal(a.finished(),1,text);a.stop();
 }
 const unfinished=capture();unfinished.feed(420,.04);unfinished.preview('I am looking for');
 unfinished.feed(480);assert.equal(unfinished.finished(),0);
 unfinished.feed(160,.035);unfinished.preview('I am looking for shade.');
 unfinished.feed(340);assert.equal(unfinished.finished(),1);unfinished.stop();
 const resumed=capture();resumed.feed(400,.04);resumed.preview('갈게');
 resumed.feed(220);resumed.feed(160,.008);resumed.feed(480);assert.equal(resumed.finished(),0,'a quiet Korean continuation invalidates the old ending');
 resumed.feed(80);assert.equal(resumed.finished(),1);resumed.stop();
 const noise=capture();noise.feed(400,.04);noise.preview('All done.');
 noise.feed(400,.0027);assert.equal(noise.finished(),0,'audio above the local floor prevents the accelerated close');
 noise.stop();
 for(const [text,target] of [['Shall we stop?',240],['We can stop here',380],['이제 같이 갈게',280],['我们停一下吧',280]]){
  const a=capture();a.feed(560,.06);a.feed(140);a.preview(text);
  a.feed(target-160);assert.equal(a.finished(),0,text);a.feed(40);assert.equal(a.finished(),1,text);a.stop();
 }
 const late=capture();late.feed(560,.06);late.feed(300);late.preview('All done.');assert.equal(late.finished(),1);late.stop();
 const growing=capture();growing.feed(460,.06);growing.preview('Shall we');growing.feed(100,.06);growing.preview('Shall we stop?');
 growing.feed(220);assert.equal(growing.finished(),0);growing.feed(40);assert.equal(growing.finished(),1);growing.stop();
 for(const text of ['I am looking for.','좋은데, 그리고.','我想说的是，因为。']){
  const a=capture();a.feed(560,.06);a.feed(180);a.preview(text);a.feed(320);assert.equal(a.finished(),0,text);a.stop();
 }
});

test('silent PCM stays listening, but a stalled capture graph fails and releases its watchdog',async()=>{
 let now=0,id=0;const timers=new Map(),errors=[];
 const input={attach:async()=>{},detach(){},onLevel(){}};
 const Recognition=createMicrophoneRecognition({input,now:()=>now,setTimer:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimer:id=>timers.delete(id)});
 const r=new Recognition();r.onerror=e=>errors.push(e.error);r.start();await flush();assert.equal(r.startTimeoutMs,50000);
 const feed=()=>r.samples(new Float32Array(1600),16000),run=()=>{const [id,t]=[...timers.entries()].find(([,t])=>t.ms===6000);timers.delete(id);t.fn();};
 feed();now=5000;feed();now=6000;run();assert.deepEqual(errors,[]);assert.equal(r.active,true);
 now=12000;run();assert.deepEqual(errors,['audio-capture']);assert.equal(r.active,false);assert.equal(timers.size,0);
 r.abort();assert.equal(timers.size,0);
});
