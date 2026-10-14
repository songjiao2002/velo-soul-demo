# VELO SOUL

自行车人格化／数字骑行伙伴 demo。保留此前的韩语「声音陪伴＋旅程卡片」版本：

- 루미 / Lumi：蓝色，好奇型，BK-024
- 모리 / Mori：薄荷绿，悠闲型，BK-017
- 보리 / Bori：橙色，吃货型，BK-036

流程：角色邀请 → QR 相遇 → 韩语声音陪伴／安静同行 → 保存和导出旅程卡片。

## 运行与部署

Node.js 22 及以上：`npm start`。无需安装依赖，无需 API 密钥。

Railway 从本仓库 main 分支自动部署，自动识别根目录 Dockerfile，启动命令由 Dockerfile 提供。服务监听 `0.0.0.0:$PORT`。在服务 Settings → Deploy 设置 Healthcheck Path 为 `/healthz`，在 Networking 中生成公开域名。当前新服务不依赖已弃用的 railway.json 配置方式。

公开演示：https://velo-soul-demo-production.up.railway.app/

三个入口为 `/?bike=lumi`、`/?bike=mori`、`/?bike=bori`。`/qr-lumi.svg`、`/qr-mori.svg`、`/qr-bori.svg` 由服务器按当前域名生成，可直接下载和打印。优先使用 `PUBLIC_BASE_URL`、其次 `RAILWAY_PUBLIC_DOMAIN`，否则使用请求地址。因此迁移后需从新站下载二维码；以前打印的二维码仍指向原站。

## 数据与演示范围

15 段预制韩语音频随网页提供；没有实时 AI、GPS、周边识别或真实租车。旅程只保存在当前浏览器的 localStorage，切换域名后不会自动迁移旧记录。

`npm test` 检查健康状态、静态资源、角色二维码、音频分段请求及服务器文件隔离。

## 来源

页面和素材来自 2026-10-09 的 VELO SOUL 原型，未包含味觉项目内容。`vendor/qrcode.mjs` 来自 qrcode-generator 2.0.4（Kazuhiko Arase，MIT；保留原作者声明）。

