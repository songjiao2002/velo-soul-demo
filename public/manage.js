const copy={
 en:{desk:'STUDY MANAGEMENT',language:'Language',edition:'FIELD KIT / 02',title:'A friend for every bicycle.',intro:'New codes · 16 Nov 2026. Replace the old labels and update the app before scanning.',print:'Print QR cards ↗',curious:'A curious explorer',foodie:'A foodie rider',relaxed:'An easygoing companion',scan:'Scan to meet your companion',download:'Download PNG ↓',open:'Check link ↗',note:'Keep the white space around each code when printing. Match the bicycle number and test the attached code before the study.',footer:'QR tools for the study team. These controls are not shown in the rider app.'},
 ko:{desk:'연구 관리',language:'언어',edition:'현장 준비 / 02',title:'자전거마다, 한 명의 친구.',intro:'2026년 11월 16일 새 QR입니다. 기존 코드를 교체하고 앱을 업데이트하세요.',print:'QR 카드 인쇄 ↗',curious:'호기심 많은 탐험가',foodie:'먹보 라이더',relaxed:'느긋한 힐링 라이더',scan:'QR을 찍고 동반자를 만나세요',download:'PNG 다운로드 ↓',open:'연결 확인 ↗',note:'인쇄할 때 QR 주위의 흰 여백을 유지하세요. 자전거 번호를 맞추고, 연구 전에 부착된 코드를 스캔해 확인하세요.',footer:'연구자를 위한 QR 관리 도구입니다. 라이더 앱에는 이 기능이 표시되지 않습니다.'},
 zh:{desk:'研究管理端',language:'语言',edition:'骑行研究 / 02',title:'每辆自行车，都有一个朋友。',intro:'2026 年 11 月 16 日新码：旧码已作废，请更换车身贴纸并更新 App。',print:'打印二维码卡片 ↗',curious:'好奇的探险家',foodie:'贪吃的骑行伙伴',relaxed:'悠闲的治愈系伙伴',scan:'扫码，遇见你的骑行伙伴',download:'下载 PNG ↓',open:'检查链接 ↗',note:'打印时保留二维码四周的白色留边。核对自行车编号，并在研究前测试贴好的二维码能否正常识别。',footer:'供研究人员使用的二维码管理工具，骑行用户的 App 中不显示这些功能。'}
};
const selector=document.getElementById('deskLanguage');
function paint(language){const lang=Object.hasOwn(copy,language)?language:'en';selector.value=lang;document.documentElement.lang=lang;for(const el of document.querySelectorAll('[data-copy]'))el.textContent=copy[lang][el.dataset.copy];}
paint(new URLSearchParams(location.search).get('lang'));
selector.addEventListener('change',()=>paint(selector.value));
document.getElementById('printCodes').addEventListener('click',()=>window.print());
