import {readFile,writeFile,copyFile,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {BUILD} from './public/build-version.mjs';
import {VOICE_PRIVACY} from './public/voice-privacy.mjs';
const source=new URL('./ui-reference/',import.meta.url),publicRoot=new URL('./public/',import.meta.url);
const read=name=>readFile(new URL(name,source),'utf8');
const normalize=text=>text.replaceAll('\r\n','\n').replaceAll('/ride/','/').replace(/\?v=(?:left-front|mono13|close-save-diary-20261126|model-ready-shift12-20261126|companion-pause-20261126)/g,'?v='+BUILD).replace(/2026\d{4}-[a-z]+\d+[a-z]*/g,BUILD);
let js=await read('app.pretty.js');
function replace(before,after){if(js.split(before).length!==2)throw Error('Reference anchor changed: '+before.slice(0,100));js=js.replace(before,after);}
replace('  var Ao = ',(await read('live-adapter.js'))+'\n  var Ao = ');
replace('a.playbackRate = 1, a.onplaying', 'liveSetMediaTempo(a), a.onplaying');
replace('on(this.bike, this.memory.theme, this.getLanguage() === "zh" ? "en" : this.getLanguage())','on(this.bike, this.memory.theme, this.getLanguage())');
replace('W === "ko" ? Di.mori[0].line','W === "zh" ? "唔，骑得有点快啦。想慢一点就慢一点吧。" : W === "ko" ? Di.mori[0].line');
replace('function In(i, e, t = P, a = () => {\n  }) {','function In(i, e, t = P, a = () => {}, speechOptions) {');
replace('function ze(i, e, t = P, a = () => {\n  }) {','function ze(i, e, t = P, a = () => {}, speechOptions) {');
replace(' : In(i, e, t, a);',' : In(i, e, t, a, speechOptions);');
replace('source: Kt(i, t, e), onState: (n) => {','...speechOptions, source: speechOptions?.voiceTurnId ? undefined : Kt(i, t, e), onState: (n, failure) => {');
replace('}[n]), a(n);','}[n] || (liveLimitCopy[S()][n] || "") + liveRetryAfter(S(),failure?.retryAfter)), a(n,failure);');
replace('        case "voice-start":','        case "ride-text-chat":\n          openRideTextChat(); break;\n        case "voice-start":');
// Keep the published mic button in the user gesture that unlocks audio.
// The conversation itself reports permission, connection and service failures.
replace(`    const response = await Q("/api/chat/status", { cache: "no-store" });
    const service = await response.json();
    if (!service.configured) {
      const status = p("cameraControlStatus");
      if (status) status.textContent = "";
      return;
    }
`,'');
// A restored camera URL renders ride settings immediately and needs its language table initialized.
const openInitialView='  Vo();\n  D !== "journal" && setTimeout(Go, 0);';
replace(openInitialView,'');
const readyEvent='  window.dispatchEvent(new window.Event("velo:ready"));';
replace(readyEvent,openInitialView+'\n'+readyEvent);
replace('  ko();','  ko(); syncSpeechLanguage();');
replace('const selected = M?.language || yi();','const selected = yi();');
replace('p("rideSettings")?.querySelector("[name=ride-language]:checked")?.value || yi()','yi()');
replace('V.setInputLanguage(i.target.value), e ? (M.start(P, yi()), _n()) : !V.isOpen()', '!e && !V.isOpen()');
replace('      if (M?.active) {\n        M.start(P, option.value);\n        _n();\n      }','');
replace('fi(), M?.stop(), ae?.stop();','fi();');
replace('W === "ko" ? Di.mori[0].line', 'W === "zh" ? "骑得有点快啦，我们慢一点吧。" : W === "ko" ? Di.mori[0].line');
replace('playing: e === "ko" ? "한국어 목소리 재생 중" : "영어 목소리 재생 중"', 'playing: e === "zh" ? "正在播放中文语音" : e === "ko" ? "한국어 목소리 재생 중" : "English voice playing"');
replace('playing: W === "en" ? "영어 목소리 재생 중" : "한국어 목소리 재생 중"', 'playing: W === "zh" ? "正在播放中文语音" : W === "ko" ? "한국어 목소리 재생 중" : "English voice playing"');
replace('  p("voiceSelect").addEventListener','  p("languageSelect").addEventListener("change", () => queueMicrotask(syncSpeechLanguage));\n  p("voiceSelect").addEventListener');
js=js.replaceAll('p("voiceSelect").value = W;','p("voiceSelect").value = yi();');
replace('record.generatedDiary?.body ? "" : diaryTranslationMenu(originalDiaryLanguage(record))','diaryTranslationMenu(originalDiaryLanguage(record))');
replace('      showDiary(record);\n      void Go();','      showDiary(record);\n      void Uo(record, S());\n      void Go();');
if(js.split('Ca(B[P].hello, "hello")').length!==4)throw Error('Intro anchors changed');
js=js.replaceAll('Ca(B[P].hello, "hello")','playLiveIntroduction()');
await writeFile(new URL('reference-entry.generated.mjs',publicRoot),(await read('live-imports.txt'))+normalize(js));
let html=normalize(await read('ride/index.html'));
html=html.replace('<title>', '<script>'+await read('layout-bootstrap.js')+'</script><title>');
html=html.replace('</head>',`<link rel="stylesheet" href="native-layout.css?v=${BUILD}"><link rel="preload" as="fetch" type="application/wasm" crossorigin="anonymous" fetchpriority="low" href="/vendor/rnnoise/rnnoise.wasm?v=${BUILD}"></head>`);
html=html.replace(/<script>\(function\(\)\{function c\(\)[\s\S]*?<\/script>/g,'');
const aboutVoice={en:'Qwen generates replies, voices and ride diaries. Diaries stay on this device.',ko:'답변, 캐릭터 목소리와 라이딩 일기는 Qwen이 생성해요. 일기는 이 기기에 저장돼요.',zh:'千问生成角色回复、声音和骑行后记。后记保存在本机。'};
const serviceNote=Object.keys(VOICE_PRIVACY).map(lang=>`<span lang="${lang}">${VOICE_PRIVACY[lang]} ${aboutVoice[lang]}</span>`).join('');
html=html.replace(/<p class="embedded-service-note"[\s\S]*?<\/p>/,`<p class="embedded-service-note" data-no-translate>${serviceNote}</p>`);
html=html.replace('<span id="voiceSelectLabel">','<span id="voiceSelectLabel" role="button" tabindex="0" aria-expanded="false">');
html=html.replace(/<select id="voiceSelect"[^>]*>([\s\S]*?)<\/select>/,(_,options)=>'<select id="voiceSelect" aria-labelledby="voiceSelectLabel"><option value="auto">Auto</option>'+options+'<option value="zh" lang="zh">中文</option></select>');
await writeFile(new URL('index.html',publicRoot),html);
for(const file of ['boot.js','app.css','screen.css','interactions.js','character-toon.bundle.mjs'])await writeFile(new URL(file,publicRoot),normalize(await read('ride/'+file)));
await cp(new URL('ride/assets/',source),new URL('assets/',publicRoot),{recursive:true});
for(const file of ['soul-blue.webp','soul-mint.webp','soul-orange.webp'])await copyFile(new URL('ride/'+file,source),new URL(file,publicRoot));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const files={};for(const file of ['app.bundle.js','app.css','screen.css','boot.js','interactions.js','index.html','character-toon.bundle.mjs'])files[file]=hash(await readFile(new URL('ride/'+file,source)));
await writeFile(new URL('SOURCE.json',source),JSON.stringify({url:'https://velo-soul-galaxy-s25-ultra.xiaolimao666.chatgpt.site/',downloaded:'2026-11-27',files},null,2)+'\n');
console.log('Published UI copied; live service adapters applied.');
