import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {RecordedVoicePlayer,voiceFile,BASE_KEYS} from './public/recorded-voice.mjs';
import {SOULS,SCENARIOS} from './public/soul-core.mjs';

test('every English line resolves to packaged, non-silent PCM audio',async()=>{
 const paths=new Set();
 for(const id of Object.keys(SOULS)){
  for(const key of BASE_KEYS)paths.add(voiceFile('en',id,key,SOULS[id][key]));
  for(const scene of SCENARIOS[id])paths.add(voiceFile('en',id,scene.audio,scene.line));
 }
 assert.equal(paths.size,19);assert.ok(!paths.has(null));
 for(const path of paths){
  const b=await readFile(new URL('./public/'+path.replace(/^\//,''),import.meta.url));
  assert.equal(b.toString('ascii',0,4),'RIFF',path);assert.equal(b.toString('ascii',8,12),'WAVE');
  assert.equal(b.readUInt16LE(20),1);assert.equal(b.readUInt16LE(22),1);assert.equal(b.readUInt16LE(34),16);
  const seconds=(b.length-44)/b.readUInt32LE(28);assert.ok(seconds>1&&seconds<15,path);
  let peak=0;for(let i=44;i<b.length;i+=2)peak=Math.max(peak,Math.abs(b.readInt16LE(i)));
  assert.ok(peak>1000&&peak<32767,path);
 }
 assert.equal(voiceFile('zh','lumi','hello'),null);
 assert.match(voiceFile('ko','lumi','hello'),/^\/audio\/characters13\/lumi-ko\.wav\?v=/);
});

function fakeAudio(){return {pause(){},removeAttribute(){this.src='';},load(){},play(){return Promise.resolve();}};}
test('recorded English playback starts synchronously without a speech synthesis dependency',()=>{
 const states=[],audio=fakeAudio();let invoked=false;
 audio.play=()=>{invoked=true;return Promise.resolve();};
 const p=new RecordedVoicePlayer({audio,onState:s=>states.push(s)});
 p.play('audio/en/mori-hello.wav');assert.equal(invoked,true);assert.equal(audio.muted,false);
 audio.onplaying();assert.deepEqual(states,['loading','playing']);audio.onended();assert.equal(states.at(-1),'ended');p.stop();
});
test('stopping or replacing a clip ignores late callbacks and rejected play promises',async()=>{
 const states=[],audio=fakeAudio();let reject;
 audio.play=()=>new Promise((_,r)=>{reject=r;});
 const p=new RecordedVoicePlayer({audio,onState:s=>states.push(s)});p.play('first.wav');
 const ended=audio.onended,playing=audio.onplaying,oldReject=reject;
 audio.play=()=>Promise.resolve();p.play('second.wav');audio.onplaying();
 ended();playing();oldReject(new Error('late failure'));await Promise.resolve();
 assert.equal(audio.src,'second.wav');assert.deepEqual(states,['loading','loading','playing']);p.stop();
});
test('autoplay denial gives a retry state and a later user click can play',async()=>{
 const states=[],audio=fakeAudio();audio.play=()=>Promise.reject(Object.assign(new Error(),{name:'NotAllowedError'}));
 const p=new RecordedVoicePlayer({audio,onState:s=>states.push(s)});p.play('hello.wav');await Promise.resolve();
 assert.equal(states.at(-1),'blocked');audio.play=()=>Promise.resolve();p.play('hello.wav');audio.onplaying();
 assert.equal(states.at(-1),'playing');p.stop();
});
