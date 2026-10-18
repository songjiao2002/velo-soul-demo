import {BUILD} from './build-version.mjs';
// One microphone session per conversation. Utterances are bounded, transient PCM;
// no recording is saved to local storage or sent until speech ends.
export function encodeWav(chunks, sampleRate) {
  const size = chunks.reduce((n, c) => n + c.length, 0);
  const samples = new Float32Array(size); let offset = 0;
  for (const c of chunks) { samples.set(c, offset); offset += c.length; }
  const rate = 16000, count = Math.floor(size * rate / sampleRate);
  const bytes = new Uint8Array(44 + count * 2), view = new DataView(bytes.buffer);
  const text = (at, s) => [...s].forEach((v, i) => bytes[at + i] = v.charCodeAt(0));
  text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const from = Math.floor(i * sampleRate / rate), to = Math.max(from + 1, Math.floor((i + 1) * sampleRate / rate));
    let sum = 0; for (let j = from; j < Math.min(to, size); j++) sum += samples[j];
    const value = Math.max(-1, Math.min(1, sum / (to - from)));
    view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return bytes;
}

export class MicrophoneInput {
  constructor({mediaDevices = globalThis.navigator?.mediaDevices,
    Context = globalThis.AudioContext || globalThis.webkitAudioContext,
    WorkletNode = globalThis.AudioWorkletNode, onLevel = () => {}} = {}) {
    Object.assign(this, {mediaDevices, Context, WorkletNode, onLevel}); this.serial = 0;
  }
  async open() {
    if (this.opening) return this.opening;
    const serial = this.serial;
    // Construct/resume synchronously in the user's camera/voice button gesture.
    if (!this.mediaDevices?.getUserMedia || !this.Context) throw new Error('unsupported');
    const context = new this.Context(); this.context = context;
    const resume = context.resume();
    this.opening = (async () => {
      const stream = await this.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      if (serial !== this.serial) { stream.getTracks().forEach(t => t.stop()); return; }
      this.stream = stream;
      await resume;
      if (serial !== this.serial) return;
      const source = context.createMediaStreamSource(stream); this.source = source;
      let node;
      if (context.audioWorklet && this.WorkletNode) {
        await context.audioWorklet.addModule(`/mic-worklet.js?v=${BUILD}`);
        if (serial !== this.serial) return;
        node = new this.WorkletNode(context, 'soul-mic');
        node.port.onmessage = event => this.samples(event.data, context.sampleRate);
      } else {
        // Compatibility path for browsers without AudioWorklet.
        node = context.createScriptProcessor(2048, 1, 1);
        node.onaudioprocess = event => this.samples(new Float32Array(event.inputBuffer.getChannelData(0)), context.sampleRate);
      }
      this.node = node; const mute = context.createGain(); this.mute = mute; mute.gain.value = 0;
      source.connect(node); node.connect(mute); mute.connect(context.destination);
      context.onstatechange = () => {
        if (serial === this.serial && ['suspended','interrupted','closed'].includes(context.state)) this.receiver?.fail('audio-capture');
      };
      stream.getTracks().forEach(track => track.addEventListener('ended', () => { if (serial === this.serial) this.receiver?.fail('audio-capture'); }));
    })();
    // Handle a rejected resume even if permission is still pending.
    resume.catch(() => {});
    return this.opening;
  }
  samples(data, rate) { this.receiver?.samples(data, rate); }
  async attach(receiver) {
    await this.open();
    if (receiver.active && this.stream) this.receiver = receiver;
  }
  detach(receiver) { if (this.receiver === receiver) { this.receiver = null; this.onLevel(0); } }
  release() {
    this.serial++; this.receiver = null; this.onLevel(0);
    this.stream?.getTracks().forEach(t => t.stop()); this.stream = null;
    if (this.node?.port) this.node.port.onmessage = null;
    if (this.node) this.node.onaudioprocess = null;
    this.node?.disconnect(); this.source?.disconnect(); this.mute?.disconnect();
    if (this.context) { this.context.onstatechange = null; this.context.close().catch(() => {}); }
    this.node = this.source = this.mute = this.context = this.opening = null;
  }
}

export function createMicrophoneRecognition({input = new MicrophoneInput(), fetchImpl = (...args) => globalThis.fetch(...args),
  toBase64 = s => globalThis.btoa(s), setTimer = (...args) => globalThis.setTimeout(...args), clearTimer = (...args) => globalThis.clearTimeout(...args)} = {}) {
  return class MicrophoneRecognition {
    constructor() { this.active = false; this.chunks = []; this.preroll = []; this.noise = .002; this.total = this.quiet = this.candidate = this.voiced = 0; }
    start() {
      this.active = true;
      input.attach(this).catch(error => { if (this.active) this.fail(error.name === 'NotAllowedError' ? 'not-allowed' : error.message === 'unsupported' ? 'unsupported' : 'audio-capture'); });
    }
    samples(data, rate) {
      if (!this.active || this.finalizing) return;
      if (!this.started) { this.started = true; this.onstart?.(); if(!this.active)return; }
      this.rate = rate;
      const ms = data.length / rate * 1000;
      const rms = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
      input.onLevel(Math.min(1, rms * 12));
      const loud = rms > Math.max(.008, this.noise * 2.8);
      if (!this.speech) {
        this.preroll.push(data);
        while (this.preroll.length > Math.ceil(rate * .35 / data.length)) this.preroll.shift();
        this.candidate = loud ? this.candidate + ms : 0;
        if (!loud) this.noise = Math.max(.001, Math.min(.025, this.noise * .95 + rms * .05));
        this.quiet += ms;
        if (this.candidate >= 120) {
          this.speech = true; this.chunks = this.preroll; this.preroll = []; this.quiet = 0; this.voiced = this.candidate;
          this.total = this.chunks.reduce((n, c) => n + c.length, 0) / rate * 1000; this.onspeechstart?.();
        } else if (this.quiet > 8000 && !this.quietReported) { this.quietReported = true; this.onquiet?.(); }
        return;
      }
      this.chunks.push(data); this.total += ms;
      this.quiet = loud ? 0 : this.quiet + ms; if (loud) this.voiced += ms;
      if (this.quiet >= 450 || this.total >= 15000) this.stop();
    }
    async stop() {
      if (!this.active || this.finalizing) return;
      if (!this.speech || this.voiced < 160) { this.abort(); this.onerror?.({error:'no-speech'}); return; }
      this.finalizing = true; input.detach(this); this.onspeechend?.(); this.ontranscribing?.();
      const wav = encodeWav(this.chunks, this.rate); this.chunks = []; this.preroll = [];
      let binary = ''; for (let i = 0; i < wav.length; i += 8192) binary += String.fromCharCode(...wav.subarray(i, i + 8192));
      this.controller = new AbortController(); this.timer = setTimer(() => this.controller?.abort(), 25000);
      try {
        const response = await fetchImpl('/api/transcribe', {method:'POST',headers:{'Content-Type':'application/json'},signal:this.controller.signal,
          body:JSON.stringify({audio:'data:audio/wav;base64,' + toBase64(binary),language:this.inputLanguage||({'ko-KR':'ko','en-US':'en','zh-CN':'zh'}[this.lang])||'auto'})});
        const data = await response.json(); if (!this.active) return;
        if (!response.ok) throw new Error(data.error || 'network');
        if (typeof data.text !== 'string') throw new Error('invalid_response');
        if (!data.text.trim()) { this.fail('no-speech'); return; }
        this.onresult?.({results:[{0:{transcript:data.text},isFinal:true}]});
        if (this.active) { this.abort(); this.onend?.(); }
      } catch(error) { if (this.active) this.fail(error.name === 'AbortError' ? 'asr_timeout' : error.message); }
      finally { clearTimer(this.timer); }
    }
    fail(error) { this.abort(); this.onerror?.({error}); }
    abort() { this.active = false; input.detach(this); this.controller?.abort(); clearTimer(this.timer); this.chunks = []; this.preroll = []; }
  };
}
