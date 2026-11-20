import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {EventEmitter,once} from 'node:events';
import WebSocket from 'ws';
import {attachRealtimeAsr} from './asr-realtime.mjs';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function waitFor(predicate){
 const end=Date.now()+2000;
 while(!predicate()){
  if(Date.now()>end)throw new Error('Timed out waiting for ASR event');
  await new Promise(resolve=>setTimeout(resolve,5));
 }
}
class Provider extends EventEmitter{
 constructor(){
  super();this.frames=[];this.tasks=[];this.readyState=WebSocket.CONNECTING;this.bufferedAmount=0;
  queueMicrotask(()=>{if(this.readyState===WebSocket.CONNECTING){this.readyState=WebSocket.OPEN;this.emit('open');}});
 }
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
async function setup(t){
 const providers=[],clients=[],env={DASHSCOPE_API_KEY:'test-qwen-key'};
 const server=http.createServer((req,res)=>res.end());
 attachRealtimeAsr(server,{env,reserve:()=>()=>{},connect:()=>{const p=new Provider();providers.push(p);return p;}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{for(const c of clients)c.terminate();await new Promise(resolve=>server.close(resolve));});
 const origin='http://127.0.0.1:'+server.address().port;
 async function start(language='en'){
  const previousTasks=providers.reduce((n,p)=>n+p.tasks.length,0);
  const socket=new WebSocket(origin.replace('http:','ws:')+'/api/transcribe/live?language='+language,{origin});
  clients.push(socket);const events=[];
  socket.on('message',raw=>events.push(JSON.parse(raw)));
  await waitFor(()=>providers.reduce((n,p)=>n+p.tasks.length,0)>previousTasks);
  const provider=providers.at(-1);
  return {socket,events,provider,id:provider.tasks.at(-1).header.task_id};
 }
 return {providers,start,env};
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
