import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SEOUL_PLACES,PlaceFence,placeFallback} from './public/seoul-places.mjs';
const place=SEOUL_PLACES[0],start=1800000000000;
const point=(offset,extra={})=>({lat:place.lat,lon:place.lon,accuracy:10,time:start+offset,...extra});
function update(f,offset,extra){return f.update(point(offset,extra),start+offset);}
test('entering a known place requires accurate GPS and a continuous dwell',()=>{
 const f=new PlaceFence();assert.equal(update(f,0,{lat:place.lat+.01}),null);
 assert.equal(update(f,120000),null);assert.equal(update(f,123000),null);assert.equal(update(f,125000).id,place.id);
 assert.equal(update(f,250000),null);assert.equal(update(f,256000),null); // Once per ride.
});
test('stale, inaccurate and impossible GPS data cannot trigger a place',()=>{
 const f=new PlaceFence();assert.equal(update(f,0),null);assert.equal(update(f,6000,{accuracy:100}),null);
 assert.equal(update(f,7000),null);assert.equal(update(f,10000,{time:start-90000}),null);
 assert.equal(update(f,11000),null);assert.equal(update(f,16000,{lat:38}),null);
 assert.equal(update(f,17000),null);assert.equal(update(f,22000).id,place.id);
});
test('leaving, pausing, or a long GPS gap resets arrival dwell',()=>{
 for(const mode of ['leave','pause','gap']){
  const f=new PlaceFence();update(f,0);
  if(mode==='leave')update(f,20000,{lat:place.lat+.003});
  if(mode==='pause')f.pause();
  assert.equal(update(f,60000),null,mode);assert.equal(update(f,65000).id,place.id,mode);
 }
});
test('place cooldown prevents rapid chatter, and a new ride can meet a place again',()=>{
 const a={...place,id:'a',radius:80},b={...place,id:'b',lon:place.lon+.003,radius:80},f=new PlaceFence({places:[a,b]});
 update(f,0);assert.equal(update(f,5000).id,'a');
 assert.equal(update(f,30000,{lon:b.lon}),null);assert.equal(update(f,35000,{lon:b.lon}),null);
 assert.equal(update(f,130000,{lon:b.lon}),null);assert.equal(update(f,135000,{lon:b.lon}).id,'b');
 const next=new PlaceFence();assert.equal(update(next,0),null);assert.equal(update(next,5000).id,place.id);
});
test('preset place speech preserves persona and does not claim current shop availability',()=>{
 const lines=['lumi','mori','bori'].map(id=>placeFallback(place,id,'en'));assert.equal(new Set(lines).size,3);
 for(const line of lines)assert.match(line,/Daelim Warehouse Gallery/);
 assert.match(lines[2],/check whether it's open/);assert.match(placeFallback(place,'bori','zh'),/We seem/);
});
