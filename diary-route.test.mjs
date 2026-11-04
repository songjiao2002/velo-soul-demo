import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diaryRouteModel,diaryRouteImage,diaryRouteMarkup,rememberPhotoMoment} from './public/diary-route.mjs';
import {diaryPayload} from './public/diary-generation.mjs';
const p=(lat,time)=>({lat,lon:126.97,accuracy:5,time});
const record=()=>({id:'route-test',soul:'lumi',route:[p(37.55,1000),p(37.551,31000)],photos:['data:image/jpeg;base64,YQ==']});
test('route image stays separate from photos and the diary model payload',()=>{
 const r=record(),original=[...r.photos];assert.equal(rememberPhotoMoment(r,0,32000,p(37.551,32000)),true);
 r.route.push(p(37.552,61000));const image=diaryRouteImage(r,'ko');assert.ok(Math.abs(image.meters-222.39)<1);assert.ok(Math.abs(image.moments[0].fraction-.5)<.001);
 assert.deepEqual(r.photos,original);assert.match(image.svg,/0 km/);assert.match(image.svg,/0.22 km/);assert.doesNotMatch(JSON.stringify(diaryPayload(r,'ko')),/photoMoments|distanceM|pointIndex|126.97|<svg/);
});
test('old diaries render the saved route without inventing photo moments; empty and corrupt routes do not invent a map',()=>{
 assert.equal(diaryRouteModel(record()).moments.length,0);
 for(const route of [[],[p(37.55,1)],[p(37.55,1),p(37.55,2)],[p(37.55,1),{...p(37.56,2),lat:NaN}]]){
  assert.equal(diaryRouteImage({...record(),route}),null);assert.doesNotMatch(diaryRouteMarkup({...record(),route},'en'),/<img|0 km|NaN/);
 }
 for(const language of ['en','ko','zh']){const image=diaryRouteImage(record(),language);assert.ok(image.src.startsWith('data:image/svg+xml;'));assert.doesNotMatch(image.svg,/https?:\/\/[^w]|NaN|Infinity/);}
});
test('photo moments require fresh GPS, keep original photo indexes and reject duplicate or inconsistent entries',()=>{
 const r=record();for(const fix of [null,p(37.551,1000),p(38,32000),{...p(37.551,32000),accuracy:100}])assert.equal(rememberPhotoMoment(r,0,32000,fix),false);
 assert.equal(rememberPhotoMoment(r,0,32000,p(37.551,32000)),true);assert.equal(rememberPhotoMoment(r,0,32000,p(37.551,32000)),false);
 r.photoMoments.push({...r.photoMoments[0],photoIndex:9},{...r.photoMoments[0],distanceM:999});assert.equal(diaryRouteModel(r).moments.length,1);
});
