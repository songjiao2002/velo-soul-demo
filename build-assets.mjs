import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {brotliCompressSync,gzipSync,constants} from 'node:zlib';
import {BUILD} from './public/build-version.mjs';

// Commit generated files so the production image requires no build toolchain.
const root=new URL('./public/',import.meta.url);
for(const file of ['index.html','boot.js']){
 const content=await readFile(new URL(file,root),'utf8');
 await writeFile(new URL(file,root),content.replace(/2026\d{4}-[a-z]+\d+/g,BUILD));
}
const textFiles=['index.html','boot.js','app.bundle.js','app.css','mic-worklet.js','vendor/jsQR.js'];
const images=['soul-blue.webp','soul-mint.webp','soul-orange.webp',...['lumi','mori','bori'].map(s=>`assets/${s}-puppet.webp`)];
const manifest={version:BUILD,files:{}};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const name of [...textFiles,...images]){
 const bytes=await readFile(new URL(name,root)),entry={size:bytes.length,sha256:digest(bytes)};
 if(textFiles.includes(name)){
  for(const [coding,compressed] of [['br',brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:9}})],['gzip',gzipSync(bytes,{level:9})]]){
   const suffix=coding==='br'?'.br':'.gz';
   await writeFile(new URL(name+suffix,root),compressed);
   entry[coding]={size:compressed.length,sha256:digest(compressed),suffix};
  }
 }
 manifest.files['/'+name]=entry;
}
await writeFile(new URL('.asset-manifest.json',root),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({build:BUILD,assets:Object.keys(manifest.files).length,script:manifest.files['/app.bundle.js'],styles:manifest.files['/app.css']},null,2));
