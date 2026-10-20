import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AudioDevices} from './public/audio-devices.mjs';
import {ConversationAudioSession} from './public/audio-session.mjs';
const flush=()=>new Promise(r=>setImmediate(r));
function setup(){
 let captures=0,sinks=0;const doc=new EventTarget(),media=new EventTarget();doc.hidden=false;
 media.enumerateDevices=async()=>[];media.getUserMedia=()=>{captures++;};media.selectAudioOutput=()=>{sinks++;throw Error('Must not select');};
 class Context extends EventTarget{constructor(){super();this.destination={};this.state='running';this.nodes=[];}createGain(){return {gain:{value:1},connect(){},disconnect(){}};}setSinkId(){sinks++;throw Error('Must not route');}createMediaElementSource(){const node={connect:d=>node.dest=d,disconnect(){}};this.nodes.push(node);return node;}async close(){}}
 const session=new ConversationAudioSession({Context,navigator:{mediaDevices:media},document:doc});session.nativeSpeech={audio:{muted:false,setSinkId(){sinks++;}}};
 const devices=new AudioDevices({session});return {devices,session,media,doc,counts:()=>({captures,sinks})};
}
test('device output is system controlled and the manual selection API is removed',async()=>{
 const a=setup();assert.equal(a.devices.state,'system');assert.equal(a.devices.selectOutput,undefined);assert.equal(a.devices.protectSelection,undefined);assert.equal(a.devices.chooseOutput,undefined);assert.equal(a.devices.destination().gain.value,1);
 await a.devices.setPlaybackMode('media');await a.devices.setPlaybackMode('stream');assert.deepEqual(a.counts(),{captures:0,sinks:0});a.session.dispose();
});
test('missing devices, device bursts and inventory failures never mute either playback path',async()=>{
 const a=setup();a.devices.destination();for(let i=0;i<20;i++)a.media.dispatchEvent(new Event('devicechange'));await flush();a.media.enumerateDevices=async()=>{throw Error('denied');};await a.devices.refresh();
 assert.equal(a.devices.state,'system');assert.equal(a.devices.gain.gain.value,1);assert.equal(a.session.nativeSpeech.audio.muted,false);assert.equal(a.devices.canPlay(),true);assert.deepEqual(a.counts(),{captures:0,sinks:0});a.session.dispose();
});
test('packaged and cloud audio share the ordinary system output without repeated nodes',()=>{
 const a=setup(),audio={};a.devices.routeMedia(audio);a.devices.routeMedia(audio);assert.equal(a.session.context.nodes.length,1);assert.equal(a.session.context.nodes[0].dest,a.session.getOutput());assert.equal(a.devices.gain.gain.value,1);a.session.dispose();
});
test('refreshing device names does not reopen microphone and discards late results on disposal',async()=>{
 const a=setup();let finish,reads=0;a.media.enumerateDevices=()=>{reads++;return new Promise(r=>finish=r);};for(let i=0;i<20;i++)void a.devices.refresh();await flush();assert.equal(reads,1);a.devices.dispose();finish([{kind:'audioinput',deviceId:'mic',label:'Mic'}]);await flush();assert.deepEqual(a.devices.devices,[]);assert.deepEqual(a.counts(),{captures:0,sinks:0});a.session.dispose();
});
test('a playback-mode change cannot interrupt an active microphone',async()=>{
 const a=setup();a.session.inputs.set('mic',{});await assert.rejects(a.devices.setPlaybackMode('media'),/busy/);assert.equal(a.session.inputs.size,1);assert.equal(a.session.playbackMode,'stream');a.session.inputs.clear();a.session.dispose();
});
test('old protection preferences are never read or restored',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),reads=[];
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(k){reads.push(k);return k==='velo-output-protection'?'1':null;}}});
 try{const a=setup();assert.deepEqual(reads,['velo-audio-playback']);assert.equal(a.devices.state,'system');assert.equal(a.devices.destination().gain.value,1);a.session.dispose();}finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;}
});
