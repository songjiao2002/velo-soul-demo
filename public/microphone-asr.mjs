import {appFetch,speechSocketURL,getDeviceMedia,isNative} from './app-network.mjs';
import {ConversationAudioSession} from './audio-session.mjs';
import {BUILD} from './build-version.mjs';
import {prepareStandby,StreamingTranscriber} from './asr-stream.mjs';
import {loadSpeechDetectorFactory} from './speech-detector.mjs';
import {isConversationLimit,conversationServiceError,MAX_MESSAGE_LENGTH} from './conversation-limits.mjs';
// A 150 Hz high-pass reduces mic offsets, wind rumble and mains hum.
function createSpeechBand(rate) {
  const angle=2*Math.PI*150/rate, cos=Math.cos(angle), a0=1+Math.sin(angle)/Math.SQRT2;
  const b0=(1+cos)/(2*a0), a1=-2*cos/a0, a2=2/a0-1;
  const midDecay=Math.exp(-2*Math.PI*450/rate);
  let z1=0,z2=0,previous=0,previousMid=0,averageMid=0,changingFor=0;
  return input=>{
    const audio=new Float32Array(input.length);
    let bandEnergy=0,rawEnergy=0,midEnergy=0,crossings=0;
    for(let i=0;i<input.length;i++){
      const value=input[i],filtered=b0*value+z1;
      z1=-2*b0*value-a1*filtered+z2;
      z2=b0*value-a2*filtered;
      audio[i]=filtered;
      bandEnergy+=filtered*filtered;
      rawEnergy+=value*value;
      if((filtered>=0)!==(previous>=0))crossings++;
      // A second high-pass measures speech above rumble without thinning the audio we send.
      previousMid=midDecay*(previousMid+filtered-previous);
      midEnergy+=previousMid*previousMid;
      previous=filtered;
    }
    const hiss=crossings*rate/input.length>5400;
    const rumble=bandEnergy<rawEnergy*.018;
    const midRms=Math.sqrt(midEnergy/input.length),seconds=input.length/rate;
    const changing=Math.abs(midRms-averageMid)>.2*Math.max(midRms,averageMid);
    changingFor=changing ? .14 : Math.max(0,changingFor-seconds);
    averageMid=midRms+(averageMid-midRms)*Math.exp(-seconds/.12);
    const speechBandChanging=rawEnergy>0&&changingFor>0&&!hiss&&midEnergy>rawEnergy*.0009;
    return {audio,rms:Math.sqrt(bandEnergy/input.length),noiseOnly:rawEnergy===0||hiss||rumble,midRms,speechBandChanging};
  };
}

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
  constraints(){
    const deviceId=this.audioSession.inputDeviceId;
    // Automatic gain can amplify a running motor during gaps between words.
    return {audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false,...(deviceId?{deviceId:{exact:deviceId}}:{})},video:false};
  }
  async open(){
    if(this.opening)return this.opening;
    if(!this.mediaDevices?.getUserMedia||!this.Context)throw Error('unsupported');
    if(globalThis.document&&globalThis.WebAssembly&&!this.detectorFactory&&!this.detectorPending){
      this.detectorPending=true;
      loadSpeechDetectorFactory().then(factory=>{this.detectorFactory=factory;})
        .catch(()=>{}).finally(()=>{this.detectorPending=false;});
    }
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
    else{node=context.createScriptProcessor(1024,1,1);node.onaudioprocess=e=>this.samples(new Float32Array(e.inputBuffer.getChannelData(0)),context.sampleRate);}
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

// An interim can shorten the pause only after local speech has already been detected.
// An unfinished phrase retains the longer interval for a rider to take a breath.
function previewPause(text,settled){
  if(/(?:\.{2,}|[…,:;，、：；—-])\s*$/u.test(text))return 0;
  const words=text.replace(/[.!?。！？"'”’」』)]+$/u,'').trim();
  if(/\b(?:a|an|the|to|of|for|and|or|but|if|because|with|at|in|on|my|your|is|are|can|could|would|should)$/iu.test(words)
     ||/(?:그리고|그래서|하지만|왜냐하면|因为|但是|然后|如果|所以)$/u.test(words))return 0;
  if(/^(?:yes|yeah|no|okay|ok|thanks|thank you|stop|응|네|아니|고마워|그래|좋아|好|好的|谢谢|不用|对)$/iu.test(text))return settled?220:280;
  if(/[.!?。！？]["'”’」』)]*$/u.test(text))return settled?240:320;
  if(/(?:습니다|습니까|니다|해요|어요|아요|예요|세요|할게|갈게|할래|있어|없어|[었았였했됐졌뒀겠]다|한다|된다|있다|없다|[吗吧呢呀啦])[~～]?$/u.test(text))return settled?280:360;
  // English previews often arrive without punctuation until the provider commits.
  return /^[a-z][\w'’-]*(?:\s+[a-z][\w'’-]*){2,}$/iu.test(text)?(settled?380:460):0;
}

// Only forced mid-speech cuts replay audio. A normal segment boundary keeps
// intentional repeated words, and Mandarin text does not gain artificial spaces.
function joinSegments(left,right,overlap){
  right=right.trim();
  if(!left||!right)return left||right;
  let insideWord=false;
  if(overlap){
    const tokens=/[\p{Script=Han}\p{Script=Hangul}]|[\p{Script=Latin}\p{N}]+(?:['’][\p{Script=Latin}]+)*/gu;
    const end=[...left.matchAll(tokens)].slice(-12),start=[...right.matchAll(tokens)].slice(0,12);
    for(let n=Math.min(end.length,start.length);n>0;n--){
      const aligns=start.slice(0,n).every((word,i)=>{
        const prior=end[end.length-n+i][0].toLowerCase(),next=word[0].toLowerCase();
        return prior===next||(i===n-1&&/^[a-z]{3,}$/iu.test(prior)&&next.startsWith(prior));
      });
      if(!aligns)continue;
      const last=start[n-1];
      if(last[0].length>end.at(-1)[0].length)left=left.slice(0,end.at(-1).index)+last[0];
      const remainder=right.slice(last.index+last[0].length);
      insideWord=/\p{Script=Hangul}$/u.test(last[0])&&/^\p{Script=Hangul}/u.test(remainder);
      right=remainder.replace(/^[\s,，、.!?。！？]+/u,'');
      break;
    }
  }
  if(!right)return left;
  const continuous=insideWord||(/[\p{Script=Han}。，！？]$/u.test(left)&&/^\p{Script=Han}/u.test(right));
  return left+(continuous?'':' ')+right;
}

export function createMicrophoneRecognition({input = new MicrophoneInput(), createDetector, Socket, standby=false, location = globalThis.location, fetchImpl = appFetch,
  now=Date.now, setTimer = (...args) => globalThis.setTimeout(...args), clearTimer = (...args) => globalThis.clearTimeout(...args)} = {}) {
  let streamDisabledUntil=0;
  return class MicrophoneRecognition {
    constructor() { this.active = false; this.chunks = []; this.parts=[];this.confirmedText='';this.preroll = []; this.noise = .002; this.total = this.quiet = this.voiced = 0; this.resetCandidate(); this.startTimeoutMs=isNative()?100000:50000; }
    get stream(){return this.part?.stream;}
    resetCandidate(){
      this.candidate=0;this.candidateGap=0;this.candidateMin=Infinity;this.candidateMax=0;
    }
    releaseDetector(){
      const detector=this.detector;
      this.detector=null;this.detectorPreroll=null;
      try{detector?.destroy();}catch{/* A failed WASM instance may already be unusable. */}
    }
    start() {
      this.active = true;
      input.attach(this).then(()=>this.prepareConnection()).catch(error => { if (this.active) this.fail(error.name === 'NotAllowedError' ? 'not-allowed' : error.message === 'unsupported' ? 'unsupported' : 'audio-capture'); });
    }
    prepareConnection(){
      if(!standby||!this.active||this.stream||this.finalizing||!Socket||!location||this.standby?.available)return;
      const time=now();
      if(time<streamDisabledUntil||time<this.retryStandbyAt)return;
      const url=speechSocketURL(location);url.pathname='/api/transcribe/standby';url.searchParams.set('language',this.language());
      this.retryStandbyAt=time+5000;
      this.standby=prepareStandby(Socket,url.href,setTimer,clearTimer);
    }
    resetCapture(){
      if(!this.active||this.finalizing)return;
      this.standby?.close();this.standby=null;
      this.discardParts();this.chunks=[];this.preroll=[];this.total=this.quiet=this.voiced=0;this.filter=null;this.rate=null;
      this.previewEndPause=0;this.backgroundPause=0;
      this.resetCandidate();
      this.releaseDetector();this.detectorFailed=false;
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
    beginPart(overlap=false,hasFreshSpeech=true){
      this.part={chunks:this.chunks,rate:this.rate,overlap,hasFreshSpeech,preview:''};
      this.parts.push(this.part);
    }
    openStream(){
      const part=this.part;
      if(!part||part.stream)return;
      if(Socket&&location&&now()>=streamDisabledUntil){
        const url=speechSocketURL(location);url.searchParams.set('language',this.language());
        const preparedSocket=this.standby?.take();this.standby=null;
        part.stream=new StreamingTranscriber({Socket,url:url.href,preparedSocket,setTimer,clearTimer,
          onPartial:text=>{
            if(!this.active||part!==this.part||part.sealed||!text.trim())return;
            const earlier=part.preview.trim().toLowerCase();
            const next=text.trim().toLowerCase();
            const growing=earlier.length>=2&&next.length>earlier.length&&next.startsWith(earlier);
            const settled=(growing||this.backgroundPause>=100)&&this.clearVoiceMs>=160&&this.voiced-this.lastClearVoice<=80;
            this.previewEndPause=previewPause(text.trim(),settled);
            this.previewVoiced=this.voiced;
            part.preview=text;
            this.showPreview();
            if(this.active&&this.previewEndPause&&this.backgroundPause>=this.previewEndPause)this.stop();
          },
          onFinal:text=>{
            part.stream=null;
            if(!this.active||!part.sealed||part.discarded)return;
            if(text.trim())this.completePart(part,text);
            else this.transcribe(part);
          },
          onUnavailable:(error,retryAfter)=>{
            part.stream=null;
            if(!this.active||part.discarded)return;
            if(part===this.part){this.backgroundPause=0;this.previewEndPause=0;}
            // A shared limit also applies to file uploads. Let the conversation
            // wait or stop without uploading the same recording a second time.
            if(isConversationLimit(error))return this.fail(error,retryAfter);
            streamDisabledUntil=now()+(['provider_auth','not_configured'].includes(error)?60000:5000);
            if(part.sealed)this.transcribe(part);
          }});
      }
    }
    samples(data, rate) {
      if (!this.active || this.finalizing) return;
      this.lastSampleAt=now();if(!this.captureTimer)this.watchCapture();
      if (!this.started) { this.started = true; this.onstart?.(); if(!this.active)return; }
      if(!data.length||!Number.isFinite(rate)||rate<8000)return;
      if(this.rate!==rate){
        if(this.rate!==null&&this.rate!==undefined)this.resetCapture();
        this.rate=rate;
        this.filter=createSpeechBand(rate);
        this.midNoise=.0003;
      }
      const ms=data.length/rate*1000;
      const {audio,rms,noiseOnly,midRms,speechBandChanging}=this.filter(data);
      let recentOnset=false;
      const factory=createDetector||input.detectorFactory;
      let localVoice;
      if(!this.detectorFailed){
        try{
          if(factory&&!this.detector){
            this.detector=factory();
            let ageAfterOnset=Infinity;
            for(const buffered of this.detectorPreroll||[]){
              ageAfterOnset=this.detector.observe(buffered,rate).onset?0:ageAfterOnset+buffered.length/rate;
            }
            recentOnset=ageAfterOnset<.36;
            this.detectorPreroll=null;
          }
          localVoice=this.detector?.observe(data,rate,this.speech);
          if(!this.detector&&input.detectorPending){
            this.detectorPreroll??=[];
            this.detectorPreroll.push(data);
            while(this.detectorPreroll.length>Math.ceil(rate*.9/data.length))this.detectorPreroll.shift();
          }
          else if(!this.detector)this.detectorPreroll=null;
        }catch{this.releaseDetector();this.detectorFailed=true;}
      }
      input.onLevel(Math.min(1,rms*12));
      const strong=!noiseOnly&&rms>Math.max(.0065,this.noise*1.8);
      const softSyllable=speechBandChanging&&midRms>Math.max(.00065,this.midNoise*2.8);
      const loud=strong||(!noiseOnly&&rms>Math.max(.0039,this.noise*2.1))||softSyllable;
      const continuationFloor=this.voiced<=220 ? .0045 : .003;
      const audible=(!noiseOnly&&rms>.0004)||(speechBandChanging&&midRms>.0004);
      const continuing=localVoice ? localVoice.continuing&&audible : (!noiseOnly&&rms>Math.max(continuationFloor,this.noise*1.4))
        ||(speechBandChanging&&midRms>Math.max(.00045,this.midNoise*2));
      if (!this.speech) {
        this.preroll.push(audio);
        while (this.preroll.length > Math.ceil(rate * .9 / data.length)) this.preroll.shift();
        if(loud){
          this.candidate+=ms;
          this.candidateGap=0;
          this.candidateMin=Math.min(this.candidateMin,midRms);
          this.candidateMax=Math.max(this.candidateMax,midRms);
        }else{
          this.candidateGap+=ms;
          if(this.candidateGap>60){
            this.resetCandidate();
          }
          const floor=Math.min(rms,noiseOnly ? .0045 : .03);
          this.noise=Math.max(.001,Math.min(.025,this.noise*.96+floor*.04));
          this.midNoise=Math.max(.00015,Math.min(.025,this.midNoise*.96+midRms*.04));
        }
        this.quiet+=ms;
        // Quiet syllables change level over time. Keep a steady, low-level hum local.
        const voiceOnset=localVoice ? (recentOnset||(localVoice.onset&&audible))
          : !input.detectorPending&&loud&&(strong||this.candidateMax>=this.candidateMin*1.4);
        if(!voiceOnset&&this.candidate>=240)this.resetCandidate();
        if(voiceOnset&&this.candidate>=40)this.prepareConnection();
        if (voiceOnset && (localVoice || this.candidate >= 120)) {
          this.speech = true; this.chunks = this.preroll; this.preroll = []; this.quiet = 0; this.voiced = this.candidate;
          this.backgroundPause=0;this.clearVoiceMs=0;this.lastClearVoice=0;
          if(localVoice)this.voiced=Math.max(40,Math.min(120,this.voiced));
          this.total = this.chunks.reduce((n, c) => n + c.length, 0) / rate * 1000; this.onspeechstart?.();
          if(this.active){this.beginPart();this.openStream();}
          if(this.active)this.stream?.writeBuffered(this.chunks,rate);
        } else if (this.quiet > 8000 && !this.quietReported) { this.quietReported = true; this.onquiet?.(); }
        return;
      }
      this.chunks.push(audio); this.total += ms;
      if(continuing&&!this.part.hasFreshSpeech){
        this.part.hasFreshSpeech=true;this.openStream();this.stream?.writeBuffered(this.chunks,rate);
      }else this.stream?.write(audio,rate);
      if(continuing&&this.quiet>=80)this.previewEndPause=0;
      this.quiet = continuing ? 0 : this.quiet + ms;
      if(continuing){
        this.voiced+=ms;
        if(rms>=Math.max(.009,this.noise*3)&&midRms>=Math.max(.0012,this.midNoise*3)){
          this.clearVoiceMs+=ms;this.lastClearVoice=this.voiced;
        }
      }
      const audioOnly=!this.stream||this.stream.closed;
      const nearBackground=audioOnly ? rms<=.0008&&midRms<=.00035
        : rms<=Math.max(.0015,this.noise*1.4)&&midRms<=Math.max(.00045,this.midNoise*1.4);
      this.backgroundPause=!continuing&&nearBackground?this.backgroundPause+ms:0;
      // Stale words, a soft trailing syllable, or elevated street noise cannot shorten the pause.
      const clearEnding=this.previewEndPause>0&&this.voiced-this.previewVoiced<=160&&this.backgroundPause>=this.previewEndPause;
      const clearAudioEnd=audioOnly&&this.clearVoiceMs>=360&&this.voiced-this.lastClearVoice<=80&&this.backgroundPause>=460;
      const endPause = this.voiced <= 220 ? 360 : 540;
      if(clearEnding||clearAudioEnd||this.quiet>=endPause)this.stop();
      else if((this.total>=12000&&this.backgroundPause>=180)||this.total>=14500)this.rotatePart();
    }
    rotatePart(){
      // Each provider task and fallback upload remains below 15 seconds. If
      // there is no pause, overlap the last 400 ms so a word can span the cut.
      const carry=[];
      let samples=0;
      if(this.backgroundPause<180){
        const target=Math.round(this.rate*.4);
        for(let i=this.chunks.length-1;i>=0&&samples<target;i--){
          const chunk=this.chunks[i],length=Math.min(chunk.length,target-samples);
          carry.unshift(chunk.subarray(chunk.length-length));samples+=length;
        }
      }
      const previous=this.part;
      this.chunks=carry;this.total=samples/this.rate*1000;
      this.previewEndPause=0;this.beginPart(samples>0,false);
      this.sealPart(previous);
    }
    sealPart(part){
      part.sealed=true;
      if(!part.hasFreshSpeech)return this.completePart(part,'');
      if(part.stream&&!part.stream.closed)return part.stream.finish();
      return this.transcribe(part);
    }
    showPreview(){
      if(this.finalizing)return;
      const text=this.parts.reduce((acc,part)=>joinSegments(acc,part.text??part.preview,part.overlap),this.confirmedText);
      if(text)this.onresult?.({results:[{0:{transcript:text},isFinal:false}]});
    }
    completePart(part,text){
      if(!this.active||part.discarded||part.done)return;
      part.chunks=[];part.done=true;part.text=text.trim();
      while(this.parts[0]?.done){
        const next=this.parts.shift();
        this.confirmedText=joinSegments(this.confirmedText,next.text,next.overlap);
        if(this.confirmedText.length>MAX_MESSAGE_LENGTH)return this.fail('utterance_too_long');
      }
      if(this.finalizing&&!this.parts.length)this.deliver(this.confirmedText);
      else this.showPreview();
    }
    async stop() {
      if (!this.active || this.finalizing) return;
      if (!this.speech || this.voiced < 120) { this.abort(); this.onerror?.({error:'no-speech'}); return; }
      this.finalizing = true; input.detach(this); this.onspeechend?.(); this.ontranscribing?.();
      clearTimer(this.captureTimer);this.captureTimer=null;
      return this.sealPart(this.part);
    }
    language(){return this.inputLanguage||({'ko-KR':'ko','en-US':'en','zh-CN':'zh'}[this.lang])||'auto';}
    deliver(text){
      if(!this.speech||this.voiced<120||!text.trim()){this.fail('no-speech');return;}
      this.onresult?.({results:[{0:{transcript:text},isFinal:true}]});
      if(this.active){this.abort();this.onend?.();}
    }
    async transcribe(part){
      if(!this.active||part.discarded||part.controller)return;
      const wav=encodeWav(part.chunks,part.rate);
      part.chunks=[];
      const controller=new AbortController();part.controller=controller;
      const timer=setTimer(()=>controller.abort(),25000);part.timer=timer;
      try {
        const response = await fetchImpl('/api/transcribe?language='+encodeURIComponent(this.language()), {
          method:'POST',headers:{'Content-Type':'audio/wav'},signal:controller.signal,body:wav
        });
        const data = await response.json(); if (!this.active||part.discarded) return;
        if (!response.ok) throw conversationServiceError(data,response.headers);
        if (typeof data.text !== 'string') throw new Error('invalid_response');
        this.completePart(part,data.text);
      } catch(error) { if (this.active&&!part.discarded) this.fail(error.name === 'AbortError' ? 'asr_timeout' : error.message,error.retryAfter); }
      finally { clearTimer(timer); }
    }
    discardParts(){
      for(const part of this.parts){
        part.discarded=true;part.stream?.close();part.controller?.abort();clearTimer(part.timer);part.chunks=[];
      }
      this.parts=[];this.part=null;this.confirmedText='';
    }
    fail(error,retryAfter) { this.abort(); this.onerror?.({error,retryAfter}); }
    abort() { this.active = false; this.standby?.close();this.standby=null;this.discardParts();this.releaseDetector();input.detach(this);clearTimer(this.captureTimer);this.captureTimer=null;this.chunks=[];this.preroll=[]; }
  };
}
