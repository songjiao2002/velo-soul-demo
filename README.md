# VELO SOUL

自行车人格化／数字骑行伙伴 demo。多语言演示版：相机初遇＋声音陪伴＋旅程日记：

- 루미 / Lumi：蓝色，好奇型，BK-024
- 모리 / Mori：薄荷绿，悠闲型，BK-017
- 보리 / Bori：橙色，吃货型，BK-036

流程：角色邀请 → 三色 QR／网页摄像头扫码 → 真实相机与角色登场动画 → 英语／韩语声音陪伴 → 可选 GPS 与照片 → 保存和导出旅程日记。

「开启实时陪伴」一次进入全屏相机并请求定位、相机及麦克风权限。底部中央圆形快门拍摄；连续语音说完自动发送、自动朗读并继续聆听。回答期间普通转写暂停，保留「等一下 / stop / 잠깐」关键词打断监听。GPS 与相机开启后可一同用于回复；中文仍用英语回答。手动聊天可选择是否附带传感器信息及自动朗读。

连续对话是网页前台的轮流语音与关键词打断，并非流式双工音频通话。语音识别依赖浏览器支持及其识别服务，锁屏、后台和嘈杂环境仍需手机验证。

## 运行与部署

Node.js 22 及以上：`npm start`。无需安装依赖。固定台词体验无需密钥；Qwen 对话和 AI 摄像头观察需要服务器配置 API Key，见 [QWEN_SETUP.md](QWEN_SETUP.md)。

Railway 从本仓库 main 分支自动部署，自动识别根目录 Dockerfile，启动命令由 Dockerfile 提供。服务监听 `0.0.0.0:$PORT`。在服务 Settings → Deploy 设置 Healthcheck Path 为 `/healthz`，在 Networking 中生成公开域名。当前新服务不依赖已弃用的 railway.json 配置方式。

公开演示：https://velo-soul-demo-production.up.railway.app/

三个入口为 `/?bike=lumi`、`/?bike=mori`、`/?bike=bori`。`/qr-lumi.svg`、`/qr-mori.svg`、`/qr-bori.svg` 由服务器按当前域名生成，可直接下载和打印。优先使用 `PUBLIC_BASE_URL`、其次 `RAILWAY_PUBLIC_DOMAIN`，否则使用请求地址。因此迁移后需从新站下载二维码；以前打印的二维码仍指向原站。

## 数据与演示范围

进入相机时请求真实摄像头权限，后置摄像头优先；开启语音对话时请求麦克风。GPS 记录轨迹和浏览器提供的速度，误差过大的点不记入。照片由用户手动拍摄，最多 4 张。手动保存的旅程照片与轨迹不上传服务器；开启 AI 观察后，分析用缩小相机图会经本站传给 Qwen，本站不保存分析图。对话可附带当前画面及近期定位匹配的目录地点、距离与速度，不发送精确 GPS 坐标。旅程数据保存在当前浏览器 IndexedDB，旧版 localStorage 文字卡片会迁入。切换域名或清除浏览器数据后记录不会跟随。

15 段预制韩语音频随网页提供；新增情景用设备韩语 TTS（无韩语声音时明确显示字幕模式）。相机可通过自选 AI 观察开关分析真实画面；GPS 可触发收录的 3 处首尔地点。实时天气、所有周边咖啡店/餐厅搜索及附近自行车邀约仍是情景模拟。AR 是 2D 屏幕叠加，不含空间追踪。标签页隐藏、页面离开或结束体验时关闭相机/GPS。浏览器不提供后台持续记录。

界面与研究设计说明见 PROTOTYPE.ko.md。无需用户账户。AI 功能由服务端管理密钥。

`npm test` 检查服务和新模块、二维码解码、音频分段请求、相机授权/释放/竞态、GPS 过滤以及浏览器原生 API 的调用对象。Windows 限制子进程环境下使用 `node --test --test-isolation=none server.test.mjs final.test.mjs language.test.mjs audio.test.mjs chat.test.mjs places.test.mjs vision.test.mjs connected.test.mjs hands-free.test.mjs browser-api.test.mjs`。

页面先直接显示三个角色和二维码，再加载单个 `public/app.bundle.js`。二维码识别库只在打开扫描页后下载；图片异步解码，首页下方角色图片延后加载。启动失败会显示重试入口和错误详情。语音和观察模块的默认计时器、网络函数通过 `globalThis` 调用，避免浏览器出现 `Illegal invocation`。

修改前端源文件后运行 `npm ci`、`npm run build`，将更新的 `public/app.bundle.js` 一并提交。Railway 镜像直接运行已构建的文件，不需要在启动时安装构建工具。

## 来源

页面和素材来自 2026-10-09 的 VELO SOUL 原型，未包含味觉项目内容。`vendor/qrcode.mjs` 来自 qrcode-generator 2.0.4（Kazuhiko Arase，MIT；保留原作者声明）。

二维码解码使用 jsQR 1.4.0（Apache-2.0），完整许可证保留于 public/vendor/LICENSE-jsQR.txt。

## 界面与语音语言

右上角「界面」提供 English / 한국어 / 中文，「语音」只提供 English / 한국어，两个选择独立保存在浏览器。切换界面不重新建立页面、重启相机或清空正在填写的日记；用户自己的文字不翻译。

英语首访默认启用；后续尊重用户保存的语音选择。19 段固定英语 WAV 随网站提供，不依赖设备安装的英语音源。露米：美式 Alayna（1.0 倍速），莫里：英式 Robert（0.9 倍速），波里：美式 Matthew（1.05 倍速），均保留默认音高。西海岸是露米的措辞与表达方向，不声称精确地区口音。配音通过 TTSMaker 生成，台词和音源信息见 public/audio/en/transcripts.json。音频授权说明：https://ttsmaker.com/copyright_and_commercial_license_terms/en 。

点击「试听」、角色见面按钮或「听我打招呼」即可播放。二维码直接打开角色页时需点击一次播放按钮，以满足手机浏览器的音频播放要求。只有收到实际播放事件才显示播放中；加载失败、超时、浏览器拦截都会显示可重试提示。韩语基本台词继续使用 15 个 MP3，额外韩语情景依赖设备韩语音源；中文可用于界面和对话输入，中文对话暂用英语回复、英语 TTS 朗读。

固定台词继续保留；新增 Qwen 对话、图像理解与三种角色 Skill。动态台词使用设备 TTS，预制 WAV/MP3 保持原有播放方式。自动检查覆盖 19 个英语音频的完整性、非静音数据、播放取消、浏览器拦截后重试，以及 WAV 分段请求。具体语调是否符合性格仍需手机试听反馈。
