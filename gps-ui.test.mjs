import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validGPSPoint,gpsMarkup,GPS_COPY} from './public/gps-ui.mjs';
const now=100000,position={coords:{latitude:37.55,longitude:126.98,accuracy:12},timestamp:now};
test('GPS accepts a current real position including zero coordinates',()=>{
 assert.deepEqual(validGPSPoint(position,now),{lat:37.55,lon:126.98,accuracy:12,time:now});
 assert.ok(validGPSPoint({...position,coords:{latitude:0,longitude:0,accuracy:0}},now));
});
test('GPS ignores malformed, stale and future positions instead of showing connected',()=>{
 for(const p of [null,{}, {...position,timestamp:now-31000},{...position,timestamp:now+6000},...[
  {latitude:91},{longitude:-181},{accuracy:-1},{latitude:NaN},{longitude:Infinity}
 ].map(change=>({...position,coords:{...position.coords,...change}}))])assert.equal(validGPSPoint(p,now),null);
});
test('GPS controls and permission guidance are available in all three UI languages',()=>{
 for(const lang of ['zh','en','ko']){const html=gpsMarkup(lang);assert.ok(html.includes(GPS_COPY[lang].connect));assert.ok(html.includes(GPS_COPY[lang].privacy));assert.match(html,/data-gps-toggle/);assert.match(html,/aria-pressed="false"/);assert.match(html,/data-no-translate/);for(const state of ['off','waiting','connected','weak','denied','error','paused','unsupported'])assert.ok(GPS_COPY[lang][state]);}
});
