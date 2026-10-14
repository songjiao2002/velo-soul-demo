import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server, makeQr } from './server.mjs';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
let base;
before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;});
after(()=>new Promise(r=>server.close(r)));

test('final UI, camera modules and decoder use executable MIME and camera policy',async()=>{
  for(const p of ['/final.js','/soul-core.mjs','/vendor/jsQR.js']){const r=await fetch(base+p);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/javascript/);}
  const home=await fetch(base+'/');assert.match(await home.text(),/20261014-final-camera/);assert.equal(home.headers.get('permissions-policy'),'camera=(self), microphone=(), geolocation=(self)');
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
    assert.equal(r.headers.get('cache-control'),'no-store');
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
  for(const p of ['/server.mjs','/package.json','/.env','/vendor/qrcode.mjs','/%2e%2e%2fserver.mjs','/missing.mp3']) assert.equal((await fetch(base+p)).status,404,p);
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
