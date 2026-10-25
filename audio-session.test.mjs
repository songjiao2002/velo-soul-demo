import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ConversationAudioSession} from './public/audio-session.mjs';
import {MicrophoneInput,createMicrophoneRecognition} from './public/microphone-asr.mjs';
import {CloudSpeechPlayer} from './public/cloud-speech.mjs';
const flush=()=>new Promise(r=>setImmediate(r));
function setup(){
 const contexts=[],tracks=[],timers=new Map(),types=[],requests=[];let id=0,type='auto',grant;
 const setTimer=(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimer=id=>timers.delete(id);
 async function run(ms){const entry=[...timers].find(([,v])=>v.ms===ms);assert.ok(entry,'pending timer '+ms);timers.delete(entry[0]);entry[1].fn();await flush();}
 class Track extends EventTarget{constructor(){super();this.readyState='live';this.muted=false;tracks.push(this);}stop(){this.readyState='ended';this.stopped=true;}end(){this.readyState='ended';this.dispatchEvent(new Event('ended'));}mute(){this.muted=true;this.dispatchEvent(new Event('mute'));}unmute(){this.muted=false;this.dispatchEvent(new Event('unmute'));}}
 const stream=()=>{const track=new Track();return {getTracks:()=>[track]};};
 const devices=new EventTarget();devices.getUserMedia=async options=>{requests.push(options);return grant?grant():stream();};
 const platform=new EventTarget();Object.defineProperty(platform,'type',{get:()=>type,set:v=>{type=v;types.push(v);}});platform.state='active';
 const document=new EventTarget();document.hidden=false;
 class Context{constructor(){this.state='running';this.currentTime=0;this.sampleRate=48000;this.destination={};this.resumes=0;contexts.push(this);}async resume(){this.resumes++;if(!this.blocked){this.state='running';this.onstatechange?.();}}async close(){this.closed=true;this.state='closed';}createMediaStreamSource(){return {connect(){},disconnect(){}};}createGain(){return {gain:{},connect(){},disconnect(){}};}createScriptProcessor(){return {connect(){},disconnect(){this.disconnected=true;}};}createBuffer(_,n,rate){return {duration:n/rate,getChannelData:()=>new Float32Array(n)};}createBufferSource(){return {connect(){},disconnect(){},start(){},stop(){}};}interrupt(){this.state='interrupted';this.onstatechange?.();}}
 const session=new ConversationAudioSession({Context,navigator:{mediaDevices:devices,audioSession:platform},document,setTimer,clearTimer});
 const input=new MicrophoneInput({Context,audioSession:session,mediaDevices:devices,setTimer,clearTimer,WorkletNode:null});
 return {session,input,Context,contexts,tracks,timers,types,requests,devices,platform,document,stream,setTimer,clearTimer,run,setGrant:fn=>grant=fn};
}
test('microphone and reply player share one graph and keep the route stable between turns',async()=>{
 const a=setup(),player=new CloudSpeechPlayer({Context:a.Context,audioSession:a.session});await player.prepare();
 const receiver={active:true,samples(){},fail(){assert.fail('unexpected failure');}};
 for(let turn=0;turn<12;turn++){await a.input.attach(receiver);a.input.detach(receiver);await player.prepare();}
 assert.equal(a.contexts.length,1);assert.equal(a.input.context,player.context);assert.equal(a.requests.length,1);assert.deepEqual(a.types,[],'the OS selects the session category');
 a.devices.dispatchEvent(new Event('devicechange'));await flush();assert.equal(a.requests.length,1,'healthy device changes do not reopen capture');
 a.input.release();assert.deepEqual(a.types,[]);assert.equal(a.contexts[0].closed,undefined,'ending input does not destroy playback');player.dispose();assert.equal(a.contexts[0].closed,undefined);a.session.dispose();assert.equal(a.contexts[0].closed,true);
});
test('a short audio interruption resumes without releasing the mic or failing the conversation',async()=>{
 const a=setup();let resets=0,failed=0;const receiver={active:true,resetCapture(){resets++;},fail(){failed++;}};await a.input.attach(receiver);
 a.contexts[0].interrupt();await flush();assert.equal(a.contexts[0].state,'running');assert.equal(resets,1);assert.equal(failed,0);assert.equal(a.requests.length,1);assert.equal(a.tracks[0].stopped,undefined);assert.equal(a.timers.size,0);a.input.release();a.session.dispose();
});
test('persistent interruptions have bounded recovery and report an actionable failure',async()=>{
 const a=setup();let failure;await a.input.attach({active:true,fail:code=>failure=code});const context=a.contexts[0];context.blocked=true;context.interrupt();await flush();
 for(const ms of [250,700,1400,2500])await a.run(ms);
 assert.equal(failure,'audio-capture');assert.equal(context.resumes,6,'initial resume plus five recovery attempts');assert.equal(a.timers.size,0);a.input.release();a.session.dispose();
});
test('stopping during route recovery cancels retries and does not restart input',async()=>{
 const a=setup();await a.input.attach({active:true,fail(){assert.fail('late failure');}});const context=a.contexts[0];context.blocked=true;context.interrupt();await flush();
 const resumes=context.resumes;a.input.release();await flush();assert.equal(a.timers.size,0);assert.equal(context.resumes,resumes);assert.equal(a.requests.length,1);assert.equal(a.platform.type,'auto');a.session.dispose();
});
test('an ended input reacquires once, preserves the shared graph, and discards a partial utterance',async()=>{
 const a=setup(),Recognition=createMicrophoneRecognition({input:a.input});const r=new Recognition();let recoveries=0;r.onaudiorecovering=()=>recoveries++;r.start();await flush();
 r.samples(new Float32Array(4800).fill(.1),48000);r.samples(new Float32Array(4800).fill(.1),48000);assert.equal(r.speech,true);
 a.tracks[0].end();await flush();assert.equal(recoveries,1);assert.equal(r.active,true);assert.equal(r.speech,false);assert.equal(r.chunks.length,0);
 await a.run(400);assert.equal(a.requests.length,2);assert.equal(a.contexts.length,1);assert.equal(a.input.stream.getTracks()[0],a.tracks[1]);assert.equal(a.timers.size,0);
 r.abort();a.input.release();a.session.dispose();
});
test('brief track mute and healthy device changes never reopen a working microphone',async()=>{
 const a=setup();await a.input.attach({active:true});a.tracks[0].mute();a.tracks[0].unmute();a.devices.dispatchEvent(new Event('devicechange'));await flush();assert.equal(a.timers.size,0);assert.equal(a.requests.length,1);a.input.release();a.session.dispose();
});
test('a microphone reconnect resolving after pause releases the late stream',async()=>{
 const a=setup();await a.input.attach({active:true});let resolve;a.setGrant(()=>new Promise(r=>resolve=r));a.tracks[0].end();await flush();await a.run(400);
 a.input.release();const late=a.stream();resolve(late);await flush();assert.equal(late.getTracks()[0].stopped,true);assert.equal(a.input.stream,null);assert.equal(a.timers.size,0);a.session.dispose();
});
test('a hanging reconnect times out and cleans up a late grant instead of recording unnoticed',async()=>{
 const a=setup();let failure;await a.input.attach({active:true,fail:code=>failure=code});let resolve;a.setGrant(()=>new Promise(r=>resolve=r));a.tracks[0].end();await flush();await a.run(400);await a.run(4000);assert.equal(failure,'audio-capture');
 const late=a.stream();resolve(late);await flush();assert.equal(late.getTracks()[0].stopped,true);assert.equal(a.input.stream,null);a.input.release();a.session.dispose();
});
test('unsupported Audio Session API still shares a graph without forcing output routing',()=>{
 const a=setup(),session=new ConversationAudioSession({Context:a.Context,navigator:{},document:a.document});const owner={};const context=session.acquire(owner);assert.equal(session.getContext(),context);session.release(owner);session.dispose();a.session.dispose();
});

test('a stalled initial audio resume times out, releases capture, and allows a clean retry',async()=>{
 const a=setup(),resume=a.Context.prototype.resume;a.Context.prototype.resume=()=>new Promise(()=>{});
 const rejected=assert.rejects(a.input.open(),/audio-capture/);await flush();await a.run(45000);await rejected;
 assert.equal(a.tracks[0].stopped,true);assert.equal(a.input.stream,null);assert.equal(a.session.inputs.size,0);assert.equal(a.timers.size,0);
 a.Context.prototype.resume=resume;await a.input.attach({active:true});assert.equal(a.requests.length,2);assert.equal(a.contexts.length,1);
 a.input.release();a.session.dispose();
});

test('pausing while permission is pending settles startup and cannot attach to a newer conversation',async()=>{
 const a=setup();let grant;a.setGrant(()=>new Promise(resolve=>grant=resolve));
 const oldReceiver={active:true},old=a.input.attach(oldReceiver);await flush();a.input.release();await old;
 assert.equal(a.timers.size,0);a.setGrant(null);const current={active:true};await a.input.attach(current);
 const late=a.stream();grant(late);await flush();assert.equal(late.getTracks()[0].stopped,true);assert.equal(a.input.receiver,current);assert.notEqual(a.input.stream,late);
 a.input.release();a.session.dispose();
});

test('permission denial releases the audio session and a new attempt can succeed',async()=>{
 const a=setup();a.setGrant(async()=>{throw Object.assign(new Error('denied'),{name:'NotAllowedError'});});
 await assert.rejects(a.input.open(),{name:'NotAllowedError'});assert.equal(a.session.inputs.size,0);assert.equal(a.platform.type,'auto');assert.equal(a.timers.size,0);
 a.setGrant(null);await a.input.attach({active:true});assert.equal(a.requests.length,2);a.input.release();a.session.dispose();
});

test('first-use microphone permission is not cancelled by the former ten-second limit',async()=>{
 const a=setup();let grant;a.setGrant(()=>new Promise(resolve=>grant=resolve));
 const opening=a.input.open();await flush();
 assert.ok(![...a.timers.values()].some(t=>t.ms===10000));
 assert.ok([...a.timers.values()].some(t=>t.ms===45000));
 const stream=a.stream();grant(stream);await opening;assert.equal(a.input.stream,stream);
 assert.equal(a.timers.size,0);a.input.release();a.session.dispose();
});

test('stalled worklet loading cannot leave capture open or attach a late audio graph',async()=>{
 const a=setup();let loaded;const context=a.session.getContext();context.audioWorklet={addModule:()=>new Promise(resolve=>loaded=resolve)};
 a.input.WorkletNode=class{constructor(){assert.fail('late worklet must not attach');}};
 const rejected=assert.rejects(a.input.open(),/audio-capture/);await flush();await a.run(3000);await rejected;
 assert.equal(a.tracks[0].stopped,true);loaded();await flush();assert.equal(a.input.node,null);assert.equal(a.timers.size,0);a.session.dispose();
});

test('microphone capture never forces a session category or output route',async()=>{
 const a=setup();let grant;a.setGrant(()=>new Promise(resolve=>grant=resolve));const opening=a.input.open();await flush();
 assert.deepEqual(a.types,[]);const stream=a.stream();grant(stream);await opening;
 assert.deepEqual(a.types,[],'the OS selects the session category');a.input.release();a.session.dispose();
});

test('Android route-change event bursts preserve a temporarily muted live microphone',async()=>{
 const a=setup();await a.input.attach({active:true,resetCapture(){}});a.tracks[0].mute();
 for(let i=0;i<12;i++)a.devices.dispatchEvent(new Event('devicechange'));
 await flush();assert.equal(a.requests.length,1);assert.equal([...a.timers.values()].filter(t=>t.ms===4500).length,1);
 assert.equal([...a.timers.values()].some(t=>t.ms===400),false);a.tracks[0].unmute();await flush();
 assert.equal(a.timers.size,0);assert.equal(a.tracks[0].stopped,undefined);a.input.release();a.session.dispose();
});

test('a persistently muted input repairs once after grace while a pause cancels the repair',async()=>{
 const a=setup();await a.input.attach({active:true,resetCapture(){}});a.tracks[0].mute();await a.run(4500);await a.run(400);
 assert.equal(a.requests.length,2);assert.equal(a.tracks[0].stopped,true);assert.equal(a.contexts.length,1);
 a.tracks[1].mute();a.input.release();await flush();assert.equal(a.requests.length,2);assert.equal(a.timers.size,0);a.session.dispose();
});

test('an explicitly selected microphone is applied once and kept for subsequent turns',async()=>{
 const a=setup();await a.input.attach({active:true,resetCapture(){}});a.session.inputDeviceId='headset-input';
 const change=a.session.inputs.get(a.input).changeInput();await flush();await a.run(400);await change;
 assert.deepEqual(a.requests[1].audio.deviceId,{exact:'headset-input'});assert.equal(a.contexts.length,1);
 await a.input.attach({active:true});assert.equal(a.requests.length,2);a.input.release();a.session.dispose();
});

test('a permission grant which suspends the graph can recover before first listening',async()=>{
 const a=setup();a.setGrant(async()=>{a.contexts[0].state='interrupted';return a.stream();});
 await a.input.attach({active:true});assert.equal(a.contexts[0].state,'running');assert.equal(a.requests.length,1);assert.equal(a.tracks[0].stopped,undefined);a.input.release();a.session.dispose();
});
