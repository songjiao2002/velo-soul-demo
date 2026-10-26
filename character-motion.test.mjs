import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CHARACTERS,characterArtwork} from './public/character-art.mjs';
import {CharacterMotion} from './public/character-motion.mjs';
import {SOULS,parseSoulQR} from './public/soul-core.mjs';
import {soulIntroduction,introductionClip} from './public/soul-intro.mjs';
import {weatherGreeting} from './public/weather-core.mjs';
import {translate} from './public/i18n.mjs';
test('printed QR identities retain their links while names and exact source art change',()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('./public/assets/characters-original-20261025.jpg',import.meta.url))).digest('hex'),'4412873ca032102b50efc41d0248184204835d62c83e85563864b4643084e565');
 for(const [id,name]of [['lumi','Mori'],['bori','Popo'],['mori','Lulu']]){
  assert.equal(parseSoulQR(`https://velo-soul-demo-production.up.railway.app/?bike=${id}`,'https://velo-soul-demo-production.up.railway.app'),id);assert.equal(SOULS[id].en,name);
  assert.match(characterArtwork(id),/data-character-2d/);assert.match(characterArtwork(id),/<svg/);assert.doesNotMatch(characterArtwork(id),/<image|<img|characters-original|soul-blue|soul-mint|soul-orange/);
  const intro=soulIntroduction(id,'ko');assert.ok(intro.text.includes(CHARACTERS[id].greeting.ko));assert.match(introductionClip(intro.text,id,'ko'),/characters13/);
  assert.equal(translate(CHARACTERS[id].greeting.ko,'en'),CHARACTERS[id].greeting.en);
 }
});
test('motion requires sustained valid GPS and does not flap at traffic lights',()=>{
 let now=100000;const m=new CharacterMotion({now:()=>now});m.enter('lumi');m.sample(12);assert.equal(m.state,'greeting');now+=2500;m.sample(12);assert.equal(m.state,'riding');
 now+=1000;m.sample(0);now+=5000;m.sample(0);assert.equal(m.state,'riding');now+=1000;m.sample(9);assert.equal(m.state,'riding');
 now+=1000;m.sample(0);now+=8100;m.sample(0);assert.equal(m.state,'resting');
 now+=1000;m.sample(6);assert.equal(m.state,'resting');now+=1600;m.sample(6);assert.equal(m.state,'riding');
 now+=16000;m.tick();assert.equal(m.state,'idle');assert.equal(m.speed,null);
});
test('unknown, inaccurate, stale and out-of-order GPS never establish a stop',()=>{
 let now=100000;const m=new CharacterMotion({now:()=>now});m.enter('mori');now+=2500;m.tick();assert.equal(m.state,'greeting');now+=1200;m.tick();assert.equal(m.state,'idle');
 for(const [speed,opts]of [[null,{}],[NaN,{}],[0,{accuracy:80}],[0,{time:now-20000}],[0,{time:now+6000}]]){m.sample(speed,opts);assert.equal(m.state,'idle');}
 m.sample(10);now+=2000;m.sample(10);m.sample(0,{time:now-1000});assert.equal(m.state,'riding');m.pause();assert.equal(m.speed,null);assert.equal(m.state,'idle');
});
test('Lulu uses exact good/bad weather lines only with fresh current evidence',()=>{
 const now=Date.now(),base={fetchedAt:now,observedAt:now,code:0,temperatureC:18,precipitationMm:0,snowfallCm:0,recentPrecipitationMm:0,nextHours:[]};
 assert.ok(weatherGreeting(base,'mori','ko').startsWith('날씨가 좋으니 천천히가자'));
 assert.ok(weatherGreeting({...base,code:61},'mori','ko').startsWith('오늘은 그냥 쉬면 안되?'));
 assert.ok(!weatherGreeting({...base,code:61,fetchedAt:now-1000000},'mori','ko').startsWith('오늘은 그냥 쉬면 안되?'));
 assert.ok(!weatherGreeting({...base,code:3},'mori','ko').startsWith('날씨가 좋으니'));
 const forecast={...base,nextHours:[{at:now+3600000,code:61,precipitationMm:1,probability:90}]};assert.ok(!weatherGreeting(forecast,'mori','ko').startsWith('오늘은 그냥 쉬면 안되?'));assert.match(weatherGreeting(forecast,'mori','en'),/hour/i);
});

test('ride entry and camera greetings keep cycling without inventing a GPS speed',()=>{
 for(const soul of ['lumi','bori','mori']){
  let now=100000;const m=new CharacterMotion({now:()=>now});m.enter(soul);m.setRideMode(true);
  assert.equal(m.state,'riding');assert.equal(m.snapshot().speed,null);assert.equal(m.snapshot().animationSpeed,12);
  m.enter(soul);assert.equal(m.state,'riding');now+=5000;m.tick();assert.equal(m.state,'riding');
  m.pause();assert.equal(m.state,'riding');assert.equal(m.speed,null);
  m.setRideMode(false);assert.equal(m.state,'idle');assert.equal(m.snapshot().animationSpeed,0);
  m.enter(soul);assert.equal(m.state,'greeting');
 }
});

test('real ride stops pause pedals, sustained stops rest, and GPS loss keeps the ride animation',()=>{
 let now=100000;const m=new CharacterMotion({now:()=>now});m.setRideMode(true);
 m.sample(0);assert.equal(m.state,'riding');assert.equal(m.snapshot().animationSpeed,0);
 now+=8100;m.sample(0);assert.equal(m.state,'resting');
 now+=1000;m.sample(12);now+=1600;m.sample(12);assert.equal(m.state,'riding');assert.equal(m.snapshot().animationSpeed,12);
 now+=16000;m.tick();assert.equal(m.state,'riding');assert.equal(m.speed,null);
 m.sample(0,{accuracy:80});assert.equal(m.state,'riding');assert.equal(m.speed,null);
 m.setRideMode(false);assert.equal(m.state,'idle');
});
