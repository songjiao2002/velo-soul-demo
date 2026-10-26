import test from 'node:test';
import assert from 'node:assert/strict';
import {appUpdateURL,androidUpdateState,validateAppRelease,downloadLatestAndroid,APP_ID,RELEASE_CERTIFICATE} from './public/app-update.mjs';
const release={version:'0.1.4-preview',android:{available:true,testSigned:false,packageId:APP_ID,certificateSHA256:RELEASE_CERTIFICATE,sha256:'a'.repeat(64),size:24000000,versionCode:5,url:'https://github.com/songjiao2002/velo-soul-demo/releases/download/v0.1.4-mobile-preview/VELO-SOUL-Android.apk'}};
test('native update link leaves bundled localhost and reports only validated installed version',()=>{
 const url=new URL(appUpdateURL({version:'0.1.3',build:'4'},'ko'));
 assert.equal(url.origin,'https://velo-soul-demo-production.up.railway.app');assert.equal(url.pathname,'/download.html');assert.equal(url.searchParams.get('build'),'4');assert.equal(url.searchParams.get('lang'),'ko');
 const bad=new URL(appUpdateURL({version:'https://evil.example',build:'<script>'},'xx'));assert.equal(bad.searchParams.has('installed'),false);assert.equal(bad.searchParams.get('lang'),'en');
});
test('download flow distinguishes newer, current, legacy, unknown and unavailable APKs',()=>{
 assert.equal(androidUpdateState(release),'download');assert.equal(androidUpdateState(release,'?build=4'),'update');assert.equal(androidUpdateState(release,'?build=5'),'current');assert.equal(androidUpdateState(release,'?build=6'),'newer');assert.equal(androidUpdateState(release,'?build=3'),'legacy');
 for(const search of ['?build=-1','?build=NaN','?build=9999999999999999','?build='])assert.equal(androidUpdateState(release,search),'download');
 assert.equal(androidUpdateState({}),'unavailable');assert.equal(androidUpdateState({android:{...release.android,url:'https://evil.example/app.apk'}}),'unavailable');
 assert.equal(androidUpdateState({android:{...release.android,url:release.android.url+'?redirect=evil'}}),'unavailable');
});

test('release metadata fails closed for wrong package, signature, tag, digest, size or build',()=>{
 assert.ok(validateAppRelease(release));
 for(const value of [null,[],{},'release',{...release,version:'0.1.3-preview'}])assert.equal(validateAppRelease(value),null);
 for(const patch of [{packageId:'other.app'},{certificateSHA256:'b'.repeat(64)},{sha256:'invalid'},{size:-1},{size:200000000},{versionCode:0},{versionCode:2.5},{versionCode:2100000001},{testSigned:true},{available:false},{url:release.android.url+'#redirect'}])assert.equal(validateAppRelease({...release,android:{...release.android,...patch}}),null);
 const legacy={version:'0.1.2-preview',android:{...release.android,versionCode:3,testSigned:true,certificateSHA256:'67096e7e3a7454f02ebb4426061991eb2040717b2dce7ad2176c17e3b115ed6c',url:release.android.url.replace('0.1.4','0.1.2')}};
 assert.ok(validateAppRelease(legacy));assert.equal(androidUpdateState(legacy,'?build=4'),'newer');assert.equal(androidUpdateState(legacy,'?build=2'),'legacy');
 assert.equal(validateAppRelease({...legacy,android:{...legacy.android,certificateSHA256:RELEASE_CERTIFICATE}}),null);
});

test('one download click checks the current release before requesting an update',async()=>{
 const navigation=[];let checks=0;
 assert.equal(await downloadLatestAndroid({loadRelease:async()=>{checks++;return release;},search:'?build=4',navigate:url=>navigation.push(url)}),'requested');
 assert.equal(checks,1);assert.deepEqual(navigation,[release.android.url]);
});

test('a release replaced while the download page is open never causes a downgrade or duplicate install',async()=>{
 for(const [build,expected] of [[5,'current'],[6,'newer']]){
  let navigations=0;
  assert.equal(await downloadLatestAndroid({loadRelease:async()=>release,search:'?build='+build,navigate:()=>navigations++}),expected);
  assert.equal(navigations,0);
 }
});

test('failed or tampered click-time checks never start a stale download',async()=>{
 for(const loadRelease of [async()=>{throw Error('offline');},async()=>null,async()=>({...release,android:{...release.android,url:'https://other.example/app.apk'}})]){
  let navigations=0;assert.equal(await downloadLatestAndroid({loadRelease,navigate:()=>navigations++}),'unavailable');assert.equal(navigations,0);
 }
});
