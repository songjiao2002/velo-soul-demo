import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {apiURL,speechSocketURL,getDeviceMedia,PUBLIC_ORIGIN} from './public/app-network.mjs';
import {allowedRequestOrigin,nativeCors} from './native-origin.mjs';
import {createNativeGPS} from './public/native-device.mjs';
import {parseSoulQR} from './public/soul-core.mjs';
const req=(origin,site='cross-site')=>({url:'/api/chat',method:'POST',headers:{origin,host:'velo-soul-demo-production.up.railway.app','sec-fetch-site':site}});
test('native API and streaming speech use production; bundled assets and web requests stay local',()=>{
 assert.equal(apiURL('/api/chat',true),PUBLIC_ORIGIN+'/api/chat');assert.equal(apiURL('/audio/lumi.wav',true),'/audio/lumi.wav');assert.equal(apiURL('/api/chat',false),'/api/chat');
 assert.equal(speechSocketURL({href:'capacitor://localhost/'},true).href,'wss://velo-soul-demo-production.up.railway.app/api/transcribe/live');
 assert.equal(speechSocketURL({href:'http://localhost:4183/'},false).protocol,'ws:');
});
test('native origins permitted without admitting other websites or nonstandard localhost ports',()=>{
 for(const origin of ['https://localhost','capacitor://localhost'])assert.equal(allowedRequestOrigin(req(origin)),true);
 for(const origin of ['null','https://localhost:443','https://localhost.evil.example','https://evil.example','http://localhost','file://','https://localhost/','capacitor://localhost/'])assert.equal(allowedRequestOrigin(req(origin)),false);
 assert.equal(allowedRequestOrigin(req(PUBLIC_ORIGIN,'same-origin')),true);
});
test('CORS preflight is restricted to needed methods and headers',()=>{
 const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(v){this.status=v;},end(){}});
 for(const origin of ['https://localhost','capacitor://localhost']){const r=req(origin);r.method='OPTIONS';r.headers['access-control-request-method']='POST';r.headers['access-control-request-headers']='content-type';const s=response();assert.equal(nativeCors(r,s),true);assert.equal(s.status,204);assert.equal(s.headers['Access-Control-Allow-Origin'],origin);assert.equal(s.headers['Access-Control-Allow-Credentials'],undefined);}
 const r=req('https://localhost');r.method='OPTIONS';r.headers['access-control-request-method']='PUT';const s=response();nativeCors(r,s);assert.equal(s.status,403);assert.equal(nativeCors(req('https://bad.example'),response()),false);
});
test('original printed codes select the correct legacy IDs; other codes rejected',()=>{
 for(const id of ['lumi','bori','mori'])for(const origin of ['capacitor://localhost','null'])assert.equal(parseSoulQR(PUBLIC_ORIGIN+'/?bike='+id,origin),id);
 for(const bad of ['https://evil.example/?bike=lumi',PUBLIC_ORIGIN+'/?bike=constructor',PUBLIC_ORIGIN+'/download.html?bike=lumi','javascript:alert(1)'])assert.equal(parseSoulQR(bad,'capacitor://localhost'),null);
});
test('native GPS cancellation while permission is pending releases the eventual watch',async()=>{
 let resolve,callback;const cleared=[];const gps=createNativeGPS({watchPosition(_opts,cb){callback=cb;return new Promise(r=>resolve=r);},async clearWatch(value){cleared.push(value.id);}});let delivered=0;const id=gps.watchPosition(()=>delivered++,()=>{},{});gps.clearWatch(id);callback({coords:{latitude:37}});resolve('native-42');await new Promise(r=>setImmediate(r));assert.deepEqual(cleared,['native-42']);assert.equal(delivered,0);
});
test('native camera and microphone permission requests are serialized',async()=>{
 const old=globalThis.Capacitor;globalThis.Capacitor={isNativePlatform:()=>true};let release;const calls=[];const devices={getUserMedia(c){calls.push(c);return calls.length===1?new Promise(r=>release=r):Promise.resolve('mic');}};
 try{const camera=getDeviceMedia({video:true},devices);const mic=getDeviceMedia({audio:true},devices);await new Promise(r=>setImmediate(r));assert.equal(calls.length,1);release('camera');assert.equal(await camera,'camera');assert.equal(await mic,'mic');assert.equal(calls.length,2);}finally{globalThis.Capacitor=old;}
});
test('native platform config bundles local screens and declares only foreground permissions',()=>{
 const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');const config=JSON.parse(read('capacitor.config.json'));assert.equal(config.webDir,'native-www');assert.equal(config.server.url,undefined);assert.equal(config.android.allowMixedContent,false);
 const android=read('android/app/src/main/AndroidManifest.xml');for(const key of ['CAMERA','RECORD_AUDIO','ACCESS_FINE_LOCATION','ACCESS_COARSE_LOCATION'])assert.ok(android.includes('android.permission.'+key));assert.ok(!android.includes('ACCESS_BACKGROUND_LOCATION'));assert.ok(android.includes('android:allowBackup="false"'));
 const ios=read('ios/App/App/Info.plist');for(const key of ['NSCameraUsageDescription','NSMicrophoneUsageDescription','NSLocationWhenInUseUsageDescription'])assert.ok(ios.includes(key));assert.ok(!ios.includes('UIBackgroundModes'));
});

test('local signing build keeps normal release key enforcement and cannot publish an unsigned artifact',()=>{
 const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');const gradle=read('android/app/build.gradle');
 assert.match(gradle,/unsignedRelease\s*\{[\s\S]*?signingConfig null/);
 assert.match(gradle,/task.name == 'validateSigningRelease'[\s\S]*?throw new GradleException/);
 const workflow=read('.github/workflows/android-local-signing.yml');
 assert.match(workflow,/contents: read/);assert.match(workflow,/assembleUnsignedRelease/);assert.doesNotMatch(workflow,/secrets\.|gh release|contents: write/);
 assert.match(workflow,/if "\$TOOLS\/apksigner" verify "\$APK"; then/);
 assert.match(read('.github/workflows/publish-mobile-preview.yml'),/apksigner.*verify --print-certs/);
});
