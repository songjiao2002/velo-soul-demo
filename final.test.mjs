import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SoulCameraController,parseSoulQR,appendPoint,projectRoute,routeDistance} from './public/soul-core.mjs';
const origin='https://velo-soul-demo-production.up.railway.app';
test('QR parser selects known souls from owned URLs without redirecting',()=>{
 for(const id of ['lumi','mori','bori'])assert.equal(parseSoulQR(origin+'/?bike='+id,origin),id);
 assert.equal(parseSoulQR('http://localhost:3000/?bike=mori','http://localhost:3000'),'mori');
 for(const raw of ['javascript:alert(1)','https://evil.example/?bike=lumi',origin+'/?bike=__proto__',origin+'/other?bike=lumi',origin+'/?bike=constructor','lumi'])assert.equal(parseSoulQR(raw,origin),null);
});
function stream(){let stopped=0;const track={stop(){stopped++;},addEventListener(){}};return{getTracks:()=>[track],getVideoTracks:()=>[track],get stopped(){return stopped;}};}
function video(){return{srcObject:null,async play(){},pause(){}};}
test('camera asks for rear video only, announces readiness and releases on stop',async()=>{
 const s=stream(),v=video(),states=[];let constraints;
 const c=new SoulCameraController({video:v,isSecure:()=>true,getMedia:async p=>(constraints=p,s),onState:q=>states.push(q)});
 await c.start();assert.equal(constraints.audio,false);assert.equal(constraints.video.facingMode.ideal,'environment');assert.equal(v.srcObject,s);assert.deepEqual(states,['requesting','live']);c.stop();assert.equal(s.stopped,1);assert.equal(v.srcObject,null);
});
test('late camera grants after leaving are stopped without attaching video',async()=>{
 const s=stream(),v=video();let grant;const c=new SoulCameraController({video:v,isSecure:()=>true,getMedia:()=>new Promise(r=>grant=r)});const pending=c.start();c.stop();grant(s);await pending;assert.equal(s.stopped,1);assert.equal(v.srcObject,null);
});
test('denied permission and playback failures report errors and release streams',async()=>{
 let state,message;const s=stream(),v=video();v.play=async()=>{throw new Error('play');};const c=new SoulCameraController({video:v,isSecure:()=>true,getMedia:async()=>s,onState:(a,b)=>{state=a;message=b;}});await c.start();assert.equal(state,'error');assert.equal(s.stopped,1);
 c.getMedia=async()=>{throw Object.assign(new Error(),{name:'NotAllowedError'});};await c.start();assert.equal(state,'error');assert.match(message,/허용/);
});
test('concurrent camera requests retain newest stream and stop stale grant',async()=>{
 const v=video(),s1=stream(),s2=stream(),grants=[];const c=new SoulCameraController({video:v,isSecure:()=>true,getMedia:()=>new Promise(r=>grants.push(r))});const p1=c.start(),p2=c.start();grants[1](s2);await p2;grants[0](s1);await p1;assert.equal(v.srcObject,s2);assert.equal(s1.stopped,1);assert.equal(s2.stopped,0);c.stop();
});
test('GPS rejects inaccurate positions, stationary jitter, reversed time and impossible jumps',()=>{
 const points=[],p={lat:37.5,lon:127,accuracy:10,time:1000};assert.equal(appendPoint(points,p),true);
 assert.equal(appendPoint(points,{...p,time:2000}),false);assert.equal(appendPoint(points,{...p,lat:37.5001,time:0}),false);assert.equal(appendPoint(points,{...p,lat:38,time:2000}),false);assert.equal(appendPoint(points,{...p,lat:37.5001,accuracy:100,time:10000}),false);assert.equal(appendPoint(points,{...p,lat:37.5001,time:10000}),true);
 assert.ok(routeDistance(points)>10&&routeDistance(points)<12);assert.ok(projectRoute(points).flat().every(Number.isFinite));assert.deepEqual(projectRoute([]),[]);assert.ok(projectRoute([p]).flat().every(Number.isFinite));
});
