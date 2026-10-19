import {MEMORY_COPY,MEMORY_DAYS,memoryLine,BIKE_IDS,THEMES} from './bike-memory-core.mjs';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='velo-soul-owned-memories-v1';
export class BikeMemoryUI{
 constructor({document=globalThis.document,storage,fetchImpl=(...a)=>globalThis.fetch(...a),getLanguage=()=> 'en',getVoice=()=> 'en',canSpeak=()=>false,speak=()=>false}={}){Object.assign(this,{document,storage,fetchImpl,getLanguage,getVoice,canSpeak,speak});this.bike='lumi';this.state='loading';this.epoch=0;this.spoken=new Set();this.busy=false;this.status='';this.owned=[];try{this.storage??=globalThis.localStorage;this.owned=JSON.parse(this.storage.getItem(KEY)||'[]').filter(x=>x&&BIKE_IDS.includes(x.bike)&&typeof x.token==='string'&&typeof x.id==='string'&&Date.now()-x.at<MEMORY_DAYS*86400000).slice(-36);}catch{}}
 copy(){return MEMORY_COPY[this.getLanguage()]||MEMORY_COPY.en;}
 markup(mode){return `<section class="bike-memory ${mode}" data-bike-memory="${mode}" data-no-translate aria-label="${escape(this.copy().tag)}"></section>`;}
 async select(bike){
  this.bike=bike;this.memory=null;this.state='loading';this.status='';const serial=++this.epoch;this.controller?.abort();const controller=new AbortController();this.controller=controller;const timeout=setTimeout(()=>controller.abort(),6000);this.render();
  try{const response=await this.fetchImpl('/api/bike-memory?bike='+bike,{signal:controller.signal});const data=await response.json();if(serial!==this.epoch)return;if(!response.ok||data.available!==true)throw Error('unavailable');const m=data.memory;this.memory=m&&m.bike===bike&&typeof m.text==='string'&&Object.hasOwn(THEMES,m.theme)?m:null;this.state='ready';}
  catch{if(serial===this.epoch)this.state='unavailable';}finally{clearTimeout(timeout);if(serial===this.epoch)this.render();}
 }
 render(){
  const c=this.copy();for(const el of this.document.querySelectorAll('[data-bike-memory]')){
   // Preserve an unfinished note and consent through async fetches and language changes.
   const draft=el.querySelector('[data-memory-text]')?.value||'',consent=el.querySelector('[data-memory-consent]')?.checked||false;
   const own=this.owned.filter(x=>x.bike===this.bike);
   const contents=el.dataset.bikeMemory==='farewell'?`<h2>${c.question}</h2><p>${c.hint}</p><label class="sr-only" for="bikeMemoryText">${c.question}</label><textarea id="bikeMemoryText" data-memory-text rows="3" maxlength="120" placeholder="${escape(c.placeholder)}">${escape(draft)}</textarea><label class="memory-consent"><input type="checkbox" data-memory-consent ${consent?'checked':''}> <span>${c.consent}</span></label><button class="secondary" data-memory-share ${this.busy||this.state!=='ready'?'disabled':''}>${this.busy?c.saving:c.share}</button><p class="small memory-status" role="status">${escape(c[this.status]|| (this.state==='unavailable'?c.unavailable:''))}</p><details><summary>${c.tag}</summary><p class="small">${c.privacy}</p></details>`:`<span class="eyebrow">${c.tag}</span><p class="memory-whisper">${escape(this.state==='loading'?c.loading:this.state==='unavailable'?c.unavailable:this.memory?memoryLine(this.bike,this.memory.theme,this.getLanguage()==='zh'?'en':this.getLanguage()):c.empty)}</p>${this.memory?`<blockquote>“${escape(this.memory.text)}”</blockquote><small>${c.quoted}</small>`:''}`;
   el.innerHTML=contents+(el.dataset.bikeMemory==='welcome'&&this.status?`<p class="small" role="status">${escape(c[this.status]||'')}</p>`:'')+(own.length?`<details class="memory-owned"><summary>${c.own} · ${own.length}</summary>${own.map(x=>`<div><p>${escape(x.text)}</p><button class="text-button" data-memory-forget="${escape(x.id)}" ${this.busy?'disabled':''}>${c.forget}</button></div>`).join('')}</details>`:'');
  }
 }
 persist(owned){this.storage.setItem(KEY,JSON.stringify(owned));this.owned=owned;}
 async share(){
  if(this.busy)return;const text=this.document.querySelector('[data-memory-text]')?.value.trim(),consent=this.document.querySelector('[data-memory-consent]')?.checked;
  if(!text||!consent){this.status='required';this.render();return;}
  const bike=this.bike,serial=this.epoch;
  let record=this.owned.find(x=>x.bike===bike&&x.text===text&&x.pending);
  if(!record){const bytes=crypto.getRandomValues(new Uint8Array(32));record={bike,id:crypto.randomUUID(),token:Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''),text,at:Date.now(),pending:true};try{this.persist([...this.owned,record].slice(-36));}catch{this.status='localFail';this.render();return;}}
  this.busy=true;this.status='';this.render();
  try{const response=await this.fetchImpl('/api/bike-memory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...record,consent:true}),signal:AbortSignal.timeout(8000)});const result=await response.json();if(!response.ok)throw Error(result.error);if(result.memory?.id!==record.id)throw Error('invalid_response');record.pending=false;try{this.persist(this.owned);}catch{}if(serial===this.epoch){this.memory=result.memory;this.status='saved';const input=this.document.querySelector('[data-memory-text]');if(input)input.value='';const check=this.document.querySelector('[data-memory-consent]');if(check)check.checked=false;}}
  catch(error){if(serial===this.epoch)this.status=error.message==='memory_contact'?'contact':'failed';}
  finally{this.busy=false;this.render();}
 }
 async forget(id){
  if(this.busy)return;const record=this.owned.find(x=>x.id===id);if(!record)return;this.busy=true;this.render();
  try{const r=await this.fetchImpl('/api/bike-memory',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify(record),signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();try{this.persist(this.owned.filter(x=>x.id!==id));}catch{this.owned=this.owned.filter(x=>x.id!==id);}await this.select(this.bike);this.status='forgot';}
  catch{this.status='failed';}finally{this.busy=false;this.render();}
 }
 flush(){if(!this.memory||this.spoken.has(this.bike)||!this.canSpeak())return false;const line=memoryLine(this.bike,this.memory.theme,this.getVoice());if(this.speak(line,this.getVoice())){this.spoken.add(this.bike);return true;}return false;}
}
