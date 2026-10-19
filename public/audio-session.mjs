// One Web Audio graph for microphone and replies. The OS still selects the
// physical route; never force the phone speaker or claim to pair a headset.
export class ConversationAudioSession {
 constructor({Context=globalThis.AudioContext||globalThis.webkitAudioContext,navigator=globalThis.navigator,document=globalThis.document,setTimer=(...a)=>globalThis.setTimeout(...a),clearTimer=(...a)=>globalThis.clearTimeout(...a)}={}){
  Object.assign(this,{Context,navigator,document,setTimer,clearTimer});this.inputs=new Map();this.waits=new Map();this.epoch=0;
  this.changed=()=>{if(this.inputs.size&&this.context?.state!=='running')this.recover();};
 }
 getContext(){
  if(!this.context||this.context.state==='closed'){
   if(!this.Context)throw Error('unsupported');
   this.context=new this.Context({latencyHint:'interactive'});
   this.context.onstatechange=this.changed;
   this.navigator?.mediaDevices?.addEventListener?.('devicechange',this.changed);
   this.navigator?.audioSession?.addEventListener?.('statechange',this.changed);
   this.document?.addEventListener?.('visibilitychange',this.changed);
  }
  return this.context;
 }
 acquire(owner,callbacks={}){
  // Reserve the graph in the user gesture, but activate duplex only once the
  // microphone has been granted. Pre-activating can select the handset route.
  if(!this.inputs.size){try{this.previousType=this.navigator?.audioSession?.type;}catch{}}
  this.inputs.set(owner,callbacks);
  try{return this.getContext();}catch(error){this.release(owner);throw error;}
 }
 captureReady(owner){
  if(!this.inputs.has(owner))return;
  try{const session=this.navigator?.audioSession;if(session)session.type='play-and-record';}catch{/* Optional API. */}
 }
 getOutput(){return this.devices?.destination()||this.getContext().destination;}
 release(owner){
  if(!this.inputs.delete(owner)||this.inputs.size)return;
  this.epoch++;this.cancelWaits();this.pending=null;
  try{const session=this.navigator?.audioSession;if(session?.type==='play-and-record')session.type=this.previousType||'auto';}catch{}
 }
 wait(ms){return new Promise(resolve=>{const id=this.setTimer(()=>{this.waits.delete(id);resolve();},ms);this.waits.set(id,resolve);});}
 cancelWaits(){for(const [id,resolve]of this.waits){this.clearTimer(id);resolve();}this.waits.clear();}
 async resumeAttempt(context){
  let timer;
  try{await Promise.race([Promise.resolve().then(()=>context.resume()).catch(()=>{}),new Promise(resolve=>{timer=this.setTimer(resolve,700);this.waits.set(timer,resolve);})]);}
  finally{this.clearTimer(timer);this.waits.delete(timer);}
 }
 recover(){
  if(this.context?.state==='running')return Promise.resolve(true);
  if(this.pending)return this.pending;
  if(!this.inputs.size||this.document?.hidden)return Promise.resolve(false);
  const epoch=this.epoch,context=this.context,valid=()=>epoch===this.epoch&&this.inputs.size&&!this.document?.hidden&&context===this.context;
  const task=Promise.resolve().then(async()=>{
   for(const callbacks of this.inputs.values())callbacks.onInterrupt?.();
   // Let a short Bluetooth route switch settle. A hanging resume is bounded.
   for(const delay of [0,250,700,1400,2500]){
    if(delay)await this.wait(delay);if(!valid())return false;
    if(context.state==='running')return true;if(context.state==='closed')break;
    if(this.navigator?.audioSession?.state==='interrupted')continue;
    await this.resumeAttempt(context);
    if(!valid())return false;if(context.state==='running')return true;
   }
   if(valid())for(const callbacks of [...this.inputs.values()])callbacks.onFailure?.();
   return false;
  }).finally(()=>{if(this.pending===task){this.pending=null;this.cancelWaits();}});
  this.pending=task;return task;
 }
 dispose(){
  this.devices?.dispose();
  for(const owner of [...this.inputs.keys()])this.release(owner);
  this.navigator?.mediaDevices?.removeEventListener?.('devicechange',this.changed);
  this.navigator?.audioSession?.removeEventListener?.('statechange',this.changed);
  this.document?.removeEventListener?.('visibilitychange',this.changed);
  const context=this.context;this.context=null;
  if(context){context.onstatechange=null;context.close().catch(()=>{});}
 }
}
