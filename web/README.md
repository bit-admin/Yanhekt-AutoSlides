<div align="center">

  <img src="docs/icon.png" width="120" />

  # AutoSlides Web

  **浏览器里的延河课堂客户端｜免安装｜边看边提取幻灯片｜导出 PDF 与云端笔记**

  <p>
    <img src="https://img.shields.io/badge/Cloudflare%20Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare Workers">
    <img src="https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vue.js&logoColor=4FC08D" alt="Vue.js">
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  </p>

  <p>
    <a href="https://learn.ruc.edu.kg">🌐 在线使用</a> •
    <a href="https://learn.ruc.edu.kg/demo/">🎮 在线演示</a> •
    <a href="#-界面导览">🧭 界面导览</a> •
    <a href="../README.md">💻 桌面版</a>
  </p>

</div>

---

> [!CAUTION]
> **Disclaimer**: This tool is intended strictly for personal study; users assume full legal responsibility for ensuring their usage complies with all applicable copyright laws and platform regulations. Terms and Conditions apply.
> <br> **免责声明**：本工具严格仅供个人学习之用；用户须自行承担全部法律责任，确保其使用符合所有适用的版权法及平台规例。受条款及细则约束。
>
> <p align="center"><a href="https://learn.ruc.edu.kg/terms">Read full Terms and Conditions / 按此查阅完整条款及细则</a></p>
>
> This tool is NOT an official application of, and is NOT affiliated with, associated with, endorsed by, or in any way connected to Beijing Institute of Technology (BIT), or any of their subsidiaries or affiliates. All product and company names are trademarks™ or registered® trademarks of their respective holders.
> <br> 本工具**并非**北京理工大学（BIT）的官方应用程式，亦与其或其任何附属机构或关联方无任何关联、联系、获其认可或以任何方式相关。所有产品及公司名称均为其各自持有人的商标™或注册®商标。

## ✨ 这是什么

AutoSlides Web 是 [AutoSlides 桌面版](../README.md)的浏览器版本，运行在 [learn.ruc.edu.kg](https://learn.ruc.edu.kg)。打开网页就能用：浏览与播放延河课堂的直播和录播，一边看一边把幻灯片提取出来，导出 PDF / ZIP，或同步到延河课堂的云端笔记。手机、平板、电脑都可以，不需要安装任何东西。

幻灯片的提取、去重和 AI 过滤全部在你自己的浏览器里完成，提取结果保存在浏览器的本地数据库（IndexedDB）中，不会上传到本站服务器。

> [!NOTE]
> 录播播放需要经由中继服务器完成延河课堂的 URL 签名，本站部署的中继只对校园网开放。校外网络可以正常浏览、搜索、看直播和管理已提取的幻灯片，录播播放会提示当前网络无法访问中继。

静态演示站：[learn.ruc.edu.kg/demo/](https://learn.ruc.edu.kg/demo/)

## 🚀 开始使用

打开 [learn.ruc.edu.kg](https://learn.ruc.edu.kg) 后点击右上角头像进入 `登录` 页。有两种方式：

1. **使用密码登录** — 输入学号与统一身份认证密码。若学校要求短信验证，页面会接着让你输入 6 位验证码。账号密码只用于向学校统一身份认证发起登录，不会被存储。
2. **使用 Token 登录** — 把页面上的按钮拖到浏览器书签栏，在 `yanhekt.cn` 点击该书签，即可把登录状态带回本站。适合密码登录不可用（如需要图形验证码）的情况。

<p align="center">
  <img src="docs/login.png" width="70%" alt="登录页" />
</p>

<br>

## 🧭 界面导览

左侧是导航栏（手机上折叠为底部标签栏）：`主页`、`直播课程`、`录播课程`、`订阅`、`搜索`，以及独立的 `幻灯片` 和 `笔记` 工作区。

### 主页

登录后的落地页：正在直播的课程、你的课程，以及保存过的搜索。点击任意课程卡片即可进入课程或直接开始播放。

<p align="center">
  <img src="docs/home.png" width="70%" alt="主页" />
</p>

<br>

### 直播课程 / 录播课程 / 订阅

`直播课程` 按开播时间列出正在进行、即将开始和已结束的直播；`录播课程` 是全校课程网格，可按学期筛选；`订阅` 是你在延河课堂订阅的课程。三个页面共用同一套课程卡片。

<p align="center">
  <img src="docs/live.png" width="49%" alt="直播课程" />
  <img src="docs/recorded.png" width="49%" alt="录播课程" />
</p>

<p align="center">
  <img src="docs/subscriptions.png" width="70%" alt="订阅" />
</p>

<br>

### 搜索

按课程名、教师或课程号搜索全校课程，可限定学期或搜索全部学期。搜索词可以保存下来，之后在主页一键回到同一份结果。

<p align="center">
  <img src="docs/search.png" width="70%" alt="搜索" />
</p>

<br>

### 课程与节次

进入一门录播课程后，左侧是本学期的全部节次，右侧是课程信息。点击任意节次开始播放。

<p align="center">
  <img src="docs/course.png" width="70%" alt="课程节次列表" />
</p>

<br>

### 播放器

支持 `双流`（同屏播放屏幕录像与摄像机画面）、`屏幕录像`、`摄像机画面` 三种模式，可切换音频来源、调整倍速，并进入影院模式隐藏页面框架。若某条分享链接带有幻灯片时间轴，播放器底部还会出现章节条，点击即可跳转到对应幻灯片。

<p align="center">
  <img src="docs/player.png" width="70%" alt="录播播放器" />
</p>

<p align="center">
  <img src="docs/player-live.png" width="70%" alt="直播播放器" />
</p>

<br>

### 边看边提取幻灯片

播放器下方的提取面板是本站的核心：打开开关后，浏览器会实时比对视频画面（SSIM），把变化的板书或课件保存成图片，右侧条带会即时显示已捕获的幻灯片。整个过程在本地完成，不需要先下载视频。

后处理会自动去掉重复画面；开启 AI 过滤后，模型还会剔除非幻灯片画面，并把「编辑模式」截图单独归入可恢复的回收分类。开启云笔记同步时，通过后处理的幻灯片会自动追加到一条云端笔记里。

<p align="center">
  <img src="docs/player-extract.png" width="70%" alt="幻灯片提取面板" />
</p>

<br>

### 幻灯片工作区

提取结果按课程节次归成一个个相册。左侧是相册列表，右侧是这一节课的全部画面：被后处理移除的也留在原处，只是打上原因标记（`重复`、`AI 过滤 – 编辑模式` 等），随时可以恢复。裁剪过的画面会带 `已裁剪` 角标。

<p align="center">
  <img src="docs/slides.png" width="70%" alt="幻灯片相册" />
</p>

切到 `已移除` 只看被过滤掉的画面，并可按原因进一步筛选——这是复查 AI 有没有误判的地方。

<p align="center">
  <img src="docs/slides-removed.png" width="70%" alt="已移除的画面与原因筛选" />
</p>

点击任意画面放大查看，可在此裁剪或删除；选中若干相册后用右上角 `导出` 一次生成 PDF 或 ZIP。

<p align="center">
  <img src="docs/slides-preview.png" width="70%" alt="放大预览" />
</p>

<br>

### 笔记

延河课堂云端笔记的读写界面：富文本编辑、分组管理、关键词搜索，自动保存。随堂提取的幻灯片会同步到 `随堂笔记`（ASuser）分组，按课程节次各成一条笔记。

<p align="center">
  <img src="docs/notes.png" width="70%" alt="笔记" />
</p>

<br>

### 设置

主题与语言、幻灯片提取的自动后处理、AI 过滤的服务来源（内置 / GitHub Copilot / 自定义），以及云端笔记的托管分组状态。

<p align="center">
  <img src="docs/settings.png" width="45%" alt="设置" />
</p>

<br>

### 应用

介绍 AutoSlides 桌面版并提供各平台安装包下载。桌面版能做的更多：批量下载课程录像、任务队列、本地文件管理与视频压缩。

<p align="center">
  <img src="docs/apps.png" width="70%" alt="应用页" />
</p>

<br>

### 手机端

导航折叠为底部标签栏，播放器、相册与笔记都有独立的移动端布局。

<p align="center">
  <img src="docs/mobile-home.png" width="30%" alt="手机端主页" />
  <img src="docs/mobile-player.png" width="30%" alt="手机端播放器" />
  <img src="docs/mobile-slides.png" width="30%" alt="手机端幻灯片" />
</p>

<br>

## ⚠️ 与桌面版的差异

| | 网页版 | 桌面版 |
|---|---|---|
| 安装 | 不需要 | 需要下载安装包 |
| 幻灯片存放位置 | 浏览器数据库（IndexedDB） | 本地文件夹，可直接用文件管理器打开 |
| 提取方式 | 边看边提取 | 边看边提取 + 任务队列批量处理 |
| 下载课程录像 | 不支持 | 支持，并可自动提取、压缩、按 Emby 规范重命名 |
| 多标签页并行 | 单个播放视图 | 多播放标签页 + 并行任务队列 |
| AI 过滤 | LLM（内置 / Copilot / 自定义） | 另支持本地 ML 分类器 |
| 外部提取器 | 不支持 | 可搭配 AutoSlides Extractor（C++） |
| 雨课堂、网页捕获 | 不支持 | 支持 |

## ❓ 常见问题

**录播打不开，一直转圈或提示网络问题。**
录播需要经过中继服务器签名，而本站的中继只对校园网开放。请连接校园网后重试；直播、搜索和已提取的幻灯片不受影响。

**我的幻灯片存在哪里？换台设备还在吗？**
存在当前浏览器的 IndexedDB 里，不会上传到本站。换设备、换浏览器或清除网站数据都会丢失，重要的结果请及时导出 PDF / ZIP，或同步到云端笔记。

**Safari / iPhone 上能用吗？**
可以。Safari 与 iOS 走系统原生 HLS 播放；受浏览器画布安全策略限制，这条路径上无法逐帧抓取，届时提取面板会给出提示。

**占用空间越来越大怎么办？**
在幻灯片工作区删除不再需要的相册即可，浏览器会随之释放空间。

## 🛠 开发

本目录是一个 Cloudflare Worker：`src/` 是 Hono 编写的 API（延河课堂代理、统一身份认证登录、录播中继策略、分享链接与 AI 转发），`frontend/` 是 Vue 3 + Vite 前端，构建产物 `dist/` 通过 Worker 的 ASSETS 绑定提供。

```sh
npm install
cp wrangler.example.jsonc wrangler.jsonc   # 填入你自己的自定义域名
npm run cf-typegen                         # 生成 worker-configuration.d.ts
npm run build                              # 构建正式站与 /demo/ 演示站 → dist/
npm run dev                                # wrangler dev，serves dist/：localhost:8787
npm run dev:web                            # vite :5173，把 /api 等代理到 :8787（热重载）
npm run demo                               # 只跑演示站（虚构数据，不联网）
npm run screenshots                        # Playwright 驱动演示站重新生成 docs/*.png
npm run typecheck && npm run typecheck:web && npm test
npm run deploy                             # 构建并发布
```

两个开发服务器一起跑是常规工作流：Vite 在 :5173 热重载界面，并把 `/api/*`、`/playlist`、`/segment` 代理到 :8787 上的 Worker。注意本地 `wrangler dev` 不接受未来的 `compatibility_date`。

演示站是同一份前端的第二次构建（`vite.demo.config.ts`）：编译期常量 `__DEMO__` 打开路由的 hash 模式与播放器的占位实现，入口改为 `frontend/src/demo/main.ts`，由它先隔离存储、再接管 `fetch`，然后才加载真正的 `main.ts`。正式构建里 `__DEMO__` 为 `false`，整个 `frontend/src/demo/` 会被摇树移除。截图脚本 `scripts/screenshots.mjs` 需要 ImageMagick（`magick`）用于把 2× 截图缩放回 1×。

三处部署相关的配置：

- `RELAY_PUBLIC_ORIGIN` / `ALLOW_OFFCAMPUS_RELAY` — 决定浏览器是直接连公开中继（默认，本 Worker 的 `/playlist`、`/segment` 返回 403），还是经由 service binding 中转。`GET /api/config` 把结果连同来访者的 ASN 一起告诉前端。
- `SSO_RESUME_KEY` — Worker 用来加密短信验证过程中那份「未完成的登录状态」的随机字符串（`openssl rand -base64 32` 自行生成），并非任何机构颁发的凭据。留空也能部署，只是需要短信验证的账号会被引导去用 Token 登录。
- `AI_ORIGIN` 与 `services`（`RELAY`、`SHARE`）— 未配置时对应路由返回 503。

`wrangler.jsonc` 已 gitignore，请从 `wrangler.example.jsonc` 复制一份再填写。录播中继的更多说明见 [`../relay/README.md`](../relay/README.md)。

---

<div align="center">
<p>Copyright © 2026 bit-admin.</p>
<p>
<a href="https://github.com/bit-admin/Yanhekt-AutoSlides">GitHub</a> •
<a href="mailto:info@ruc.edu.kg">Email</a> •
<a href="https://it.ruc.edu.kg/docs">Docs</a>
</p>
</div>
