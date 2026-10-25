export const DOWNLOAD_URL='https://velo-soul-demo-production.up.railway.app/download.html';

export function appUpdateURL(info={},language='en') {
 const url=new URL(DOWNLOAD_URL);
 if(/^\d+\.\d+\.\d+$/.test(info.version||'')&&/^\d+$/.test(String(info.build||''))) {
  url.searchParams.set('installed',info.version);
  url.searchParams.set('build',String(info.build));
 }
 url.searchParams.set('lang',['en','ko','zh'].includes(language)?language:'en');
 return url.href;
}

export function androidUpdateState(release={},search='') {
 const android=release.android||{};
 const ready=android.available===true&&/^https:\/\/github\.com\/songjiao2002\/velo-soul-demo\/releases\/download\/v[\w.-]+\/VELO-SOUL-Android\.apk$/.test(android.url||'');
 if(!ready)return 'unavailable';
 const raw=new URLSearchParams(search).get('build');
 const installed=/^[1-9]\d{0,8}$/.test(raw||'')?Number(raw):null;
 if(!installed||!Number.isSafeInteger(android.versionCode))return 'download';
 // Only native App.getInfo supplies this hint. Browsers cannot reliably detect
 // installed APKs; Android's package installer makes the actual update decision.
 if(installed<4&&!android.testSigned)return 'legacy';
 return installed>=android.versionCode?'current':'update';
}
