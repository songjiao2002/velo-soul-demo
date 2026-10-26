import {APP_ID,validateAppRelease} from './public/app-update.mjs';
const check=(ok,message)=>{if(!ok)throw Error(message);};
function versionAfter(a,b){const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i];}return false;}

// Used only by the trusted release workflow. No API token or signing material
// enters the published metadata; APK verification has already run in CI.
export function verifiedReleaseMetadata({verification:v,githubRelease:r,previous,source}){
 check(/^[a-f0-9]{40}$/.test(source||''),'Invalid source revision');
 check(v?.originalQRsUnchanged===true&&/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v.version||''),'Missing package verification');
 check(r?.draft===false&&r.tag_name===`v${v.version}-mobile-preview`&&r.target_commitish===source,'Release provenance mismatch');
 const assets=Array.isArray(r.assets)?r.assets.filter(a=>a.name==='VELO-SOUL-Android.apk'):[];
 check(assets.length===1,'Expected one APK');const apk=assets[0];
 check(apk.state==='uploaded'&&apk.digest===`sha256:${v.sha256}`&&apk.size===v.bytes,'Published APK differs from verified package');
 const result={version:v.version+'-preview',android:{available:true,packageId:APP_ID,versionCode:v.versionCode,sha256:v.sha256,certificateSHA256:v.certificateSHA256,url:apk.browser_download_url,minAndroid:'7.0',size:v.bytes,testSigned:false},ios:{webApp:true,testflight:null},sourceCommit:source};
 const next=validateAppRelease(result),old=validateAppRelease(previous);
 check(next&&old,'Invalid release metadata or signing identity');
 check(next.android.versionCode>old.android.versionCode&&versionAfter(next.versionName,old.versionName),'Refusing downgrade or replacement of an existing version');
 return result;
}
