import test from 'node:test';
import assert from 'node:assert/strict';
import {appUpdateURL,androidUpdateState} from './public/app-update.mjs';
const release={android:{available:true,testSigned:false,versionCode:5,url:'https://github.com/songjiao2002/velo-soul-demo/releases/download/v0.1.4-mobile-preview/VELO-SOUL-Android.apk'}};
test('native update link leaves bundled localhost and reports only validated installed version',()=>{
 const url=new URL(appUpdateURL({version:'0.1.3',build:'4'},'ko'));
 assert.equal(url.origin,'https://velo-soul-demo-production.up.railway.app');assert.equal(url.pathname,'/download.html');assert.equal(url.searchParams.get('build'),'4');assert.equal(url.searchParams.get('lang'),'ko');
 const bad=new URL(appUpdateURL({version:'https://evil.example',build:'<script>'},'xx'));assert.equal(bad.searchParams.has('installed'),false);assert.equal(bad.searchParams.get('lang'),'en');
});
test('download flow distinguishes newer, current, legacy, unknown and unavailable APKs',()=>{
 assert.equal(androidUpdateState(release),'download');assert.equal(androidUpdateState(release,'?build=4'),'update');assert.equal(androidUpdateState(release,'?build=5'),'current');assert.equal(androidUpdateState(release,'?build=6'),'current');assert.equal(androidUpdateState(release,'?build=3'),'legacy');
 for(const search of ['?build=-1','?build=NaN','?build=9999999999999999','?build='])assert.equal(androidUpdateState(release,search),'download');
 assert.equal(androidUpdateState({}),'unavailable');assert.equal(androidUpdateState({android:{...release.android,url:'https://evil.example/app.apk'}}),'unavailable');
 assert.equal(androidUpdateState({android:{...release.android,url:release.android.url+'?redirect=evil'}}),'unavailable');
});
