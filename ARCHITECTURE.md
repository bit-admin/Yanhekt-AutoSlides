# AutoSlides 架构文档

> 本文档是 AutoSlides 项目的完整架构参考，涵盖进程模型、模块依赖、IPC 通信、渲染器分层、状态管理、流水线设计、构建系统与编码规范。

---

## 目录

1. [项目概览](#1-项目概览)
2. [技术栈](#2-技术栈)
3. [进程架构](#3-进程架构)
4. [目录结构](#4-目录结构)
5. [路径别名](#5-路径别名)
6. [主进程架构](#6-主进程架构)
   - 6.1 [领域划分](#61-领域划分)
   - 6.2 [IPC 处理器注册](#62-ipc-处理器注册)
   - 6.3 [IPC 依赖注入](#63-ipc-依赖注入)
   - 6.4 [服务实例化](#64-服务实例化)
   - 6.5 [窗口管理](#65-窗口管理)
7. [Preload 架构](#7-preload-架构)
8. [渲染器架构](#8-渲染器架构)
   - 8.1 [三个渲染入口](#81-三个渲染入口)
   - 8.2 [Feature 领域层](#82-feature-领域层)
   - 8.3 [Shared 基础设施层](#83-shared-基础设施层)
   - 8.4 [Component 组件层](#84-component-组件层)
   - 8.5 [响应式配置仓库](#85-响应式配置仓库)
9. [状态机与编排](#9-状态机与编排)
   - 9.1 [提取状态机 (Chain A)](#91-提取状态机-chain-a)
   - 9.2 [任务状态机 (Chain B)](#92-任务状态机-chain-b)
   - 9.3 [任务协调器](#93-任务协调器)
   - 9.4 [提取编排器](#94-提取编排器)
10. [流水线架构](#10-流水线架构)
    - 10.1 [幻灯片提取流水线 (Stage 1)](#101-幻灯片提取流水线-stage-1)
    - 10.2 [后处理流水线 (Stage 2)](#102-后处理流水线-stage-2)
    - 10.3 [自动裁剪流水线 (Stage 3)](#103-自动裁剪流水线-stage-3)
11. [Web Worker 架构](#11-web-worker-架构)
12. [视频代理系统](#12-视频代理系统)
13. [下载与提取队列](#13-下载与提取队列)
14. [AI 分类系统](#14-ai-分类系统)
15. [配置管理系统](#15-配置管理系统)
16. [共享工具模块](#16-共享工具模块)
17. [UI 架构](#17-ui-架构)
    - 17.1 [三面板布局](#171-三面板布局)
    - 17.2 [CSS 主题系统](#172-css-主题系统)
    - 17.3 [Z-index 层级](#173-z-index-层级)
    - 17.4 [共享样式类](#174-共享样式类)
18. [国际化](#18-国际化)
19. [构建系统](#19-构建系统)
    - 19.1 [Electron Forge + Vite](#191-electron-forge--vite)
    - 19.2 [Vite 配置](#192-vite-配置)
    - 19.3 [打包与分发](#193-打包与分发)
    - 19.4 [原生模块处理](#194-原生模块处理)
20. [依赖规则](#20-依赖规则)
    - 20.1 [主进程依赖图](#201-主进程依赖图)
    - 20.2 [渲染器依赖图](#202-渲染器依赖图)
    - 20.3 [ESLint 边界强制](#203-eslint-边界强制)
21. [IPC 通信全景](#21-ipc-通信全景)
22. [开发命令](#22-开发命令)
23. [验证步骤](#23-验证步骤)
24. [图像分析设计](#24-图像分析设计)
    - 24.1 [在线幻灯片检测](#241-在线幻灯片检测)
    - 24.2 [pHash 去重与排除](#242-phash-去重与排除)
    - 24.3 [AI / ML 语义过滤](#243-ai--ml-语义过滤)
    - 24.4 [自动裁剪](#244-自动裁剪)

---

## 1. 项目概览

AutoSlides 是一个基于 Electron 的教育视频流媒体与幻灯片自动提取工具。它支持直播流和录播视频的播放，并能自动捕获课程幻灯片。核心功能包括：

- **双模式操作**：直播（Live）和录播（Recorded）模式完全独立，可同时运行
- **多标签播放 + 并行任务**：信息标签 + N 个并发播放标签；任务队列最多运行 `parallelTasks` 个并行提取
- **首页与搜索**：Apple Music 风格首页（已保存搜索卡片 + 缩略图预览）+ 多学期搜索页
- **SSIM 幻灯片提取**：基于 Web Worker 的 SSIM 图像比较算法
- **M3U8 流下载**：并发下载 M3U8 直播/录播流，通过 FFmpeg 处理
- **任务队列**：自动化批量幻灯片提取
- **AI 过滤**：可选的 AI 幻灯片分类（LLM / ML 两种模式）
- **自动裁剪**：OpenCV.js Canny 边缘检测 + YOLOv8 ONNX 推理
- **Qt 提取器集成**：可选的外部 C++ 提取器 CLI
- **PDF 导出**：从选定文件夹生成可配置压缩的 PDF
- **结果视图**：文件夹优先的提取/移除幻灯片审查
- **引导与演示模式**：首次启动引导流程（`OnboardingModal`）；`npm run demo` 启动纯虚构 UI 用于截图
- **国际化**：中、英、日、韩四种语言

---

## 2. 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Electron 35+ |
| 前端 | Vue 3 (Composition API) + TypeScript |
| 构建 | Vite + Electron Forge |
| 状态管理 | Vue `reactive()` / `ref()` 单例服务 |
| 视频播放 | hls.js |
| 图像处理 | Sharp (主进程)、Canvas API (渲染器)、OpenCV.js (Worker) |
| ML 推理 | onnxruntime-web (YOLOv8、幻灯片分类器) |
| 视频处理 | FFmpeg (ffmpeg-static) |
| 持久化 | electron-store |
| 测试 | Vitest |
| 代码质量 | ESLint + typescript-eslint + eslint-plugin-import |
| 国际化 | vue-i18n |

---

## 3. 进程架构

AutoSlides 遵循 Electron 的多进程模型：

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Process (main.ts)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ platform │ │   infra  │ │  video   │ │extraction│       │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤       │
│  │   ai     │ │  export  │ │ download │ │   ipc    │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│         │              │              │                      │
│         └──────────────┼──────────────┘                      │
│                        │ IPC (ipcMain.handle)                │
├────────────────────────┼────────────────────────────────────┤
│                        │ contextBridge                       │
├────────────────────────┼────────────────────────────────────┤
│                 Preload Scripts (preload/)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ platform │ │  video   │ │extraction│ │    ai    │       │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤       │
│  │  export  │ │  course  │ │  update  │ │  tools   │       │
│  ├──────────┤ └──────────┘ └──────────┘ └──────────┘       │
│  │ intranet │                                                │
│  └──────────┘                                                │
├─────────────────────────────────────────────────────────────┤
│                 Renderer Process (renderer.ts)                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │               Vue 3 Application                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │    │
│  │  │ features │  │  shared  │  │components│          │    │
│  │  └──────────┘  └──────────┘  └──────────┘          │    │
│  │       │              │              │                │    │
│  │       └──────────────┼──────────────┘                │    │
│  │           Web Workers (shared/workers/)              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Tools Window (tools.ts)  ←  独立渲染器窗口                   │
│  Addons Window (addons.ts) ← 独立渲染器窗口                   │
└─────────────────────────────────────────────────────────────┘
```

**关键设计决策**：
- `contextIsolation: true` + `nodeIntegration: false`：渲染器无法直接访问 Node.js API
- 所有 IPC 通信通过 `contextBridge.exposeInMainWorld` 暴露的 `window.electronAPI` 对象
- 三个独立的渲染器窗口（主窗口、工具窗口、附加组件窗口）共享同一套 preload 脚本

---

## 4. 目录结构

```
autoslides/
├── src/
│   ├── main.ts                               # 主进程入口
│   ├── renderer.ts                           # 主窗口渲染器入口
│   ├── tools.ts                              # 工具窗口渲染器入口
│   ├── addons.ts                             # 附加组件窗口渲染器入口
│   ├── index.css                             # 全局基础样式
│   ├── App.vue                               # 主窗口根组件
│   ├── shims-vue.d.ts                        # Vue SFC 类型声明
│   ├── vite-env.d.ts                         # Vite 环境类型
│   ├── webviewCapturePreload.ts              # Webview 捕获 preload
│   │
│   ├── shared/                               # 跨进程共享模块 (via @common/*)
│   │   ├── crypto.ts                         # 视频 URL 签名/加密
│   │   ├── sanitizeFileName.ts               # 文件名清理
│   │   ├── githubRelease.ts                  # GitHub Release 获取
│   │   ├── types.ts                          # AppConfig、Trash/Crop 类型
│   │   └── index.ts                          # 导出聚合
│   │
│   ├── main/                                 # 主进程服务 (via @main/*)
│   │   ├── platform/                         # 平台基础设施
│   │   │   ├── configService.ts              # electron-store 配置管理
│   │   │   ├── config/
│   │   │   │   ├── types.ts                  # 配置类型重导出
│   │   │   │   ├── defaults.ts               # 默认值 + 工厂函数
│   │   │   │   └── index.ts
│   │   │   ├── authService.ts                # 登录/Token 管理
│   │   │   ├── apiClient.ts                  # 后端 API 客户端
│   │   │   ├── intranetMappingService.ts     # 内网映射
│   │   │   ├── windowManager.ts              # 窗口生命周期管理
│   │   │   ├── themeService.ts               # 系统主题检测
│   │   │   ├── powerManagementService.ts     # 系统休眠阻止
│   │   │   └── cacheManagementService.ts     # 缓存统计/清理
│   │   │
│   │   ├── infra/                            # 基础设施服务
│   │   │   ├── ffmpegService.ts              # FFmpeg 路径/可用性
│   │   │   ├── sharpService.ts               # Sharp 图像处理
│   │   │   ├── onnxModelService.ts           # ONNX 模型加载基类
│   │   │   └── fileDownloadService.ts        # 文件下载基类
│   │   │
│   │   ├── video/                            # 视频服务
│   │   │   ├── videoProxyService.ts          # HTTP 代理服务器
│   │   │   ├── videoProxy/
│   │   │   │   ├── proxyAuth.ts              # 代理认证逻辑
│   │   │   │   ├── proxyRequest.ts           # 请求签名/构建
│   │   │   │   └── urlHelpers.ts             # URL 重写/修复
│   │   │   ├── m3u8DownloadService.ts        # M3U8 流下载
│   │   │   └── compressLectureService.ts     # 视频压缩
│   │   │
│   │   ├── extraction/                       # 提取服务
│   │   │   ├── slideExtractionService.ts     # 幻灯片文件操作
│   │   │   ├── slideExtraction/
│   │   │   │   ├── types.ts                  # 提取类型
│   │   │   │   └── pathHelpers.ts            # 路径工具
│   │   │   ├── qtExtractorService.ts         # Qt 提取器集成
│   │   │   └── offlineProcessingService.ts   # 离线处理
│   │   │
│   │   ├── ai/                               # AI 服务
│   │   │   ├── aiFilteringService.ts         # AI 过滤协调
│   │   │   ├── aiPromptsService.ts           # 提示词管理
│   │   │   ├── llmApiService.ts              # LLM API 调用
│   │   │   ├── copilotService.ts             # GitHub Copilot 集成
│   │   │   ├── autoCropModelService.ts       # 自动裁剪 YOLO 模型
│   │   │   └── mlClassifierModelService.ts   # ML 分类器模型
│   │   │
│   │   ├── export/                           # 导出服务
│   │   │   ├── pdfService.ts                 # PDF 生成
│   │   │   ├── coverFontService.ts           # 封面字体
│   │   │   └── yuketangService.ts            # 雨课堂集成
│   │   │
│   │   ├── download/                         # 下载服务
│   │   │   ├── updateDownloadService.ts      # 应用更新下载
│   │   │   └── extractorInstallerService.ts  # 提取器安装
│   │   │
│   │   └── ipc/                              # IPC 处理器
│   │       ├── index.ts                      # registerAllIpcHandlers()
│   │       ├── types.ts                      # IpcServices 接口
│   │       ├── authIpc.ts                    # 认证 IPC
│   │       ├── configIpc.ts                  # 配置 IPC + broadcastConfig()
│   │       ├── videoIpc.ts                   # 视频 IPC
│   │       ├── ... (共 27 个模块)
│   │       └── extractorInstallerIpc.ts
│   │
│   ├── preload/                              # Preload 脚本
│   │   ├── index.ts                          # contextBridge.exposeInMainWorld
│   │   ├── platform.ts                       # auth, config, window, shell, menu...
│   │   ├── video.ts                          # video, ffmpeg, compressLecture, download
│   │   ├── extraction.ts                     # slideExtraction, offline, trash, crop...
│   │   ├── ai.ts                             # ai, copilot
│   │   ├── export.ts                         # pdfmaker, yuketang
│   │   ├── course.ts                         # api
│   │   ├── update.ts                         # update, extractorInstaller
│   │   ├── tools.ts                          # tools, addons, webCapture
│   │   └── intranet.ts                       # intranet
│   │
│   └── renderer/                             # 渲染器 (via @renderer/*)
│       ├── assets/
│       │   └── github-markdown.css           # GitHub Markdown 样式
│       │
│       ├── features/                         # 领域逻辑 (via @features/*)
│       │   ├── video/                        # 视频播放
│       │   │   ├── useVideoPlayer.ts         # HLS 单流播放 (~929 行)
│       │   │   ├── useDualStreamPlayer.ts    # 双流播放 (~400 行)
│       │   │   ├── singleStreamPlayback.ts   # 播放率/静音辅助
│       │   │   ├── useVideoErrorRecovery.ts  # HLS 错误恢复
│       │   │   ├── useSlideExtraction.ts     # 幻灯片提取适配器
│       │   │   ├── useSlideGallery.ts        # 幻灯片画廊
│       │   │   └── usePerformanceOptimization.ts
│       │   │
│       │   ├── results/                      # 结果视图
│       │   │   ├── useResultsView.ts         # 主 composable (~940 行)
│       │   │   ├── resultsDataLoader.ts      # 数据加载
│       │   │   ├── resultsDedupPipeline.ts   # pHash 去重
│       │   │   ├── resultsCropPipeline.ts    # 裁剪流水线
│       │   │   ├── resultsTypes.ts           # 类型定义
│       │   │   └── useCropEditor.ts          # 裁剪编辑器
│       │   │
│       │   ├── offline/                      # 离线处理
│       │   │   ├── useAutoCrop.ts            # 自动裁剪适配器
│       │   │   └── useOfflineProcessing.ts
│       │   │
│       │   ├── download/                     # 下载管理
│       │   │   ├── useTaskQueue.ts           # 任务队列
│       │   │   └── usePostProcessing.ts      # 后处理
│       │   │
│       │   ├── ai/                           # AI 设置
│       │   │   ├── useAISettings.ts          # AI 设置门面
│       │   │   ├── useCopilotOAuth.ts        # Copilot OAuth
│       │   │   ├── useMlClassifierSettings.ts
│       │   │   ├── useModelChain.ts          # 模型链管理
│       │   │   ├── usePHashExclusion.ts      # pHash 排除列表
│       │   │   ├── providerDetect.ts         # 提供商检测
│       │   │   ├── mlClassifierClient.ts     # ML 分类器 Worker 客户端
│       │   │   └── slideClassificationService.ts  # 幻灯片分类服务
│       │   │
│       │   ├── export/                       # 导出
│       │   │   ├── usePdfMaker.ts            # PDF 生成
│       │   │   └── useYuketang.ts            # 雨课堂
│       │   │
│       │   ├── course/                       # 课程管理
│       │   │   ├── useCourseList.ts          # 课程列表
│       │   │   ├── useSessionPage.ts         # 课时页面
│       │   │   ├── useHomePage.ts            # 首页 composables
│       │   │   ├── useHomeThumbnails.ts      # 首页缩略图
│       │   │   ├── useSearchPage.ts          # 搜索页
│       │   │   ├── savedSearches.ts          # 已保存搜索
│       │   │   ├── navigationStore.ts        # 侧边栏导航状态
│       │   │   ├── tabStore.ts               # 信息标签 + 播放标签状态
│       │   │   └── courseSelection.ts        # 统一课程/流打开入口
│       │   │
│       │   ├── settings/                     # 设置
│       │   │   ├── useSettings.ts            # 设置主 composable
│       │   │   ├── useAdvancedSettings.ts    # 高级设置门面
│       │   │   ├── useGeneralSettings.ts
│       │   │   ├── useImageProcessingSettings.ts
│       │   │   ├── useNetworkSettings.ts
│       │   │   ├── useExtractorSettings.ts
│       │   │   ├── languageService.ts        # 语言切换
│       │   │   ├── settingsContext.ts        # 设置上下文
│       │   │   └── settingsTypes.ts
│       │   │
│       │   ├── platform/                     # 平台功能
│       │   │   ├── useAuth.ts                # 认证
│       │   │   ├── useCacheManagement.ts     # 缓存管理
│       │   │   ├── useGreeting.ts            # 问候语
│       │   │   └── usePinyinName.ts          # 拼音名
│       │   │
│       │   ├── webCapture/                   # Web 捕获
│       │   │   └── useWebCapture.ts
│       │   │
│       │   └── tools/                        # 工具
│       │       └── useCompressLecture.ts     # 视频压缩
│       │
│       ├── components/                       # Vue 组件
│       │   ├── video/                        # 视频组件
│       │   │   ├── PlaybackPage.vue          # 播放页面
│       │   │   ├── SlideGallery.vue          # 幻灯片画廊
│       │   │   ├── PreviewModal.vue          # 预览模态框
│       │   │   ├── DualStreamControls.vue    # 双流控制
│       │   │   └── PostProcessingProgressBar.vue
│       │   │
│       │   ├── results/                      # 结果视图组件
│       │   │   ├── ResultsWindow.vue
│       │   │   └── ResultsImageGrid.vue
│       │   │
│       │   ├── offline/
│       │   │   └── OfflineProcessingTab.vue
│       │   │
│       │   ├── course/
│       │   │   ├── HomePage.vue              # 首页（已保存搜索卡片）
│       │   │   ├── SearchPage.vue            # 搜索页（多学期搜索）
│       │   │   ├── CoursePage.vue            # 课程网格
│       │   │   ├── SessionPage.vue           # 课时列表
│       │   │   └── SemesterSelect.vue        # 学期选择下拉
│       │   │
│       │   ├── settings/
│       │   │   ├── LeftPanel.vue             # 侧边栏导航 + 用户栏 + 设置宿主
│       │   │   ├── AdvancedSettingsModal.vue # 5 标签设置模态框
│       │   │   ├── OnboardingModal.vue       # 首次启动引导
│       │   │   ├── SignInModal.vue            # SSO 登录模态框
│       │   │   ├── UserMenuLinks.vue         # 用户菜单链接
│       │   │   ├── BrowserLoginView.vue
│       │   │   ├── ExtractorInstallModal.vue
│       │   │   ├── MlThresholdSlider.vue
│       │   │   └── tabs/
│       │   │       ├── AISettingsTab.vue
│       │   │       ├── GeneralSettingsTab.vue
│       │   │       ├── ImageProcessingSettingsTab.vue
│       │   │       ├── NetworkSettingsTab.vue
│       │   │       └── PlaybackSettingsTab.vue
│       │   │
│       │   ├── titlebar/
│       │   │   ├── TitleBar.vue
│       │   │   └── UpdateManager.vue
│       │   │
│       │   ├── export/
│       │   │   ├── PdfMakerWindow.vue
│       │   │   └── YuketangTab.vue
│       │   │
│       │   ├── download/
│       │   │   ├── RightPanel.vue            # 右侧面板
│       │   │   ├── DownloadQueuePanel.vue
│       │   │   └── TaskQueuePanel.vue
│       │   │
│       │   ├── tools/
│       │   │   ├── ToolsWindow.vue
│       │   │   ├── ToolsApp.vue
│       │   │   └── CompressLectureTab.vue
│       │   │
│       │   ├── addons/
│       │   │   ├── AddonsWindow.vue
│       │   │   └── AddonsApp.vue
│       │   │
│       │   ├── webCapture/
│       │   │   ├── WebCaptureTab.vue
│       │   │   └── RegionOverlay.vue
│       │   │
│       │   ├── MainContent.vue               # 主内容区（信息标签 + 播放标签）
│       │   └── App.vue                       # 根组件
│       │
│       └── shared/                           # 共享基础设施 (via @shared/*)
│           ├── processing/                   # Stage 1: 提取流水线 (SSIM)
│           │   ├── pipeline.ts               # SlideExtractionPipeline
│           │   ├── manager.ts                # SlideExtractionManager 单例
│           │   ├── changeDetection.ts        # ChangeDetector (SSIM 比较)
│           │   ├── frameSource.ts            # 视频帧捕获
│           │   ├── slideWriter.ts            # 幻灯片文件写入
│           │   ├── intervalTable.ts          # 播放率→采样间隔映射
│           │   ├── workerHelpers.ts          # Worker 通信辅助
│           │   └── types.ts                  # 提取类型定义
│           │
│           ├── postProcessing/               # Stage 2: 后处理流水线
│           │   ├── pipeline.ts               # PostProcessingPipeline
│           │   ├── phase1Duplicates.ts       # Phase 1: pHash 去重
│           │   ├── phase2Exclusion.ts        # Phase 2: 排除列表过滤
│           │   ├── phase3AI.ts               # Phase 3: AI 分类
│           │   ├── trashWriter.ts            # 移动到回收站
│           │   ├── imageSources.ts           # 图像数据源
│           │   ├── displayAdapter.ts         # 显示适配器
│           │   ├── errorModel.ts             # 错误分类
│           │   ├── workerHelpers.ts          # Worker 通信辅助
│           │   └── types.ts                  # 后处理类型
│           │
│           ├── autoCrop/                     # Stage 3: 自动裁剪流水线
│           │   ├── autoCropPipeline.ts       # processBatch (纯异步)
│           │   ├── autoCropWorkerClient.ts   # Worker 生命周期
│           │   └── index.ts
│           │
│           ├── orchestration/                # 状态机与协调器
│           │   ├── extractionMachine.ts      # 提取状态机 (纯函数)
│           │   ├── extractionOrchestrator.ts # 提取编排器 (副作用)
│           │   ├── taskMachine.ts            # 任务状态机 (纯函数)
│           │   ├── taskCoordinator.ts        # 任务协调器
│           │   └── *.test.ts                 # 状态机单元测试
│           │
│           ├── services/                     # 跨领域单例服务
│           │   ├── configStore.ts            # 响应式配置仓库
│           │   ├── authService.ts            # Token 管理器
│           │   ├── dataStore.ts              # 会话/课程数据缓存
│           │   ├── apiClient.ts              # 渲染器 API 客户端
│           │   ├── downloadService.ts        # 下载队列
│           │   ├── downloadNaming.ts         # 下载文件名清理
│           │   ├── taskQueueService.ts       # 任务队列
│           │   ├── postProcessingService.ts  # 后处理作业队列
│           │   ├── extractionQueueService.ts # 提取队列门面
│           │   ├── extractionQueueLogic.ts   # 提取决策纯函数
│           │   ├── ssimThresholdService.ts   # SSIM 阈值自适应
│           │   ├── rightPanelStore.ts        # 任务/下载标签切换状态
│           │   ├── demoData.ts               # 演示模式虚构数据
│           │   └── demoSeed.ts               # 演示模式队列种子
│           │
│           ├── workers/                      # Web Worker 文件
│           │   ├── slideProcessor.worker.ts  # SSIM 比较
│           │   ├── postProcessor.worker.ts   # pHash 计算
│           │   ├── autoCrop.worker.ts        # Canny + YOLO 裁剪
│           │   ├── slideClassifier.worker.ts # ML 幻灯片分类
│           │   ├── pHashWorkerClient.ts      # pHash Worker 客户端
│           │   └── workerClientFactory.ts    # Worker 客户端工厂
│           │
│           ├── i18n/                         # 国际化
│           │   ├── index.ts
│           │   └── locales/
│           │       ├── en.json
│           │       ├── zh.json
│           │       ├── ja.json
│           │       └── ko.json
│           │
│           ├── styles/                       # 共享样式
│           │   ├── theme.css                 # 主题变量 (96 个 token)
│           │   ├── components.css            # 共享组件类
│           │   ├── modal.css                 # 模态框类
│           │   └── settings.css              # 设置类
│           │
│           └── utils/
│               └── toolWindowFolders.ts      # 工具窗口文件夹工具
│
├── resources/                                # 打包资源
│   ├── img/                                  # 应用图标
│   ├── models/                               # ONNX 模型
│   │   ├── slide-detect-v1.onnx              # YOLO 裁剪模型
│   │   └── slide-classifier-v1.onnx          # ML 分类器模型
│   ├── terms/terms.rtf                       # 使用条款
│   └── installer.nsh                         # Windows NSIS 安装脚本
│
├── build/                                    # 构建资源
│   ├── background.png                        # DMG 背景
│   └── license.rtf
│
├── forge.config.ts                           # Electron Forge 配置
├── electron-builder.yml                      # Windows 打包配置
├── tsconfig.json                             # TypeScript 配置
├── eslint.config.mjs                         # ESLint 配置 (含领域边界规则)
├── vitest.config.ts                          # 测试配置
├── vite.main.config.ts                       # 主进程 Vite 配置
├── vite.renderer.config.ts                   # 渲染器 Vite 配置
├── vite.preload.config.ts                    # Preload Vite 配置
├── vite.tools.config.ts                      # 工具窗口 Vite 配置
├── vite.addons.config.ts                     # 附加组件窗口 Vite 配置
├── vite.webviewPreload.config.ts             # Webview Preload Vite 配置
├── index.html                                # 主窗口 HTML
├── tools.html                                # 工具窗口 HTML
├── addons.html                               # 附加组件窗口 HTML
└── package.json
```

---

## 5. 路径别名

TypeScript 路径别名在 `tsconfig.json` 和所有 6 个 Vite 配置中统一定义：

| 别名 | 目标 | 用途 |
|------|------|------|
| `@main/*` | `src/main/*` | 主进程服务导入 |
| `@renderer/*` | `src/renderer/*` | 渲染器根导入 |
| `@shared/*` | `src/renderer/shared/*` | 渲染器共享基础设施 |
| `@common/*` | `src/shared/*` | 跨进程共享工具 |
| `@features/*` | `src/renderer/features/*` | Feature 领域导入 |

**约定**：跨领域跳转使用别名；同领域内导入保持相对路径。

---

## 6. 主进程架构

### 6.1 领域划分

主进程服务按 7 个领域组织：

| 领域 | 目录 | 职责 | 关键文件 |
|------|------|------|----------|
| **platform** | `src/main/platform/` | 平台基础设施 | `configService`, `authService`, `apiClient`, `intranetMappingService`, `windowManager`, `themeService`, `powerManagementService`, `cacheManagementService` |
| **infra** | `src/main/infra/` | 底层工具服务 | `ffmpegService`, `sharpService`, `onnxModelService`, `fileDownloadService` |
| **video** | `src/main/video/` | 视频代理与下载 | `videoProxyService` (+ `videoProxy/` 子目录), `m3u8DownloadService`, `compressLectureService` |
| **extraction** | `src/main/extraction/` | 幻灯片提取 | `slideExtractionService`, `qtExtractorService`, `offlineProcessingService` |
| **ai** | `src/main/ai/` | AI 分类与推理 | `aiFilteringService`, `aiPromptsService`, `llmApiService`, `copilotService`, `autoCropModelService`, `mlClassifierModelService` |
| **export** | `src/main/export/` | 导出功能 | `pdfService`, `coverFontService`, `yuketangService` |
| **download** | `src/main/download/` | 应用更新与安装 | `updateDownloadService`, `extractorInstallerService` |

### 6.2 IPC 处理器注册

`src/main/ipc/index.ts` 导出 `registerAllIpcHandlers(services)` 函数，内部调用 27 个领域 IPC 模块：

```typescript
export function registerAllIpcHandlers(services: IpcServices): void {
  registerAuthIpcHandlers(services);
  registerConfigIpcHandlers(services);
  registerModelIpcHandlers(services);
  // ... 共 27 个
  registerExtractorInstallerIpcHandlers(services);
}
```

每个 IPC 模块接收完整的 `IpcServices` 对象，通过解构获取所需服务。

### 6.3 IPC 依赖注入

`src/main/ipc/types.ts` 定义 `IpcServices` 接口，包含 22 个服务实例：

```typescript
export interface IpcServices {
  authService: MainAuthService;
  apiClient: ApiClient;
  configService: ConfigService;
  intranetMappingService: IntranetMappingService;
  videoProxyService: VideoProxyService;
  ffmpegService: FFmpegService;
  m3u8DownloadService: M3u8DownloadService;
  powerManagementService: PowerManagementService;
  aiPromptsService: AIPromptsService;
  aiFilteringService: AIFilteringService;
  llmApiService: LLMApiService;
  updateDownloadService: UpdateDownloadService;
  qtExtractorService: QtExtractorService;
  extractorInstallerService: ExtractorInstallerService;
  autoCropModelService: AutoCropModelService;
  mlClassifierModelService: MlClassifierModelService;
  compressLectureService: CompressLectureService;
  windowManager: WindowManager;
  pdfService: PdfService;
  slideExtractionService: SlideExtractionService;
  offlineProcessingService: OfflineProcessingService;
  cacheManagementService: CacheManagementService;
}
```

**设计原则**：所有 IPC 模块通过 `IpcServices` 接收依赖，禁止直接导入单例。

### 6.4 服务实例化

`src/main.ts` (~180 行) 负责：

1. **导入所有服务类**
2. **实例化服务**（带构造函数依赖注入）：
   ```typescript
   const configService = new ConfigService();
   const authService = new MainAuthService();
   const apiClient = new MainApiClient();
   const autoCropModelService = new AutoCropModelService(configService);
   const mlClassifierModelService = new MlClassifierModelService(configService);
   const intranetMappingService = new IntranetMappingService(configService);
   const videoProxyService = new VideoProxyService(apiClient, intranetMappingService);
   const ffmpegService = new FFmpegService();
   // ...
   ```
3. **注册 IPC 处理器**：`registerAllIpcHandlers({ authService, apiClient, ... })`
4. **初始化窗口**：`createWindow()`
5. **应用生命周期管理**：`app.on('ready')`, `app.on('window-all-closed')`, `app.on('activate')`

### 6.5 窗口管理

`WindowManager` 管理应用窗口生命周期：
- 主窗口（1400×900，最小 1200×700）
- 工具窗口（结果视图、PDF 生成器、离线处理）
- 附加组件窗口（雨课堂等）
- macOS 原生菜单栏
- 应用菜单更新（`updateApplicationMenu()`）

---

## 7. Preload 架构

Preload 脚本是主进程和渲染器之间的安全桥梁，通过 `contextBridge.exposeInMainWorld` 暴露 API。

`src/preload/index.ts` 组合 9 个领域模块：

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  isDemoMode,     // 演示模式标志（DEMO_MODE=1 → --demo-mode argv）
  auth,           // 登录、Token 验证、浏览器数据清理
  config,         // 所有配置 getter/setter + onUpdate 推送
  api,            // 后端 API 调用（课程、课时、直播、学期）
  intranet,       // 内网模式状态和映射
  video,          // 视频代理管理
  ffmpeg,         // FFmpeg 路径和可用性
  compressLecture,// 视频压缩
  download,       // 下载控制和进度事件
  slideExtraction,// 幻灯片文件操作
  dialog,         // 消息/错误对话框 + 图像文件选择器
  window,         // 窗口控制（最小化、最大化、关闭）
  shell,          // 外部链接和文件打开
  menu,           // 菜单操作、缩放、全屏
  powerManagement,// 系统休眠阻止
  cache,          // 缓存统计和清理
  app,            // 应用重启
  ai,             // AI 分类端点
  copilot,        // GitHub Copilot OAuth
  trash,          // 结果视图操作
  crop,           // 裁剪操作
  pdfmaker,       // PDF 生成
  tools,          // 工具窗口管理
  addons,         // 附加组件窗口
  webCapture,     // Web 捕获
  yuketang,       // 雨课堂
  autoCrop,       // 自动裁剪
  mlClassifier,   // ML 分类器
  offline,        // 离线处理
  qtExtractor,    // Qt 提取器
  extractorInstaller,// 提取器安装
  update,         // 应用更新
});
```

每个模块使用 `ipcRenderer.invoke()` 进行请求-响应通信，`ipcRenderer.on()` 进行事件监听。

---

## 8. 渲染器架构

### 8.1 三个渲染入口

| 入口 | 文件 | 根组件 | 用途 |
|------|------|--------|------|
| 主窗口 | `renderer.ts` | `App.vue` | 课程浏览、视频播放、设置 |
| 工具窗口 | `tools.ts` | `ToolsApp.vue` | 结果视图、PDF 生成、离线处理 |
| 附加组件窗口 | `addons.ts` | `AddonsApp.vue` | 雨课堂等 |

每个入口都：
1. 导入 `index.css`
2. 创建 Vue 应用
3. 加载 `i18n` 插件
4. 注入 `PostProcessingService` 的分类器回调
5. 调用 `loadConfig()` 加载配置
6. 挂载到 `#app`

演示模式（`npm run demo` / `DEMO_MODE=1`）下，主进程将持久化隔离到 `AutoSlides-Demo` 用户数据目录，并通过 `--demo-mode` argv 传递到每个渲染器。渲染器的 `ApiClient`、`TokenManager`、`savedSearches`、`useGreeting` 短路到 `demoData.ts` 中的虚构工厂；`demoSeed.ts` 将假任务/下载项推入响应式队列（绕过处理器——什么都不实际运行）。

### 8.2 Feature 领域层

Feature 层是渲染器的核心业务逻辑，每个领域是一个独立的功能单元：

| 领域 | 目录 | 职责 | 关键 Composable |
|------|------|------|-----------------|
| **video** | `features/video/` | HLS 播放、流切换、错误恢复 | `useVideoPlayer`, `useDualStreamPlayer`, `useSlideExtraction`, `useSlideGallery` |
| **results** | `features/results/` | 结果视图数据加载、去重、裁剪 | `useResultsView`, `useCropEditor`, `resultsDataLoader`, `resultsDedupPipeline`, `resultsCropPipeline` |
| **offline** | `features/offline/` | 离线自动裁剪 | `useAutoCrop`, `useOfflineProcessing` |
| **download** | `features/download/` | 任务队列、后处理 | `useTaskQueue`, `usePostProcessing` |
| **ai** | `features/ai/` | AI 设置、Copilot OAuth、ML 分类 | `useAISettings`, `useCopilotOAuth`, `useMlClassifierSettings`, `useModelChain` |
| **export** | `features/export/` | PDF 生成、雨课堂 | `usePdfMaker`, `useYuketang` |
| **course** | `features/course/` | 课程列表、首页、搜索、导航、标签 | `useCourseList`, `useSessionPage`, `useHomePage`, `useSearchPage`, `savedSearches`, `navigationStore`, `tabStore`, `courseSelection` |
| **settings** | `features/settings/` | 设置管理 | `useSettings`, `useAdvancedSettings`, `useGeneralSettings` 等，`settingsContext` |
| **platform** | `features/platform/` | 认证、缓存、问候 | `useAuth`, `useCacheManagement`, `useGreeting`, `usePinyinName` |
| **webCapture** | `features/webCapture/` | Web 捕获 | `useWebCapture` |
| **tools** | `features/tools/` | 视频压缩 | `useCompressLecture` |

**设计原则**：
- 每个 Feature 是一个独立的功能单元，不依赖其他 Feature（通过白名单例外）
- Feature 可以导入 `@shared/*` 的任何模块
- Feature 不能导入其他 Feature 的代码（ESLint 强制）

### 8.3 Shared 基础设施层

Shared 层是跨领域的基础模块，**不能**导入 Feature 层：

| 子目录 | 职责 |
|--------|------|
| `processing/` | Stage 1: SSIM 提取流水线 |
| `postProcessing/` | Stage 2: 后处理流水线 |
| `autoCrop/` | Stage 3: 自动裁剪流水线 |
| `orchestration/` | 状态机与协调器 |
| `services/` | 跨领域单例服务 |
| `workers/` | Web Worker 文件 |
| `i18n/` | 国际化 |
| `styles/` | 共享样式 |
| `utils/` | 工具函数 |

### 8.4 Component 组件层

组件按领域分组，每个组件目录对应一个 UI 功能域：

```
components/
├── video/           # 播放页面、画廊、预览模态框
├── results/         # 结果窗口、图像网格
├── offline/         # 离线处理标签页
├── course/          # 首页、搜索页、课程页面、课时页面、学期选择
├── settings/        # 侧边栏导航、高级设置、引导、SSO 登录、标签页
├── titlebar/        # 标题栏、更新管理器
├── export/          # PDF 生成、雨课堂
├── download/        # 右侧面板、下载队列、任务队列
├── tools/           # 工具窗口、压缩标签页
├── addons/          # 附加组件窗口
├── webCapture/      # Web 捕获、区域覆盖
├── MainContent.vue  # 主内容区（信息标签 + 播放标签）
└── App.vue          # 根组件
```

### 8.5 响应式配置仓库

`src/renderer/shared/services/configStore.ts` 是渲染器的配置中心：

```typescript
// 响应式镜像，启动时加载一次，通过 config:onUpdate 广播保持同步
export const configStore = reactive({} as unknown as AppConfigShape);

export function loadConfig(): Promise<void> {
  // 1. 从主进程获取完整配置
  const full = await window.electronAPI.config.get();
  Object.assign(configStore, full);
  // 2. 订阅后续更新
  window.electronAPI.config.onUpdate((cfg) => {
    Object.assign(configStore, cfg);
  });
}
```

**关键特性**：
- **同步读取**：`configStore.slideExtraction?.pHashThreshold`（无需 await）
- **异步写入**：通过 `window.electronAPI.config.*` 设置器（`useSettings`、`useAdvancedSettings` + 5 个子 composable 拥有写入面）
- **广播同步**：每次设置器调用后，主进程通过 `broadcastConfig()` 推送完整快照到所有窗口
- **竞态窗口**：设置后立即读取可能看到旧值（下一个事件循环才收到广播）

---

## 9. 状态机与编排

### 9.1 提取状态机 (Chain A)

`src/renderer/shared/orchestration/extractionMachine.ts` 管理下载→提取→后处理的状态转换：

```typescript
export type ExtractionEvent =
  | { type: 'MARK_PENDING' }
  | { type: 'DOWNLOAD_FAILED'; error: string }
  | { type: 'EXTRACT_STARTED' }
  | { type: 'EXTRACT_PROGRESS'; percent: number }
  | { type: 'EXTRACT_FAILED'; error: string }
  | { type: 'NORMALIZE_STARTED' }
  | { type: 'NORMALIZE_FAILED'; error: string }
  | { type: 'POSTPROCESS_STARTED' }
  | { type: 'POSTPROCESS_DONE' }
  | { type: 'POSTPROCESS_FAILED'; error: string }
  | { type: 'FINISH' }
  | { type: 'CANCEL' }

export function reduceExtraction(
  current: ExtractionStatus | undefined,
  event: ExtractionEvent
): ExtractionPatch | null { ... }
```

**关键不变量**：
- **终态不可变**：一旦进入 `completed`/`error`/`cancelled`，任何事件都不生效
- **取消优先**：`CANCEL` 事件在任何状态下都生效
- **进度保护**：`EXTRACT_PROGRESS` 仅在 `extracting` 状态下生效
- **纯函数**：无副作用，可单元测试

### 9.2 任务状态机 (Chain B)

`src/renderer/shared/orchestration/taskMachine.ts` 管理自动化任务队列的状态：

```typescript
export type TaskEvent =
  | { type: 'START' }
  | { type: 'PROGRESS'; value: number }
  | { type: 'COMPLETE' }
  | { type: 'FAIL'; error: string }
  | { type: 'PAUSE' }

export function reduceTask(current: TaskStatus, event: TaskEvent): TaskPatch | null { ... }
```

**设计特点**：
- 时间戳使用哨兵值（`'now'`, `'clear'`），由服务层填充实际值
- 保持纯函数，无副作用

### 9.3 任务协调器

`src/renderer/shared/orchestration/taskCoordinator.ts` 替代了原来的 `window.CustomEvent` 握手机制：

```typescript
export interface TaskDriver {
  mode: 'live' | 'recorded';
  sessionId?: string;
  start(task: TaskContext): Promise<void>;
  pause(task: TaskContext): void;
  resume(task: TaskContext): Promise<void>;
}

class TaskCoordinatorClass {
  registerDriver(driver: TaskDriver): () => void;   // PlaybackPage 挂载时注册
  registerNavigator(navigator: TaskNavigator): void; // MainContent 注册导航器
  async runTask(task: TaskContext): Promise<void>;   // 导航→等待驱动→启动
  pauseTask(task: TaskContext): void;                // 暂停任务
}
```

**工作流程**：
1. `TaskQueue.runTask(task)` 调用 `TaskCoordinator.runTask()`
2. 协调器调用导航器（`MainContent`）导航到目标课时
3. `PlaybackPage` 挂载后注册 `TaskDriver`
4. 协调器等待驱动注册（带超时），然后调用 `driver.start(task)`
5. 无全局事件，无重试风暴

### 9.4 提取编排器

`src/renderer/shared/orchestration/extractionOrchestrator.ts` 是下载→提取→后处理链的唯一写入者：

```typescript
class ExtractionOrchestrator {
  // 唯一的状态写入方法
  private apply(item: DownloadItem, event: ExtractionEvent): void {
    const patch = reduceExtraction(item.extractionStatus, event);
    if (!patch) return;
    if (patch.status !== undefined) item.extractionStatus = patch.status;
    if (patch.progress !== undefined) item.extractionProgress = patch.progress;
    if (patch.error !== undefined) item.extractionError = patch.error;
  }
  
  // 注入作业提供者（打破循环依赖）
  setJobProvider(provider: () => DownloadItem[]): void;
  
  // 唤醒机制
  notifyChange(): void;
  
  // 工作循环
  private async workerLoop(): Promise<void> { ... }
  
  // 运行单个提取任务
  private async runOne(item: DownloadItem, videoFilePath: string): Promise<void> { ... }
}
```

**关键设计**：
- **唯一写入者**：所有 `DownloadItem` 的 `extractionStatus`/`extractionProgress`/`extractionError` 都通过 `apply()` 写入
- **注入作业提供者**：`ExtractionQueue.setJobProvider(() => this.items)` 打破循环依赖
- **唤醒机制**：`notifyChange()` 唤醒等待中的工作循环

---

## 10. 流水线架构

### 10.1 幻灯片提取流水线 (Stage 1)

`src/renderer/shared/processing/pipeline.ts` 是 SSIM 幻灯片提取的核心：

```typescript
export class SlideExtractionPipeline implements SlideExtractionHandle {
  // 核心组件
  private detector: ChangeDetector;      // SSIM 比较
  private intervalTable: IntervalTable;  // 播放率→采样间隔
  private extractedSlides: ExtractedSlide[];
  
  // 公共 API
  async run(input: SlideExtractionInput, adapter: SlideExtractionAdapter): Promise<boolean>;
  stop(): void;
  pushFrame(imageData: ImageData): Promise<void>;
  setPlaybackRate(rate: number): void;
  pauseForBuffering(): void;
  resumeAfterBuffering(): void;
}
```

**数据流**：
```
视频元素 → captureFrame() → ImageData
                ↓
        ChangeDetector.process()
                ↓
        SSIM Worker (slideProcessor.worker)
                ↓
        if (变化检测) → saveSlide() → 文件系统
                ↓
        adapter.onSlideExtracted()
```

**管理器**：`SlideExtractionManager` 是单例，管理多个流水线实例：

```typescript
export const slideExtractionManager = SlideExtractionManager.getInstance();

// 使用方式
const handle = await slideExtractionManager.run(input, adapter);
```

### 10.2 后处理流水线 (Stage 2)

`src/renderer/shared/postProcessing/pipeline.ts` 是三阶段后处理的核心：

```typescript
export class PostProcessingPipeline {
  static async run(
    input: PostProcessingInput,
    dataSource: PipelineDataSource,
    ctx: PostProcessingContext
  ): Promise<PostProcessingResult> {
    // Phase 1: pHash 去重
    // Phase 2: 排除列表过滤
    // Phase 3: AI 分类 (LLM 或 ML)
  }
}
```

**三阶段流程**：

1. **Phase 1 (Duplicates)**：计算所有图片的 pHash，比较汉明距离，移除重复项
2. **Phase 2 (Exclusion)**：与用户排除列表比较，移除匹配项
3. **Phase 3 (AI)**：
   - **LLM 模式**：批量发送图片到 AI API，分类为 `slide`/`not_slide`/`may_be_slide_edit`
   - **ML 模式**：本地 ONNX 推理（`slideClassifier.worker`）

**取消支持**：Phase 3 支持在批次边界取消（`AbortController`）。

### 10.3 自动裁剪流水线 (Stage 3)

`src/renderer/shared/autoCrop/autoCropPipeline.ts` 是图像裁剪的核心：

```typescript
export async function processBatch(
  client: AutoCropWorkerClient,
  source: AutoCropImageSource,
  imagePaths: string[],
  options: AutoCropOptions,
  callbacks: AutoCropCallbacks
): Promise<AutoCropBatchProgress> { ... }
```

**检测模式**：
- `canny_then_yolo`（默认）：先运行 Canny，无结果则回退到 YOLO
- `canny_only`：仅 Canny 边缘检测
- `yolo_only`：仅 YOLO 推理

**Worker 通信**：
```
渲染器 → AutoCropWorkerClient → autoCrop.worker
                                    ↓
                              OpenCV.js (Canny)
                              onnxruntime-web (YOLO)
                                    ↓
                              裁剪坐标 → 裁剪图像 → 保存
```

---

## 11. Web Worker 架构

| Worker | 文件 | 职责 | 运行时 |
|--------|------|------|--------|
| **slideProcessor** | `slideProcessor.worker.ts` | SSIM 图像比较、降采样 | Canvas API |
| **postProcessor** | `postProcessor.worker.ts` | pHash 计算、汉明距离 | Canvas API + DCT |
| **autoCrop** | `autoCrop.worker.ts` | Canny 边缘检测 + YOLO 推理 | OpenCV.js + onnxruntime-web |
| **slideClassifier** | `slideClassifier.worker.ts` | ML 幻灯片分类 | onnxruntime-web |

**Worker 通信模式**：
```typescript
// 客户端
const worker = new Worker(new URL('./slideProcessor.worker.ts', import.meta.url));
worker.postMessage({ id: '1', type: 'calculateSSIM', data: { img1, img2 } });
worker.onmessage = (e) => { /* 处理结果 */ };

// Worker
self.onmessage = (e) => {
  const { id, type, data } = e.data;
  // 处理...
  self.postMessage({ id, success: true, result });
};
```

**客户端工厂**：`workerClientFactory.ts` 提供统一的 Worker 创建接口。

---

## 12. 视频代理系统

`VideoProxyService` 是视频播放的核心，运行在主进程：

```typescript
export class VideoProxyService {
  private proxyServer: http.Server;     // HTTP 代理服务器
  private auth: ProxyAuth;              // 认证逻辑
  private intranetMapping: IntranetMappingService; // 内网映射
  
  // 核心方法
  async getLiveStreamUrls(stream: LiveStreamInput, token: string): Promise<VideoPlaybackUrls>;
  async getVideoPlaybackUrls(session: RecordedSessionInput, token: string): Promise<VideoPlaybackUrls>;
  
  // 代理生命周期
  async registerClient(clientId: string): Promise<number>;  // 返回代理端口
  async unregisterClient(clientId: string): Promise<void>;
}
```

**架构**：
```
渲染器 (hls.js)
    ↓ HTTP 请求
主进程代理服务器 (localhost:PORT)
    ↓ 代理逻辑
VideoProxyService
    ├── ProxyAuth: 认证令牌管理
    ├── proxyRequest.ts: 请求签名、重试
    ├── urlHelpers.ts: URL 重写、修复
    └── IntranetMappingService: 内网 IP 映射
    ↓
原始视频服务器
```

**关键特性**：
- **引用计数**：多个客户端共享同一代理服务器
- **自动重试**：403 时重新签名，持久 403 时使令牌失效
- **内网映射**：自动将外网 URL 重写为内网地址
- **双流支持**：同时代理摄像头流和屏幕流

---

## 13. 下载与提取队列

### 下载队列

`src/renderer/shared/services/downloadService.ts` 管理 M3U8 流下载：

```typescript
export interface DownloadItem {
  id: string;
  name: string;
  courseTitle: string;
  sessionTitle: string;
  sessionId: string;
  videoType: 'camera' | 'screen';
  status: DownloadStatus;  // 'queued' | 'downloading' | 'processing' | 'completed' | 'error'
  progress: number;
  
  // Qt 提取器状态
  extractionStatus?: ExtractionStatus;
  extractionProgress?: number;
  // ...
}
```

### 提取队列

`src/renderer/shared/services/extractionQueueService.ts` 是 `ExtractionOrchestrator` 的 3 行门面：

```typescript
export const ExtractionQueue = new ExtractionOrchestrator();
```

**工作流程**：
1. 下载完成后，`markPendingIfApplicable()` 标记为 `pending`
2. 编排器的工作循环找到第一个 `pending` 项
3. 调用 `qtExtractor.runExtraction()` 运行外部提取器
4. 可选：运行 PNG 颜色量化
5. 创建后处理作业：`PostProcessingService.addJob()`
6. 监听后处理作业的终态

### 后处理服务

`src/renderer/shared/services/postProcessingService.ts` 管理后处理作业队列：

```typescript
class PostProcessingServiceClass {
  addJob(taskId: string, outputPath: string, imageFiles: string[]): string;
  cancelJob(jobId: string): void;
  subscribe(handler: (job: PostProcessJob) => void): () => void;
  // ...
}
```

**设计特点**：
- **并行任务**：最多 `parallelTasks` 个录制任务同时提取，每个任务在独立的播放标签中运行，SSIM 阈值在队列时冻结
- **串行后处理**：后处理仍为串行（单个 `PostProcessingService.processQueue`）
- **订阅通知**：通过 `subscribe()` 通知状态变化（非轮询）
- **LLM 可取消**：仅 LLM 模式支持取消（ML 本地推理不可取消）

---

## 14. AI 分类系统

AI 分类支持两种模式：

### LLM 模式
- **服务类型**：`builtin`（内置 API）、`custom`（自定义 API）、`copilot`（GitHub Copilot）
- **提供商检测**：`providerDetect.ts` 自动识别 ModelScope、LM Studio、NVIDIA 等
- **模型链**：支持多模型链式调用（`customModelChain`）
- **速率限制**：内置 10 请求/分钟，自定义 60 请求/分钟
- **批量处理**：每批 1-10 张图片

### ML 模式
- **模型**：`slide-classifier-v1.onnx`（ONNX 格式）
- **推理**：`slideClassifier.worker.ts` 使用 `onnxruntime-web`
- **阈值**：`trustLow`、`trustHigh`、`slideCheckLow`
- **单线程**：`ort.env.wasm.numThreads = 1`（避免 SharedArrayBuffer 要求）

### 提示词系统

`src/main/ai/aiPromptsService.ts` 管理 AI 分类提示词：
- **简单模式**：2 类（slide/not_slide）
- **区分模式**：3 类（slide/not_slide/may_be_slide_edit）
- **独立配置**：直播/录播、简单/区分各有独立提示词

---

## 15. 配置管理系统

### 主进程配置

`src/main/platform/configService.ts` 使用 `electron-store` 持久化配置：

```typescript
export class ConfigService {
  private store: ElectronStore;
  
  getConfig(): AppConfig { ... }
  setOutputDirectory(directory: string): void { ... }
  setConnectionMode(mode: 'internal' | 'external'): void { ... }
  // ... 100+ 个 getter/setter 方法
}
```

### 配置类型

`src/shared/types.ts` 定义了完整的配置类型：

```typescript
export interface AppConfig {
  outputDirectory: string;
  connectionMode: ConnectionMode;
  maxConcurrentDownloads: number;
  muteMode: MuteMode;
  taskSpeed: number;
  parallelTasks: number;          // 并行任务数（默认 2，范围 1-10）
  maxManualTabs: number;          // 手动播放标签上限（默认 3）
  previewFromVideo: boolean;      // 缩略图从视频提取
  previewSeekSeconds: number;     // 缩略图提取时间点
  autoPostProcessing: boolean;
  enableAIFiltering: boolean;
  themeMode: ThemeMode;
  languageMode: LanguageMode;
  savedSearchesLive: string[];    // 已保存直播搜索
  savedSearchesRecorded: string[];// 已保存录播搜索
  onboardingCompleted: boolean;   // 引导完成标志
  slideExtraction: SlideExtractionConfig;
  aiFiltering: AIFilteringConfig;
  qtExtractor: QtExtractorConfig;
  // ...
}
```

### 配置广播

每次配置变更后，`configIpc.ts` 调用 `broadcastConfig()` 将完整 `AppConfig` 推送到所有窗口：

```typescript
function broadcastConfig(config: AppConfig): void {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('config:onUpdate', config);
  });
}
```

---

## 16. 共享工具模块

### 跨进程共享 (`src/shared/`)

| 文件 | 功能 |
|------|------|
| `crypto.ts` | 视频 URL 签名/加密（`VIDEO_MAGIC`、`encryptVideoUrl`、`getVideoSignature`、`addSignatureToUrl`、`getClientSignature`） |
| `sanitizeFileName.ts` | 文件名清理（单规范实现） |
| `githubRelease.ts` | GitHub Release 获取（主/备用 URL 模式） |
| `types.ts` | `AppConfig`、`TrashEntry`、`CropEntry` 等跨进程类型 |

### 渲染器共享服务 (`src/renderer/shared/services/`)

| 服务 | 职责 |
|------|------|
| `configStore` | 响应式配置镜像 |
| `authService` | Token 管理器 |
| `dataStore` | 会话/课程数据缓存 |
| `apiClient` | 渲染器 API 客户端 |
| `downloadService` | 下载队列 |
| `downloadNaming` | 下载文件名清理（与 `sanitizeFileName` 不同） |
| `taskQueueService` | 任务队列 |
| `postProcessingService` | 后处理作业队列 |
| `extractionQueueService` | 提取队列门面 |
| `extractionQueueLogic` | 提取决策纯函数 |
| `ssimThresholdService` | SSIM 阈值自适应 |
| `rightPanelStore` | 任务/下载标签切换状态（标题栏视图切换器） |
| `demoData` | 演示模式虚构账户/课程数据 |
| `demoSeed` | 演示模式队列种子（假任务/下载项） |

---

## 17. UI 架构

### 17.1 三面板布局

```
┌─────────────────────────────────────────────────────────────┐
│                      TitleBar (macOS hiddenInset)            │
├──────────┬──────────────────────────────────┬───────────────┤
│          │                                  │               │
│   Left   │  ┌─────────────────────────┐     │    Right      │
│  Panel   │  │ Info Tab:               │     │    Panel      │
│          │  │   Home / Search /       │     │               │
│ Sidebar  │  │   Live / Recorded       │     │ Task          │
│ Navigator│  ├─────────────────────────┤     │ Queue         │
│          │  │ Playback Tab 1:         │     │               │
│ User Bar │  │   PlaybackPage          │     │ Download      │
│          │  ├─────────────────────────┤     │ Queue         │
│ Settings │  │ Playback Tab N:         │     │               │
│ (modal)  │  │   PlaybackPage          │     │               │
│          │  └─────────────────────────┘     │               │
├──────────┴──────────────────────────────────┴───────────────┤
│                     Resizable Dividers                       │
└─────────────────────────────────────────────────────────────┘
```

- **左侧面板**（`LeftPanel.vue`）：Apple Music 风格侧边栏 — 导航器（Home / Search / Live / Recorded，由 `navigationStore.activeNav` 驱动）、用户/账户栏、设置模态框（`AdvancedSettingsModal`）和 SSO 登录（`SignInModal`）的宿主。macOS 下侧边栏渲染在标题栏共享的毛玻璃底图后面。
- **主内容区**（`MainContent.vue`）：持久 **信息标签**（Home / Search / Live / Recorded 浏览 + 录播课时列表）加上 **N 个播放标签**。`tabStore.state.activeTabId === null` 显示信息标签；否则显示对应的 `PlaybackPage`。每个播放标签的 `PlaybackPage` 保持挂载（CSS 隐藏而非卸载），后台播放 + 幻灯片提取继续运行。侧边栏导航始终返回信息标签。
- **右侧面板**（`RightPanel.vue`）：任务队列（`TaskQueuePanel`）和下载队列（`DownloadQueuePanel`）；活动视图保存在 `rightPanelStore` 中，标题栏托管视图切换器。
- **可调整分隔线**：拖动调整面板宽度

**导航与标签流**：`courseSelection` 是从任何表面（课程网格、Home 行、搜索结果）打开课程/流的唯一入口。直播流和录播课时打开 **播放标签**（手动打开上限 `maxManualTabs`；任务队列为每个并发任务打开一个标签，上限 `parallelTasks`）。录播模式在信息标签内保持本地 课程网格→课时列表 浏览状态；直播模式无中间页面。首次启动显示 `OnboardingModal`（由 `config.onboardingCompleted` 控制）。

### 17.2 CSS 主题系统

`src/renderer/shared/styles/theme.css` 定义了 96 个 CSS 变量：

```css
:root {
  /* 表面 */
  --bg-page: #f5f5f5;
  --bg-surface: #ffffff;
  --bg-elevated: #fafafa;
  
  /* 文本 */
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --text-muted: #999999;
  
  /* 边框 */
  --border-color: #e0e0e0;
  --border-strong: #cccccc;
  
  /* 强调色 */
  --accent: #007aff;
  --accent-hover: #0056b3;
  
  /* 状态 */
  --danger: #ff3b30;
  --success: #34c759;
  --warning: #ff9500;
  
  /* 徽章 */
  --badge-active-bg: #e3f2fd;
  --badge-cropped-bg: #e8f5e9;
  --badge-removed-bg: #fce4ec;
  
  /* 原因徽章 */
  --reason-duplicate-bg: #fff3e0;
  --reason-exclusion-bg: #f3e5f5;
  --reason-ai-bg: #e8eaf6;
  
  /* Z-index */
  --z-base: 1;
  --z-dropdown: 10;
  --z-sticky: 20;
  --z-overlay: 30;
  --z-modal: 1000;
  --z-super-modal: 10000;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-page: #1a1a1a;
    --bg-surface: #2d2d2d;
    --text-primary: #e0e0e0;
    /* ... */
  }
}
```

**暗色模式**：通过 `@media (prefers-color-scheme: dark)` 自动切换，组件无需单独处理。

### 17.3 Z-index 层级

| 层级 | 变量 | 用途 |
|------|------|------|
| 1 | `--z-base` | 默认堆叠 |
| 10 | `--z-dropdown` | 下拉菜单、工具提示 |
| 20 | `--z-sticky` | 粘性头部 |
| 30 | `--z-overlay` | 覆盖层 |
| 1000 | `--z-modal` | 模态框 |
| 10000 | `--z-super-modal` | 系统级模态框（更新管理器、提取器安装） |

### 17.4 共享样式类

`src/renderer/shared/styles/components.css` 定义了共享组件类：

```css
/* 滚动条 */
.custom-scrollbar { /* macOS 风格细滚动条 */ }

/* 按钮 */
.btn { /* 基础按钮 */ }
.btn--primary { /* 主要按钮 */ }
.btn--danger { /* 危险按钮 */ }
.btn--success { /* 成功按钮 */ }
.btn--ghost { /* 幽灵按钮 */ }

/* 徽章 */
.badge { /* 基础徽章 */ }
.badge--active { /* 活跃状态 */ }
.badge--cropped { /* 已裁剪 */ }
.badge--removed { /* 已移除 */ }

/* 表单 */
.input-field { /* 输入框 */ }
.text-input { /* 文本输入 */ }
.field-label { /* 字段标签 */ }
```

---

## 18. 国际化

`src/renderer/shared/i18n/` 使用 `vue-i18n`：

```typescript
// index.ts
import { createI18n } from 'vue-i18n';
import en from './locales/en.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';

export const i18n = createI18n({
  legacy: false,
  locale: 'zh', // 默认语言
  fallbackLocale: 'en',
  messages: { en, zh, ja, ko }
});
```

支持的语言：英语（en）、中文（zh）、日语（ja）、韩语（ko）。

---

## 19. 构建系统

### 19.1 Electron Forge + Vite

项目使用 Electron Forge 作为构建框架，Vite 作为打包工具：

```typescript
// forge.config.ts
const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: '**/{*.node,sharp/**/*,@img/**/*,ort-wasm/**/*}'
    },
    extraResource: [
      'resources/terms',
      'resources/models',
      'node_modules/ffmpeg-static',
      'node_modules/sharp',
      // ...
    ]
  },
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main.ts', config: 'vite.main.config.ts', target: 'main' },
        { entry: 'src/preload/index.ts', config: 'vite.preload.config.ts', target: 'preload' },
        { entry: 'src/webviewCapturePreload.ts', config: 'vite.webviewPreload.config.ts', target: 'preload' },
      ],
      renderer: [
        { name: 'main_window', config: 'vite.renderer.config.ts' },
        { name: 'tools_window', config: 'vite.tools.config.ts' },
        { name: 'addons_window', config: 'vite.addons.config.ts' },
      ],
    }),
    new AutoUnpackNativesPlugin({}),  // 仅打包时
    new FusesPlugin({ ... }),          // 仅打包时
  ],
};
```

### 19.2 Vite 配置

| 配置文件 | 目标 | 用途 |
|----------|------|------|
| `vite.main.config.ts` | Main | 主进程打包 |
| `vite.renderer.config.ts` | Renderer | 主窗口渲染器 |
| `vite.tools.config.ts` | Renderer | 工具窗口渲染器 |
| `vite.addons.config.ts` | Renderer | 附加组件窗口渲染器 |
| `vite.preload.config.ts` | Preload | Preload 脚本 |
| `vite.webviewPreload.config.ts` | Preload | Webview 捕获 Preload |

### 19.3 打包与分发

```bash
# macOS
npm run package      # 打包应用
npm run make:mac     # 生成 DMG（通过 DropDMG）

# Windows
npm run make:win     # 生成安装包（通过 electron-builder + NSIS）
```

### 19.4 原生模块处理

| 模块 | 处理方式 |
|------|----------|
| **Sharp** | 打包时复制 `node_modules/sharp` 和 `node_modules/@img`，运行时通过 `sharpService` 延迟初始化 |
| **FFmpeg** | 使用 `ffmpeg-static` npm 包，打包时复制二进制文件 |
| **onnxruntime-web** | WASM 文件通过 `vite-plugin-static-copy` 复制到 `/ort-wasm/`，asar 解包 |
| **OpenCV.js** | 静态导入到 Worker，Vite 打包时内联 |

---

## 20. 依赖规则

### 20.1 主进程依赖图

```
infra/          ← 无内部依赖
platform/       ← infra/
video/          ← infra/, platform/
extraction/     ← infra/, platform/
ai/             ← infra/, platform/
export/         ← infra/, platform/
download/       ← infra/, platform/
```

### 20.2 渲染器依赖图

```
shared/workers/             ← 无内部依赖
shared/processing/          ← shared/workers/
shared/postProcessing/      ← shared/workers/
shared/autoCrop/            ← shared/workers/
shared/services/            ← 无内部依赖（被 features 和 orchestration 消费）
shared/orchestration/       ← shared/services/

features/<any>/             ← shared/<any>/
features/video/             ← features/course/ (Course 类型 — 白名单)
features/download/          ← features/video/, features/course/ (PlaybackData, Session 类型 — 白名单)
```

### 20.3 ESLint 边界强制

`eslint.config.mjs` 使用 `no-restricted-imports` 规则强制领域边界：

```javascript
// Feature 领域边界
const FEATURE_DOMAINS = ['video', 'results', 'offline', 'download', 'ai', 'export', 
                         'course', 'settings', 'platform', 'webCapture', 'tools'];

function featureBoundaryRule(self, allowed = []) {
  const allow = new Set([self, ...allowed]);
  const forbidden = FEATURE_DOMAINS.filter(d => !allow.has(d));
  return {
    'no-restricted-imports': ['error', {
      patterns: forbidden.map(d => ({
        group: [`@features/${d}/*`, `@features/${d}`],
        message: `Feature domain '${self}' may not import from sibling domain '${d}'.`,
      })),
    }],
  };
}

// 白名单例外
{ files: ['src/renderer/features/video/**/*.{ts,vue}'], 
  rules: featureBoundaryRule('video', ['course']) },
{ files: ['src/renderer/features/download/**/*.{ts,vue}'], 
  rules: featureBoundaryRule('download', ['video', 'course', 'ai']) },
// ...
```

---

## 21. IPC 通信全景

### 命名空间划分

| 命名空间 | Preload 模块 | 功能 |
|----------|--------------|------|
| `isDemoMode` | `index.ts` | 演示模式标志（`process.argv.includes('--demo-mode')`） |
| `auth` | `platform.ts` | 登录、Token 验证、浏览器数据清理 |
| `config` | `platform.ts` | 配置 getter/setter + `onUpdate` 推送 |
| `api` | `course.ts` | 后端 API（课程、课时、直播、学期） |
| `intranet` | `intranet.ts` | 内网模式状态和映射 |
| `video` | `video.ts` | 视频代理管理 |
| `ffmpeg` | `video.ts` | FFmpeg 路径和可用性 |
| `compressLecture` | `video.ts` | 视频压缩 |
| `download` | `video.ts` | 下载控制和进度事件 |
| `slideExtraction` | `extraction.ts` | 幻灯片文件操作 |
| `offline` | `extraction.ts` | 离线处理 |
| `trash` | `extraction.ts` | 结果视图操作 |
| `crop` | `extraction.ts` | 裁剪操作 |
| `autoCrop` | `extraction.ts` | 自动裁剪 |
| `mlClassifier` | `extraction.ts` | ML 分类器 |
| `qtExtractor` | `extraction.ts` | Qt 提取器 |
| `ai` | `ai.ts` | AI 分类 |
| `copilot` | `ai.ts` | GitHub Copilot OAuth |
| `pdfmaker` | `export.ts` | PDF 生成 |
| `yuketang` | `export.ts` | 雨课堂 |
| `api` | `course.ts` | 后端 API |
| `update` | `update.ts` | 应用更新 |
| `extractorInstaller` | `update.ts` | 提取器安装 |
| `tools` | `tools.ts` | 工具窗口管理 |
| `addons` | `tools.ts` | 附加组件窗口 |
| `webCapture` | `tools.ts` | Web 捕获 |
| `dialog` | `platform.ts` | 消息/错误对话框 |
| `window` | `platform.ts` | 窗口控制 |
| `shell` | `platform.ts` | 外部链接和文件打开 |
| `menu` | `platform.ts` | 菜单操作 |
| `powerManagement` | `platform.ts` | 系统休眠阻止 |
| `cache` | `platform.ts` | 缓存统计和清理 |
| `app` | `platform.ts` | 应用重启 |

### 事件通道

| 通道 | 方向 | 用途 |
|------|------|------|
| `config:onUpdate` | Main → Renderer | 配置变更推送 |
| `download:progress` | Main → Renderer | 下载进度 |
| `download:completed` | Main → Renderer | 下载完成 |
| `download:error` | Main → Renderer | 下载错误 |
| `compressLecture:progress` | Main → Renderer | 压缩进度 |
| `compressLecture:completed` | Main → Renderer | 压缩完成 |
| `compressLecture:error` | Main → Renderer | 压缩错误 |
| `qtExtractor:progress` | Main → Renderer | 提取进度 |
| `qtExtractor:slidesExtracted` | Main → Renderer | 幻灯片已提取 |
| `qtExtractor:completed` | Main → Renderer | 提取完成 |
| `qtExtractor:error` | Main → Renderer | 提取错误 |
| `qtExtractor:cancelled` | Main → Renderer | 提取取消 |
| `update:autoCheck` | Main → Renderer | 自动检查更新 |

---

## 22. 开发命令

所有命令在 `autoslides/` 子目录运行：

```bash
cd autoslides

npm start              # 启动开发服务器（热重载）
npm run demo           # DEMO_MODE=1 启动（虚构账户/课程，用于截图）
npm run screenshots    # Playwright 驱动截图（--no-native 仅 web 风格）
npm run package        # 打包应用
npm run make:mac       # 生成 macOS DMG
npm run make:win       # 生成 Windows 安装包
npm run make:linux     # 生成 Linux 安装包
npm run lint           # 运行 ESLint
npm test               # 运行单元测试 (Vitest, node 环境)
npm run test:watch     # 监视模式运行测试
```

---

## 23. 验证步骤

任何代码变更后：

1. **类型检查**：`cd autoslides && npx tsc --noEmit`
2. **Lint 检查**：`cd autoslides && npm run lint`（包含领域边界规则）
3. **启动测试**：`cd autoslides && npm start`（应用启动 3 个窗口，无控制台错误）
4. **冒烟测试**：测试变更涉及的功能域

---

## 24. 图像分析设计

> 图像分析算法的技术细节和数学推导请参阅 [AutoSlides Image Analysis Technical Report](docs/image-analysis-technical-report.pdf)。

### 24.1 在线幻灯片检测

在线提取只使用 SSIM 判断画面是否发生结构性变化。每一帧先按配置缩放到较小尺寸（默认 `480 x 270`），再转为灰度图：

$$
Y = 0.299R + 0.587G + 0.114B
$$

对两帧灰度图 $x,y$ 计算全局结构相似度：

$$
\mathrm{SSIM}(x,y)=
\frac{(2\mu_x\mu_y+C_1)(2\sigma_{xy}+C_2)}
{(\mu_x^2+\mu_y^2+C_1)(\sigma_x^2+\sigma_y^2+C_2)}
$$

其中：

$$
C_1=(0.01\cdot255)^2,\qquad C_2=(0.03\cdot255)^2
$$

当：

$$
\mathrm{SSIM}(x,y) < \tau
$$

即可认为当前帧与上一张已保存幻灯片存在显著变化。默认阈值使用 `自适应` 模式：常规情况下为 `0.9987`，当教室名称包含 `综教`、`理教` 或 `研楼` 时自动切换到更宽松的 `0.998`，以适应老旧设备或较差录制质量。

为了减少动画、鼠标移动、视频片段造成的误检，提取器还会运行稳定性复核。检测到候选帧 $c$ 后，后续连续帧 $f_i$ 必须满足：

$$
\mathrm{SSIM}(c,f_i) \ge \tau
$$

达到配置的复核次数后才保存。默认检测间隔为 `2000 ms`，播放倍速变化时会按倍速重新计算实际检查间隔；13 倍速以上使用上限因子，避免浏览器定时器和视频渲染在极高倍速下出现不稳定。

**实现位置**：`src/renderer/shared/processing/changeDetection.ts`（`ChangeDetector` 类）、`src/renderer/shared/workers/slideProcessor.worker.ts`（SSIM 计算）。

### 24.2 pHash 去重与排除

后处理的前两阶段使用感知哈希。图像会先转灰度并缩放到 `64 x 64`，随后计算二维 DCT：

$$
D_{u,v}=
\frac{2}{N}\alpha(u)\alpha(v)
\sum_{x=0}^{N-1}\sum_{y=0}^{N-1}
I_{x,y}
\cos\frac{(2x+1)u\pi}{2N}
\cos\frac{(2y+1)v\pi}{2N}
$$

其中 $\alpha(0)=1/\sqrt{2}$，其余 $\alpha(k)=1$。实现取左上角 `16 x 16` 低频块，跳过 DC 项后，用 AC 系数中位数生成固定位宽哈希：

$$
h_i=
\begin{cases}
1, & D_i \ge \mathrm{median}(D) \\
0, & D_i < \mathrm{median}(D)
\end{cases}
$$

两张图像的相似度用汉明距离衡量：

$$
d_H(h_a,h_b)=\sum_i (h_{a,i}\oplus h_{b,i})
$$

当 $d_H \le 10$（默认阈值）时，后出现的图像会被视为重复项并移入回收站。排除列表使用同一套 pHash 机制，因此可以稳定过滤 `No Signal`、黑屏、桌面背景或用户自定义错误页。

**实现位置**：`src/renderer/shared/workers/postProcessor.worker.ts`（pHash 计算）、`src/renderer/shared/postProcessing/phase1Duplicates.ts`（去重逻辑）、`phase2Exclusion.ts`（排除列表过滤）。

### 24.3 AI / ML 语义过滤

SSIM 和 pHash 只判断像素变化与视觉相似度，无法可靠区分"完整幻灯片"和"非幻灯片页面"。因此第三阶段引入语义分类：

- `LLM` 模式把图像缩放到默认 `768 x 432` 后发送给多模态模型，要求返回结构化 JSON。
- `ML` 模式在本机运行 MobileNetV4 ONNX 分类器，类别为 `may_be_slide`、`not_slide`、`slide`。
- 当开启 `Distinguish may_be_slide` 时，编辑模式截图会进入 `AI 过滤 - 编辑模式`，用户可以在 `幻灯片审查页面` 中恢复并自动裁剪。

本地 ML 的输出 logits $z_i$ 会先转为概率：

$$
p_i=\frac{e^{z_i}}{\sum_j e^{z_j}}
$$

随后按置信度区间做保守决策：若预测为 `slide`，直接保留；若预测为非幻灯片但置信度低于 `trustLow`，也保留；若置信度高于 `trustHigh`，按预测类别移除；中间区间则检查 `slide` 概率，只有当 $p_\text{slide}$ 低于 `slideCheckLow` 时才移除。默认阈值为：

| 参数 | 默认值 | 含义 |
| --- | --- | --- |
| `trustLow` | `0.75` | 低于该值时不信任非幻灯片判断 |
| `trustHigh` | `0.90` | 高于该值时信任非幻灯片判断 |
| `slideCheckLow` | `0.25` | 中间区间内用于兜底保留幻灯片的概率阈值 |

**实现位置**：`src/renderer/shared/postProcessing/phase3AI.ts`（AI 阶段协调）、`src/renderer/features/ai/slideClassificationService.ts`（LLM 分类）、`src/renderer/shared/workers/slideClassifier.worker.ts`（ML 推理）。

### 24.4 自动裁剪

自动裁剪默认使用 `canny_then_yolo`：先运行传统 CV 管线，检测失败时再回退到 YOLOv8 ONNX 模型。

传统管线步骤如下：

1. 扫描图像四边，移除灰度均值低于 `blackThreshold` 的黑边，最多扫描宽高的 `maxBorderFrac`。
2. 对内部区域运行 Canny 边缘检测和一次膨胀。
3. 查找轮廓并要求近似多边形为四边形。
4. 使用面积占比、边缘填充率和宽高比评分筛选候选框。

宽高比评分以 `16:9` 和 `4:3` 为目标：

$$
s_\text{aspect}=\max\left(0,1-\frac{\min_{a\in\{16/9,4/3\}}\left|\frac{w/h-a}{a}\right|}{\epsilon}\right)
$$

候选框最终分数为：

$$
s = s_\text{aspect}\cdot \frac{w h}{W H}
$$

其中 $W,H$ 是去黑边后的内部区域尺寸。若 Canny 未找到可靠候选框，YOLO 分支会把图像 letterbox 到固定输入尺寸，解码 `(cx, cy, w, h, confidence)` 输出，并用 NMS 去除重叠框：

$$
\mathrm{IoU}(A,B)=\frac{|A\cap B|}{|A\cup B|}
$$

YOLO 的默认置信度阈值为 `0.25`，NMS IoU 阈值为 `0.45`，输入尺寸为 `640`。`onnxruntime-web` 在 Worker 内使用 WASM 后端，并设置单线程运行，避免依赖 `SharedArrayBuffer` 相关浏览器隔离策略。

**实现位置**：`src/renderer/shared/workers/autoCrop.worker.ts`（Canny + YOLO 推理）、`src/renderer/shared/autoCrop/autoCropPipeline.ts`（批次处理协调）。

---

## 附录：关键设计模式

### 1. 状态机模式
- **纯函数**：`reduceExtraction()` 和 `reduceTask()` 是纯函数，无副作用
- **唯一写入者**：编排器是状态的唯一写入者
- **可测试**：状态机可独立单元测试

### 2. 适配器模式
- `SlideExtractionAdapter`：调用者提供回调，流水线调用回调
- `PipelineDataSource`：后处理流水线的数据源抽象
- `AutoCropImageSource`：自动裁剪的图像读写抽象

### 3. 门面模式
- `extractionQueueService.ts`：3 行门面导出 `ExtractionOrchestrator` 单例
- `useAdvancedSettings.ts`：组合多个子设置 composable
- `useAISettings.ts`：AI 设置门面

### 4. 依赖注入
- `IpcServices`：主进程 IPC 的依赖注入容器
- `ExtractionOrchestrator.setJobProvider()`：打破循环依赖
- `PostProcessingService.setClassifier()`：注入 AI 分类器

### 5. 观察者模式
- `configStore`：Vue `reactive()` + `config:onUpdate` 广播
- `PostProcessingService.subscribe()`：作业状态订阅
- `TaskCoordinator.driverWaiters`：驱动注册等待

### 6. 单例模式
- `SlideExtractionManager`：管理多个流水线实例
- `TaskCoordinator`：全局任务协调
- `DownloadService`、`PostProcessingService`、`TaskQueue`：全局服务单例
