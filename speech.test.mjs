import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {CloudSpeechPlayer,speechChunks} from './public/cloud-speech.mjs';
import {createChatService,createChatHandler,validateSpeech,speechAudioURL} from './chat-service.mjs';
const wav=readFileSync(new URL('./public/audio/en/lumi-hello.wav',import.meta.url));
const env={DASHSCOPE_API_KEY:'test-private-key'},input={soul:'lumi',language:'en',text:'I can hear you. Keep talking.'};
const flush=()=>new Promise(r=>setImmediate(r));
test('speech validates bounded text and restricts provider audio URLs',()=>{
 for(const body of [{...input,text:''},{...input,text:'a'.repeat(601)},{...input,soul:'unknown'},{...input,language:'fr'}])assert.throws(()=>validateSpeech(body));
 assert.equal(validateSpeech({...input,language:'zh'}).language,'English');
 for(const url of ['http://127.0.0.1/test.wav','https://example.com/audio.wav','https://dashscope-result-sgp.oss-ap-southeast-1.aliyuncs.com.evil.test/x','https://x@dashscope-result-sgp.oss-ap-southeast-1.aliyuncs.com/x'])assert.throws(()=>speechAudioURL(url));
 assert.match(speechAudioURL('http://dashscope-result-sgp.oss-ap-southeast-1.aliyuncs.com/x.wav'),/^https:/);
});
test('cloud speech returns real audio, uses persona voices and never forwards credentials to storage',async()=>{
 const voices=[];let downloads=0;const service=createChatService({env,fetchImpl:async(url,options)=>{
  if(url.endsWith('/generation')){assert.equal(options.headers.Authorization,'Bearer test-private-key');const body=JSON.parse(options.body);voices.push(body.input.voice);assert.equal(body.model,'qwen3-tts-flash');return new Response(JSON.stringify({output:{audio:{url:'https://dashscope-result-sgp.oss-ap-southeast-1.aliyuncs.com/file.wav'}}}));}
  downloads++;assert.equal(options.headers,undefined);assert.equal(options.redirect,'error');return new Response(wav);
 }});
 for(const soul of ['lumi','mori','bori'])assert.deepEqual(await service.speech({...input,soul}),wav);
 assert.deepEqual(voices,['Cherry','Serena','Chelsie']);assert.equal(downloads,3);
});
test('speech HTTP route serves non-cacheable WAV and enforces origins and shared budget',async t=>{
 const handler=createChatHandler({env:{...env,QWEN_MAX_DAILY_REQUESTS:'1'},fetchImpl:async url=>url.endsWith('/generation')?new Response(JSON.stringify({output:{audio:{url:'https://dashscope-result-sgp.oss-ap-southeast-1.aliyuncs.com/a.wav'}}})):new Response(wav)});
 const server=http.createServer(async(req,res)=>{if(!await handler(req,res)){res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 const send=(origin=base)=>fetch(base+'/api/speech',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(input)});
 assert.equal((await send('https://elsewhere.example')).status,403);assert.equal((await fetch(base+'/api/speech')).status,405);
 const response=await send();assert.equal(response.headers.get('content-type'),'audio/wav');assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(Buffer.from(await response.arrayBuffer()),wav);assert.equal((await send()).status,429);
});
test('invalid audio is rejected and provider failures are sanitized',async()=>{
 const service=createChatService({env,fetchImpl:async url=>url.endsWith('/generation')?new Response(JSON.stringify({output:{audio:{url:'https://dashscope-result-sgp.oss-ap-southeast-1.aliyuncs.com/a.wav'}}})):new Response('not audio')});
 await assert.rejects(service.speech(input),{code:'invalid_response'});
 const denied=createChatService({env,fetchImpl:async()=>new Response('test-private-key',{status:401})});await assert.rejects(denied.speech(input),{code:'provider_auth'});
});
function playerSetup(fetchImpl=async()=>new Response(wav)){
 const sources=[],contexts=[],requests=[],timers=new Map();let i=0;
 class Context{constructor(){this.state='suspended';this.sampleRate=24000;this.destination={};contexts.push(this);}resume(){this.state='running';return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}createBuffer(){return {duration:0};}decodeAudioData(){return Promise.resolve({duration:2});}createBufferSource(){const source={playbackRate:{value:1},connect(){},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(){this.stopped=true;}};sources.push(source);return source;}}
 const player=new CloudSpeechPlayer({Context,fetchImpl:(url,options)=>{requests.push({url,options});return fetchImpl(url,options);},setTimer:(fn,ms)=>{timers.set(++i,{fn,ms});return i;},clearTimer:id=>timers.delete(id)});
 return {player,sources,contexts,requests,timers};
}
test('unlock once, play multiple cloud replies and finish without speechSynthesis',async()=>{
 const a=playerSetup(),states=[];assert.equal(await a.player.prepare(),true);
 for(const text of ['Hello there.','What do you see?','I am still listening.']){
  const promise=a.player.speak(text,{onState:s=>states.push(s)});await flush();assert.equal(states.at(-1),'playing');const source=a.sources.at(-1);assert.equal(source.started,true);source.onended();await promise;assert.equal(states.at(-1),'ended');
 }
 assert.equal(a.contexts.length,1);assert.equal(a.requests.length,3);assert.ok(a.requests.every(r=>r.url==='/api/speech/stream'));assert.equal(a.timers.size,0);a.player.dispose();assert.equal(a.contexts[0].state,'closed');
});
test('stop cancels pending generation and ignores its late response; old cleanup cannot clear new timeout',async()=>{
 let resolve;const a=playerSetup(()=>new Promise(r=>resolve=r));await a.player.prepare();const first=a.player.speak('First');await flush();const firstResolve=resolve;
 const second=a.player.speak('Second');await flush();assert.ok(a.requests[0].options.signal.aborted);firstResolve(new Response(wav));await first;assert.equal(a.timers.size,1);a.player.stop();resolve(new Response(wav));await second;assert.equal(a.sources.filter(s=>s.buffer?.duration===2).length,0);a.player.dispose();
});
test('blocked output reports an actionable state and long replies are split without dropping words',async()=>{
 const a=playerSetup(),states=[];await a.player.speak('Hi',{onState:s=>states.push(s)});assert.equal(states.at(-1),'blocked');assert.equal(a.requests.length,0);
 const text=('A lovely tree. ').repeat(100).trim(),parts=speechChunks(text);assert.ok(parts.length>1);assert.ok(parts.every(p=>p.length<=540));assert.equal(parts.join(' '),text);
});
test('playback cancellation silences its node and does not emit a late ended event',async()=>{
 const a=playerSetup(),states=[];await a.player.prepare();const promise=a.player.speak('Hello',{onState:s=>states.push(s)});await flush();const source=a.sources.at(-1),late=source.onended;a.player.stop();await promise;late();assert.equal(source.stopped,true);assert.deepEqual(states,['loading','playing']);a.player.dispose();
});
