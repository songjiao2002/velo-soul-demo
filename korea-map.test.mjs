import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routeFeature,koreaMapStyle,mapName} from './public/korea-map-style.mjs';
import {journeyMap} from './public/journey-map.mjs';
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
