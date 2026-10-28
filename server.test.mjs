import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server, makeQr, makeQrPng } from './server.mjs';
import { readFile } from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {BUILD} from './public/build-version.mjs';
import {preferredEncoding} from './static-assets.mjs';
import vm from 'node:vm';
import http from 'node:http';
let base;
before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;});
after(()=>new Promise(r=>server.close(r)));

test('invalid request targets cannot crash API dispatch; pages cannot be framed',async()=>{
 const status=await new Promise((resolve,reject)=>{const req=http.request(base,{path:'http://['},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});
 assert.equal(status,400);const health=await fetch(base+'/healthz');assert.equal(health.status,200);
 const home=await fetch(base+'/');assert.equal(home.headers.get('x-frame-options'),'DENY');assert.match(home.headers.get('content-security-policy'),/frame-ancestors 'none'/);
});

test('final UI, camera modules and decoder use executable MIME and camera policy',async()=>{
  for(const p of ['/boot.js','/final.js','/soul-core.mjs','/vendor/jsQR.js']){const r=await fetch(base+p);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/javascript/);}
  const home=await fetch(base+'/');const html=await home.text();assert.match(html,/id="startupHome"/);assert.match(html,/id="cameraVideo"/);assert.match(html,/id="cameraStart"/);assert.doesNotMatch(html,/class="topbar"|class="soul-card"/);for(const soul of ['lumi','mori','bori'])assert.ok(html.includes('href="/qr-'+soul+'.png"'));assert.match(html,/boot\.js\?v=/);assert.equal(home.headers.get('permissions-policy'),'camera=(self), microphone=(self), geolocation=(self), speaker-selection=(self)');
});
test('all three colored QR codes decode to their correct public character URL',async()=>{
 const sandbox={module:{exports:{}},exports:{}};vm.runInNewContext(await readFile(new URL('./public/vendor/jsQR.js',import.meta.url),'utf8'),sandbox);const decode=sandbox.module.exports;
 const origin='https://velo-soul-demo-production.up.railway.app';
 for(const soul of ['lumi','mori','bori']){const svg=makeQr(soul,origin);const [,w,h]=svg.match(/viewBox="0 0 (\d+) (\d+)"/).map(Number);const rgba=new Uint8ClampedArray(w*h*4).fill(255);const color=svg.match(/<path[^>]*fill="(#\w+)"/)[1],rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));for(const m of svg.matchAll(/M(\d+),(\d+)l(\d+),0 0,(\d+)/g)){const [,x,y,cw,ch]=m.map(Number);for(let yy=y;yy<y+ch;yy++)for(let xx=x;xx<x+cw;xx++){const p=(yy*w+xx)*4;rgba[p]=rgb[0];rgba[p+1]=rgb[1];rgba[p+2]=rgb[2];}}assert.equal(decode(rgba,w,h)?.data,origin+'/?bike='+soul);}
});

test('home, health, all character assets and all 15 audio clips are served',async()=>{
  for (const p of ['/', '/?bike=lumi','/?bike=mori','/?bike=bori','/healthz','/mobile.js','/style.css','/gallery.css','/mobile.css','/memories.css','/soul-blue.png','/soul-mint.png','/soul-orange.png',...['lumi','mori','bori'].flatMap(s=>['hello','start','during','pause','end'].map(k=>`/audio/${s}-${k}.mp3`))]) {
    const r=await fetch(base+p);assert.equal(r.status,200,p);assert.ok((await r.arrayBuffer()).byteLength>0,p);
  }
});
test('QR routes encode the current deployment origin for every soul',async()=>{
  for(const soul of ['lumi','mori','bori']) {
    const r=await fetch(base+`/qr-${soul}.svg`);
    assert.equal(await r.text(),makeQr(soul,base));
    assert.equal(r.headers.get('cache-control'),'public, max-age=3600');
  }
});
test('audio supports Safari byte-range requests and HEAD',async()=>{
  const head=await fetch(base+'/audio/lumi-hello.mp3',{method:'HEAD'});
  const size=Number(head.headers.get('content-length'));
  assert.ok(size>1000);assert.equal((await head.arrayBuffer()).byteLength,0);
  const r=await fetch(base+'/audio/lumi-hello.mp3',{headers:{Range:'bytes=0-1'}});
  assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),`bytes 0-1/${size}`);assert.equal((await r.arrayBuffer()).byteLength,2);
  const suffix=await fetch(base+'/audio/lumi-hello.mp3',{headers:{Range:'bytes=-10'}});
  assert.equal(suffix.status,206);assert.equal((await suffix.arrayBuffer()).byteLength,10);
  const bad=await fetch(base+'/audio/lumi-hello.mp3',{headers:{Range:'bytes=999999-'}});
  assert.equal(bad.status,416);
});
test('deployment files, traversal and unexpected methods are not exposed',async()=>{
  for(const p of ['/server.mjs','/chat-service.mjs','/skills/velo-lumi/SKILL.md','/package.json','/.env','/.env.example','/vendor/qrcode.mjs','/%2e%2e%2fserver.mjs','/missing.mp3']) assert.equal((await fetch(base+p)).status,404,p);
  assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
});

test('packaged English WAV supports correct MIME, HEAD and partial playback',async()=>{
 for(const id of ['lumi','mori','bori']){
  const path=base+`/audio/en/${id}-hello.wav`,head=await fetch(path,{method:'HEAD'});
  assert.equal(head.status,200);assert.equal(head.headers.get('content-type'),'audio/wav');
  const size=Number(head.headers.get('content-length'));assert.ok(size>48000);
  const part=await fetch(path,{headers:{Range:'bytes=0-43'}});
  assert.equal(part.status,206);assert.equal(part.headers.get('content-range'),`bytes 0-43/${size}`);
  assert.equal(Buffer.from(await part.arrayBuffer()).toString('ascii',0,4),'RIFF');
 }
});

test('QR downloads preserve bytes and filenames while supporting HEAD and conditional cache hits',async()=>{
 for(const format of ['png','svg']){
  const response=await fetch(base+'/qr-lumi.'+format),bytes=Buffer.from(await response.arrayBuffer()),etag=response.headers.get('etag');
  assert.deepEqual(bytes,Buffer.from(format==='png'?makeQrPng('lumi',base):makeQr('lumi',base)));
  const head=await fetch(base+'/qr-lumi.'+format,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('etag'),etag);assert.equal(Number(head.headers.get('content-length')),bytes.length);assert.equal((await head.arrayBuffer()).byteLength,0);
  if(format==='png')assert.equal(head.headers.get('content-disposition'),'attachment; filename="velo-soul-lumi.png"');
  const cached=await fetch(base+'/qr-lumi.'+format,{headers:{'If-None-Match':etag}});assert.equal(cached.status,304);assert.equal((await cached.arrayBuffer()).byteLength,0);
 }
});

test('Brotli and gzip serve the same complete app with representation-specific validators',async()=>{
 const original=await readFile(new URL('./public/app.bundle.js',import.meta.url));
 const tags=new Set();
 for(const encoding of ['br','gzip','identity']){
  const r=await fetch(base+'/app.bundle.js?v='+BUILD,{headers:{'Accept-Encoding':encoding}});
  assert.equal(r.status,200);assert.equal(r.headers.get('content-encoding'),encoding==='identity'?null:encoding);
  assert.equal(r.headers.get('vary'),'Accept-Encoding');
  assert.deepEqual(Buffer.from(await r.arrayBuffer()),original);
  if(encoding!=='identity')assert.ok(Number(r.headers.get('content-length'))<original.length/2);
  const tag=r.headers.get('etag');assert.ok(tag);tags.add(tag);
  const cached=await fetch(base+'/app.bundle.js?v='+BUILD,{headers:{'Accept-Encoding':encoding,'If-None-Match':'W/'+tag}});
  assert.equal(cached.status,304);assert.equal((await cached.arrayBuffer()).byteLength,0);
 }
 assert.equal(tags.size,3);
});

test('cache policy revalidates HTML and unversioned files but retains current build assets',async()=>{
 for(const file of ['/','/?bike=lumi','/app.bundle.js','/app.bundle.js?v=older','/app.css?v=older']){
  const r=await fetch(base+file,{method:'HEAD'});assert.equal(r.headers.get('cache-control'),'no-cache',file);
 }
 for(const file of ['/app.bundle.js','/app.css','/soul-blue.webp','/assets/mori-puppet.webp']){
  const r=await fetch(base+file+'?v='+BUILD,{method:'HEAD'});assert.equal(r.headers.get('cache-control'),'public, max-age=31536000, immutable');
  assert.equal((await r.arrayBuffer()).byteLength,0);
 }
 assert.equal((await fetch(base+'/soul-blue.webp',{method:'HEAD'})).headers.get('content-type'),'image/webp');
});

test('compressed asset HEAD, encoding opt-out and byte range requests remain valid',async()=>{
 const path=base+'/app.bundle.js';
 const head=await fetch(path,{method:'HEAD',headers:{'Accept-Encoding':'br'}});
 assert.equal(head.headers.get('content-encoding'),'br');assert.ok(Number(head.headers.get('content-length'))>0);
 assert.equal((await head.arrayBuffer()).byteLength,0);
 const r=await fetch(path,{headers:{Range:'bytes=0-15','Accept-Encoding':'br'}});
 assert.equal(r.status,206);assert.equal(r.headers.get('content-encoding'),null);
 const bytes=await readFile(new URL('./public/app.bundle.js',import.meta.url));
 assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes.subarray(0,16));
 assert.equal((await fetch(path,{headers:{'Accept-Encoding':'br;q=0,gzip;q=0'}})).headers.get('content-encoding'),null);
 assert.equal((await fetch(path,{headers:{'Accept-Encoding':'*;q=0'}})).status,406);
 assert.equal(preferredEncoding('br;q=0.5,gzip;q=1',{br:{},gzip:{}}),'gzip');
 assert.equal(preferredEncoding('br;q=0.5,identity;q=1',{br:{}}),'identity');
});

test('all previously published QR PNGs and SVGs stay byte-for-byte identical',()=>{
 const expected={
  lumi:['323470880dbc0480c9d6101ae0af5853b15df9939f03d690e2166751fd1f24f5','696cf48aa1099eab62f90471baafe66dc43aa327570091c030f14ee3126a7a8f'],
  mori:['4b6cb842c3b7d416d0b0835e7289f74591c4a82f459b68fa47e8079d61629f8a','21bfe17cec4b453c0df31b3197e8cfefb480a8457563c6e86832da610158d4e4'],
  bori:['f157255736a73ac159ca1009179a64ac176d7018ff6791c77f30fbef9e4a3590','d2c10e36bb307f2d11bee74cc62d0d2f1f4dfb34f11682cf35d95f9fcd9fa251']
 };
 for(const soul of Object.keys(expected)){
  const origin='https://velo-soul-demo-production.up.railway.app';
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  assert.deepEqual([hash(makeQrPng(soul,origin)),hash(makeQr(soul,origin))],expected[soul]);
 }
});
