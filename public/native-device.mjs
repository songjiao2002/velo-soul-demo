import {App} from '@capacitor/app';
import {Geolocation} from '@capacitor/geolocation';
import {Filesystem,Directory} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {isNative} from './app-network.mjs';

export function createNativeGPS(plugin){
 let sequence=0;const watchers=new Map();
 const error=e=>({code:/0003|denied|permission/i.test(e?.code+' '+e?.message)?1:2,message:e?.message||'Location unavailable'});
 return {
  getCurrentPosition(success,failure,options){plugin.getCurrentPosition(options||{}).then(success,e=>failure?.(error(e)));},
  watchPosition(success,failure,options){
   const id=++sequence,entry={nativeId:null,cancelled:false};watchers.set(id,entry);
   // Preserve the synchronous browser watch ID while native permission is pending.
   plugin.watchPosition({...options,minimumUpdateInterval:2000},(position,e)=>{
    if(entry.cancelled)return;if(e)failure?.(error(e));else if(position)success(position);
   }).then(nativeId=>{entry.nativeId=nativeId;if(entry.cancelled)void plugin.clearWatch({id:nativeId}).catch(()=>{});},e=>{if(!entry.cancelled)failure?.(error(e));watchers.delete(id);});return id;
  },
  clearWatch(id){const entry=watchers.get(id);if(!entry)return;entry.cancelled=true;watchers.delete(id);if(entry.nativeId!==null)void plugin.clearWatch({id:entry.nativeId}).catch(()=>{});}
 };
}
const gps=createNativeGPS(Geolocation);
export function deviceGPS(){return isNative()?gps:globalThis.navigator?.geolocation;}
export async function saveNativeImage(data,filename,{share=false}={}){
 if(!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(data)||!/^velo-soul-[\w.-]+\.(jpg|png)$/.test(filename))throw Error('Invalid image');
 // App-private Documents survives restarts and is not uploaded. Export through the OS share sheet.
 await Filesystem.writeFile({path:'VELO-SOUL/'+filename,directory:Directory.Data,data:data.split(',')[1],recursive:true});
 if(share){
  const file=await Filesystem.writeFile({path:filename,directory:Directory.Cache,data:data.split(',')[1]});
  await Share.share({files:[file.uri],title:'VELO SOUL',dialogTitle:'Save or share'});
 }
 return {saved:true};
}
export function initNativeDevice({onBack,onURL,onPause}){
 if(!isNative())return;
 document.documentElement.classList.add('native-app');
 void App.addListener('backButton',()=>{if(onBack()===false)void App.exitApp();});
 void App.addListener('appUrlOpen',event=>onURL(event.url));
 void App.addListener('appStateChange',state=>{if(!state.isActive)onPause();});
 void App.getLaunchUrl().then(event=>{if(event?.url)onURL(event.url);}).catch(()=>{});
 document.addEventListener('click',async event=>{
  const link=event.target.closest('a[download]');if(!link)return;
  const raw=link.getAttribute('href')||'';if(!/^\/qr-(lumi|mori|bori)\.png$/.test(raw)&&!raw.startsWith('data:image/jpeg;base64,'))return;
  event.preventDefault();try{
   const data=raw.startsWith('data:')?raw:await new Promise(async(resolve,reject)=>{try{const response=await fetch(raw);if(!response.ok)throw Error('Image unavailable');const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(await response.blob());}catch(e){reject(e);}});
   await saveNativeImage(data,link.download,{share:true});
  }catch{const el=document.getElementById('toast');if(el){el.textContent=({ko:'내보내기를 완료하지 못했어요. 다시 눌러주세요.',zh:'未能完成导出，请重试。'})[document.documentElement.lang.slice(0,2)]||'Could not finish exporting. Please try again.';el.classList.add('show');setTimeout(()=>el.classList.remove('show'),4200);}}
 });
}
