# VELO SOUL

Current release: **20261018-stream1**. Speech is streamed during the utterance, and the UI replaces tentative transcripts as Qwen revises them. Confirmed text is submitted once after a roughly 450 ms pause. Korean, English and Chinese input remain supported; Chinese still receives English replies. Temporary audio is retained only in memory for a bounded HTTP fallback if streaming fails. This reduces waiting for recognition to begin; model response and network latency remain.

The animated characters now share the covers' 1254 px design coordinates and reuse the covers' actual eye, brow and mouth textures. Separated body/hand textures preserve the original proportions and accessories, with no feet and fixed shoulder pivots. Original covers, QR files and destinations are unchanged. Asset prompts and paths: [IDENTITY_ASSETS.json](IDENTITY_ASSETS.json).

Streaming setup: run npm ci (ws is a server-only dependency). The browser connects to /api/transcribe/live on this same origin; Railway proxies PCM16 audio to Qwen-ASR-Realtime using the server key. No key is sent to the browser or placed in a URL. The proxy enforces origin, language, payload, duration, backpressure and shared demo quota limits. QWEN_REALTIME_ASR=off disables streaming; QWEN_ASR_MODEL continues to configure the HTTP fallback.

References: [official Qwen3-ASR streaming demo](https://github.com/QwenLM/Qwen3-ASR#streaming-demo), [RealtimeSTT](https://github.com/KoljaB/RealtimeSTT), [ws](https://github.com/websockets/ws), and [Qwen streaming events](https://www.alibabacloud.com/help/en/model-studio/qwen-asr-realtime-server-events). The integration uses the existing cloud account, not a self-hosted GPU model.

Validation: 120 automated checks, including incremental revisions, final-only submission, partials across multiple VAD segments, fallback retention, cancellation, PCM duration, same-origin checks and shared quotas. English and Korean generated samples were streamed through the real Qwen API. Device, wind-noise and speaker tests still require a phone.

The sections below retain earlier implementation notes.


自行车人格化／数字骑行伙伴 demo。多语言演示版：相机初遇＋声音陪伴＋旅程日记：

- 루미 / Lumi：蓝色，好奇型，BK-024
- 모리 / Mori：薄荷绿，悠闲型，BK-017
- 보리 / Bori：橙色，吃货型，BK-036

流程：角色邀请 → 三色 QR／网页摄像头扫码 → 真实相机与角色登场动画 → 英语／韩语声音陪伴 → 可选 GPS 与照片 → 保存和导出旅程日记。

「开启实时陪伴」一次进入全屏相机并请求定位、相机及麦克风权限。底部中央圆形快门拍摄；连续语音说完自动发送、自动朗读并继续聆听。回答期间普通转写暂停，保留「等一下 / stop / 잠깐」关键词打断监听。GPS 与相机开启后可一同用于回复；中文仍用英语回答。手动聊天可选择是否附带传感器信息及自动朗读。

连续对话是网页前台的轮流语音与关键词打断，并非流式双工音频通话。连续语音直接采集麦克风，经本站 `/api/transcribe` 使用 Qwen `qwen3-asr-flash` 识别，不再依赖浏览器 SpeechRecognition 服务；锁屏、后台和嘈杂环境仍需手机验证。

## 运行与部署

Node.js 22 及以上：`npm start`。无需安装依赖。固定台词体验无需密钥；Qwen 对话和 AI 摄像头观察需要服务器配置 API Key，见 [QWEN_SETUP.md](QWEN_SETUP.md)。

Railway 从本仓库 main 分支自动部署，自动识别根目录 Dockerfile，启动命令由 Dockerfile 提供。服务监听 `0.0.0.0:$PORT`。在服务 Settings → Deploy 设置 Healthcheck Path 为 `/healthz`，在 Networking 中生成公开域名。当前新服务不依赖已弃用的 railway.json 配置方式。

公开演示：https://velo-soul-demo-production.up.railway.app/

三个入口为 `/?bike=lumi`、`/?bike=mori`、`/?bike=bori`。`/qr-lumi.svg`、`/qr-mori.svg`、`/qr-bori.svg` 由服务器按当前域名生成，可直接下载和打印。优先使用 `PUBLIC_BASE_URL`、其次 `RAILWAY_PUBLIC_DOMAIN`，否则使用请求地址。因此迁移后需从新站下载二维码；以前打印的二维码仍指向原站。

## 数据与演示范围

进入相机时请求真实摄像头权限，后置摄像头优先；相机语音入口同时请求麦克风。麦克风片段经本站发送给 Qwen，不保存录音文件。GPS 记录轨迹和浏览器提供的速度，误差过大的点不记入。照片由用户手动拍摄，最多 4 张。手动保存的旅程照片与轨迹不上传服务器；开启 AI 观察后，分析用缩小相机图会经本站传给 Qwen，本站不保存分析图。对话可附带当前画面及近期定位匹配的目录地点、距离与速度，不发送精确 GPS 坐标。旅程数据保存在当前浏览器 IndexedDB，旧版 localStorage 文字卡片会迁入。切换域名或清除浏览器数据后记录不会跟随。

15 段预制韩语音频随网页提供；新增情景用设备韩语 TTS（无韩语声音时明确显示字幕模式）。相机可通过自选 AI 观察开关分析真实画面；GPS 可触发收录的 3 处首尔地点。实时天气已按 GPS 接入 Open-Meteo；所有周边咖啡店/餐厅搜索及附近自行车邀约仍是情景模拟。AR 是 2D 屏幕叠加，不含空间追踪。标签页隐藏、页面离开或结束体验时关闭相机/GPS。浏览器不提供后台持续记录。

界面与研究设计说明见 PROTOTYPE.ko.md。无需用户账户。AI 功能由服务端管理密钥。

`npm test` 检查服务和新模块、二维码解码、音频分段请求、相机授权/释放/竞态、GPS 过滤以及浏览器原生 API 的调用对象。Windows 限制子进程环境下使用 `node --test --test-isolation=none server.test.mjs final.test.mjs language.test.mjs audio.test.mjs chat.test.mjs places.test.mjs vision.test.mjs connected.test.mjs hands-free.test.mjs browser-api.test.mjs microphone.test.mjs speech.test.mjs`。

页面先直接显示三个角色和二维码，再加载单个 `public/app.bundle.js`。二维码识别库只在打开扫描页后下载；图片异步解码，首页下方角色图片延后加载。启动失败会显示重试入口和错误详情。语音和观察模块的默认计时器、网络函数通过 `globalThis` 调用，避免浏览器出现 `Illegal invocation`。

修改前端源文件后运行 `npm ci`、`npm run build`，将更新的 `public/app.bundle.js` 一并提交。Railway 镜像直接运行已构建的文件，不需要在启动时安装构建工具。

## 来源

页面和素材来自 2026-10-09 的 VELO SOUL 原型，未包含味觉项目内容。`vendor/qrcode.mjs` 来自 qrcode-generator 2.0.4（Kazuhiko Arase，MIT；保留原作者声明）。

二维码解码使用 jsQR 1.4.0（Apache-2.0），完整许可证保留于 public/vendor/LICENSE-jsQR.txt。

## 界面与语音语言

右上角「界面」提供 English / 한국어 / 中文，「语音」只提供 English / 한국어，两个选择独立保存在浏览器。切换界面不重新建立页面、重启相机或清空正在填写的日记；用户自己的文字不翻译。

英语首访默认启用；后续尊重用户保存的语音选择。19 段固定英语 WAV 随网站提供，不依赖设备安装的英语音源。露米：美式 Alayna（1.0 倍速），莫里：英式 Robert（0.9 倍速），波里：美式 Matthew（1.05 倍速），均保留默认音高。西海岸是露米的措辞与表达方向，不声称精确地区口音。配音通过 TTSMaker 生成，台词和音源信息见 public/audio/en/transcripts.json。音频授权说明：https://ttsmaker.com/copyright_and_commercial_license_terms/en 。

点击「试听」、角色见面按钮或「听我打招呼」即可播放。二维码直接打开角色页时需点击一次播放按钮，以满足手机浏览器的音频播放要求。只有收到实际播放事件才显示播放中；加载失败、超时、浏览器拦截都会显示可重试提示。韩语基本台词继续使用 15 个 MP3，额外韩语情景使用云端合成；中文可用于界面和对话输入，中文对话暂用英语回复、英语 TTS 朗读。

固定台词继续保留；新增 Qwen 对话、图像理解与三种角色 Skill。动态回复通过 Qwen TTS 流式合成并自动播放，预制 WAV/MP3 保持原有播放方式。自动检查覆盖 19 个英语音频的完整性、非静音数据、播放取消、浏览器拦截后重试，以及 WAV 分段请求。具体语调是否符合性格仍需手机试听反馈。

## 相机语音修复（2026-10-17 / voice6）

进入「相机＋语音陪伴」即开启语音；登场动画不再取消会话。界面显示真实音量、识别出的原话及收音／识别／思考／播报状态。只有实际收到 PCM 采样才显示聆听，没有收音会提示检查设备。

链路：麦克风 AudioWorklet（兼容回退 ScriptProcessor）→ 本机音量/静音分段 → 最长约 15 秒、16 kHz 单声道 WAV → `/api/transcribe` → Qwen ASR → 原有带角色和传感器的聊天 → 设备 TTS。中、英、韩语自动识别，中文回答仍为英语。说完约一秒自动发送。聊天弹窗也支持一次开启后持续自动发送和语音回复。

ASR、视觉、聊天共享同一请求限额。服务端只接受有大小上限的 PCM WAV，不接受远程音频 URL；密钥仅在服务端。退出、隐藏页面、权限超时或停止会话会释放录音轨道和音频上下文。回答时的打断检测仍会采集并发送触发的语音片段。

自动检查覆盖静音不上传、短噪声、语音分段、超时取消、权限延迟、真实采样状态、音量、连续两轮以及离开时释放。模拟设备通过不等于手机实测；动态播报已改为云端合成音频，风噪、回声和关键词打断延迟待实测。

## 连续对话与云端朗读（2026-10-17 / voice7）

动态回复改为 `qwen3-tts-flash` 生成真实 WAV，经本站 `/api/speech` 返回并由已解锁的 Web Audio 播放。第一次点击开始交流时解锁播放通道；以后每轮自动播报和恢复聆听，不依赖设备安装的 speechSynthesis 音色。固定欢迎台词仍使用原先的音频文件。

相机和聊天窗口都使用同一套 HandsFreeConversation 循环：自动识别、自动发送、合成语音、播放结束后自动恢复。聊天窗口不再要求逐句点击麦克风和发送。临时识别连接失败最多自动重连三次；播放失败保留会话并显示一次性的声音恢复按钮，权限拒绝或限额达到仍会明确停止。两种模式支持时请求屏幕常亮；网页仍须保持前台。

Lumi / Mori / Bori 分别使用 Cherry / Serena / Chelsie 音色。中文输入继续用英语回复；韩语用韩语合成。长回复按句拆成每段不超过 540 字符的请求，服务端上限 600 字符。连续语音提示模型简短回答。识别、聊天、视觉、合成共用同一服务请求预算，语音合成也会使用账号额度。

新界面保留三个角色色调，把主操作收拢为「开始／暂停交流」、字幕、音量与圆形快门；相机设置和文字输入默认折叠。没有“说一句点一次”的默认流程。

验证：76 项自动化检查；模拟设备的完整页面验证相机和聊天窗口各两轮自动识别、发送、播放与恢复。真实接口验证 ASR、对话、三个音色和韩语 WAV 非静音。当前环境无法验证手机真实扬声器或浏览器视觉布局；未宣称实机通过。实现仍是按短语轮流对话，不是流式全双工语音。

## 韩语与首音延迟修复（2026-10-17 / voice8）

顶部语音选择、相机对话和聊天弹窗同步保存同一个语言偏好。选 한국어 时，录音请求包含 language:ko，服务端传入 Qwen 的 asr_options.language，回答和动态合成也使用韩语；短暂的“OK”不会切回英语。中文输入仍依项目要求用英语回答。Auto 不限定识别语言，适合混合语言。界面语言继续独立于对话语言。

动态朗读默认改用 /api/speech/stream：服务器解析 Qwen SSE 并验证 WAV 头，逐段转发 24 kHz 单声道 PCM；客户端收到首段便调度 Web Audio，无需等待整份音频生成和 OSS 下载。完成标记防止网络中断被当作成功，退出和打断会取消上游并停止全部已排队声音。原 /api/speech 仍提供完整 WAV 兼容接口。

语句结束静音阈值由 1000 ms 调整为 650 ms，播放结束后 250 ms 恢复听取。短语音确认可被识别，短瞬时噪声仍不上传。普通寒暄不再每轮附带摄像头图片；中英韩的看图问题仍附当前帧，GPS 上下文与主动相机观察保持工作。额外韩语场景改用云端朗读，不再依赖设备韩语声音包。

验证：83 项自动测试，包含流的分块/截断/取消、Korean 选择贯通 ASR→回答→TTS，以及实际发布 bundle 的模拟相机和聊天连续对话。真实 Qwen 测试覆盖韩语录音转写、三个角色韩语回答和合成音频再识别。首音提速只涉及合成阶段；ASR 和模型排队仍有波动，不能保证整轮小于一秒。手机麦克风、风噪、扬声器和后台运行需要实机验证。

## 二维码 PNG 下载（2026-10-17）

首页三个角色的二维码下载为 PNG，含白底、四个模块宽的留白及各自蓝／绿／橙色。PNG 由后端根据当前部署地址生成，使用整数像素绘制，可直接保存或打印；页面尚未启动时的备用下载入口也使用 PNG。

## GPS 自动天气陪伴（2026-10-18 / weather3）

进入「实时陪伴」或「相机＋语音陪伴」并允许 GPS 后，自动调用本站 POST /api/weather 获取所在地天气，无需点天气按钮。首次取得天气后，等对话空闲至少两秒，以当前英语或韩语做一次天气开场寒暄；正在说话或回答时延后。随后只主动补充天气风险提醒，不定时重复普通天气闲聊。开启一次后持续运行，直到暂停陪伴、关闭 GPS 或页面转入后台。天气卡片可单独关闭自动播报。

天气来自 Open-Meteo，按约 2 公里网格查询，每五分钟刷新，换网格可提前查询（至少间隔一分钟），失败一分钟后重试。精确坐标保留在设备；近似网格会发送给本站和 Open-Meteo，后端仅作内存缓存。聊天只携带天气引用 ID，由服务器补入当前可信天气；不接受浏览器自填的晴雨资料。天气获取独立于千问聊天额度，动态语音仍消耗 Qwen TTS 额度。

Lumi 留意天气中的小发现；Mori 关心舒适节奏；Bori 联系安全休息时的点心。下雨、下雪、雷雨、近期降水、低温伴随降水或未来两小时可能降水时，主动给一句注意提醒。同类提醒至少间隔 30 分钟，普通天气闲聊只在本次陪伴开场说一次；通常不同提醒也间隔两分钟，风险加重可提前。天气服务失败、定位不可靠或资料过期时不编造天气。

冰滑判断是推测：冻雨，或气温不高于 2°C 且当前/近期有降水，提示「可能结冰」，不把低温干燥等同于结冰。模型估计不等于实际路面检测，也不是官方预警。地点推荐仍只覆盖既有首尔目录；没有接入所有咖啡馆搜索或路线规划。

[Open-Meteo 文档](https://open-meteo.com/en/docs) · [使用条款](https://open-meteo.com/en/terms) · [CC BY 4.0 数据许可](https://open-meteo.com/en/licence)。当前使用适合教育/研究原型的免费非商业接口，无新增密钥；若改作商业服务需按提供方条款更换方案。天气卡片注明来源、模型估计和 VELO SOUL 摘要。

预报提醒：检查未来两小时的逐小时数据，对约一小时内和两小时内的可能降雨、降雪、雷雨或冻雨分别说明。新预报在开场之后仍会自动提醒；风险临近可更新提醒，但不反复读相同预报。小时预报只表示一个时间窗口，不声称确定的降雨开始时刻。

## Voice9: quicker conversation and expressive Souls

Starting voice conversation plays a packaged introduction in the selected Korean/English voice immediately after microphone readiness. It does not wait for GPS or a chat model. Weather is prepared while the introduction plays, then spoken when listening is idle. Missing GPS does not block conversation. Pause/resume and switching camera/chat do not repeat an introduction already heard in this page session. Chinese input continues to receive English output.

Voice replies use QWEN_VOICE_MODEL (default qwen-flash, thinking disabled), separate from text QWEN_MODEL and camera QWEN_VISION_MODEL. Speech endpointing is 450 ms of silence, followed by ASR → short reply → streaming PCM playback. This is turn-taking conversation with keyword interruption, not full-duplex streaming input. Dynamic replies still depend on network and service latency.

Camera and chat characters use separate arms, feet, body and programmable eyes/mouth. Greeting gestures, blinks, listening gaze, thinking face and speaking mouth follow actual session/playback state. Reduced-motion settings disable the animation. Assets are generated with built-in imagegen; prompts and saved paths are in ASSET_GENERATION.json. Runtime SVG/CSS articulates the unchanged PNG atlases.

Validation: opening/cancellation/continuous conversation/half-second endpointing regressions; production bundle DOM simulation in English and Korean; all six packaged introductions synthesized and transcribed through Qwen. A static SVG layout render was inspected. Physical-device microphone, wind noise, autoplay and browser animation rendering still need on-device verification.

## Load1: smaller downloads, unchanged QR codes

The public origin and all `/?bike=lumi|mori|bori` destinations are unchanged. Existing QR routes, colors, generation, PNG download names and SVG previews are untouched; regression tests compare all six outputs against their previously published SHA-256 hashes.

The three 480px WebP portraits total 22,384 bytes, replacing 3,753,277 bytes of initial PNG downloads. Full-resolution WebP animation atlases total 342,252 bytes instead of 4,600,492 bytes; SVG coordinates, alpha edges, expressions and joint animations are preserved. Original PNG assets remain available. These WebP files were encoded from the original PNGs using sharp with quality 86, alphaQuality 100 for atlases and effort 6; portraits use a 480×480 inside resize. This is a transfer-size comparison, not a measured mobile loading-time guarantee.

`npm ci && npm run build` bundles the JavaScript and the six stylesheets (in their existing cascade order), then runs `build-assets.mjs`. The build writes Brotli/gzip representations and a content-hash manifest. Generated files are committed and copied into the Docker image, so production needs no build-time dependencies. The `public/build-version.mjs` identifier also updates HTML/boot URLs during this build. Bump it when changing assets.

The server negotiates Brotli/gzip, supports ETag revalidation, and only marks assets with the current build query as immutable. HTML always revalidates, enabling updates through existing QR links. Byte-range media playback retains the identity representation. At startup, stale manifest entries are ignored if their identity bytes no longer match, so editing a source output locally cannot silently serve its old compressed counterpart.

Startup reads only the journey count from IndexedDB. Photos and detailed routes are read when opening the journal, and saving no longer reads the whole history twice. The QR decoder stays lazy-loaded; camera, microphone and GPS retain their existing consent-based start flow. Introduction audio remains the previously validated Korean/English recordings.

Validation: 113 automated tests, startup failure recovery, simulated English/Korean continuous conversation, journal count/detail loading, and comparison of decoded WebP character layouts with the original PNG layout. Physical phone rendering and device input are not covered by these checks.

## Rig1: attached hands and a floating ghost silhouette

The original three character images, colors, accessories, facial features and atlas bytes are unchanged. The animated SVG now draws the torso and two arms only; it does not draw the foot cells. Each arm has a fixed shoulder anchor inside the opaque torso, with the arm's texture root at the local rotation origin. Arms and torso share the same floating parent transform, and idle/wave animations rotate only at the shoulders. The torso masks the join. Mori and Bori use mirrored-side atlas cells so the shoulder end meets the body. Bori's snack is parented to the right arm and follows the hand.

A slow vertical float, gentle sideways drift and small body deformation replace the walking-like movement. Lumi, Mori and Bori keep different motion tempos. Arm timing trails the body slightly while the shoulder anchors stay fixed. The existing speaking, listening, thinking and blinking expressions remain, and reduced-motion preferences disable animations.

Validation uses three rendered poses per character from the actual SVG markup, the existing 113-test suite and English/Korean simulated voice sessions. QR outputs, original artwork and the public character links remain unchanged. These checks do not replace a physical-phone animation test.
