import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routeFeature,koreaMapStyle,mapName} from './public/korea-map-style.mjs';
import {journeyMap} from './public/journey-map.mjs';
import {KOREA_LANDMARKS,MAP_REGIONS,MAP_KINDS,MAP_ICONS,groupLandmarks} from './public/korea-landmarks.mjs';
import {SEOUL_PLACES} from './public/seoul-places.mjs';
test('national landmark catalog has bounded real coordinates, localized metadata and sources',()=>{
 assert.equal(KOREA_LANDMARKS.length,20);
 assert.equal(new Set(KOREA_LANDMARKS.map(p=>p.id)).size,KOREA_LANDMARKS.length);
 for(const p of KOREA_LANDMARKS){
  assert.ok(p.lat>33&&p.lat<39&&p.lon>124&&p.lon<131,p.id);
  assert.ok(MAP_REGIONS[p.region]&&MAP_KINDS[p.kind]&&MAP_ICONS[p.kind]);
  for(const lang of ['ko','en','zh'])assert.ok(p.name[lang]);
  assert.equal(new URL(p.source).protocol,'https:');assert.equal(p.positionType,'representative');
 }
 assert.equal(new Set(KOREA_LANDMARKS.map(p=>p.region)).size,8);
 assert.equal(SEOUL_PLACES.length,3,'display catalog must not expand voice geofences');
 for(const old of SEOUL_PLACES){const p=KOREA_LANDMARKS.find(p=>p.id===old.id);assert.equal(p.lat,old.lat);assert.equal(p.lon,old.lon);}
});
test('projected map clustering conserves every place and separates distant points',()=>{
 const project=([x,y])=>({x,y});
 const rows=[{id:'a',lon:0,lat:0},{id:'b',lon:10,lat:0},{id:'c',lon:200,lat:200}];
 const groups=groupLandmarks(rows,project);
 assert.deepEqual(groups.map(g=>g.places.map(p=>p.id)),[['a','b'],['c']]);
 assert.equal(groupLandmarks(rows,project,1).length,3);
 assert.deepEqual(groupLandmarks([],project),[]);
 const full=groupLandmarks(KOREA_LANDMARKS,([x,y])=>({x:x*10,y:y*10}));
 assert.deepEqual(full.flatMap(g=>g.places).map(p=>p.id).sort(),KOREA_LANDMARKS.map(p=>p.id).sort());
});
test('GPS map draws only valid supplied coordinates and does not fabricate a path when empty',()=>{
 assert.deepEqual(routeFeature().features,[]);assert.deepEqual(routeFeature([{lat:37,lon:127}]).features,[]);
 const data=routeFeature([{lat:37,lon:127},{lat:NaN,lon:127},{lat:38,lon:128},{lat:100,lon:127}]);assert.deepEqual(data.features[0].geometry.coordinates,[[127,37],[128,38]]);
 assert.doesNotMatch(JSON.stringify(data),/NaN|null|undefined/);
});
test('custom map styles use open vector geography and language fallback without rider data',()=>{
 for(const lang of ['ko','en','zh']){const style=koreaMapStyle(lang);assert.equal(style.sources.openmaptiles.url,'https://tiles.openfreemap.org/planet');assert.deepEqual(style.sources.journey.data.features,[]);assert.equal(new Set(style.layers.map(l=>l.id)).size,style.layers.length);assert.ok(style.layers.some(l=>l['source-layer']==='transportation'));assert.ok(style.layers.some(l=>l['source-layer']==='poi'));assert.equal(mapName(lang)[1][1],'name:'+lang);assert.doesNotMatch(JSON.stringify(style),/api[_-]?key|token=/i);}
});
test('offline journey cards have unique SVG definitions and explicitly label the trace',()=>{
 const a=journeyMap([]),b=journeyMap([]);assert.notEqual(a.match(/id="([^"]+)/)[1],b.match(/id="([^"]+)/)[1]);assert.doesNotMatch(a,/<polyline/);
 const actual=journeyMap([{lat:37.5,lon:127},{lat:37.501,lon:127.002}]);assert.match(actual,/실제 궤적 · 도로 지도 아님/);assert.doesNotMatch(actual,/NaN|Infinity/);
});
