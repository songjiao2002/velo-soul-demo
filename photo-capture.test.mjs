import {test} from 'node:test';
import assert from 'node:assert/strict';
import {capturePhoto,downloadPhoto,photoFilename} from './public/photo-capture.mjs';
import {translate} from './public/i18n.mjs';

test('download and journey preview use the same frozen camera frame',()=>{
 const canvases=[],draws=[];
 const doc={createElement(){const c={getContext:()=>({drawImage:(...args)=>draws.push(args)}),toDataURL:(type,quality)=>`data:${type};base64,${quality===.9?'ZnVsbA==':'cHJldmlldw=='}`};canvases.push(c);return c;}};
 const video={videoWidth:3840,videoHeight:2160},photo=capturePhoto(video,doc);
 assert.equal(canvases[0].width,2560);assert.equal(canvases[0].height,1440);
 assert.equal(canvases[1].width,720);assert.equal(canvases[1].height,405);
 assert.equal(draws[0][0],video);assert.equal(draws[1][0],canvases[0]);
 assert.notEqual(photo.full,photo.preview);assert.throws(()=>capturePhoto({videoWidth:0},doc));
});

test('shutter downloads synchronously, leaves no links behind, and permits repeated photos',()=>{
 let mounted=0;const clicks=[];
 const doc={body:{append:a=>{mounted++;a.attached=true;}},createElement:()=>({click(){assert.equal(this.attached,true);clicks.push({href:this.href,filename:this.download});},remove(){mounted--;}})};
 for(let i=1;i<=30;i++)downloadPhoto('data:image/jpeg;base64,cGhvdG8=',photoFilename('bori',1792400000000,i),doc);
 assert.equal(clicks.length,30);assert.equal(new Set(clicks.map(c=>c.filename)).size,30);assert.equal(mounted,0);
 assert.ok(clicks.every(c=>c.filename.endsWith('.jpg')&&!/[:/]/.test(c.filename)));
 assert.throws(()=>downloadPhoto('https://example.com/not-a-photo','x.jpg',doc));
 doc.createElement=()=>({click(){throw Error('Blocked');},remove(){mounted--;}});
 assert.throws(()=>downloadPhoto('data:image/jpeg;base64,cGhvdG8=','x.jpg',doc),/Blocked/);assert.equal(mounted,0);
});

test('photo counts and retry/download messages support all three UI languages',()=>{
 assert.equal(translate('사진 15장','ko'),'사진 15장');
 assert.equal(translate('사진 15장','en'),'Photos 15');assert.equal(translate('사진 15장','zh'),'照片 15 张');
 for(const source of ['사진 다시 저장','사진을 누르면 다시 저장할 수 있어요.','사진 다운로드를 요청했어요. 휴대폰의 다운로드 또는 파일 앱을 확인해주세요.','사진 다운로드를 시작하지 못했어요. 사진을 다시 눌러주세요.']){
  for(const lang of ['en','zh'])assert.notEqual(translate(source,lang),source);
 }
});
