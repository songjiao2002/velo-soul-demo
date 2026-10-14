import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server, makeQr } from './server.mjs';
let base;
before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;});
after(()=>new Promise(r=>server.close(r)));

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
