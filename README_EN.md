<div align="center">

  <img src="docs/icon.png" width="120" />

  # AutoSlides
  
  **Unofficial Client for BIT Yanhekt | Auto Slide Extraction | Download Course Videos | AI Filtering**

  <p>
    <img src="https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/YDX-2147483647/best-of-bits/main/config/badge/v1.json" alt="best of BITs">
    <img src="https://img.shields.io/github/downloads/bit-admin/Yanhekt-AutoSlides/total?color=orange&logo=docusign" alt="Downloads">
    <img src="https://img.shields.io/github/v/release/bit-admin/Yanhekt-AutoSlides?color=blue" alt="Version">
    <img src="https://img.shields.io/badge/platform-win%20%7C%20mac%20%7C%20linux-lightgrey?color=green" alt="Platform">
  </p>

  <p>
    <img src="https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white" alt="Electron">
    <img src="https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vue.js&logoColor=4FC08D" alt="Vue.js">
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  </p>

  <p>
    <a href="#-quick-start">🚀 Quick Start</a> • 
    <a href="#-features">✨ Features</a> • 
    <a href="#-architecture">🛠 Architecture</a>
  </p>

  <p>
    <a href="./README_EN.md">English</a> | <a href="./README.md">简体中文</a>
  </p>

</div>

---

## ✨ Features

- Handles Yanhekt anti-hotlinking protection based on reverse engineering, enabling video playback and downloads.
- Optimized for campus networks: watch Yanhekt videos without buffering; smooth playback at 10x speed for recorded videos; download speeds up to 110MB/s<sup>1</sup>.
- Run slide extraction simultaneously with video playback; no need to download videos; a 145-minute course is processed in 15 minutes at 10x speed.
- Prevents system sleep during slide extraction tasks, allowing for long overnight runs.

> [!TIP]
> To speed up processing, you can use `AutoSlides` to download course videos and then use `AutoSlides Extractor` for processing.

- AI filtering based on multimodal large language models (vLLM) to remove non-fullscreen slide images and other distracting content.

> [!TIP]
> vLLM processing is extremely effective, with a tested accuracy of 99.9%, far superior to machine learning model solutions.
>
> Recommended models: `gpt-4.1`, `Qwen/Qwen3-VL-235B-A22B-Instruct`, `Qwen/Qwen3-VL-30B-A3B-Instruct`, and `Qwen/Qwen3-VL-8B-Instruct`. Tests show that even the lightweight model `qwen3-vl-2b-instruct` running locally via LM Studio achieves good recognition results.

- Merge the extracted slides into a PDF; compress images to reduce file size.

<p align="center">
  <img src="docs/cover.png" alt="AutoSlides Cover" width="60%">
</p>


> [!CAUTION]
> **Disclaimer**: This tool is intended strictly for personal study; users assume full legal responsibility for ensuring their usage complies with all applicable copyright laws and platform regulations. Terms and Conditions available here: [TERMS AND CONDITIONS](docs/terms.md)
> 
> This tool is NOT an official application of, and is NOT affiliated with, associated with, endorsed by, or in any way connected to Beijing Institute of Technology (BIT), or any of their subsidiaries or affiliates. All product and company names are trademarks™ or registered® trademarks of their respective holders.


### Related Projects

<table>
  <thead>
    <tr>
      <th width="155">Project / Category</th>
      <th width="190">GitHub Repository</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <a href="https://learn.ruc.edu.kg">Web Version</a> 👈
      </td>
      <td>
        <a href="https://github.com/bit-admin/Yanhe-Web">bit&#8209;admin/Yanhe-Web</a>
      </td>
      <td>
        Watch live courses campus-wide, run slide extraction on mobile devices<sup>2</sup>; take notes and export as documents<sup>3</sup>.
      </td>
    </tr>
    <tr>
      <td>Extractor Tool</td>
      <td>
        <a href="https://github.com/bit-admin/AutoSlides-Extractor">bit&#8209;admin/AutoSlides-Extractor</a>
      </td>
      <td>
        Extract slides from downloaded screen recordings; process a single course video in as little as 10 seconds<sup>4</sup>; supports GPU acceleration; built with C++; uses the same image processing algorithms as <code>AutoSlides</code> and a <code>MobileNetV4</code>-based machine learning model.
      </td>
    </tr>
    <tr>
      <td>Yanhekt Downloader</td>
      <td>
        <a href="https://github.com/bit-admin/Yanhekt-downloader-electron">bit&#8209;admin/Yanhekt-downloader-electron</a>
      </td>
      <td>
        Video download functionality rewritten based on this project; special thanks to <a href="https://github.com/AuYang261/BIT_yanhe_download">AuYang261/BIT_yanhe_download</a> for ideas and references.
      </td>
    </tr>
    <tr>
      <td>BIT SSO Login Module</td>
      <td>
        <a href="https://github.com/bit-admin/bit-sso">bit&#8209;admin/bit-sso</a>
      </td>
      <td>
        Yanhekt login functionality based on this project; reverse-engineered login module<sup>5</sup>; Yanhekt login implementation based on edge functions.
      </td>
    </tr>
  </tbody>
</table>

---

<sup>1</sup> When connected to the campus network via wired connection, peak download speeds can reach 120MB/s; speeds are slower via Wi-Fi.

<sup>2</sup> The web version uses simplified image processing algorithms suitable for both desktop and mobile devices.

<sup>3</sup> The web version provides note-taking and exporting to Word and Markdown documents.

<sup>4</sup> **Using both tools together is faster**: Using `AutoSlides` to download a 95-minute course screen recording takes about 10 seconds on the campus network; using `AutoSlides Extractor` to process that video (I-frame interval 2s) takes about 10 seconds on an M4 Mac mini.

<sup>5</sup> Can only handle login with account/password via BIT Unified Identity Authentication; login during "non-routine hours" may require secondary verification; pre-verify at [sso.bit.edu.cn](https://sso.bit.edu.cn).

## 🚀 Quick Start

### 1. Download

- Go to the [release page](https://github.com/bit-admin/Yanhekt-AutoSlides/releases) 👈 to download the installer for your platform (macOS users download `DMG` file; Windows users download `EXE` file; Linux users download `AppImage` or `deb` file).

### 2. Install
   - **macOS**: Open the `.dmg` installer and drag the app icon to the `Applications` folder.
      - Double-click the `install.command` file inside the installer to run the installation script. You will receive an "Apple cannot verify security" prompt; close this prompt first.
      - Open `System Settings > Privacy & Security`, as shown, click `Open Anyway`.
      - Enter your Mac password in the terminal (note that the password will not be displayed while typing).

<p align="center">
  <img src="docs/dmg.png" alt="AutoSlides DMG Installer" width="100%">
</p>

> [!IMPORTANT]
> - macOS marks downloaded applications as "quarantined" to ensure safety.
> - AutoSlides does not use an Apple Developer Certificate.
> - Besides double-clicking `install.command`, you can also manually run the following command in the terminal to remove the quarantine attribute and allow the application to run normally:
>   ```shell
>   sudo xattr -d com.apple.quarantine /Applications/AutoSlides.app
>   ```

   - **Windows**: Run the `.exe` installer and follow the setup wizard.

   - **Linux**:
     - **AppImage**: Download the `.AppImage` file, add execute permission and run:
       ```bash
       chmod +x AutoSlides-*.AppImage
       ./AutoSlides-*.AppImage
       ```
     - **Deb Package** (Debian/Ubuntu):
       ```bash
       sudo apt install ./AutoSlides-*.deb
       ```

> [!NOTE]
> **Linux Users Note**: Video download functionality requires FFmpeg. The app bundles an FFmpeg binary, but it may not be compatible with some Linux distributions (especially ARM64 architecture). If download functionality has issues, install system FFmpeg:
> ```bash
> # Debian/Ubuntu
> sudo apt install ffmpeg
>
> # Fedora
> sudo dnf install ffmpeg
>
> # Arch Linux
> sudo pacman -S ffmpeg
> ```
> The app will automatically detect and use system-installed FFmpeg.

### 3. Check for Updates

- Click `Menu Bar > AutoSlides > Check for Updates...` (on Windows/Linux `Menu Bar > Help > Check for Updates...`) to see if a new version is released.
- Manually download and install the latest version from the [release page](https://github.com/bit-admin/Yanhekt-AutoSlides/releases).

> [!NOTE]
> - Due to lack of backward compatibility, it is recommended to always completely remove the old version before installing a new version of `AutoSlides`.
> - If you encounter problems after installing a new version, try using the `Advanced Settings > General > Reset All Data` function; alternatively, you can remove the support files for the old version:
>   - **macOS**: Run the following command in the terminal or manually find and remove `~/Library/Application\ Support/AutoSlides`:
>     ```bash
>     rm -rf ~/Library/Application\ Support/AutoSlides
>     ```
>   - **Windows**: Find and remove `C:\Users\<Your Username>\AppData\Roaming\AutoSlides` or `C:\ProgramData\AutoSlides`
>   - **Linux**: Find and remove `~/.config/AutoSlides`:
>     ```bash
>     rm -rf ~/.config/AutoSlides
>     ```

### 4. Usage & Settings

<img src="docs/step1.png" align="right" width="70%" alt="step1" />

#### A. Basic Settings

1. Launch the application, login using BIT Unified Identity Authentication account and password.
2. Adjust `Output Directory` as needed, default is `~/Downloads/AutoSlides` (recommended to set as an independent folder).
3. When on campus network, switch `Connection Mode` to `Intranet Mode` for better connection experience and faster access to course resources.
4. Adjust `Audio Mode` as needed; you can mute the application.

<br clear="both">

<img src="docs/step1.1.png" align="right" width="70%" alt="step1" />

#### B. Basic UI Introduction

BIT Unified Identity Authentication may occasionally require SMS verification code for secondary verification [#1](https://github.com/bit-admin/Yanhekt-AutoSlides/issues/1). Since `v4.1.1`, you can also use browser login.

1. Click `Browser Login`.
2. The official login interface will open in the built-in browser.
3. After logging in and redirecting to the Yanhekt page, the Yanhekt token will be automatically retrieved. If issues occur, you can also try manually clicking the `Get Token` button.
4. Click `Clear Data` button to clear website login data, including cookies and localstorage.


<br clear="both">

<img src="docs/step2.png" align="right" width="70%" alt="step2" />

<br>

5. Basic settings for slide extraction include `Slide Detection Interval`, `Slide Stability Check`, and `Task Speed`. Default settings are recommended.
6. `Auto Post-processing` setting is enabled by default in both Live and Recorded modes.
  - In Live mode, post-processing occurs every time a slide is saved.
  - In Recorded mode, post-processing occurs when the current task completes (course needs to be added to the task list).
7. Click buttons in the status bar to `View App Recycle Bin` and `Merge PDF` (formerly `Open Output Directory` in versions prior to `v4.1.1`).
8. `Live` and `Recorded` modes can run simultaneously; video playback continues when switching modes.

<br clear="both">

<img src="docs/step3.png" align="right" width="70%" alt="step3" />

#### C. Advanced Settings Introduction

For detailed configuration of `Advanced Settings`, please refer to the [Configuration Table](#5-configuration-table) below.

9. It is recommended to adjust defaults in `Image Processing` tab only when necessary; some parameters are highly sensitive, and even minor changes may significantly affect performance.
10. `Post-processing` includes `Deduplication`, `Exclusion List`, and `AI Filtering` stages, all enabled by default, adjustable as needed.

<br clear="both">

<img src="docs/step4.png" align="right" width="70%" alt="step4" />

<br>

11. `AI` tab contains configurations for AI filtering function. AI service can switch between `Built-in` and `Custom` services.
  - Built-in service is a shared service provided for free, usable with `gpt-4.1` model after login; **availability of shared service depends on situation**.
  - Custom service allows configuration of `API Base URL`, `API Key`, and `Model Name`; learn more: [AI Configuration Docs](https://it.ruc.edu.kg/zh/docs).

> [!IMPORTANT]
> The Built-in service is provided by the developer free of charge and on an "as is" basis. We make no warranties, express or implied, regarding the continuity or stability of the service, and we may modify or interrupt the service at any time without prior notice. The user agrees to use the service in a reasonable, fair, and non-commercial manner.

<br clear="both">

<img src="docs/step5.png" align="right" width="70%" alt="step5" />

#### D. App Usage

12. In the course session interface, click control bar buttons `Add Course to Slide Extraction Task`, `Download Classroom Camera Video`, and `Download Course Screen Recording`.
13. After adding items to `Slide Extraction Task`, click `Start` button to start the task queue.

<br clear="both">

<img src="docs/step6.png" align="right" width="70%" alt="step6" />

<br>

14. After starting the task, course screen recordings will play sequentially at `Task Speed` and slide extraction will start.
15. Slide images saved to the output directory will also be displayed in the slide list below.

<br clear="both">

<img src="docs/step7.png" align="right" width="70%" alt="step7" />

<br>

16. After each task completes, the `Post-processing Stage` will execute automatically. AI filtering may take some time to avoid API rate limits.
17. It is recommended to click `View App Recycle Bin` after post-processing to check for AI filtering errors.

> [!TIP]
> `App Recycle Bin` is located in the `.autoslidesTrash` folder under `Output Directory` on the hard drive.

<br clear="both">

<img src="docs/step8.png" align="right" width="70%" alt="step8" />

<br>

18. In `App Recycle Bin` interface, you can filter images by `Folder` and `Exclusion Method`.
  - `Exclusion Method` includes `Duplicate`, `Excluded`, `AI Filtered`, and `Manual`.
  - `Duplicate` refers to situations like `A -> B -> A`, where the speaker returns to a slide; only the first occurrence is kept, subsequent ones are deleted.
  - `Excluded` refers to pre-set exclusion items. `Exclusion List` includes `No Signal`, `No Input`, `Black Screen`, and `Desktop`; configurable in `Advanced Settings > Image Processing > pHash Exclusion List`.
  - `AI Filtered` are images judged by AI as non-fullscreen slides. To modify AI criteria, edit in `Advanced Settings > AI > AI Prompts`.

<br clear="both">

<img src="docs/step9.png" align="right" width="70%" alt="step9" />

<br>

19. **AI may make mistakes**. It is recommended to filter and check AI filtering results.
20. Select images you wish to restore, click `Restore Selected` button to put them back.

<br clear="both">

<img src="docs/step10.png" align="right" width="70%" alt="step9" />

21. Since `v4.1.1`, click `Merge PDF` to enter PDF maker interface, where you can merge course slide images into a PDF file.
22. Select folders to merge as PDF folders. Folder sorting is optimized by natural order, but you can also manually drag and drop to reorder. When making PDF files, you can enable compression options to reduce PDF file size.
- 3 preset compression levels.
- Compression via `Compress PNG Image Palette Size` and `Reduce Resolution`.

<br clear="both">

<img src="docs/step11.png" align="right" width="70%" alt="step9" />

<br>

23. Before merging PDF, you can double-click folders to check saved images. Select images you don't need and click `Delete`. Images will be moved to `App Recycle Bin`.


<br clear="both">

### 5. Configuration Table

#### A. Basic Settings

| Setting | Default | Range/Options | Description |
| --- | --- | --- | --- |
| Output Directory | ~/Downloads/AutoSlides | Folder Path | Save location for slides and downloaded files |
| Connection Mode | Extranet | Intranet / Extranet | Select network connection mode for video streams |
| Audio Mode | Normal | Normal / Mute All / Mute Live / Mute Recorded | Control audio during video playback |
| Slide Detection Interval | 2000 | 1000-10000 ms (step 500) | Time interval for detecting new slides |
| Slide Stability Check | Enabled, 2 times | Enabled/Disabled, 1-5 times | If enabled, requires multiple checks to confirm slide stability before saving |
| Task Speed | 10x | 1x - 10x | Playback speed for recorded video in task queue |
| Auto Post-processing (Live) | Enabled | Enabled/Disabled | Automatically execute post-processing every time a slide is saved during live playback |
| Auto Post-processing (Recorded) | Enabled | Enabled/Disabled | Automatically execute post-processing after recorded extraction task ends |

#### B. Advanced Settings

| Setting | Default | Range/Options | Description |
| --- | --- | --- | --- |
| **1. General** |  |  |  |
| Token | - | Text Input | Manually input auth token to login |
| Theme | Light | Follow System / Light / Dark | Application appearance theme |
| Language | Follow System | Follow System / English / 中文 / 日本語 / 한국어 | Interface language setting |
| Cache Management | - | Refresh / Clear Cache / Reset All Data | Manage application cache |
| **2. Image Processing** |  |  |  |
| Enable PNG Color Compression | Enabled | Enabled/Disabled | Reduce PNG colors to 128, significantly reducing file size |
| SSIM Threshold | 0.9987 (Adaptive) | 0.9-1.0 (step 0.0001), Preset: Adaptive/Strict/Standard/Relaxed/Custom | Image similarity threshold for judging new slides |
| Enable Downsampling | Enabled (480×270) | Enabled/Disabled, Resolution: 320×180 / 480×270 / 640×360 / 800×450 | Image anti-aliasing |
| Post-processing Stage - Deduplication | Enabled | Enabled/Disabled | Remove duplicate slides based on pHash |
| Post-processing Stage - Exclusion List | Enabled | Enabled/Disabled | Filter images based on pHash exclusion list |
| Post-processing Stage - AI Filtering | Enabled | Enabled/Disabled | Use AI to filter non-slide images |
| pHash Threshold | 10 | 0-256 (Hamming Distance) | Perceptual hash threshold for duplicate detection in post-processing |
| pHash Exclusion List | 4 Presets | Add/Delete Images | Set list of pHash images to exclude |
| **3. Playback & Download** |  |  |  |
| Video Error Retry Count | 5 | 5-10 times | Retry count when video load fails |
| Prevent System Sleep | Enabled | Enabled/Disabled | Prevent system sleep while task is running |
| Concurrent Download Limit | 5 | 1-10 | Max simultaneous downloads |
| **4. Network** |  |  |  |
| Intranet Mapping | - | Read-only | Show domain to IP mapping configuration (Single IP/Load Balancing) |
| **5. AI** |  |  |  |
| Service Type | Built-in | Built-in / Custom | AI service provider |
| API Base URL | - | Text Input (with presets) | Custom API Base URL |
| API Key | - | Text Input | Custom API Key |
| Model Name | - | Text Input (with presets) | AI Model Name used |
| Request Rate Limit | 10 | 1-10 (Built-in) / 1-60 (Custom) times/min | Max requests per minute |
| Max Concurrent Requests | 1 | 1-10 | Max simultaneous requests |
| Min Request Interval | 6000 | 0-60000 ms (step 100) | Min interval between two requests |
| Batch Size | 5 | 1-10 images | Number of images per batch request |
| AI Image Scaling | 768×432 | 512×288 / 768×432 / 1024×576 / 1920×1080 | Image scaling before AI processing |
| Live Mode Prompt | - | Text Input | System prompt for AI filtering in Live mode |
| Recorded Mode Prompt | - | Text Input | System prompt for AI filtering in Recorded mode |

#### C. Core Parameter Introduction

> [!NOTE]
> - SSIM Threshold: Higher Global Structure Similarity threshold means stricter matching.
>   - Recommended to adjust only when necessary. Even 0.001 change can significantly affect performance.
>   - Use [Online Test](https://learn.ruc.edu.kg/test) 👈 or open `test-image-comparison.html` in browser to test and calibrate SSIM algorithm.

1. `SSIM Threshold` contains five preset modes: `Adaptive/Strict(0.999)/Standard(0.9987)/Relaxed(0.998)/Custom(0.990-0.9999)`.
  - `Adaptive` mode is specially optimized for different teaching buildings; some buildings have older equipment/poor video quality, making them suitable for a more relaxed threshold.
  - `Classroom Location Rules`: "Zongjiao/Lijiao/Yanlou" → Relaxed; Others → Normal.
  - `Strict` mode has extremely high detection sensitivity.
  - `Standard` mode is relatively balanced, effectively detecting small text additions/deletions.

<table align="center" width="100%">
  <tr>
    <td align="center" width="33%">
      <img src="docs/a.png" alt="Fig 1" />
      <br>
      <strong>Relaxed Mode</strong>
    </td>
    <td align="center" width="33%">
      <img src="docs/b.png" alt="Fig 2" />
      <br>
      <strong>Strict Mode</strong>
    </td>
    <td align="center" width="33%">
      <img src="docs/c.png" alt="Fig 3" />
      <br>
      <strong>Standard Mode</strong>
    </td>
  </tr>
</table>

2. `Slide Stability Check` is based on the assumption that a speaker usually stays on the same slide for a while to explain. Checking if a new slide remains unchanged for several consecutive checks excludes animations, videos, and slight movements.
  - With `Slide Stability Check` enabled, `Check Count` set to `2`, and `Slide Detection Interval` set to `2000` ms, a slide is saved only if it "stably" displays for at least `6` seconds.
  - `Slide Detection Interval` is the interval at 1x speed. Actual interval adjusts with playback speed; at high speeds, `JavaScript` execution is slowed, with a minimum actual interval of `200` ms.

> [!TIP]
> If the speaker flips slides quickly, some slides shown for too short a time won't be saved if `Slide Stability Check` is enabled.
>
> This is reasonable because if you can't write it down in class, you probably can't save it. If you believe the skipped slides are important, you can manually pause during playback to capture them.

3. Image compression uses `PNG Color Compression`.
  - Normal PNGs use "True Color" mode, where each pixel's color is directly defined by red, green, blue, and alpha channels. This mode can show millions of colors but results in large file sizes.
  - `Compress PNG Image Palette Size` quantizes colors to 128 or fewer significantly reducing file size.
  - For slides with limited colors, compression is effective with little visual loss, keeping text sharp.

<table align="center" width="100%">
  <tr>
    <td align="center" width="50%">
      <img src="docs/normal.png" alt="Fig 1" />
      <br>
      <strong>Original Size 965 KB</strong>
    </td>
    <td align="center" width="50%">
      <img src="docs/small.png" alt="Fig 2" />
      <br>
      <strong>Compressed to 128 colors only 79 KB</strong>
    </td>
  </tr>
</table>

## 🛠 Architecture

### SSIM-based Slide Detection

AutoSlides uses a modified Global Structure Similarity Index (G-SSIM) for image comparison to detect slide changes, confirmed through a dual verification mechanism. Full technical details can be found in [`report.pdf`](report.pdf).

```typescript
// Core SSIM Calculation (Simplified)
function calculateSSIM(img1: ImageData, img2: ImageData): number {
  const gray1 = convertToGrayscale(img1);
  const gray2 = convertToGrayscale(img2);

  // Calculate means, variances and covariance
  const [mean1, mean2] = calculateMeans(gray1, gray2);
  const [var1, var2, covar] = calculateVariances(gray1, gray2, mean1, mean2);

  // SSIM formula constants
  const C1 = 0.01 * 255 * 0.01 * 255;
  const C2 = 0.03 * 255 * 0.03 * 255;

  const numerator = (2 * mean1 * mean2 + C1) * (2 * covar + C2);
  const denominator = (mean1 * mean1 + mean2 * mean2 + C1) * (var1 + var2 + C2);

  return numerator / denominator;
}
```

### Project Main Structure

<div align="left">

<table>
<tr>
<td valign="top" width="50%">

#### Main Process & Root

```text
autoslides/src/
├── main/
│   ├── aiFilteringService.ts
│   ├── aiPromptsService.ts
│   ├── apiClient.ts
│   ├── authService.ts
│   ├── cacheManagementService.ts
│   ├── configService.ts
│   ├── ffmpegService.ts
│   ├── intranetMappingService.ts
│   ├── m3u8DownloadService.ts
│   ├── powerManagementService.ts
│   ├── slideExtractionService.ts
│   ├── themeService.ts
│   └── videoProxyService.ts
├── App.vue
├── index.css
├── main.ts
├── preload.ts
├── renderer.ts
├── trash.ts
└── vite-env.d.ts

```

</td>
<td valign="top" width="50%">

#### Renderer Process

```text
renderer/
├── components/
│   ├── CoursePage.vue
│   ├── LeftPanel.vue
│   ├── MainContent.vue
│   ├── PlaybackPage.vue
│   ├── RightPanel.vue
│   ├── SessionPage.vue
│   ├── TitleBar.vue
│   └── TrashWindow.vue
├── composables/
│   ├── index.ts
│   ├── useAdvancedSettings.ts
│   ├── useAISettings.ts
│   ├── useAuth.ts
│   ├── useCacheManagement.ts
│   ├── useCourseList.ts
│   ├── usePerformanceOptimization.ts
│   ├── usePHashExclusion.ts
│   ├── usePostProcessing.ts
│   ├── useSessionPage.ts
│   ├── useSettings.ts
│   ├── useSlideExtraction.ts
│   ├── useSlideGallery.ts
│   ├── useTaskQueue.ts
│   ├── useTour.ts
│   └── useVideoPlayer.ts
├── services/
│   ├── apiClient.ts
│   ├── authService.ts
│   ├── dataStore.ts
│   ├── downloadService.ts
│   ├── languageService.ts
│   ├── postProcessingService.ts
│   ├── slideExtractor.ts
│   ├── slideProcessorService.ts
│   ├── ssimThresholdService.ts
│   └── taskQueueService.ts
├── workers/
│   ├── postProcessor.worker.ts
│   └── slideProcessor.worker.ts
└── TrashApp.vue

```

</td>
</tr>
</table>

</div>

---

<div align="center">
<p>Copyright © 2025 bit-admin.</p>
<p>
<a href="https://learn.ruc.edu.kg">Website</a> •
<a href="mailto:info@ruc.edu.kg">Email</a> •
<a href="https://it.ruc.edu.kg/docs">Docs</a>
</p>
</div>
