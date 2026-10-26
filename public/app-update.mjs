export const DOWNLOAD_URL='https://velo-soul-demo-production.up.railway.app/download.html';
export const APP_ID='com.velosoul.companion';
export const RELEASE_CERTIFICATE='3692891421910f0357e3f20f6240212973e5a9aee34c5c00db58c0069169d910';
const LEGACY_RELEASES={
 2:{version:'0.1.1',certificate:'b1284ea0073c479de257544759f629da328efd4c85a4e7bf49b57a36ca2fd02f'},
 3:{version:'0.1.2',certificate:'67096e7e3a7454f02ebb4426061991eb2040717b2dce7ad2176c17e3b115ed6c'}
};
const validBuild=value=>Number.isSafeInteger(value)&&value>0&&value<=2100000000;
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

export function validateAppRelease(release){
 if(!record(release)||!record(release.android))return null;
 const a=release.android;
 if(a.available!==true||a.packageId!==APP_ID||!validBuild(a.versionCode)||typeof release.version!=='string'||!/^\d{1,3}\.\d{1,3}\.\d{1,3}-preview$/.test(release.version))return null;
 const version=release.version.replace(/-preview$/,'');
 if(a.url!==`https://github.com/songjiao2002/velo-soul-demo/releases/download/v${version}-mobile-preview/VELO-SOUL-Android.apk`)return null;
 if(!/^[a-f0-9]{64}$/.test(a.sha256||'')||!Number.isSafeInteger(a.size)||a.size<1000000||a.size>150000000)return null;
 const legacy=LEGACY_RELEASES[a.versionCode];
 if(legacy){if(a.testSigned!==true||version!==legacy.version||a.certificateSHA256!==legacy.certificate)return null;}
 else if(a.versionCode<4||a.testSigned!==false||a.certificateSHA256!==RELEASE_CERTIFICATE)return null;
 return {...release,android:{...a},versionName:version};
}

export function appUpdateURL(info={},language='en') {
 const url=new URL(DOWNLOAD_URL);
 if(/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(info?.version||'')&&/^\d+$/.test(String(info?.build||''))&&validBuild(Number(info.build))) {
  url.searchParams.set('installed',info.version);
  url.searchParams.set('build',String(info.build));
 }
 url.searchParams.set('lang',['en','ko','zh'].includes(language)?language:'en');
 return url.href;
}

export function androidUpdateState(release,search='') {
 const validated=validateAppRelease(release);if(!validated)return 'unavailable';
 const android=validated.android;
 const raw=new URLSearchParams(search).get('build');
 const installed=/^[1-9]\d{0,9}$/.test(raw||'')&&validBuild(Number(raw))?Number(raw):null;
 if(!installed)return 'download';
 // Only native App.getInfo supplies this hint. Browsers cannot reliably detect
 // installed APKs; Android's package installer makes the actual update decision.
 if(installed>android.versionCode)return 'newer';
 if(installed===android.versionCode)return 'current';
 return installed<4?'legacy':'update';
}

// Recheck at the user's click, so a page left open never downloads a stale APK.
// A browser cannot silently install it; Android's installer owns confirmation.
export async function downloadLatestAndroid({loadRelease,search='',navigate}){
 let release;try{release=validateAppRelease(await loadRelease());}catch{return 'unavailable';}
 const state=androidUpdateState(release,search);
 if(!['download','legacy','update'].includes(state))return state;
 navigate(release.android.url);
 return 'requested';
}
