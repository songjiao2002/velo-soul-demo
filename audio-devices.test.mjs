import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AudioDevices,AUDIO_DEVICE_COPY} from './public/audio-devices.mjs';
import {ConversationAudioSession} from './public/audio-session.mjs';
import {RecordedVoicePlayer} from './public/recorded-voice.mjs';
import {CloudSpeechPlayer} from './public/cloud-speech.mjs';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup(){
 let list=[{kind:'audiooutput',deviceId:'headphones',label:'Headphones'}];const changes=[];
 class Context extends EventTarget{constructor(){super();this.state='running';this.destination={};this.sinkId='';this.nodes=[];}createGain(){return {gain:{value:1},connect(){},disconnect(){}};}async setSinkId(id){if(id===this.sinkId)return;changes.push(id);this.sinkId=id;this.dispatchEvent(new Event('sinkchange'));}createMediaElementSource(){const node={connect:dest=>node.destination=dest,disconnect(){}};this.nodes.push(node);return node;}async close(){this.state='closed';}}
 const media=new EventTarget();media.enumerateDevices=async()=>list;const session=new ConversationAudioSession({Context,navigator:{mediaDevices:media},document:{}});
 const devices=new AudioDevices({session});return {session,devices,media,changes,setList:x=>list=x};
}
test('a selected output is shared by packaged audio and cloud audio without repeated media nodes',async()=>{
 const a=setup();await a.devices.selectOutput({deviceId:'headphones',label:'Headphones'});await flush();
 const audio={};a.devices.routeMedia(audio);a.devices.routeMedia(audio);
 assert.equal(a.session.getContext().nodes.length,1);assert.equal(a.session.getContext().nodes[0].destination,a.session.getOutput());assert.equal(a.devices.gain.gain.value,1);assert.equal(a.devices.state,'selected');assert.deepEqual(a.changes,['headphones']);a.session.dispose();
});
test('disconnecting a selected output mutes immediately and reconnect restores only that output',async()=>{
 const a=setup();await a.devices.selectOutput({deviceId:'headphones'});await flush();
 a.setList([]);a.media.dispatchEvent(new Event('devicechange'));assert.equal(a.devices.gain.gain.value,0);await flush();
 assert.equal(a.devices.state,'missing');assert.deepEqual(a.changes,['headphones']);
 a.setList([{kind:'audiooutput',deviceId:'headphones'}]);a.media.dispatchEvent(new Event('devicechange'));await flush();
 assert.equal(a.devices.state,'selected');assert.equal(a.devices.gain.gain.value,1);assert.equal(a.session.getContext().sinkId,'headphones');a.session.dispose();
});
test('denied selection never silently falls back to speaker, while system default needs explicit selection',async()=>{
 const a=setup();const context=a.session.getContext(),original=context.setSinkId.bind(context);context.setSinkId=async()=>{throw Error('denied');};
 await assert.rejects(a.devices.selectOutput({deviceId:'headphones'}));assert.equal(a.devices.gain.gain.value,0);assert.equal(a.devices.state,'unavailable');
 context.setSinkId=original;await a.devices.selectOutput(null);assert.equal(a.devices.state,'system');assert.equal(a.devices.gain.gain.value,1);a.session.dispose();
});
test('an old device enumeration cannot overwrite a newer output selection',async()=>{
 const a=setup();let resolve;a.media.enumerateDevices=()=>new Promise(r=>resolve=r);const old=a.devices.refresh();await flush();
 await a.devices.selectOutput({deviceId:'headphones'});resolve([]);await old;
 assert.equal(a.devices.selected.deviceId,'headphones');assert.equal(a.devices.state,'selected');a.session.dispose();
});
test('unsupported in-app browser does not prompt, guess Bluetooth status or force a sink',async()=>{
 const a=setup();a.session.Context.prototype.setSinkId=undefined;assert.equal(a.devices.canSelectOutput(),false);
 await assert.rejects(a.devices.selectOutput({deviceId:'headphones'}),/unsupported/);assert.equal(a.devices.state,'system');assert.equal(a.devices.selected,null);
 for(const c of Object.values(AUDIO_DEVICE_COPY)){assert.ok(c.limited&&c.privacy&&c.inputHint);}a.session.dispose();
});
test('an idle recorded player does not reset Android native media focus between cloud replies',()=>{
 let touched=0;const audio={src:'',pause(){touched++;},load(){touched++;},removeAttribute(){this.src='';}};
 const player=new RecordedVoicePlayer({audio});for(let i=0;i<20;i++)player.stop();assert.equal(touched,0);
 audio.src='hello.wav';player.stop();assert.equal(touched,2);player.stop();assert.equal(touched,2);
});
test('every new page follows the device by default and does not restore a forced route',()=>{
 const a=setup();assert.equal(a.devices.state,'system');assert.equal(a.devices.protection,false);assert.equal(a.devices.canPlay(),true);a.devices.protectSelection();
 const b=setup();assert.equal(b.devices.state,'system');assert.equal(b.devices.selected,null);assert.equal(b.devices.protection,false);assert.equal(b.devices.destination().gain.value,1);a.session.dispose();b.session.dispose();
});
test('Bluetooth choice arms both playback paths before the picker and cancellation stays muted',async()=>{
 const a=setup();a.session.nativeSpeech={audio:{muted:false}};a.devices.destination();a.devices.protectSelection();
 assert.equal(a.devices.gain.gain.value,0);assert.equal(a.session.nativeSpeech.audio.muted,true);assert.equal(a.devices.canPlay(),false);
 a.media.selectAudioOutput=async()=>{throw Object.assign(Error('cancel'),{name:'NotAllowedError'});};await assert.rejects(a.devices.chooseOutput());await a.devices.refresh();
 assert.equal(a.devices.state,'protected');assert.equal(a.devices.canPlay(),false);await a.devices.followSystem();assert.equal(a.devices.state,'system');assert.equal(a.devices.protection,false);assert.equal(a.session.nativeSpeech.audio.muted,false);a.session.dispose();
});
test('specific output then explicit device default changes sinks without replacing microphone',async()=>{
 const a=setup();let replaced=0;a.session.inputs.set('capture',{changeInput(){replaced++;}});a.devices.protectSelection();
 await a.devices.selectOutput({deviceId:'headphones'});assert.equal(a.devices.canPlay(),true);
 a.setList([{kind:'audiooutput',deviceId:'speaker'}]);await a.devices.selectOutput({deviceId:'speaker'});await flush();assert.equal(a.devices.selected.deviceId,'speaker');
 await a.devices.followSystem();assert.equal(a.session.context.sinkId,'');assert.equal(a.devices.state,'system');assert.equal(a.devices.protection,false);assert.equal(a.session.inputs.size,1);assert.equal(replaced,0);a.session.inputs.clear();a.session.dispose();
});
test('a failed return to system keeps the selected output muted',async()=>{
 const a=setup();a.devices.protectSelection();await a.devices.selectOutput({deviceId:'headphones'});await flush();a.session.context.setSinkId=async()=>{throw Error('denied');};
 await assert.rejects(a.devices.followSystem());assert.equal(a.devices.protection,true);assert.equal(a.devices.state,'unavailable');assert.equal(a.devices.gain.gain.value,0);a.session.dispose();
});
test('an unavailable picker and default device aliases cannot bypass Bluetooth protection',async()=>{
 const a=setup();a.devices.protectSelection();for(const deviceId of ['','default','communications'])await assert.rejects(a.devices.selectOutput({deviceId}),/specific-output/);
 a.session.Context.prototype.setSinkId=undefined;await assert.rejects(a.devices.chooseOutput());assert.equal(a.devices.canPlay(),false);
 await a.devices.followSystem();assert.equal(a.devices.state,'system');assert.equal(a.devices.protection,false);a.session.dispose();
});
test('protection blocks generated and saved cloud replies before fetching in either playback mode',async()=>{
 for(const mode of ['stream','media']){
  const a=setup(),states=[];let fetched=0;const p=new CloudSpeechPlayer({audioSession:a.session,fetchImpl:async()=>{fetched++;throw Error('must not fetch');}});
  p.native.audio={pause(){},removeAttribute(){},muted:false};p.context=a.session.getContext();a.session.playbackMode=mode;a.devices.protectSelection();
  await p.speak('Hello',{source:'/audio/intro/lumi-en.wav',onState:s=>states.push(s)});assert.deepEqual(states,['loading','blocked']);assert.equal(fetched,0);p.stop();a.session.dispose();
 }
});
test('switching playback mode after returning to device default clears an inactive player old sink',async()=>{
 const a=setup();const audio={muted:false,sinkId:'',async setSinkId(id){this.sinkId=id;}};a.session.nativeSpeech={audio};
 await a.devices.setPlaybackMode('media');await a.devices.selectOutput({deviceId:'headphones'});await a.devices.setPlaybackMode('stream');await a.devices.followSystem();
 assert.equal(audio.sinkId,'headphones');await a.devices.setPlaybackMode('media');assert.equal(audio.sinkId,'');assert.equal(a.devices.state,'system');assert.equal(audio.muted,false);a.session.dispose();
});
test('device event bursts share one inventory request and do not reset a healthy output',async()=>{
 const a=setup();await a.devices.selectOutput({deviceId:'headphones'});let reads=0,binds=0,finish;
 a.media.enumerateDevices=()=>{reads++;return new Promise(r=>finish=r);};a.session.context.setSinkId=async()=>{binds++;};
 for(let i=0;i<20;i++)a.media.dispatchEvent(new Event('devicechange'));await flush();assert.equal(reads,1);assert.equal(a.devices.gain.gain.value,0);
 const task=a.devices.refreshing;finish([{kind:'audiooutput',deviceId:'headphones',label:'Headset'}]);await task;
 assert.equal(reads,1);assert.equal(binds,0);assert.equal(a.devices.state,'selected');assert.equal(a.devices.selected.label,'Headset');assert.equal(a.devices.gain.gain.value,1);a.session.dispose();
});
test('events arriving during an inventory read trigger one final check for a new disconnect',async()=>{
 const a=setup();await a.devices.selectOutput({deviceId:'headphones'});let reads=0,finish,finishLast;
 a.media.enumerateDevices=()=>{reads++;return reads===1?new Promise(r=>finish=r):new Promise(r=>finishLast=r);};const pending=a.devices.refresh();await flush();
 for(let i=0;i<20;i++)a.media.dispatchEvent(new Event('devicechange'));finish([{kind:'audiooutput',deviceId:'headphones'}]);await flush();assert.equal(a.devices.gain.gain.value,0);finishLast([]);await pending;
 assert.equal(reads,2);assert.equal(a.devices.state,'missing');assert.equal(a.devices.gain.gain.value,0);a.session.dispose();
});
test('a slow recovery sink cannot finish after and overwrite a newer explicit output choice',async()=>{
 const a=setup();await a.devices.selectOutput({deviceId:'headphones'});const context=a.session.context;context.sinkId='';let finish;
 context.setSinkId=id=>id==='headphones'?new Promise(r=>finish=()=>{context.sinkId=id;r();}):Promise.resolve(context.sinkId=id);
 const recovery=a.devices.refresh();await flush();assert.equal(typeof finish,'function');const selection=a.devices.selectOutput({deviceId:'speaker'});finish();await recovery;await selection;
 assert.equal(context.sinkId,'speaker');assert.equal(a.devices.selected.deviceId,'speaker');assert.equal(a.devices.state,'selected');a.session.dispose();
});
test('returning from phone settings rechecks only the selected output and disposal removes the listener',async()=>{
 const doc=new EventTarget();doc.hidden=false;const context={sinkId:'headphones',setSinkId:async()=>{throw Error('unneeded');}};let reads=0;
 const session={inputs:new Map(),navigator:{mediaDevices:{enumerateDevices:async()=>{reads++;return [];}}},document:doc,getContext:()=>context};const devices=new AudioDevices({session});
 devices.selected={deviceId:'headphones'};devices.state='selected';session.nativeSpeech={audio:{muted:false}};
 doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(reads,0);
 doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(session.nativeSpeech.audio.muted,true);await flush();assert.equal(devices.state,'missing');assert.equal(reads,1);
 devices.dispose();doc.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(reads,1);
});
test('granting microphone permission refreshes device names without reacquiring capture',async()=>{
 const a=setup();let reads=0;const owner={};a.media.enumerateDevices=async()=>{reads++;return [{kind:'audioinput',deviceId:'mic',label:'Headset microphone'}];};
 a.session.acquire(owner,{getInput:()=>({label:'Headset microphone'})});a.session.captureReady(owner);await flush();assert.equal(reads,1);assert.equal(a.devices.inputLabel(),'Headset microphone');assert.equal(a.session.inputs.size,1);a.session.release(owner);assert.equal(a.devices.inputLabel(),'');a.session.dispose();
});
