import {readFile,writeFile,mkdir,readdir,copyFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {makeQr,makeQrPng} from './qr-images.mjs';
import {PUBLIC_ORIGIN} from './public/app-network.mjs';
const root=fileURLToPath(new URL('./',import.meta.url)),destination=path.join(root,'native-www'),source=path.join(root,'public');
if(path.dirname(destination)!==path.resolve(root)||path.basename(destination)!=='native-www')throw Error('Invalid build directory');
await rm(destination,{recursive:true,force:true});await mkdir(destination,{recursive:true});
const entries=[];
async function copy(name){const bytes=await readFile(path.join(source,name));const target=path.join(destination,name);await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(source,name),target);entries.push({name,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
async function walk(folder){for(const item of await readdir(path.join(source,folder),{withFileTypes:true})){const name=path.posix.join(folder,item.name);if(item.isDirectory())await walk(name);else if(/\.(png|jpg|webp|svg|wav|mp3|mjs|js|css|json|txt|woff2?)$/.test(item.name))await copy(name);}}
for(const file of ['index.html','manifest.webmanifest','boot.js','app.bundle.js','app.css','character-toon.bundle.mjs','mic-worklet.js','landmark-sources.html','privacy.html','download.css'])await copy(file);
for(const folder of ['audio','assets','vendor'])await walk(folder);
for(const name of ['soul-blue.webp','soul-mint.webp','soul-orange.webp'])await copy(name);
for(const id of ['lumi','mori','bori'])for(const ext of ['svg','png'])await writeFile(path.join(destination,`qr-${id}.${ext}`),ext==='png'?makeQrPng(id,PUBLIC_ORIGIN):makeQr(id,PUBLIC_ORIGIN));
await writeFile(path.join(destination,'native-build.json'),JSON.stringify({app:'VELO SOUL',apiOrigin:PUBLIC_ORIGIN,files:entries},null,2));
console.log(JSON.stringify({nativeFiles:entries.length,megabytes:Number((entries.reduce((sum,x)=>sum+x.size,0)/1048576).toFixed(1)),apiOrigin:PUBLIC_ORIGIN,qrDestinationsUnchanged:true}));
