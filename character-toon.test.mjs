import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Box3} from 'three';
import {createCharacterModel,animateCharacter,disposeCharacter} from './public/character-toon-model.mjs';
test('all companions are articulated meshes with two-band toon materials and real backs',()=>{
 for(const id of ['lumi','bori','mori']){const m=createCharacterModel(id);let toon=0;
  m.root.traverse(o=>{if(!o.isMesh)return;assert.ok(!o.material.map);if(o.material.isMeshToonMaterial){toon++;assert.deepEqual([...o.material.gradientMap.image.data],[175,255]);}});
  assert.ok(toon>50);assert.ok(m.root.getObjectByName('backpack'));assert.equal(m.arms.length,2);assert.equal(m.wheels.length,2);
  animateCharacter(m,{time:1,dt:1,state:'riding',yaw:Math.PI,reduced:true});assert.equal(m.root.rotation.y,Math.PI);disposeCharacter(m);
 }
});
test('Lulu curls onto its paws, talks without duplicate mouth shapes, and wakes to ride',()=>{
 const m=createCharacterModel('mori');
 animateCharacter(m,{time:1,dt:1,state:'resting',reduced:true});
 assert.equal(m.avatar.visible,false);assert.equal(m.sleepingPanda.visible,true);
 assert.equal(m.sleepingPanda.getObjectByName('helmet').visible,false);
 assert.equal(m.sleepingPanda.getObjectByName('closed-eyes').visible,true);
 m.root.updateMatrixWorld(true);assert.ok(new Box3().setFromObject(m.sleepingPanda).min.y>=-.02,'Resting body stays above the ground');
 assert.equal(m.sleepingPanda.getObjectByName('talking-mouth').visible,false);
 animateCharacter(m,{time:2,dt:1,state:'resting',speech:.8,reduced:true});assert.equal(m.sleepingPanda.getObjectByName('talking-mouth').visible,true);
 animateCharacter(m,{time:3,dt:1,state:'riding',reduced:true});assert.equal(m.avatar.visible,true);assert.equal(m.sleepingPanda.visible,false);assert.equal(m.helmet.visible,true);assert.equal(m.mouth.visible,false);disposeCharacter(m);
});
test('riding keeps feet on rotating pedals; zero speed and reduced motion pause them',()=>{
 const m=createCharacterModel('lumi');animateCharacter(m,{time:2,dt:1,state:'riding',speed:18});m.root.updateMatrixWorld(true);
 const pedals=[];m.crank.traverse(o=>{if(o.name==='pedal')pedals.push(o);});
 for(let i=0;i<2;i++){const foot=m.legs[i].foot.getWorldPosition(m.legs[i].foot.position.clone()),pedal=pedals[i].getWorldPosition(pedals[i].position.clone());foot.y-=.1;assert.ok(foot.distanceTo(pedal)<.04);}
 const phase=m.pedalPhase;animateCharacter(m,{time:3,dt:1,state:'riding',speed:0});assert.equal(m.pedalPhase,phase);animateCharacter(m,{time:4,dt:1,state:'riding',speed:18,reduced:true});assert.equal(m.pedalPhase,phase);disposeCharacter(m);
});
test('Lulu keeps a pale fitted helmet; all personality rest and speech states still work',()=>{
 for(const id of ['lumi','bori','mori']){const m=createCharacterModel(id),hat=m.hatMaterial.color.getHex();
  animateCharacter(m,{time:1,dt:1,state:'greeting',speech:.8,reduced:true});assert.ok(m.mouth.scale.y>.05);assert.equal(m.question.visible,id==='lumi');
  animateCharacter(m,{time:4,dt:1,state:'riding'});assert.equal(m.snack.visible,false);assert.equal(m.hatMaterial.color.getHex(),hat);
  animateCharacter(m,{time:6,dt:1,state:'resting',reduced:true});animateCharacter(m,{time:9,dt:1,state:'resting',reduced:true});assert.equal(m.snack.visible,id==='bori');assert.equal(m.sleep.visible,id==='mori');assert.equal(m.helmet.visible,id!=='mori');assert.equal(m.hatMaterial.color.getHex(),hat);disposeCharacter(m);
 }
});
