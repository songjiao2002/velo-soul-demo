import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AudioDevices,AUDIO_DEVICE_COPY} from './public/audio-devices.mjs';
import {ConversationAudioSession} from './public/audio-session.mjs';
import {RecordedVoicePlayer} from './public/recorded-voice.mjs';
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
 const a=setup();let resolve;a.media.enumerateDevices=()=>new Promise(r=>resolve=r);const old=a.devices.refresh();
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
