import {characterSVG} from './character-2d.mjs';
import {androidUpdateState,validateAppRelease,downloadLatestAndroid} from './app-update.mjs?v=20261028-install37';
const $=id=>document.getElementById(id);
$('downloadCharacters').innerHTML=characterSVG('lumi');
const copy={
 en:{title:'A little companion.<br>A place on your phone.',intro:'Meet Mori, Popo and Lulu. Scan your bicycle, find your pace, and keep a little of the journey.',androidText:'Download / Update',appleText:'Open on iPhone',pending:'The Android download is temporarily unavailable. You can still use the browser version.',ready:'Android 7.0+ · Download the APK, then open it and confirm installation. Same-signature updates keep your saved journeys.',testReady:'Android 7.0+ · Preview APK. Allow installation from your browser when Android asks.',update:'A newer version is ready. Download and open the APK, then confirm Update in Android.',current:'You have this version or newer. Download again only if you want to reinstall it.',again:'Download again',legacy:'Early previews (0.1.1 / 0.1.2) used different signing keys. Export your journeys before uninstalling the old preview once. Updates from 0.1.3 onward use a fixed key.',feature1:'Your original QR codes',feature2:'Full-screen camera & map',feature3:'Diaries in your Soul’s voice',webLink:'Open VELO SOUL in the browser ↗',iosTitle:'Keep it on your Home Screen',iosBody:'No App Store download needed. Open VELO SOUL in Safari, then:',iosStep1:'Tap Share (the square with an upward arrow).',iosStep2:'Choose Add to Home Screen. If shown, leave Open as Web App on.',iosStep3:'Tap Add. Your VELO SOUL icon is ready.',iosNote:'In WeChat or KakaoTalk, open the link in Safari first. The Home Screen version uses the live website; reopen it online to load website updates. Keep it open during voice conversations.',managementLink:'Desktop management ↗',privacyLink:'Privacy & permissions'},
 ko:{title:'작은 동반자.<br>휴대폰 속 한 자리.',intro:'모리, 포포, 루루를 만나세요. 자전거 QR을 찍고, 나의 속도로 달리고, 여정의 작은 순간을 남겨요.',androidText:'다운로드 / 업데이트',appleText:'iPhone에서 열기',pending:'Android 다운로드를 잠시 사용할 수 없어요. 브라우저 버전은 계속 이용할 수 있어요.',ready:'Android 7.0 이상 · APK를 내려받아 열고 설치를 확인하세요. 같은 서명의 업데이트는 저장된 여정을 유지해요.',testReady:'Android 7.0 이상 · 체험용 APK. 시스템 안내에 따라 이 브라우저의 앱 설치를 허용하세요.',update:'새 버전이 있어요. APK를 내려받아 열고 Android에서 업데이트를 확인하세요.',current:'현재 버전 또는 더 최신 버전을 사용 중이에요. 재설치가 필요할 때만 다시 내려받으세요.',again:'다시 다운로드',legacy:'초기 체험판(0.1.1 / 0.1.2)은 서명이 달라요. 여정을 내보낸 후 기존 체험판을 한 번 삭제하고 설치해야 해요. 0.1.3부터는 같은 서명으로 업데이트해요.',feature1:'기존 QR 그대로',feature2:'전체 화면 카메라·지도',feature3:'소울의 성격이 담긴 일기',webLink:'브라우저에서 VELO SOUL 열기 ↗',iosTitle:'홈 화면에 함께 두세요',iosBody:'App Store에서 받을 필요 없어요. Safari에서 VELO SOUL을 연 다음:',iosStep1:'공유 버튼(위쪽 화살표가 있는 사각형)을 누르세요.',iosStep2:'홈 화면에 추가를 선택하세요. 웹 앱으로 열기가 보이면 켜 두세요.',iosStep3:'추가를 누르면 VELO SOUL 아이콘이 생겨요.',iosNote:'카카오톡이나 위챗에서는 먼저 Safari로 링크를 여세요. 홈 화면 버전은 실제 웹사이트를 사용해요. 온라인에서 다시 열면 웹사이트 업데이트를 불러와요. 음성 대화 중에는 화면을 열어 두세요.',managementLink:'PC 관리 페이지 ↗',privacyLink:'개인정보와 권한'},
 zh:{title:'一个小小的伙伴。<br>住进你的手机。',intro:'遇见 Mori、Popo 和 Lulu。扫一下自行车，找到自己的节奏，留下一点旅途的记忆。',androidText:'下载／更新安卓',appleText:'苹果直接打开',pending:'安卓下载暂时不可用，你仍可打开网页版。',ready:'Android 7.0 及以上。下载并打开 APK，在系统弹窗确认安装；同签名更新会保留已存旅程。',testReady:'Android 7.0 及以上 · 体验版 APK。按系统提示允许此浏览器安装应用。',update:'有新版本。下载并打开 APK，在 Android 弹窗中确认“更新”。',current:'当前已是此版本或更新版本，仅需重新安装时再下载。',again:'重新下载安装包',legacy:'早期测试版（0.1.1／0.1.2）的签名不同。请先导出旅程记录，再卸载旧测试版、换装一次。从 0.1.3 起固定签名，后续可覆盖更新。',feature1:'兼容原有二维码',feature2:'全屏相机与地图',feature3:'各有性格的骑行日记',webLink:'用浏览器打开 VELO SOUL ↗',iosTitle:'把它放到 iPhone 桌面',iosBody:'无需 App Store。在 Safari 打开 VELO SOUL 后：',iosStep1:'点击“分享”（方框向上的箭头）。',iosStep2:'选择“添加到主屏幕”；若看到“作为网页 App 打开”，保持开启。',iosStep3:'点击“添加”，桌面就会出现 VELO SOUL 图标。',iosNote:'微信或 KakaoTalk 内请先用 Safari 打开链接。桌面版使用线上网站，联网重新打开即可加载网站更新；语音交流时请保持页面开启。',managementLink:'电脑管理端 ↗',privacyLink:'隐私与权限'}
};
const requested=new URLSearchParams(location.search).get('lang');
const updateCopy={
 en:{current:'Latest available version installed',newer:'Your installed version is newer than this download. Keep it; no downgrade is offered.',checking:'Checking the latest release…',retry:'Check now',release:'Release details ↗',autoUpdateTitle:'Always the latest available',autoUpdateBody:'This page checks for new releases while open, when you return, and again before downloading.',available:'Available Android version',installed:'Installed version',checked:'Last checked',requested:'Download requested. Open the APK in Downloads, then confirm Install or Update in Android.',checkingButton:'Checking update…',updateButton:'Download update',pendingNativeNote:'This APK is an earlier preview. Recent website improvements are available in the browser; the next Android package has not been published yet.',updateHelpTitle:'How updates work',androidUpdateHelp:'Already installed? Use the same Android button. A compatible, same-signature APK updates the app after you confirm in Android and keeps your journeys. A website cannot detect every installed app or install updates silently.',appleUpdateHelp:'On iPhone, use the website or add it to your Home Screen. Reopen it online to load website updates. No App Store download is needed.',migrationHelp:'Early 0.1.1 and 0.1.2 previews have different signatures. When moving to a new signing key, export journeys first; a one-time reinstall is required. Do not uninstall before backing up.',phoneTitle:'A little curiosity. A lovely way to go.',phoneScan:'Scan your bicycle',phoneRouteTitle:'A path to share',phoneRouteBody:'Seoul, and all the little things between.'},
 ko:{current:'설치 가능한 최신 버전이에요',newer:'설치된 앱이 다운로드 버전보다 최신이에요. 이전 버전은 제공하지 않아요.',checking:'최신 버전을 확인하고 있어요…',retry:'지금 확인',release:'릴리스 정보 ↗',autoUpdateTitle:'언제나 최신 공개 버전으로',autoUpdateBody:'페이지가 열려 있는 동안, 다시 돌아왔을 때, 다운로드 직전에 새 버전을 자동으로 확인해요.',available:'공개된 Android 버전',installed:'설치된 버전',checked:'마지막 확인',requested:'다운로드를 요청했어요. 다운로드 폴더에서 APK를 열고 Android의 설치 또는 업데이트를 확인하세요.',checkingButton:'업데이트 확인 중…',updateButton:'업데이트 다운로드',pendingNativeNote:'이 APK는 이전 체험판이에요. 최근 웹사이트 개선 사항은 브라우저에서 이용할 수 있으며 새 Android 설치 파일은 아직 공개되지 않았어요.',updateHelpTitle:'업데이트는 어떻게 하나요?',androidUpdateHelp:'이미 설치했다면 같은 Android 버튼을 이용하세요. 같은 서명의 호환 APK는 Android에서 확인하면 여정을 유지하며 업데이트돼요. 웹사이트가 모든 설치 앱을 확인하거나 자동으로 설치할 수는 없어요.',appleUpdateHelp:'iPhone에서는 웹사이트를 이용하거나 홈 화면에 추가하세요. 온라인에서 다시 열면 웹사이트 업데이트를 불러와요. App Store 다운로드는 필요 없어요.',migrationHelp:'초기 0.1.1과 0.1.2 체험판은 서명이 달라요. 새 서명으로 옮길 때는 먼저 여정을 내보내고 한 번 다시 설치해야 해요. 백업 전에 삭제하지 마세요.',phoneTitle:'작은 호기심. 함께 달리는 즐거움.',phoneScan:'자전거 QR 스캔',phoneRouteTitle:'함께 달리는 길',phoneRouteBody:'서울과 그 사이의 작은 순간들.'},
 zh:{current:'已安装当前可用的最新版',newer:'已安装版本高于当前下载版本，保留现有 App，不提供降级下载。',checking:'正在检查最新版本…',retry:'立即检查',release:'查看发布说明 ↗',autoUpdateTitle:'同一个入口，获取最新版本',autoUpdateBody:'页面打开期间、返回页面时和点击下载前，都会自动检查已发布的新版本。',available:'已发布安卓版本',installed:'已安装版本',checked:'上次检查',requested:'已发起下载。请在“下载”中打开 APK，并在安卓系统中确认“安装”或“更新”。',checkingButton:'正在检查更新…',updateButton:'下载更新',pendingNativeNote:'当前 APK 是早期体验版。近期网页改进已可通过浏览器使用，新安卓安装包尚未发布。',updateHelpTitle:'如何自动获取更新？',androidUpdateHelp:'已经安装？继续点同一个安卓按钮。兼容且签名相同的 APK 会在安卓系统确认后覆盖更新，保留旅程记录。网页无法识别所有已安装 App，也不能静默安装更新。',appleUpdateHelp:'iPhone 直接使用网页，或添加到主屏幕。联网重新打开即可加载网站更新，无需 App Store 下载。',migrationHelp:'早期 0.1.1 和 0.1.2 测试版签名不同。换用新签名时需先导出旅程，再一次性重新安装；备份前请不要卸载。',phoneTitle:'一点好奇，一路陪伴。',phoneScan:'扫描自行车二维码',phoneRouteTitle:'一起走过的路',phoneRouteBody:'首尔，以及沿途的小小瞬间。'}
};
let release={},lang=Object.prototype.hasOwnProperty.call(copy,requested)?requested:'en';
let checking=true,request,pollTimer,lastChecked=0,downloading=false,downloadRequested=false;
$('downloadLanguage').value=lang;
function paint(){
 const c=copy[lang],u=updateCopy[lang];document.documentElement.lang=lang;
 for(const [id,value]of Object.entries(c)){
  const el=$(id);if(!el)continue;
  if(id==='title')el.innerHTML=value;else el.textContent=value;
 }
 for(const [id,value]of Object.entries(u)){const el=$(id);if(el)el.textContent=value;}
 const validated=validateAppRelease(release),state=androidUpdateState(release,location.search),ready=!!validated&&!checking,downloadable=ready&&!downloading&&!['current','newer'].includes(state);
 $('androidStatus').textContent=checking?u.checking:downloadRequested?u.requested:state==='unavailable'?c.pending:state==='newer'?u.newer:state==='current'?u.current:state==='update'?c.update:release.android.testSigned?c.testReady:c.ready;
 $('updatePanel').dataset.state=checking?'checking':state;
 $('androidDownload').setAttribute('aria-disabled',String(!downloadable));
 if(downloadable)$('androidDownload').href=validated.android.url;else $('androidDownload').removeAttribute('href');
 if(['current','newer'].includes(state))$('androidText').textContent=u.current;
 else if(checking||downloading)$('androidText').textContent=u.checkingButton;
 else if(state==='update')$('androidText').textContent=u.updateButton;
 $('legacyNote').hidden=!ready||state!=='legacy';
 $('legacyNote').textContent=u.migrationHelp;
 $('releaseVersion').textContent=ready?`${u.available}: ${validated.version} · ${(validated.android.size/1000000).toFixed(1)} MB`:'';
 const installed=new URLSearchParams(location.search).get('installed');
 $('installedVersion').textContent=/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(installed||'')?`${u.installed}: ${installed}`:'';
 $('pendingNativeNote').hidden=!ready||validated.android.testSigned!==true;
 $('lastChecked').textContent=lastChecked?`${u.checked} · ${new Intl.DateTimeFormat(lang,{hour:'2-digit',minute:'2-digit'}).format(lastChecked)}`:'';
 $('releaseDetails').hidden=!ready;$('releaseDetails').textContent=u.release;
 if(ready)$('releaseDetails').href=`https://github.com/songjiao2002/velo-soul-demo/releases/tag/v${validated.versionName}-mobile-preview`;
 $('releaseRetry').hidden=false;$('releaseRetry').disabled=checking||downloading;$('releaseRetry').textContent=u.retry;
}
$('downloadLanguage').addEventListener('change',event=>{lang=event.target.value;paint();});
$('androidDownload').addEventListener('click',async event=>{
 event.preventDefault();if(downloading||event.currentTarget.getAttribute('aria-disabled')==='true')return;
 downloading=true;downloadRequested=false;paint();
 try{await downloadLatestAndroid({loadRelease:refreshRelease,search:location.search,navigate:url=>{downloadRequested=true;paint();location.assign(url);}});}
 catch{downloadRequested=false;release={};}
 finally{downloading=false;paint();}
});
function refreshRelease(){
 if(request)return request.promise;
 const entry={controller:new AbortController()};request=entry;checking=true;downloadRequested=false;paint();
 const timeout=setTimeout(()=>entry.controller.abort(),10000);
 entry.promise=(async()=>{
  try{const response=await fetch('/app-release.json?check='+Date.now(),{cache:'no-store',signal:entry.controller.signal});if(!response.ok)throw Error('unavailable');release=validateAppRelease(await response.json())||{};if(validateAppRelease(release))lastChecked=Date.now();}
  catch{release={};}
  finally{clearTimeout(timeout);checking=false;request=null;paint();}
  return release;
 })();return entry.promise;
}
function stopPolling(){clearInterval(pollTimer);pollTimer=null;}
function startPolling(){stopPolling();if(!document.hidden)pollTimer=setInterval(()=>{if(!checking&&!downloading)void refreshRelease();},60000);}
$('releaseRetry').addEventListener('click',refreshRelease);
addEventListener('pageshow',event=>{if(event.persisted)void refreshRelease();startPolling();});
addEventListener('pagehide',()=>{stopPolling();request?.controller.abort();});
addEventListener('online',()=>{if(!document.hidden)void refreshRelease();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPolling();else{startPolling();void refreshRelease();}});
void refreshRelease();startPolling();
paint();
