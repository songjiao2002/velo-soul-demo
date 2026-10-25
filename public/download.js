import {characterSVG} from './character-2d.mjs';
import {androidUpdateState} from './app-update.mjs';
const $=id=>document.getElementById(id);
$('downloadCharacters').innerHTML=characterSVG('lumi');
const copy={
 en:{title:'A little companion.<br>A place on your phone.',intro:'Meet Mori, Popo and Lulu. Scan your bicycle, find your pace, and keep a little of the journey.',androidText:'Download / Update',appleText:'Open on iPhone',pending:'The Android download is temporarily unavailable. You can still use the browser version.',ready:'Android 7.0+ · Download the APK, then open it and confirm installation. Same-signature updates keep your saved journeys.',testReady:'Android 7.0+ · Preview APK. Allow installation from your browser when Android asks.',update:'A newer version is ready. Download and open the APK, then confirm Update in Android.',current:'You have this version or newer. Download again only if you want to reinstall it.',again:'Download again',legacy:'Early previews (0.1.1 / 0.1.2) used different signing keys. Export your journeys before uninstalling the old preview once. Updates from 0.1.3 onward use a fixed key.',feature1:'Your original QR codes',feature2:'Voice, camera & GPS',feature3:'Keep your journeys',webLink:'Open VELO SOUL in the browser ↗',iosTitle:'Keep it on your Home Screen',iosBody:'No App Store download needed. Open VELO SOUL in Safari, then:',iosStep1:'Tap Share (the square with an upward arrow).',iosStep2:'Choose Add to Home Screen. If shown, leave Open as Web App on.',iosStep3:'Tap Add. Your VELO SOUL icon is ready.',iosNote:'In WeChat or KakaoTalk, open the link in Safari first. The Home Screen version uses the live website; reopen it online to load website updates. Keep it open during voice conversations.',privacyLink:'Privacy & permissions'},
 ko:{title:'작은 동반자.<br>휴대폰 속 한 자리.',intro:'모리, 포포, 루루를 만나세요. 자전거 QR을 찍고, 나의 속도로 달리고, 여정의 작은 순간을 남겨요.',androidText:'다운로드 / 업데이트',appleText:'iPhone에서 열기',pending:'Android 다운로드를 잠시 사용할 수 없어요. 브라우저 버전은 계속 이용할 수 있어요.',ready:'Android 7.0 이상 · APK를 내려받아 열고 설치를 확인하세요. 같은 서명의 업데이트는 저장된 여정을 유지해요.',testReady:'Android 7.0 이상 · 체험용 APK. 시스템 안내에 따라 이 브라우저의 앱 설치를 허용하세요.',update:'새 버전이 있어요. APK를 내려받아 열고 Android에서 업데이트를 확인하세요.',current:'현재 버전 또는 더 최신 버전을 사용 중이에요. 재설치가 필요할 때만 다시 내려받으세요.',again:'다시 다운로드',legacy:'초기 체험판(0.1.1 / 0.1.2)은 서명이 달라요. 여정을 내보낸 후 기존 체험판을 한 번 삭제하고 설치해야 해요. 0.1.3부터는 같은 서명으로 업데이트해요.',feature1:'기존 QR 그대로',feature2:'음성·카메라·GPS',feature3:'여정을 간직해요',webLink:'브라우저에서 VELO SOUL 열기 ↗',iosTitle:'홈 화면에 함께 두세요',iosBody:'App Store에서 받을 필요 없어요. Safari에서 VELO SOUL을 연 다음:',iosStep1:'공유 버튼(위쪽 화살표가 있는 사각형)을 누르세요.',iosStep2:'홈 화면에 추가를 선택하세요. 웹 앱으로 열기가 보이면 켜 두세요.',iosStep3:'추가를 누르면 VELO SOUL 아이콘이 생겨요.',iosNote:'카카오톡이나 위챗에서는 먼저 Safari로 링크를 여세요. 홈 화면 버전은 실제 웹사이트를 사용해요. 온라인에서 다시 열면 웹사이트 업데이트를 불러와요. 음성 대화 중에는 화면을 열어 두세요.',privacyLink:'개인정보와 권한'},
 zh:{title:'一个小小的伙伴。<br>住进你的手机。',intro:'遇见 Mori、Popo 和 Lulu。扫一下自行车，找到自己的节奏，留下一点旅途的记忆。',androidText:'下载／更新安卓',appleText:'苹果直接打开',pending:'安卓下载暂时不可用，你仍可打开网页版。',ready:'Android 7.0 及以上。下载并打开 APK，在系统弹窗确认安装；同签名更新会保留已存旅程。',testReady:'Android 7.0 及以上 · 体验版 APK。按系统提示允许此浏览器安装应用。',update:'有新版本。下载并打开 APK，在 Android 弹窗中确认“更新”。',current:'当前已是此版本或更新版本，仅需重新安装时再下载。',again:'重新下载安装包',legacy:'早期测试版（0.1.1／0.1.2）的签名不同。请先导出旅程记录，再卸载旧测试版、换装一次。从 0.1.3 起固定签名，后续可覆盖更新。',feature1:'兼容原有二维码',feature2:'语音、相机与定位',feature3:'保存旅程记忆',webLink:'用浏览器打开 VELO SOUL ↗',iosTitle:'把它放到 iPhone 桌面',iosBody:'无需 App Store。在 Safari 打开 VELO SOUL 后：',iosStep1:'点击“分享”（方框向上的箭头）。',iosStep2:'选择“添加到主屏幕”；若看到“作为网页 App 打开”，保持开启。',iosStep3:'点击“添加”，桌面就会出现 VELO SOUL 图标。',iosNote:'微信或 KakaoTalk 内请先用 Safari 打开链接。桌面版使用线上网站，联网重新打开即可加载网站更新；语音交流时请保持页面开启。',privacyLink:'隐私与权限'}
};
const requested=new URLSearchParams(location.search).get('lang');
let release={},lang=Object.prototype.hasOwnProperty.call(copy,requested)?requested:'en';
$('downloadLanguage').value=lang;
function paint(){
 const c=copy[lang];document.documentElement.lang=lang;
 for(const [id,value]of Object.entries(c)){
  const el=$(id);if(!el)continue;
  if(id==='title')el.innerHTML=value;else el.textContent=value;
 }
 const state=androidUpdateState(release,location.search),ready=state!=='unavailable';
 $('androidStatus').textContent=state==='unavailable'?c.pending:state==='current'?c.current:state==='update'?c.update:release.android.testSigned?c.testReady:c.ready;
 $('androidDownload').setAttribute('aria-disabled',String(!ready));
 $('androidDownload').href=ready?release.android.url:'#androidStatus';
 if(state==='current')$('androidText').textContent=c.again;
 $('legacyNote').hidden=!ready;
 $('legacyNote').textContent=c.legacy;
 const version=typeof release.version==='string'&&/^[\w.-]{1,40}$/.test(release.version)?release.version:'';
 $('releaseVersion').textContent=ready?version:'';
}
$('downloadLanguage').addEventListener('change',event=>{lang=event.target.value;paint();});
$('androidDownload').addEventListener('click',event=>{if(event.currentTarget.getAttribute('aria-disabled')==='true')event.preventDefault();});
fetch('/app-release.json',{cache:'no-store'}).then(response=>response.ok?response.json():{}).then(value=>{release=value&&typeof value==='object'?value:{};paint();}).catch(()=>paint());
paint();
