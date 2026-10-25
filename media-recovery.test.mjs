import test from 'node:test';
import assert from 'node:assert/strict';
import {SoulCameraController} from './public/camera-controller.mjs';
import {createMediaPermissionQueue} from './public/app-network.mjs';
import {ConversationAudioSession} from './public/audio-session.mjs';
import {AudioDevices} from './public/audio-devices.mjs';
const flush=()=>new Promise(r=>setImmediate(r));
function clock(){let id=0;const jobs=new Map();return {setTimer(fn,ms){jobs.set(++id,{fn,ms});return id;},clearTimer(id){jobs.delete(id);},async fire(ms){const row=[...jobs].find(([,v])=>v.ms===ms);assert.ok(row,'timer '+ms);jobs.delete(row[0]);row[1].fn();await flush();},jobs};}
function stream(){const track={stopped:0,stop(){this.stopped++;},addEventListener(){}};return {track,getTracks:()=>[track],getVideoTracks:()=>[track]};}
function video(){return {style:{display:'none',removeProperty(){this.display='';}},setAttribute(){},pause(){},play:async()=>{}};}
test('camera reduces unsupported constraints and makes muted inline video visible before playback',async()=>{
 const requests=[],s=stream(),v=video();v.play=async()=>{assert.equal(v.style.display,'block');assert.equal(v.muted,true);assert.equal(v.playsInline,true);assert.equal(v.srcObject,s);};
 const c=new SoulCameraController({video:v,isSecure:()=>true,getMedia:async options=>{requests.push(options);if(requests.length===1)throw Object.assign(Error(),{name:'OverconstrainedError'});return s;}});
 await c.start();assert.equal(requests.length,2);assert.equal(requests[1].video.width,undefined);assert.equal(requests[1].audio,false);c.stop();assert.equal(s.track.stopped,1);
});
test('camera denial never loops permission requests',async()=>{let requests=0;const c=new SoulCameraController({video:video(),isSecure:()=>true,getMedia:async()=>{requests++;throw Object.assign(Error(),{name:'NotAllowedError'});}});await c.start();assert.equal(requests,1);});
test('a stalled permission prompt times out, releases its late grant and permits retry',async()=>{
 const t=clock(),v=video(),s=stream(),states=[];let grant;const c=new SoulCameraController({...t,video:v,isSecure:()=>true,getMedia:()=>new Promise(r=>grant=r),onState:(state,_,code)=>states.push([state,code])});const opening=c.start();await t.fire(45000);await opening;assert.deepEqual(states.at(-1),['error','TimeoutError']);grant(s);await flush();assert.equal(s.track.stopped,1);assert.equal(v.srcObject,null);const retry=stream();c.getMedia=async()=>retry;await c.start();assert.equal(v.srcObject,retry);c.stop();assert.equal(t.jobs.size,0);
});
test('a video play hang is bounded and releases camera hardware',async()=>{const t=clock(),s=stream(),v=video();v.play=()=>new Promise(()=>{});let code;const c=new SoulCameraController({...t,video:v,isSecure:()=>true,getMedia:async()=>s,onState:(_,__,value)=>{code=value;}});const pending=c.start();await flush();await t.fire(8000);await pending;assert.equal(code,'PlaybackTimeoutError');assert.equal(s.track.stopped,1);assert.equal(v.srcObject,null);});
test('native permission timeout does not deadlock the next device or retain late capture',async()=>{
 const t=clock(),calls=[],s=stream();let grant;const request=createMediaPermissionQueue({...t,timeout:50,prepare:async()=>{}}),devices={getUserMedia(c){calls.push(c);return calls.length===1?new Promise(r=>grant=r):Promise.resolve(s);}};
 const first=assert.rejects(request({video:true},devices),{name:'TimeoutError'});await flush();await t.fire(50);await first;assert.equal(await request({audio:true},devices),s);const late=stream();grant(late);await flush();assert.equal(late.track.stopped,1);assert.equal(s.track.stopped,0);assert.equal(t.jobs.size,0);
});
test('a native permission preflight denial does not open WebView capture',async()=>{let opened=false;const request=createMediaPermissionQueue({prepare:async()=>{throw Object.assign(Error(),{name:'NotAllowedError'});}});await assert.rejects(request({video:true},{getUserMedia(){opened=true;}}),{name:'NotAllowedError'});assert.equal(opened,false);});
test('cancelling during the native permission prompt never opens capture after granting',async()=>{
 let grant,current=true,opened=0;const request=createMediaPermissionQueue({prepare:()=>new Promise(resolve=>grant=resolve)});
 const pending=assert.rejects(request({audio:true},{getUserMedia(){opened++;}},{isCurrent:()=>current}),{name:'AbortError'});
 await flush();current=false;grant();await pending;assert.equal(opened,0);
});
test('a device interruption can resume active playback without an active microphone',async()=>{
 let resumes=0;class Context{constructor(){this.state='suspended';}async resume(){resumes++;this.state='running';}async close(){}}
 const session=new ConversationAudioSession({Context,navigator:{},document:{hidden:false}});session.getContext();session.setPlayback('reply',true);session.changed();await flush();assert.equal(resumes,1);session.setPlayback('reply',false);session.context.state='suspended';session.changed();await flush();assert.equal(resumes,1,'stopped playback stays stopped');session.dispose();
});
test('Android in-app playback defaults to the media route while normal browsers retain streaming',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null}});
 try{for(const [ua,expected]of [['Android MicroMessenger/8','media'],['Android KAKAOTALK/10','media'],['Android; wv','media'],['Android Chrome/130','stream']]){const session={inputs:new Map(),navigator:{userAgent:ua}};const devices=new AudioDevices({session});assert.equal(session.playbackMode,expected);devices.dispose();}}finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
});
