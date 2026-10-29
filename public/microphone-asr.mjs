import {appFetch,speechSocketURL,getDeviceMedia,isNative} from './app-network.mjs';
import {ConversationAudioSession} from './audio-session.mjs';
import {BUILD} from './build-version.mjs';
import {StreamingTranscriber} from './asr-stream.mjs';
// One microphone session per conversation. Utterances are bounded, transient PCM;
// speech streams to the server; bounded PCM is retained only for outage fallback.
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
  constructor({mediaDevices=globalThis.navigator?.mediaDevices,Context=globalThis.AudioContext||globalThis.webkitAudioContext,
    WorkletNode=globalThis.AudioWorkletNode,audioSession,document=globalThis.document,onLevel=()=>{},setTimer=(...a)=>globalThis.setTimeout(...a),clearTimer=(...a)=>globalThis.clearTimeout(...a)}={}) {
    Object.assign(this,{mediaDevices,Context,WorkletNode,document,onLevel,setTimer,clearTimer});this.serial=0;this.waits=new Map();
    this.ownsSession=!audioSession;this.audioSession=audioSession||new ConversationAudioSession({Context,setTimer,clearTimer});
    this.deviceChanged=()=>{if(this.document?.hidden)return;const tracks=this.stream?.getTracks()||[];if(tracks.some(t=>t.readyState==='ended'))this.recoverCapture();else if(tracks.some(t=>t.muted))this.deferMutedRecovery();};
  }
  constraints(){const deviceId=this.audioSession.inputDeviceId;return {audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,...(deviceId?{deviceId:{exact:deviceId}}:{})},video:false};}
  async open(){
    if(this.opening)return this.opening;
    if(!this.mediaDevices?.getUserMedia||!this.Context)throw Error('unsupported');
    const serial=this.serial;
    this.opening=(async()=>{
      const context=this.audioSession.acquire(this,{onInterrupt:()=>this.receiver?.resetCapture?.(),onFailure:()=>{this.routeFailed=true;this.receiver?.fail('audio-capture');},changeInput:()=>this.recoverCapture(true),getInput:()=>this.stream?.getTracks()[0]});this.context=context;
      // Start resume and permission capture in the original user gesture. Both
      // waits must settle when stopped, even if the browser never resolves them.
      const resume=Promise.resolve(context.resume());resume.catch(()=>{});
      const request=getDeviceMedia(this.constraints(),this.mediaDevices,{isCurrent:()=>serial===this.serial}).then(stream=>{
        if(serial!==this.serial){stream.getTracks().forEach(t=>t.stop());return;}
        this.stream=stream;this.audioSession.captureReady(this);return stream;
      });
      // First use may include a queued camera prompt, microphone and paired
      // headset permission. Do not cancel a human permission choice after 10s.
      // Already granted capture still proceeds immediately.
      const [stream]=await this.deadline(Promise.all([request,resume]),isNative()?95000:45000);
      if(serial!==this.serial)return;
      if(context.state!=='running')await this.audioSession.recover();
      if(serial!==this.serial)return;if(context.state!=='running')throw Error('audio-capture');
      await this.deadline(this.connectStream(stream,serial),3000);
      if(serial!==this.serial)return;
      this.mediaDevices.addEventListener?.('devicechange',this.deviceChanged);
      this.document?.addEventListener?.('visibilitychange',this.deviceChanged);
    })().catch(error=>{if(serial!==this.serial)return;this.release();throw error;});
    return this.opening;
  }
  async deadline(promise,ms){
    let timer;
    try{return await Promise.race([promise,new Promise((_,reject)=>{
      timer=this.setTimer(()=>{this.waits.delete(timer);reject(Error('audio-capture'));},ms);
      this.waits.set(timer,()=>reject(Error('cancelled')));
    })]);}finally{this.clearTimer(timer);this.waits.delete(timer);}
  }
  async connectStream(stream,serial){
    const context=this.context;
    if(context.audioWorklet&&this.WorkletNode&&!this.workletLoaded){await context.audioWorklet.addModule('/mic-worklet.js?v='+BUILD);if(serial!==this.serial)return;this.workletLoaded=true;}
    if(serial!==this.serial)return;
    const source=context.createMediaStreamSource(stream);this.source=source;let node;
    if(context.audioWorklet&&this.WorkletNode){node=new this.WorkletNode(context,'soul-mic');node.port.onmessage=e=>this.samples(e.data,context.sampleRate);}
    else{node=context.createScriptProcessor(2048,1,1);node.onaudioprocess=e=>this.samples(new Float32Array(e.inputBuffer.getChannelData(0)),context.sampleRate);}
    this.node=node;const mute=context.createGain();this.mute=mute;mute.gain.value=0;source.connect(node);node.connect(mute);mute.connect(context.destination);
    for(const track of stream.getTracks()){
      const valid=()=>serial===this.serial&&stream===this.stream;
      track.addEventListener('ended',()=>{if(valid())this.recoverCapture();});
      track.addEventListener('mute',()=>{if(!valid())return;this.receiver?.resetCapture?.();this.deferMutedRecovery();});
      track.addEventListener('unmute',()=>{if(valid()){this.clearTimer(this.muteTimer);this.muteTimer=null;if(context.state!=='running')this.audioSession.recover();}});
    }
  }
  deferMutedRecovery(){
    if(this.muteTimer||this.document?.hidden)return;
    const serial=this.serial;
    // Android Bluetooth profile changes can mute a live track for several
    // seconds. Device-change bursts must not shorten or extend this grace.
    this.muteTimer=this.setTimer(()=>{this.muteTimer=null;if(serial===this.serial&&!this.document?.hidden&&this.stream?.getTracks().some(t=>t.muted))this.recoverCapture();},4500);
  }
  wait(ms){return new Promise(resolve=>{const id=this.setTimer(()=>{this.waits.delete(id);resolve();},ms);this.waits.set(id,resolve);});}
  recoverCapture(force=false){
    if(this.repair||!this.stream||this.document?.hidden)return this.repair;
    const serial=this.serial,valid=()=>serial===this.serial;this.receiver?.resetCapture?.();
    const task=Promise.resolve().then(async()=>{
      await this.wait(400);if(!valid())return;
      // Reacquire only an ended/muted input, never on every reply or healthy device event.
      if(!force&&this.stream?.getTracks().every(t=>t.readyState!=='ended'&&!t.muted))return;
      this.dropGraph();this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;
      let discard=false;
      const request=getDeviceMedia(this.constraints(),this.mediaDevices,{isCurrent:()=>!discard&&valid()}).then(stream=>{
        if(discard||!valid()){stream.getTracks().forEach(t=>t.stop());throw Error('cancelled');}return stream;
      });
      try{
        const stream=await Promise.race([request,this.wait(4000).then(()=>{throw Error('audio-capture');})]);
        if(!valid()){stream.getTracks().forEach(t=>t.stop());return;}
        this.stream=stream;this.audioSession.captureReady(this);await this.deadline(this.connectStream(stream,serial),3000);if(valid())return await this.audioSession.recover();return false;
      }finally{discard=true;}
    }).catch(()=>{if(valid()){this.routeFailed=true;this.dropGraph();this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.receiver?.fail('audio-capture');}return false;}).finally(()=>{
      if(this.repair===task){this.repair=null;for(const [id,resolve]of this.waits){this.clearTimer(id);resolve();}this.waits.clear();}
    });this.repair=task;return task;
  }
  samples(data,rate){if(!this.repair&&this.context?.state==='running'&&!this.stream?.getTracks().some(t=>t.muted))this.receiver?.samples(data,rate);}
  async attach(receiver){const serial=this.serial;await this.open();if(this.repair)await this.repair;if(serial!==this.serial)return;if(this.routeFailed)throw Error('audio-capture');if(receiver.active&&this.stream)this.receiver=receiver;}
  detach(receiver){if(this.receiver===receiver){this.receiver=null;this.onLevel(0);}}
  dropGraph(){if(this.node?.port)this.node.port.onmessage=null;if(this.node)this.node.onaudioprocess=null;this.node?.disconnect();this.source?.disconnect();this.mute?.disconnect();this.node=this.source=this.mute=null;}
  release(){
    this.serial++;this.receiver=null;this.onLevel(0);this.clearTimer(this.muteTimer);this.muteTimer=null;
    for(const [id,resolve]of this.waits){this.clearTimer(id);resolve();}this.waits.clear();this.repair=null;
    this.mediaDevices?.removeEventListener?.('devicechange',this.deviceChanged);
    this.document?.removeEventListener?.('visibilitychange',this.deviceChanged);
    this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.dropGraph();
    this.audioSession.release(this);if(this.ownsSession)this.audioSession.dispose();
    this.context=this.opening=null;this.routeFailed=false;this.workletLoaded=false;
  }
}

export function createMicrophoneRecognition({input = new MicrophoneInput(), Socket, location = globalThis.location, fetchImpl = appFetch,
  toBase64 = s => globalThis.btoa(s), now=Date.now, setTimer = (...args) => globalThis.setTimeout(...args), clearTimer = (...args) => globalThis.clearTimeout(...args)} = {}) {
  let streamDisabledUntil=0;
  return class MicrophoneRecognition {
    constructor() { this.active = false; this.chunks = []; this.preroll = []; this.noise = .002; this.total = this.quiet = this.candidate = this.voiced = 0; this.startTimeoutMs=isNative()?100000:50000; }
    start() {
      this.active = true;
      input.attach(this).catch(error => { if (this.active) this.fail(error.name === 'NotAllowedError' ? 'not-allowed' : error.message === 'unsupported' ? 'unsupported' : 'audio-capture'); });
    }
    resetCapture(){
      if(!this.active||this.finalizing)return;
      this.stream?.close();this.stream=null;this.chunks=[];this.preroll=[];this.total=this.quiet=this.candidate=this.voiced=0;
      this.speech=false;this.started=false;this.quietReported=false;this.noise=.002;this.onaudiorecovering?.();
    }
    watchCapture(){
      clearTimer(this.captureTimer);
      this.captureTimer=setTimer(()=>{
        if(!this.active||this.finalizing)return;
        if(now()-this.lastSampleAt>=6000)return this.fail('audio-capture');
        this.watchCapture();
      },6000);
    }
    openStream(){
      if(Socket&&location&&Date.now()>=streamDisabledUntil){
        const url=speechSocketURL(location);url.searchParams.set('language',this.language());
        this.stream=new StreamingTranscriber({Socket,url:url.href,setTimer,clearTimer,
          onPartial:text=>{if(this.active)this.onresult?.({results:[{0:{transcript:text},isFinal:false}]});},
          onFinal:text=>{if(this.active)this.deliver(text);},
          onUnavailable:error=>{this.stream=null;streamDisabledUntil=Date.now()+60000;if(!this.active)return;if(['rate_limited','provider_quota'].includes(error))return this.fail(error);if(this.finalizing)this.transcribe();}});
      }
    }
    samples(data, rate) {
      if (!this.active || this.finalizing) return;
      this.lastSampleAt=now();if(!this.captureTimer)this.watchCapture();
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
          if(this.active)this.openStream();
          if(this.active)for(const chunk of this.chunks)this.stream?.write(chunk,rate);
        } else if (this.quiet > 8000 && !this.quietReported) { this.quietReported = true; this.onquiet?.(); }
        return;
      }
      this.chunks.push(data); this.total += ms; this.stream?.write(data,rate);
      this.quiet = loud ? 0 : this.quiet + ms; if (loud) this.voiced += ms;
      if (this.quiet >= 450 || this.total >= 15000) this.stop();
    }
    async stop() {
      if (!this.active || this.finalizing) return;
      if (!this.speech || this.voiced < 160) { this.abort(); this.onerror?.({error:'no-speech'}); return; }
      this.finalizing = true; input.detach(this); this.onspeechend?.(); this.ontranscribing?.();
      clearTimer(this.captureTimer);this.captureTimer=null;
      if(this.stream&&!this.stream.closed){this.stream.finish();return;}
      return this.transcribe();
    }
    language(){return this.inputLanguage||({'ko-KR':'ko','en-US':'en','zh-CN':'zh'}[this.lang])||'auto';}
    deliver(text){
      if(!text.trim()){this.fail('no-speech');return;}
      this.onresult?.({results:[{0:{transcript:text},isFinal:true}]});
      if(this.active){this.abort();this.onend?.();}
    }
    async transcribe(){
      if(!this.active||this.uploading)return;this.uploading=true;
      const wav = encodeWav(this.chunks, this.rate); this.chunks = []; this.preroll = [];
      let binary = ''; for (let i = 0; i < wav.length; i += 8192) binary += String.fromCharCode(...wav.subarray(i, i + 8192));
      this.controller = new AbortController(); this.timer = setTimer(() => this.controller?.abort(), 25000);
      try {
        const response = await fetchImpl('/api/transcribe', {method:'POST',headers:{'Content-Type':'application/json'},signal:this.controller.signal,
          body:JSON.stringify({audio:'data:audio/wav;base64,' + toBase64(binary),language:this.language()})});
        const data = await response.json(); if (!this.active) return;
        if (!response.ok) throw new Error(data.error || 'network');
        if (typeof data.text !== 'string') throw new Error('invalid_response');
        this.deliver(data.text);
      } catch(error) { if (this.active) this.fail(error.name === 'AbortError' ? 'asr_timeout' : error.message); }
      finally { clearTimer(this.timer); }
    }
    fail(error) { this.abort(); this.onerror?.({error}); }
    abort() { this.active = false; this.stream?.close();this.stream=null; input.detach(this); this.controller?.abort(); clearTimer(this.timer);clearTimer(this.captureTimer);this.captureTimer=null; this.chunks = []; this.preroll = []; }
  };
}
