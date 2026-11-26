import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {EventEmitter,once} from 'node:events';
import WebSocket from 'ws';
import {attachRealtimeAsr} from './asr-realtime.mjs';
import {ChatError} from './chat-service.mjs';
import {buildConnector} from 'undici';
import {createQwenTransport} from './qwen-transport.mjs';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function waitFor(predicate){
 const end=Date.now()+2000;
 while(!predicate()){
  if(Date.now()>end)throw new Error('Timed out waiting for ASR event');
  await new Promise(resolve=>setTimeout(resolve,5));
 }
}

test('microphone warmup sends no HTTP request and both overlapping calls use existing connections',async t=>{
 const sockets=new Set(),requests=[];
 const server=http.createServer((req,res)=>{requests.push({socket:req.socket,res});});
 server.on('connection',socket=>sockets.add(socket));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const transport=createQwenTransport(origin);
 t.after(async()=>{for(const socket of sockets)socket.destroy();await transport.close();await new Promise(done=>server.close(done));});
 transport.warm();transport.warm();
 await waitFor(()=>sockets.size===2);
 await tick();
 assert.equal(requests.length,0);
 const warmed=new Set(sockets);
 const pending=Promise.all(['/chat','/speech'].map(path=>fetch(origin+path,{dispatcher:transport.dispatcher}).then(res=>res.text())));
 await waitFor(()=>requests.length===2);
 assert.equal(sockets.size,2);
 for(const {socket,res} of requests){assert.ok(warmed.has(socket));res.end('ok');}
 assert.deepEqual(await pending,['ok','ok']);
});

test('failed speculative connections never block the real request',async t=>{
 const server=http.createServer((req,res)=>res.end('ok'));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const cold=buildConnector({});
 let calls=0;
 const transport=createQwenTransport(origin,{dial(options,callback){
   if(++calls<=2)queueMicrotask(()=>callback(new Error('offline'),null));
   else cold(options,callback);
 }});
 t.after(async()=>{await transport.close();await new Promise(done=>server.close(done));});
 transport.warm();
 const response=await fetch(origin+'/chat',{dispatcher:transport.dispatcher});
 assert.equal(await response.text(),'ok');assert.equal(calls,3);
});
class Provider extends EventEmitter{
 constructor(automaticOpen=true){
  super();this.frames=[];this.tasks=[];this.readyState=WebSocket.CONNECTING;this.bufferedAmount=0;
  if(automaticOpen)queueMicrotask(()=>this.open());
 }
 open(){if(this.readyState===WebSocket.CONNECTING){this.readyState=WebSocket.OPEN;this.emit('open');}}
 send(raw){
  if(Buffer.isBuffer(raw)){this.frames.push(Buffer.from(raw));return;}
  const request=JSON.parse(raw);
  this.frames.push(request);
  if(request.header.action==='run-task')this.tasks.push(request);
 }
 event(taskId,event,payload={}){this.emit('message',Buffer.from(JSON.stringify({header:{event,task_id:taskId},payload})));}
 sentence(taskId,text,ended){this.event(taskId,'result-generated',{output:{sentence:{sentence_id:1,text,sentence_end:ended}}});}
 terminate(){
  if(this.readyState===WebSocket.CLOSED)return;
  this.readyState=WebSocket.CLOSED;
  this.emit('close');
 }
}
async function setup(t,{reserve=()=>()=>{},automaticOpen=true}={}){
 const providers=[],clients=[],env={DASHSCOPE_API_KEY:'test-qwen-key'};
 const server=http.createServer((req,res)=>res.end());
 attachRealtimeAsr(server,{env,reserve,connect:()=>{const p=new Provider(automaticOpen);providers.push(p);return p;}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{for(const c of clients)c.terminate();await new Promise(resolve=>server.close(resolve));});
 const origin='http://127.0.0.1:'+server.address().port;
 async function start(language='en'){
  const previousTasks=providers.reduce((n,p)=>n+p.tasks.length,0);
  const socket=new WebSocket(origin.replace('http:','ws:')+'/api/transcribe/live?language='+language,{origin});
  clients.push(socket);const events=[];
  socket.on('message',raw=>events.push(JSON.parse(raw)));
  await once(socket,'open');
  await waitFor(()=>providers.reduce((n,p)=>n+p.tasks.length,0)>previousTasks);
  const provider=providers.at(-1);
  return {socket,events,provider,id:provider.tasks.at(-1).header.task_id};
 }
 async function standby(language='en'){
  const socket=new WebSocket(origin.replace('http:','ws:')+'/api/transcribe/standby?language='+language,{origin});
  clients.push(socket);const events=[];
  socket.on('message',raw=>events.push(JSON.parse(raw)));
  await once(socket,'open');return {socket,events};
 }
 return {providers,start,standby,env,origin};
}
async function complete({socket,events,provider,id},text){
 provider.event(id,'task-started');await waitFor(()=>events.some(e=>e.type==='ready'));
 socket.send(Buffer.alloc(80));
 socket.send(JSON.stringify({type:'finish'}));
 await waitFor(()=>provider.frames.some(f=>f.header?.action==='finish-task'&&f.header.task_id===id));
 provider.sentence(id,text,true);
 const done=once(socket,'close');
 provider.event(id,'task-finished');await done;
 assert.deepEqual(events.at(-1),{type:'final',text});
}

test('successive Qwen duplex tasks reuse one quiet transport with separate task IDs and transcripts',async t=>{
 const app=await setup(t),first=await app.start('ko');
 await complete(first,'첫 번째.');
 const p=first.provider,frames=p.frames.length;
 await tick();
 assert.equal(p.readyState,WebSocket.OPEN);
 assert.equal(p.frames.length,frames);
 const next=await app.start('en');
 assert.equal(app.providers.length,1);
 assert.notEqual(next.id,first.id);
 assert.equal(p.tasks.at(-1).payload.model,'qwen-audio-3.1-asr-flash-message');
 p.sentence(first.id,'old private sentence',true);
 p.event(first.id,'task-finished');
 await complete(next,'Just the new sentence.');
 assert.ok(next.events.every(e=>!e.text?.includes('private')));
});

test('canceled, failed and closed-idle Qwen connections are replaced',async t=>{
 const app=await setup(t),canceled=await app.start();
 canceled.provider.event(canceled.id,'task-started');
 await waitFor(()=>canceled.events.some(e=>e.type==='ready'));
 canceled.socket.close();await waitFor(()=>canceled.provider.readyState===WebSocket.CLOSED);
 const failed=await app.start();
 assert.equal(app.providers.length,2);
 failed.provider.event(failed.id,'task-failed');
 await waitFor(()=>failed.provider.readyState===WebSocket.CLOSED);
 const completed=await app.start();
 assert.equal(app.providers.length,3);await complete(completed,'Hello.');
 completed.provider.terminate();
 const replacement=await app.start();
 assert.equal(app.providers.length,4);await complete(replacement,'Back.');
});

test('a reclaimed connection lost before task-started retries with buffered PCM and a fresh task',async t=>{
 const app=await setup(t),first=await app.start();
 await complete(first,'First.');
 const next=await app.start();
 next.socket.send(Buffer.from([255,0]));
 next.socket.send(JSON.stringify({type:'finish'}));
 next.provider.terminate();
 await waitFor(()=>app.providers.length===2&&app.providers[1].tasks.length===1);
 const p=app.providers[1],id=p.tasks[0].header.task_id;
 assert.notEqual(id,next.id);
 assert.ok(!p.frames.some(Buffer.isBuffer));
 p.event(id,'task-started');
 await waitFor(()=>p.frames.some(f=>f.header?.action==='finish-task'));
 assert.deepEqual(p.frames.filter(Buffer.isBuffer),[Buffer.from([255,0])]);
 p.sentence(id,'Second.',true);p.event(id,'task-finished');
 await waitFor(()=>next.events.some(e=>e.type==='final'));
 assert.deepEqual(next.events.filter(e=>e.type==='final'),[{type:'final',text:'Second.'}]);
});

test('an idle connection authenticated for a previous key or endpoint cannot be reclaimed',async t=>{
 const app=await setup(t);
 const first=await app.start();await complete(first,'One.');
 app.env.DASHSCOPE_API_KEY='new-qwen-key';
 const second=await app.start();assert.equal(app.providers.length,2);
 assert.equal(first.provider.readyState,WebSocket.CLOSED);await complete(second,'Two.');
 app.env.QWEN_BASE_URL='https://new-workspace.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1';
 const third=await app.start();assert.equal(app.providers.length,3);
 assert.equal(second.provider.readyState,WebSocket.CLOSED);await complete(third,'Three.');
});

test('overlapping riders get exclusive transports and at most one completed connection stays idle',async t=>{
 const app=await setup(t),first=await app.start('en'),second=await app.start('ko');
 assert.equal(app.providers.length,2);
 assert.notEqual(first.provider,second.provider);
 await complete(first,'First rider.');await complete(second,'둘째.');
 assert.equal(first.provider.readyState,WebSocket.CLOSED);
 assert.equal(second.provider.readyState,WebSocket.OPEN);
 // Traffic after task-finished makes the idle transport ineligible for reuse.
 second.provider.event(second.id,'task-failed');
 assert.equal(second.provider.readyState,WebSocket.CLOSED);
 const next=await app.start('ko');assert.equal(app.providers.length,3);
 await complete(next,'다시.');
});

test('English and Korean standby share only an empty Qwen transport; the last cancellation closes it',async t=>{
 let reservations=0;
 const app=await setup(t,{reserve(){reservations++;return ()=>{};}});
 const first=await app.standby('en'),second=await app.standby('ko');
 assert.equal(app.providers.length,1);
 const provider=app.providers[0];
 assert.equal(provider.readyState,WebSocket.OPEN);
 assert.deepEqual(provider.frames,[]);assert.equal(reservations,0);
 first.socket.close();await once(first.socket,'close');
 assert.equal(provider.readyState,WebSocket.OPEN);
 second.socket.send(Buffer.alloc(10));
 await once(second.socket,'close');
 await waitFor(()=>provider.readyState===WebSocket.CLOSED);
 assert.deepEqual(provider.frames,[]);assert.equal(reservations,0);
 // Rapidly reopening standby cannot repeatedly dial the provider.
 await app.standby();assert.equal(app.providers.length,1);
});

test('speech can claim a pending handshake without a second dial and sends queued PCM only after task-started',async t=>{
 let reservations=0;
 const app=await setup(t,{automaticOpen:false,reserve(){reservations++;return ()=>{};}});
 const {socket,events}=await app.standby('ko'),provider=app.providers[0];
 const audio=Buffer.from([1,2,3,4]);
 assert.equal(provider.readyState,WebSocket.CONNECTING);
 socket.send('{"type":"start"}');socket.send(audio);socket.send('{"type":"finish"}');
 await waitFor(()=>reservations===1);
 assert.deepEqual(provider.frames,[]);assert.equal(app.providers.length,1);
 provider.open();assert.equal(provider.tasks.length,1);
 const {header:{task_id:id},payload}=provider.tasks[0];assert.deepEqual(payload.parameters.language_hints,['ko']);
 assert.equal(provider.frames.length,1);
 provider.event(id,'task-started');
 await waitFor(()=>provider.frames.some(f=>f.header?.action==='finish-task'));
 assert.deepEqual(provider.frames.filter(Buffer.isBuffer),[audio]);
 provider.sentence(id,'안녕',true);provider.event(id,'task-finished');
 await waitFor(()=>events.some(e=>e.type==='final'&&e.text==='안녕'));
});

test('a denied activation closes the untouched prepared transport without a cloud task',async t=>{
 const app=await setup(t,{reserve(){throw new ChatError('minute_limit',429,9);}});
 const {socket,events}=await app.standby(),p=app.providers[0];
 socket.send('{"type":"start"}');
 await once(socket,'close');
 assert.deepEqual(events,[{type:'error',error:'minute_limit',retryAfter:9}]);
 assert.deepEqual(p.frames,[]);assert.equal(p.readyState,WebSocket.CLOSED);
});

test('a direct live connection receives the daily budget result before any upstream connection',async t=>{
 const app=await setup(t,{reserve(){throw new ChatError('daily_limit',429,30);}});
 const socket=new WebSocket(app.origin.replace('http:','ws:')+'/api/transcribe/live',{origin:app.origin});
 const events=[];socket.on('message',raw=>events.push(JSON.parse(raw)));await once(socket,'close');
 assert.deepEqual(events,[{type:'error',error:'daily_limit',retryAfter:30}]);
 assert.equal(app.providers.length,0);
});

test('Qwen live speech distinguishes token throughput from exhausted free credits',async t=>{
 const app=await setup(t);
 for(const [code,error] of [['Throttling.AllocationQuota','provider_rate_limited'],['AllocationQuota.FreeTierOnly','provider_quota']]){
  const {provider,socket,id,events}=await app.start();
  const closed=once(socket,'close');
  provider.emit('message',Buffer.from(JSON.stringify({header:{task_id:id,event:'task-failed',error_code:code}})));
  await closed;
  assert.equal(events.at(-1).error,error);
  assert.equal(events.at(-1).retryAfter,error==='provider_rate_limited'?2:undefined);
 }
});

test('when a prepared handshake fails during activation only the replacement gets PCM',async t=>{
 const app=await setup(t,{automaticOpen:false});
 const {socket,events}=await app.standby(),original=app.providers[0],other=await app.standby('ko');
 socket.send('{"type":"start"}');socket.send(Buffer.from([9,8]));socket.send('{"type":"finish"}');
 await waitFor(()=>original.listenerCount('open')>0);
 other.socket.close();await once(other.socket,'close');
 assert.equal(original.readyState,WebSocket.CONNECTING);
 original.terminate();
 await waitFor(()=>app.providers.length===2);const retry=app.providers[1];retry.open();
 const id=retry.tasks[0].header.task_id;
 retry.event(id,'task-started');
 await waitFor(()=>retry.frames.some(f=>f.header?.action==='finish-task'));
 assert.deepEqual(original.frames,[]);
 assert.deepEqual(retry.frames.filter(Buffer.isBuffer),[Buffer.from([9,8])]);
 retry.sentence(id,'Hello',true);retry.event(id,'task-finished');
 await waitFor(()=>events.some(e=>e.type==='final'&&e.text==='Hello'));
});
