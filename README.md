# VELO SOUL

自行车人格化／数字骑行伙伴 demo。韩语最终演示版：相机初遇＋声音陪伴＋旅程日记：

- 루미 / Lumi：蓝色，好奇型，BK-024
- 모리 / Mori：薄荷绿，悠闲型，BK-017
- 보리 / Bori：橙色，吃货型，BK-036

流程：角色邀请 → 三色 QR／网页摄像头扫码 → 真实相机与角色登场动画 → 韩语声音陪伴 → 可选 GPS 与照片 → 保存和导出旅程日记。

## 运行与部署

Node.js 22 及以上：`npm start`。无需安装依赖，无需 API 密钥。

Railway 从本仓库 main 分支自动部署，自动识别根目录 Dockerfile，启动命令由 Dockerfile 提供。服务监听 `0.0.0.0:$PORT`。在服务 Settings → Deploy 设置 Healthcheck Path 为 `/healthz`，在 Networking 中生成公开域名。当前新服务不依赖已弃用的 railway.json 配置方式。

公开演示：https://velo-soul-demo-production.up.railway.app/

三个入口为 `/?bike=lumi`、`/?bike=mori`、`/?bike=bori`。`/qr-lumi.svg`、`/qr-mori.svg`、`/qr-bori.svg` 由服务器按当前域名生成，可直接下载和打印。优先使用 `PUBLIC_BASE_URL`、其次 `RAILWAY_PUBLIC_DOMAIN`，否则使用请求地址。因此迁移后需从新站下载二维码；以前打印的二维码仍指向原站。

## 数据与演示范围

点击「카메라 켜기」后请求真实摄像头权限，后置摄像头优先，不请求麦克风。可选 GPS 记录轨迹和浏览器提供的速度；误差过大的点不记入。照片由用户手动拍摄，最多 4 张。照片与轨迹不上传服务器，保存在当前浏览器 IndexedDB，旧版 localStorage 文字卡片会迁入。切换域名或清除浏览器数据后记录不会跟随。

15 段预制韩语音频随网页提供；新增情景用设备韩语 TTS（无韩语声音时明确显示字幕模式）。相机识物、实时天气、附近咖啡店/餐厅和附近自行车邀约仍是明确标注的情景模拟。AR 是 2D 屏幕叠加，不含空间追踪。标签页隐藏、页面离开或结束体验时关闭相机/GPS。浏览器不提供后台持续记录。

界面与研究设计说明见 PROTOTYPE.ko.md。无需账户和 API 密钥。

`npm test` 检查服务和新模块、二维码解码、音频分段请求、相机授权/释放/竞态、GPS 过滤。Windows 限制子进程环境下使用 `node --test --test-isolation=none server.test.mjs final.test.mjs`。

## 来源

页面和素材来自 2026-10-09 的 VELO SOUL 原型，未包含味觉项目内容。`vendor/qrcode.mjs` 来自 qrcode-generator 2.0.4（Kazuhiko Arase，MIT；保留原作者声明）。

二维码解码使用 jsQR 1.4.0（Apache-2.0），完整许可证保留于 public/vendor/LICENSE-jsQR.txt。
