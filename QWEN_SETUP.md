# 千问对话与摄像头观察

## 服务器配置

Railway → `velo-soul-demo` 服务 → **Variables**，设置以下变量并重新部署。真实密钥不要提交到 GitHub 或发到聊天中。

| 变量 | 值 |
| --- | --- |
| `DASHSCOPE_API_KEY` | 阿里云百炼 / Model Studio 密钥 |
| `QWEN_BASE_URL` | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` |
| `QWEN_MODEL` | `qwen-plus`（文字对话） |
| `QWEN_VISION_MODEL` | `qwen3-vl-plus`（图像理解） |
| `QWEN_MAX_DAILY_REQUESTS` | `200`，可以调低 |

默认使用新加坡端点，密钥和模型权限必须匹配地域。如果控制台提供工作空间专用地址，可使用其以 `/compatible-mode/v1` 结尾的 OpenAI 兼容地址。本地可复制 `.env.example` 为 `.env` 填写；`.env` 被 Git 和 Docker 排除，服务启动时读取。

[官方兼容接口与端点](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope)、[获取密钥](https://help.aliyun.com/zh/model-studio/get-api-key)、[视觉模型 JSON 输出](https://www.alibabacloud.com/help/en/model-studio/qwen-structured-output)。

## 体验与验收

如果实际调用返回 `403 AccessDenied.Unpurchased`，需要先在新加坡地域完成账号资料及 Model Studio 服务开通。创建 API Key 本身不代表模型服务已开通。网站会显示对应提示，不将此错误当成密钥格式错误。[官方错误说明](https://www.alibabacloud.com/help/en/model-studio/error-code)。

1. `/api/chat/status` 的 `configured: true` 表示服务器发现密钥且地址格式有效；不证明密钥拥有额度或模型权限。
2. 分别打开三个角色 →「和灵魂对话」。英语、韩语、中文均可输入，中文暂用英语回复和朗读，保留中文输入原文。文字自动判断；聊天弹窗点击麦克风，自动识别中英韩，开启后会连续自动发送和朗读；不需逐句点击。
3. 进入相机并允许权限，会自动播放角色出场动画。点击「开启 AI 观察」才会发送分析用画面。
4. 观察开启后，每次分析完成约 20 秒后再次取图，最长边 640 像素。仅发送原始相机帧，不将 AR 角色叠加到分析图中。露米关注车色和形状，莫里关注树木和水景，波里关注咖啡馆或食物招牌。画面不清晰时可以保持安静；发话至少间隔 45 秒，同类场景 3 分钟内不重复。
5. 关闭相机、停止观察、离开页面或隐藏标签页会停止取图并取消未完成请求。聊天或其他语音播放期间暂缓分析。动态台词可点击重播；设备无英语／韩语 TTS 时以字幕为准。
6. 开始骑行并允许 GPS 后，进入大林仓库咖啡馆、景福宫／光化门或首尔林的目录范围，准确定位并停留 5 秒后触发地点对话。地点模拟按钮用于异地演示，不改变真实定位或轨迹。

## 数据与实现边界

文字聊天发送最近五轮对话；地点事件只发送地点 ID，由服务器选择目录资料，不发送原始 GPS。AI 观察会发送缩小的相机图片，经本站服务器传给 Qwen，本站不保存分析图或请求正文。仅手动拍摄的旅程照片保存在本机。语音片段经本站发送给 Qwen ASR 识别；本站不保存录音文件。

API Key 仅在服务端使用。`/api/chat` 与 `/api/vision` 共用调用限额。没有 Key 时聊天和视觉观察明确提示未配置，不把模拟台词冒充模型回复。地点触发仍可使用标注为预设的备用台词。

视觉理解可能误判，不是逐帧实时追踪，也不能确认店铺营业、气味、天气、道路通行或位置。实际地点触发只覆盖目录中的 3 处；GPS 天气服务已接入 Open-Meteo；所有咖啡馆搜索、路线导航和附近自行车邀约未接入。

## 三个 Skill

服务器读取 `skills/velo-lumi/SKILL.md`、`skills/velo-mori/SKILL.md`、`skills/velo-bori/SKILL.md`。同一套文件用于文字、地点和相机请求，规定性格、语言、可见证据和用户需求优先；只有明确提供图像的请求允许基于画面回答。修改后重新部署生效。

## 使用量与验证

默认每个进程并发 3、每分钟 20 次、每 UTC 日 200 次，文字及图像合计，失败的上游调用也计数。进程重启清零，多副本不共享。**这是演示用请求数上限，不是阿里云账单硬上限。** 可用免费额度与收费以控制台模型、地域及账号资格为准；只想使用免费额度时，在支持的模型上开启阿里云「仅使用免费额度」。[官方免费额度说明](https://www.alibabacloud.com/help/en/model-studio/new-free-quota)。

自动测试使用明确的模拟上游，覆盖请求、角色、语言、图片校验、停止与取消、场景防重复、GPS、配额和错误处理。真实模型、手机摄像头、语音识别、室外 GPS 和动画观感需配置密钥并在实机上验证。


## 2026-10-17：全屏相机与连续语音

角色页点击「开启实时陪伴」，依次允许 GPS、相机、麦克风。进入相机即铺满网页视口；底部中央圆形按钮拍摄，照片保存在当前旅程中，仍需结束旅程后保存记录。浏览器地址栏是否隐藏由手机系统控制。

连续语音模式：自动识别中英韩，说完自动发送给千问，回复自动朗读，结束后继续听。普通转写在播报时暂停，但会保留打断指令监听；中文说「等一下」、英语说「stop」、韩语说「잠깐」，可中止当前播报，接着提问。可说「停止对话 / stop listening / 대화 멈춰」结束。打断识别失败或浏览器不支持时会显示状态，不保证在扬声器回声或嘈杂环境中识别成功。

语音和手动聊天均可结合 30 秒内的有效定位（精度不超过 60 米）与 AI 观察开启时的一张相机画面。坐标留在本机；模型仅收到目录地点 ID 对应的资料、估算距离、精度及速度。目录外不会虚构当前位置地址。相机对话走 `/api/chat/scene`，由 `qwen3-vl-plus` 生成自然对话；纯文字或位置对话仍用 `qwen-plus`。自动相机观察继续使用 `/api/vision`。

手动聊天可关闭「结合已开启的 GPS 和相机」及「自动朗读回复」。连续语音使用已开启的传感器，关闭相机/定位后后续请求不再携带对应信息。

这是网页前台的轮流语音对话与关键词打断，不是完整的流式双工音频通话。麦克风录音经本站发送给 Qwen ASR；动态播报使用 Qwen TTS 合成音频。浏览器支持不一致，退出网页、锁屏或切到后台会停止监听和传感器；支持时会请求屏幕常亮。


## GitHub 实时语音方案参考（2026-10-17）

本轮查阅了项目 README、相关实现和官方文档。这些项目仅作为参考，当前部署未引入下列依赖；现有方案是麦克风分段 → Qwen ASR → Qwen 回复 → Qwen TTS 音频播放，播报期间保留关键词监听，不是全双工音频流。

| 方案 | 可借鉴内容 | 对 VELO SOUL 的判断 |
| --- | --- | --- |
| [ricky0123/vad](https://github.com/ricky0123/vad) | 浏览器 Silero VAD，onSpeechStart / onSpeechEnd；默认音频流请求回声消除与降噪 | 最适合先做小范围验证：检测到用户开口即停止播放。它只判断有没有人声，不负责听懂内容，也不保证区分用户、旁人或扬声器回声。 |
| [livekit/agents](https://github.com/livekit/agents) | WebRTC、对话轮次、打断、被打断后的历史截断；有 Node.js 版本和网页客户端 | 更完整的后续架构，需要接入媒体服务及流式语音链路；当前 Railway 网页不能仅换一个函数就获得这些能力。 |
| [QwenLM/Qwen-Live-Harness](https://github.com/QwenLM/Qwen-Live-Harness) | 千问官方实时音视频接入、semantic_vad、interrupt_response、响应取消及过期事件处理 | 优先参考其千问协议和状态管理。完整应用当前面向 macOS 桌面，不能直接当手机网页使用；需另行验证新加坡密钥的实时模型权限与韩语能力。 |
| [pipecat-ai/pipecat](https://github.com/pipecat-ai/pipecat) | Python 语音/视觉管线、WebRTC 和多服务组合 | 适合后续复杂相机/GPS主动对话，但相对现有 Node 项目迁移量更大。 |

建议：保留当前可用的关键词打断演示；下一步先做浏览器 VAD + 回声消除的小实验，再评估千问 Realtime 音频链路。若需要更完整的媒体连接和轮次控制，再评估 LiveKit。自然打断仍需要开启麦克风检测；完全关闭麦克风后，只能通过按钮等非语音方式打断。

实现时同时处理停止播放、取消未完成响应、丢弃旧回调、保留新问题，并校正对话历史，避免模型误以为用户已听到被打断的整段回答。当前演示只完成关键词打断及旧回调隔离，尚未实现精确的已播放文本截断。先在手机外放、耳机、风噪环境分别验证，不能以桌面模拟测试替代骑行实测。

代码与文档定位：
- [VAD 浏览器音频约束](https://github.com/ricky0123/vad/blob/2e5aca93e3902f04ff5b7eb4a9633926cdca9cf6/docs/user-guide/browser.md)
- [LiveKit 轮次与打断](https://docs.livekit.io/agents/logic/turns/)
- [千问 Realtime 会话实现](https://github.com/QwenLM/Qwen-Live-Harness/blob/b2d17b8706b226ff7792683ecd8f050f18f9752e/packages/qwen-live-harness/src/realtime/realtime-session.ts)

## 直接麦克风识别（voice6）

新增 `QWEN_ASR_MODEL=qwen3-asr-flash`，有默认值，无需新密钥。沿用同一 `DASHSCOPE_API_KEY` 与新加坡兼容端点。已用现有账号和项目预制语音验证该模型返回识别文字。

`POST /api/transcribe` 接收 `{audio: "data:audio/wav;base64,..."}`，仅允许最长约 15 秒的 16 kHz 单声道 PCM。ASR 与聊天、视觉共享每日/每分钟并发限制；一次对话至少包含 ASR 和聊天两次请求，模型费用分别计入账号。

手机打开相机语音入口后，看麦克风音量条，说完停顿约一秒。字幕应依次显示「收到声音／正在识别」和回答。8 秒没有人声会显示检查输入设备的提示；12 秒未取得真实采样会停止启动，避免虚假的 Listening。原二维码继续使用。

官方接口：[Qwen 录音识别与 Base64 输入](https://www.alibabacloud.com/help/en/model-studio/non-realtime-speech-recognition-user-guide)。当前使用短片段请求，并非 Qwen Realtime 流式连接。

## 云端朗读与持续会话（voice7）

新增可选变量 `QWEN_TTS_MODEL=qwen3-tts-flash`，默认已经生效，沿用现有密钥。`POST /api/speech` 接收 `{soul,language,text}`，服务器生成并代理 WAV，不把密钥或带签名的音频网址交给浏览器。合成文本单次不超过 600 字符，音频最多 4 MB；仅下载 Qwen 返回的指定 OSS 域名，禁止重定向并不转发 API 授权头。

用户只需点击一次「开始交流」。相机和聊天窗口都自动完成识别、发送、语音回复及下一轮。第一次点击会解锁 Web Audio；若设备拦截声音，会保留会话并显示「开启声音」恢复按钮。短暂识别网络错误自动重连，明确的权限和额度错误不无限重试。

服务端请求限制包含 TTS，完整一轮一般为 ASR、聊天和 TTS 三次请求。固定欢迎音频和本机声音检测不调用 API。

接口依据：[Qwen-TTS API](https://www.alibabacloud.com/help/en/model-studio/qwen-tts-api)。已实际验证三种音色，其中 Mori 的韩语语音返回非静音 WAV。

## 韩语偏好与流式播报（voice8）

无需新增密钥或模型。/api/transcribe 接受 language:ko/en/zh/auto；Auto 省略上游语种限定，其他选项传给 asr_options.language。选择韩语会同步相机和聊天偏好，回答和 TTS 的 language_type 使用 Korean。中文回答仍为英语。

新增 /api/speech/stream，使用原生 TTS 请求头 X-DashScope-SSE:enable。后端仅返回 application/x-ndjson 的 {audio:base64,rate:24000} 与 {done:true}，不透传提供商 URL、错误细节或密钥。PCM、WAV 头、总长度、超时、来源和共享预算均有校验；客户中断会取消上游。播放收到第一段即开始，结束标记和最后一段播放完毕后才恢复收音。

语言选择依据：[Qwen-ASR API](https://www.alibabacloud.com/help/en/model-studio/qwen-asr-api-reference)。流式合成依据：[Qwen-TTS API](https://www.alibabacloud.com/help/en/model-studio/qwen-tts-api)。当前仍是短语 ASR 加轮流对话；只把音频输出改为流式，不声称已实现全双工电话。

## GPS 自动天气陪伴（2026-10-18 / weather3）

进入「实时陪伴」或「相机＋语音陪伴」并允许 GPS 后，自动调用本站 POST /api/weather 获取所在地天气，无需点天气按钮。首次取得天气后，等对话空闲至少两秒，以当前英语或韩语做一次天气开场寒暄；正在说话或回答时延后。随后只主动补充天气风险提醒，不定时重复普通天气闲聊。开启一次后持续运行，直到暂停陪伴、关闭 GPS 或页面转入后台。天气卡片可单独关闭自动播报。

天气来自 Open-Meteo，按约 2 公里网格查询，每五分钟刷新，换网格可提前查询（至少间隔一分钟），失败一分钟后重试。精确坐标保留在设备；近似网格会发送给本站和 Open-Meteo，后端仅作内存缓存。聊天只携带天气引用 ID，由服务器补入当前可信天气；不接受浏览器自填的晴雨资料。天气获取独立于千问聊天额度，动态语音仍消耗 Qwen TTS 额度。

Lumi 留意天气中的小发现；Mori 关心舒适节奏；Bori 联系安全休息时的点心。下雨、下雪、雷雨、近期降水、低温伴随降水或未来两小时可能降水时，主动给一句注意提醒。同类提醒至少间隔 30 分钟，普通天气闲聊只在本次陪伴开场说一次；通常不同提醒也间隔两分钟，风险加重可提前。天气服务失败、定位不可靠或资料过期时不编造天气。

冰滑判断是推测：冻雨，或气温不高于 2°C 且当前/近期有降水，提示「可能结冰」，不把低温干燥等同于结冰。模型估计不等于实际路面检测，也不是官方预警。地点推荐仍只覆盖既有首尔目录；没有接入所有咖啡馆搜索或路线规划。

[Open-Meteo 文档](https://open-meteo.com/en/docs) · [使用条款](https://open-meteo.com/en/terms) · [CC BY 4.0 数据许可](https://open-meteo.com/en/licence)。当前使用适合教育/研究原型的免费非商业接口，无新增密钥；若改作商业服务需按提供方条款更换方案。天气卡片注明来源、模型估计和 VELO SOUL 摘要。

预报提醒：检查未来两小时的逐小时数据，对约一小时内和两小时内的可能降雨、降雪、雷雨或冻雨分别说明。新预报在开场之后仍会自动提醒；风险临近可更新提醒，但不反复读相同预报。小时预报只表示一个时间窗口，不声称确定的降雨开始时刻。

## 低延迟与角色表情（20261018-voice9）

语音短句默认改用 qwen-flash；可选环境变量 QWEN_VOICE_MODEL=qwen-plus 可切回。文字聊天和看相机画面仍分别使用原来的 QWEN_MODEL 和 QWEN_VISION_MODEL，不需要新密钥。语音请求关闭思考，要求先说一句简短完整的话。停顿判定从650毫秒改为450毫秒；没有更改录音长度限制、来源校验和共享额度。

六段韩英自我介绍随网站发布，进入角色页面预载，麦克风就绪后直接播放，不再请求千问生成固定开场。介绍播放时后台准备天气音频，介绍后在空闲时播报。新名字不会在天气寒暄中重复，定位失败时仍可正常聊天。动态回答继续流式播放第一段音频。

短句模型对照测试与三阶段测试位于交付验证记录。测试使用同一段合成韩语录音交替调用旧/新模型，不能代表所有手机、网络、问题长度的耗时，也不保证零延迟。实时识别 WebSocket 另做了对照，未显示稳定速度优势，因此保留原识别接口。

录音不落盘、API Key仅在服务器保存、中文输入改用英语回答等设置不变。相机仍为屏幕空间2D角色叠加。表情显示聆听、思考、说话状态，不推断用户真实情绪。
