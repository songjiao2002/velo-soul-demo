import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSpeechDetectorFactory} from './public/speech-detector.mjs';
import {createMicrophoneRecognition} from './public/microphone-asr.mjs';

const createDetector=await createSpeechDetectorFactory(await readFile(new URL('./public/vendor/rnnoise/rnnoise.wasm',import.meta.url)));
const input=()=>({attach:async()=>{},detach(){},onLevel(){}});
const timers={setTimer:()=>1,clearTimer(){}};
const sine=t=>Math.sin(t*2*Math.PI);
function motor(t){
  return .035*sine(44*t)+.014*sine(67*t)+(.013+.007*sine(4.25*t))*(sine(310*t)+.42*sine(620*t)+.16*sine(930*t));
}

test('the bundled model keeps a modulated motor local at headset rates, and hears English and Korean over it',async()=>{
  for(const [lang,rate,block] of [['en',16000,320],['ko',44100,1024],['en',48000,1024]]){
    const wav=await readFile(new URL('./public/audio/intro/mori-'+lang+'.wav',import.meta.url));
    const offset=wav.indexOf('data',36)+8,sourceRate=wav.readUInt32LE(24),count=wav.readUInt32LE(offset-4)/2;
    let time=0,starts=0;
    const Recognition=createMicrophoneRecognition({input:input(),createDetector,...timers});
    const r=new Recognition();r.onspeechstart=()=>starts++;r.start();
    const feed=(length,voice)=>{
      for(let i=0;i<length;i+=block){
        const frame=Float32Array.from({length:block},(_,k)=>motor((time+k)/rate)+(voice?.(i+k)||0));
        time+=block;r.samples(frame,rate);
        if(starts)break;
      }
    };
    feed(rate*1.25);assert.equal(starts,0,'motor alone at '+rate);
    feed(rate*3,i=>{const j=Math.floor(i*sourceRate/rate);return j<count?wav.readInt16LE(offset+j*2)/32768:0;});
    assert.equal(starts,1,lang+' with a running motor at '+rate);
    assert.ok(r.detector);r.abort();
  }
});

test('a late model analyzes bounded pre-roll; sample rate changes and repeated abort release its state once',()=>{
  const source=input();source.detectorPending=true;
  const Recognition=createMicrophoneRecognition({input:source,...timers});
  const r=new Recognition();r.start();
  const frame=Float32Array.from({length:320},(_,i)=>.1*sine(i*20/320));
  for(let i=0;i<55;i++)r.samples(frame,16000);
  assert.equal(r.speech,undefined);assert.equal(r.detectorPreroll.length,45);
  let processed=0,destroyed=0;
  source.detectorPending=false;source.detectorFactory=()=>({observe(){return {onset:++processed===44,continuing:true};},destroy(){destroyed++;}});
  r.samples(frame,16000);assert.equal(r.speech,true);assert.equal(processed,46);
  r.samples(frame,48000);assert.equal(destroyed,1);
  r.abort();r.abort();assert.equal(destroyed,2);
});

test('a low motor starting abruptly after silence does not open a conversation',()=>{
  const rate=48000,frequencies=[83,168,315,381,479];
  const Recognition=createMicrophoneRecognition({input:input(),createDetector,...timers});
  const r=new Recognition();let starts=0,seed=257,lp=0,lp2=0;
  r.onspeechstart=()=>starts++;r.start();
  for(let i=0;i<rate*2;i+=1024){
    const frame=Float32Array.from({length:1024},(_,j)=>{
      const t=(i+j)/rate-.17;
      if(t<0)return 0;
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      lp=.92*lp+.08*(seed/4294967296*2-1);lp2=.9*lp2+.1*lp;
      const harmonics=frequencies.reduce((sum,h,k)=>sum+.024/(1+k*.32)*Math.sin(2*Math.PI*h*t+.15*Math.sin(t*(3+k))),0);
      return (.8+.2*Math.sin(t*19))*(harmonics+.04*lp2);
    });
    r.samples(frame,rate);
  }
  assert.equal(starts,0);assert.ok(r.detector);r.abort();
});

test('an unavailable or failing local model falls back without retrying on every audio frame',()=>{
  for(const allocationFailure of [false,true]){
    let allocations=0,destroyed=0;
    const factory=()=>{
      allocations++;
      if(allocationFailure)throw Error('allocation failed');
      return {observe(){throw Error('model trapped');},destroy(){destroyed++;throw Error('model unavailable');}};
    };
    const Recognition=createMicrophoneRecognition({input:input(),createDetector:factory,...timers});
    const r=new Recognition();r.start();
    const frame=Float32Array.from({length:320},(_,i)=>.07*sine(i*200/16000));
    for(let i=0;i<10;i++)r.samples(frame,16000);
    assert.ok(r.speech);assert.equal(allocations,1);
    r.abort();assert.equal(destroyed,allocationFailure?0:1);
  }
});
