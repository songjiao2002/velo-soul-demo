import {BUILD} from './build-version.mjs';

// RNNoise analyzes 10 ms of mono PCM at 48 kHz. Its output waveform is never
// sent to ASR: its speech probabilities only decide when to open/close a turn.
const MODEL_RATE = 48000, FRAME_SIZE = 480;
const fftSize=256, bandEdges=[4,8,13,20,30,43,59,80,103,128];
const hannWindow=Float32Array.from({length:fftSize},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/fftSize));
const cosine=Float32Array.from({length:fftSize/2},(_,i)=>Math.cos(2*Math.PI*i/fftSize));
const sine=Float32Array.from({length:fftSize/2},(_,i)=>-Math.sin(2*Math.PI*i/fftSize));
const reversed=Uint8Array.from({length:fftSize},(_,i)=>{
  let reverse=0;for(let bit=0;bit<8;bit++){reverse=reverse*2+(i&1);i>>=1;}return reverse;
});

// Compare 32 ms spectra to the local background. A stationary motor may
// score as voiced; actual syllables introduce energy in changing bands.
class BackgroundSpectrum{
  constructor(){
    this.pcm=new Float32Array(fftSize);this.real=new Float32Array(fftSize);this.imag=new Float32Array(fftSize);
    this.background=new Float32Array(bandEdges.length-1);
    this.frames=0;this.changeFrames=0;this.silentFrames=0;this.sourceFrames=0;
  }
  analyze(frame,speaking){
    const {pcm,real,imag,background}=this;
    let framePower=0;
    pcm.copyWithin(0,80);
    for(let i=0;i<80;i++){
      let sum=0;for(let j=0;j<6;j++)sum+=frame[i*6+j];
      pcm[176+i]=sum/(6*32768);
      framePower+=pcm[176+i]*pcm[176+i];
    }
    if(framePower<80*.0003**2)this.silentFrames++;
    else{
      if(this.silentFrames>=8&&!speaking)this.sourceFrames=4;
      this.silentFrames=0;
    }
    if(++this.frames<4)return {change:false,above:false};
    for(let i=0;i<fftSize;i++){real[reversed[i]]=pcm[i]*hannWindow[i];imag[i]=0;}
    for(let width=2;width<=fftSize;width*=2){
      const half=width/2,step=fftSize/width;
      for(let i=0;i<fftSize;i+=width)for(let j=0;j<half;j++){
        const k=i+j,other=k+half,t=j*step;
        const re=cosine[t]*real[other]-sine[t]*imag[other],im=sine[t]*real[other]+cosine[t]*imag[other];
        real[other]=real[k]-re;imag[other]=imag[k]-im;real[k]+=re;imag[k]+=im;
      }
    }
    if(this.sourceFrames>0&&--this.sourceFrames===0){
      // A suddenly audible low motor after silence changes every band's
      // absolute level. Measure its shape before treating it as a syllable.
      let total=0,bass=0,upper=0;
      for(let k=3;k<128;k++){
        const energy=real[k]*real[k]+imag[k]*imag[k];
        total+=energy;
        if(k<10)bass+=energy;
        if(k>=48)upper+=energy;
      }
      if(bass>.45*total&&upper<.01*total){this.frames=4;this.changeFrames=0;}
    }
    let raised=0,distinct=0;
    for(let band=0;band<background.length;band++){
      let power=0;
      for(let k=bandEdges[band];k<bandEdges[band+1];k++)power+=real[k]*real[k]+imag[k]*imag[k];
      power/=bandEdges[band+1]-bandEdges[band];
      // Some headset inputs have an effectively silent high band.
      const floor=Math.max(2e-7,background[band]);
      if(power>floor*3)raised++;
      if(power>floor*8)distinct++;
      if(this.frames===4)background[band]=power;
      else if(!speaking)background[band]+=(power-background[band])*.035;
    }
    const novel=this.frames>4&&raised>=2&&distinct>=1;
    this.changeFrames=novel?Math.min(this.changeFrames+1,7):Math.max(0,this.changeFrames-1);
    return {change:!this.sourceFrames&&this.changeFrames>=2,above:raised>=1};
  }
}
let bundledModel;
export function loadSpeechDetectorFactory() {
  if (!bundledModel) {
    bundledModel = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch('/vendor/rnnoise/rnnoise.wasm?v='+BUILD, {signal: controller.signal});
        if (!response.ok) throw Error('Speech detector could not be loaded');
        return await createSpeechDetectorFactory(await response.arrayBuffer());
      } finally { clearTimeout(timer); }
    })().catch(error => { bundledModel = null; throw error; });
  }
  return bundledModel;
}

export async function createSpeechDetectorFactory(bytes) {
  let api;
  const imports = {env: {
    emscripten_memcpy_big(destination, source, size) {
      new Uint8Array(api.memory.buffer).copyWithin(destination, source, source + size);
      return destination;
    },
    emscripten_resize_heap: () => 0,
    __assert_fail: () => { throw Error('Invalid speech detector state'); }
  }};
  const {instance} = await WebAssembly.instantiate(bytes, imports);
  api = instance.exports;
  api.__wasm_call_ctors();
  if (api.rnnoise_get_frame_size() !== FRAME_SIZE) throw Error('Unexpected speech detector frame size');
  return () => new SpeechDetector(api);
}

class SpeechDetector {
  constructor(api) {
    this.api = api;
    this.state = api.rnnoise_create(0);
    this.buffer = api.malloc(FRAME_SIZE * 4);
    if (!this.state || !this.buffer) { this.destroy(); throw Error('Speech detector allocation failed'); }
    this.frame = new Float32Array(api.memory.buffer, this.buffer, FRAME_SIZE);
    this.history = new Float32Array(200);
    this.spectrum = new BackgroundSpectrum();
    this.frames = this.fill = this.position = this.previous = this.strong = this.weak = this.burst = 0;
    this.floor = null;
  }
  // A nearly exact repeating waveform can fool a speech model, particularly
  // when a motor whines at a steady pitch while its volume changes.
  periodic() {
    const h = this.history, n = 80;
    h.copyWithin(0, n);
    for (let i = 0; i < n; i++) {
      const k = i * 6;
      h[120+i] = this.frame[k] - 2*this.frame[k+2] + this.frame[k+4];
    }
    let energy = 0;
    for (let i = 120; i < 200; i++) energy += h[i] * h[i];
    this.bandPower = energy/n;
    if (this.frames < 2) return false;
    if (energy < 1e-6) return true;
    for (let lag = 8; lag <= 114; lag++) {
      let dot = 0, previousEnergy = 0;
      for (let i = 120; i < 200; i++) {
        dot += h[i] * h[i-lag];
        previousEnergy += h[i-lag] * h[i-lag];
      }
      if (dot > 0 && dot * dot > .979 * energy * previousEnergy) return true;
    }
    return false;
  }
  observe(pcm, rate, speaking=false) {
    let onset = false, continuing = false;
    const step = rate / MODEL_RATE;
    let position = this.position;
    while (position < pcm.length) {
      const i = Math.floor(position), fraction = position - i;
      const preceding = i ? pcm[i-1] : this.previous;
      this.frame[this.fill++] = (preceding + fraction * (pcm[i] - preceding)) * 32768;
      if (this.fill === FRAME_SIZE) {
        this.frames++;
        const tonal = this.periodic();
        const spectrum=this.spectrum.analyze(this.frame,speaking);
        // The RNNoise C API supports processing an input buffer in place.
        const probability = this.api.rnnoise_process_frame(this.state, this.buffer, this.buffer);
        this.strong = !tonal && probability >= .84 ? this.strong + 1 : 0;
        this.weak = !tonal && probability >= .58 ? this.weak + 1 : 0;
        const rise = this.frames>8 && this.bandPower>Math.max(.08,this.floor*15);
        this.burst = rise&&!tonal ? this.burst*.87+Math.max(0, probability-.12) : 0;
        if (spectrum.change && this.bandPower>.08 && (this.strong >= 4 || this.weak >= 9 || this.burst>=1.35)) onset = true;
        if (!tonal && spectrum.above && (probability >= .35 || rise)) continuing = true;
        if(this.floor===null)this.floor=this.bandPower;
        else if(!speaking){
          const difference=this.bandPower-this.floor;
          this.floor+=difference<0?difference*.035:Math.min(difference,Math.max(.15,this.floor*2))*.035;
        }
        this.fill = 0;
      }
      position += step;
    }
    this.position = position - pcm.length;
    this.previous = pcm[pcm.length - 1];
    return {onset, continuing};
  }
  destroy() {
    if (this.state) this.api.rnnoise_destroy(this.state);
    if (this.buffer) this.api.free(this.buffer);
    this.state = this.buffer = 0;
  }
}
