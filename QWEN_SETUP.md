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
2. 分别打开三个角色 →「和灵魂对话」。英语、韩语、中文均可输入，中文暂用英语回复和朗读，保留中文输入原文。文字自动判断；语音识别先选择输入语言，再点麦克风，检查识别结果并发送。不支持浏览器语音识别时可以打字。
3. 进入相机并允许权限，会自动播放角色出场动画。点击「开启 AI 观察」才会发送分析用画面。
4. 观察开启后，每次分析完成约 20 秒后再次取图，最长边 640 像素。仅发送原始相机帧，不将 AR 角色叠加到分析图中。露米关注车色和形状，莫里关注树木和水景，波里关注咖啡馆或食物招牌。画面不清晰时可以保持安静；发话至少间隔 45 秒，同类场景 3 分钟内不重复。
5. 关闭相机、停止观察、离开页面或隐藏标签页会停止取图并取消未完成请求。聊天或其他语音播放期间暂缓分析。动态台词可点击重播；设备无英语／韩语 TTS 时以字幕为准。
6. 开始骑行并允许 GPS 后，进入大林仓库咖啡馆、景福宫／光化门或首尔林的目录范围，准确定位并停留 5 秒后触发地点对话。地点模拟按钮用于异地演示，不改变真实定位或轨迹。

## 数据与实现边界

文字聊天发送最近五轮对话；地点事件只发送地点 ID，由服务器选择目录资料，不发送原始 GPS。AI 观察会发送缩小的相机图片，经本站服务器传给 Qwen，本站不保存分析图或请求正文。仅手动拍摄的旅程照片保存在本机。浏览器语音识别可能由浏览器提供商处理。

API Key 仅在服务端使用。`/api/chat` 与 `/api/vision` 共用调用限额。没有 Key 时聊天和视觉观察明确提示未配置，不把模拟台词冒充模型回复。地点触发仍可使用标注为预设的备用台词。

视觉理解可能误判，不是逐帧实时追踪，也不能确认店铺营业、气味、天气、道路通行或位置。实际地点触发只覆盖目录中的 3 处；所有咖啡馆搜索、天气服务、路线导航和附近自行车邀约未接入。

## 三个 Skill

服务器读取 `skills/velo-lumi/SKILL.md`、`skills/velo-mori/SKILL.md`、`skills/velo-bori/SKILL.md`。同一套文件用于文字、地点和相机请求，规定性格、语言、可见证据和用户需求优先；只有明确提供图像的请求允许基于画面回答。修改后重新部署生效。

## 使用量与验证

默认每个进程并发 3、每分钟 20 次、每 UTC 日 200 次，文字及图像合计，失败的上游调用也计数。进程重启清零，多副本不共享。**这是演示用请求数上限，不是阿里云账单硬上限。** 可用免费额度与收费以控制台模型、地域及账号资格为准；只想使用免费额度时，在支持的模型上开启阿里云「仅使用免费额度」。[官方免费额度说明](https://www.alibabacloud.com/help/en/model-studio/new-free-quota)。

自动测试使用明确的模拟上游，覆盖请求、角色、语言、图片校验、停止与取消、场景防重复、GPS、配额和错误处理。真实模型、手机摄像头、语音识别、室外 GPS 和动画观感需配置密钥并在实机上验证。
