import * as flat from './character-2d-motion.mjs';
import {BUILD} from './build-version.mjs';
let pending=null,toon=null,active=false;
export function mountCharacters(){
 active=true;flat.mountCharacters();
 // Keep startup and permission UI independent of the optional renderer.
 if(!globalThis.WebGL2RenderingContext)return;
 pending??=import('/character-toon.bundle.mjs?v='+BUILD).catch(()=>null);
 pending.then(module=>{if(!active||!module)return;toon=module;toon.mountCharacters();});
}
export function disposeCharacters(){active=false;toon?.disposeCharacters();flat.disposeCharacters();}
export async function characterSnapshot(id){return toon?.characterSnapshot(id)||await flat.characterSnapshot(id);}
