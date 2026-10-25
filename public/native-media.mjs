import {registerPlugin} from '@capacitor/core';
const media=registerPlugin('VeloMedia');
export function hasNativeMedia(){return globalThis.Capacitor?.isPluginAvailable?.('VeloMedia')===true;}
export async function prepareNativeMedia(constraints){
 if(!hasNativeMedia())return;
 const camera=!!constraints.video,microphone=!!constraints.audio;
 const result=await media.prepare({camera,microphone});
 if((camera&&!result.camera)||(microphone&&!result.microphone))throw Object.assign(Error('Permission denied'),{name:'NotAllowedError'});
}
export function openMediaSettings(){return hasNativeMedia()?media.openSettings():Promise.reject(Error('unavailable'));}
