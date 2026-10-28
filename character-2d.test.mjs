import {test} from 'node:test';
import assert from 'node:assert/strict';
import {characterSVG,cyclePose,cycleWheelAngle} from './public/character-2d.mjs';
import {characterArtwork,characterPuppet} from './public/character-art.mjs';
test('all identities produce self-contained animated vectors without raster images or WebGL',()=>{
 for(const id of ['lumi','bori','mori']){const svg=characterSVG(id,'riding');assert.match(svg,/<svg/);assert.match(svg,/two-head/);assert.match(svg,/data-flat-leg/);assert.match(svg,/two-pack/);assert.match(svg,/prefers-reduced-motion/);assert.doesNotMatch(svg,/<image|<img|<canvas|WebGL|href=/);assert.match(characterPuppet(id),/data-character-2d/);assert.match(characterArtwork(id),/data-pose="riding"/);}
 assert.equal(characterSVG('untrusted'), '');assert.equal(characterArtwork('<script>'), '');
});
test('cycling feet stay opposite each other on a shared pedal circle',()=>{
 for(const phase of [0,.4,1.7,3,5.2]){const [a,b]=cyclePose(phase);assert.ok(Math.abs(a.x+b.x-392)<1e-9);assert.ok(Math.abs(a.y+b.y-588)<1e-9);assert.ok(Math.abs(Math.hypot(a.x-196,a.y-294)-12)<1e-9);assert.ok(a.path.endsWith(`${a.x} ${a.y-4}`));}
});

test('flat wheel tops and upper pedals travel toward the front fork on the left',()=>{
 const topX=phase=>Math.sin(cycleWheelAngle(phase)*Math.PI/180)*30;
 assert.ok(topX(.01)<topX(0),'wheel top rolls left toward the front fork');
 assert.ok(cyclePose(Math.PI+.01)[0].x<cyclePose(Math.PI)[0].x,'upper pedal travels left as well');
});
