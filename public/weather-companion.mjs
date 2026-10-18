import {weatherArea,weatherFresh,weatherLine,weatherGreeting,WeatherNoticeGate} from './weather-core.mjs';
export class WeatherCompanion{
 constructor({fetchImpl=(...args)=>globalThis.fetch(...args),getSoul=()=> 'mori',getLanguage=()=> 'en',canSpeak=()=>false,speak=()=>false,onChange=()=>{},refreshPosition=async()=>null,now=Date.now,setTimer=(...args)=>globalThis.setTimeout(...args),clearTimer=(...args)=>globalThis.clearTimeout(...args)}={}){
  Object.assign(this,{fetchImpl,getSoul,getLanguage,canSpeak,speak,onChange,refreshPosition,now,setTimer,clearTimer});this.epoch=0;this.active=false;this.autoSpeak=true;this.gate=new WeatherNoticeGate();this.state='off';
 }
 setState(state){this.state=state;this.onChange(state,this.snapshot);}
 start(){if(this.active)return;this.active=true;this.epoch++;this.startedAt=this.now();this.nextFetch=0;this.lastAttempt=-Infinity;this.setState('waiting');this.schedule();}
 stop(){this.active=false;this.epoch++;this.controller?.abort();this.controller=null;this.clearTimer(this.timer);this.timer=null;this.snapshot=null;this.point=null;this.areaKey=null;this.busy=false;this.gate=new WeatherNoticeGate();this.setState('off');}
 position(point){if(!this.active)return;const area=weatherArea(point,this.now());if(!area)return;const key=`${area.latitude},${area.longitude}`;this.point=point;if(key!==this.areaKey){this.areaKey=key;this.snapshot=null;this.nextFetch=0;this.setState('loading');}void this.refresh();}
 reference(){return this.active&&weatherArea(this.point,this.now())&&weatherFresh(this.snapshot,this.now())?this.snapshot.id:null;}
 openingPending(){return this.active&&this.autoSpeak&&!this.gate.greeted&&this.state!=='unavailable'&&(!!this.reference()||this.now()-this.startedAt<15000);}
 schedule(){this.clearTimer(this.timer);if(this.active)this.timer=this.setTimer(()=>{this.tick();this.schedule();},5000);}
 tick(){if(!this.active)return;if(this.snapshot&&!weatherFresh(this.snapshot,this.now())){this.snapshot=null;this.setState('stale');}void this.refresh();this.flush();}
 preview(){if(!this.reference()||!this.autoSpeak)return null;const notice=this.gate.candidate(this.snapshot,this.now());return notice?{notice,line:(notice.greeting?weatherGreeting:weatherLine)(this.snapshot,this.getSoul(),this.getLanguage(),notice.risk)}:null;}
 flush(){if(!this.reference()||!this.autoSpeak||!this.canSpeak())return;const notice=this.gate.candidate(this.snapshot,this.now());if(!notice)return;const line=(notice.greeting?weatherGreeting:weatherLine)(this.snapshot,this.getSoul(),this.getLanguage(),notice.risk);const accepted=this.speak(line,this.getLanguage(),notice);if(accepted)this.gate.mark(notice,this.now());}
 async refresh(){
  if(!this.active||this.busy||(this.now()<this.nextFetch&&weatherArea(this.point,this.now()))||this.now()-this.lastAttempt<60000||!this.point)return;
  const serial=this.epoch;this.busy=true;this.lastAttempt=this.now();const controller=new AbortController();this.controller=controller;
  const valid=()=>this.active&&serial===this.epoch;let timer;
  try{
   let area=weatherArea(this.point,this.now());
   if(!area){const p=await this.refreshPosition();if(!valid())return;area=weatherArea(p,this.now());if(!area)throw Error('weather_gps');this.point=p;const key=`${area.latitude},${area.longitude}`;if(key!==this.areaKey){this.snapshot=null;this.areaKey=key;}}
   if(this.snapshot&&weatherFresh(this.snapshot,this.now())&&this.now()<this.nextFetch){this.setState('ready');return;}
   const key=this.areaKey;this.setState('loading');timer=this.setTimer(()=>controller.abort(),12000);
   const response=await this.fetchImpl('/api/weather',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(area),signal:controller.signal});const data=await response.json();if(!valid()||key!==this.areaKey)return;
   if(!response.ok||typeof data.id!=='string'||data.source!=='Open-Meteo'||!weatherFresh(data,this.now())||!Number.isFinite(data.temperatureC)||!Number.isFinite(data.code))throw Error(data.error||'weather_unavailable');
   this.snapshot=data;this.nextFetch=this.now()+300000;this.setState('ready');this.flush();
  }catch(error){if(valid()){this.snapshot=null;this.nextFetch=this.now()+60000;this.setState(error.message==='weather_gps'?'waiting':'unavailable');}}
  finally{this.clearTimer(timer);if(valid())this.busy=false;if(this.controller===controller)this.controller=null;}
 }
}
