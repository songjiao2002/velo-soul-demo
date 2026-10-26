import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedReleaseMetadata} from './release-validation.mjs';
import {RELEASE_CERTIFICATE,APP_ID} from './public/app-update.mjs';
const previous={version:'0.1.2-preview',android:{available:true,packageId:APP_ID,versionCode:3,testSigned:true,size:24392280,sha256:'7305c5cc91ba1d00fc0e957e8ea19afbba5cfba91fddfedd0c3c33ece86076e5',certificateSHA256:'67096e7e3a7454f02ebb4426061991eb2040717b2dce7ad2176c17e3b115ed6c',url:'https://github.com/songjiao2002/velo-soul-demo/releases/download/v0.1.2-mobile-preview/VELO-SOUL-Android.apk'}};
const source='a'.repeat(40),verification={version:'0.1.3',versionCode:4,sha256:'b'.repeat(64),bytes:25000000,certificateSHA256:RELEASE_CERTIFICATE,originalQRsUnchanged:true};
const githubRelease={draft:false,tag_name:'v0.1.3-mobile-preview',target_commitish:source,assets:[{name:'VELO-SOUL-Android.apk',state:'uploaded',size:verification.bytes,digest:'sha256:'+verification.sha256,browser_download_url:'https://github.com/songjiao2002/velo-soul-demo/releases/download/v0.1.3-mobile-preview/VELO-SOUL-Android.apk'}]};
const fixture=()=>structuredClone({previous,source,verification,githubRelease});
test('only a verified uploaded APK can advance the original download metadata',()=>{
 const result=verifiedReleaseMetadata(fixture());assert.equal(result.android.versionCode,4);assert.equal(result.android.testSigned,false);assert.equal(result.android.sha256,verification.sha256);assert.equal(result.ios.webApp,true);assert.equal(result.android.url,githubRelease.assets[0].browser_download_url);
});
test('release publication rejects substituted artifacts, signatures, tags and revisions',()=>{
 for(const change of [f=>f.githubRelease.target_commitish='main',f=>f.githubRelease.draft=true,f=>f.githubRelease.tag_name='v0.1.2-mobile-preview',f=>f.githubRelease.assets[0].digest='sha256:'+'c'.repeat(64),f=>f.githubRelease.assets[0].size++,f=>f.githubRelease.assets[0].state='new',f=>f.githubRelease.assets[0].browser_download_url='https://evil.example/app.apk',f=>f.verification.certificateSHA256='c'.repeat(64),f=>f.verification.originalQRsUnchanged=false]){const f=fixture();change(f);assert.throws(()=>verifiedReleaseMetadata(f));}
});
test('publishing never rolls the download page back or overwrites the same build',()=>{
 const f=fixture();f.previous=verifiedReleaseMetadata(f);assert.throws(()=>verifiedReleaseMetadata(f),/downgrade|replacement/);
 f.previous={...f.previous,version:'0.1.4-preview',android:{...f.previous.android,versionCode:5,url:f.previous.android.url.replace('0.1.3','0.1.4')}};assert.throws(()=>verifiedReleaseMetadata(f),/downgrade|replacement/);
});
