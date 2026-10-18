import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Only use prebuilt representations whose identity file still matches the build.
// This also prevents stale compressed output while editing locally before build.
export function loadAssetManifest(root){
 try{
  const manifest=JSON.parse(readFileSync(new URL('.asset-manifest.json',root),'utf8'));
  for(const [name,entry] of Object.entries(manifest.files)){
   const bytes=readFileSync(new URL('.'+name,root));
   if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256)delete manifest.files[name];
  }
  return manifest;
 }catch{return {version:'',files:{}};}
}

export function preferredEncoding(header,available){
 const preferences=new Map(String(header||'').toLowerCase().split(',').map(item=>{
  const [name,...parameters]=item.trim().split(';');
  const q=parameters.map(p=>p.trim()).find(p=>p.startsWith('q='));
  const weight=q?Number(q.slice(2)):1;
  return [name,Number.isFinite(weight)&&weight>=0&&weight<=1?weight:0];
 }));
 const weight=name=>preferences.get(name)??preferences.get('*')??0;
 const candidates=['br','gzip'].filter(name=>available[name]&&weight(name)>0).sort((a,b)=>weight(b)-weight(a));
 const identity=preferences.get('identity')??(preferences.get('*')===0?0:1);
 if(candidates.length&&(!preferences.has('identity')||weight(candidates[0])>=identity))return candidates[0];
 return identity>0?'identity':null;
}

export function matchesETag(header,etag){
 return String(header||'').split(',').some(tag=>tag.trim()==='*'||tag.trim().replace(/^W\//,'')===etag);
}
