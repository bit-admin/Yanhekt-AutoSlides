# AutoSlides architecture

This is the developer map of this monorepo: four independently-installed packages, no root `package.json`, no npm workspaces. User-facing walkthroughs live in the root [`README.md`](../README.md) (desktop) and in each project's own README. Image-analysis maths (SSIM, pHash, ML, auto-crop) live in the [Image Analysis Technical Report](image-analysis-technical-report.pdf) — this document does not re-derive them.

Read this if you are about to change behaviour, port a fix across packages, add an IPC/API surface, or clone a Worker.

| Package | Path | Runtime | Public host |
|---|---|---|---|
| Desktop app | [`autoslides/`](../autoslides/) | Electron (Forge + Vite) + Vue 3 | GitHub Releases |
| Web client | [`web/`](../web/) | Cloudflare Worker (Hono) + Vue 3 SPA | [learn.ruc.edu.kg](https://learn.ruc.edu.kg) |
| Share / Index | [`share/`](../share/) | Cloudflare Worker + two React SPAs | [share.ruc.edu.kg](https://share.ruc.edu.kg) |
| Recorded HLS relay | [`relay/`](../relay/) | Cloudflare Worker (Cache API) | [relay.ruc.edu.kg](https://relay.ruc.edu.kg) |

Each package has its own `package.json` / lockfile. Commands always run **inside** the package directory (`cd autoslides && npm test`, never from the repo root — except the drift checker).

---

## Table of contents

1. [Repository layout](#1-repository-layout)
2. [How the four packages fit together](#2-how-the-four-packages-fit-together)
3. [Conventions every package shares](#3-conventions-every-package-shares)
4. [Deliberate copies and the drift checker](#4-deliberate-copies-and-the-drift-checker)
5. [`autoslides/` — Electron desktop](#5-autoslides--electron-desktop)
6. [`web/` — browser client](#6-web--browser-client)
7. [`share/` — viewer and public index](#7-share--viewer-and-public-index)
8. [`relay/` — recorded HLS proxy](#8-relay--recorded-hls-proxy)
9. [Yanhekt API](#9-yanhekt-api)
10. [Cross-cutting protocols](#10-cross-cutting-protocols)
11. [Extraction and post-processing](#11-extraction-and-post-processing)
12. [Gotchas](#12-gotchas)
13. [CI, tests, and how to verify a change](#13-ci-tests-and-how-to-verify-a-change)

---

## 1. Repository layout

```
.
├── autoslides/          Electron desktop app (no package-level README — the root README is it)
├── web/                 Browser client: Worker (`src/`) + Vue SPA (`frontend/`)
├── share/               Share viewer (`src/` React) + Index (`apex/` React) + Worker
├── relay/               Recorded-HLS Worker (`src/`) + static test player (`public/`)
├── scripts/             Cross-package glue (drift checker only)
│   ├── check-drift.mjs
│   └── drift-manifest.json
├── docs/                README screenshots, this guide, the image-analysis report
├── .github/workflows/   ci.yml, build.yml, release.yml
├── README.md            Desktop user guide + (this) architecture pointer
└── LICENSE              Apache-2.0
```

There is **no** root `package.json`. GitHub Actions `cd`s into each package.

Worker config is split on purpose:

- Tracked template: `wrangler.example.jsonc` (comments, binding *names*, dummy domain).
- Gitignored live file: `wrangler.jsonc` (custom domain, KV/D1 ids, secrets).

First deploy of any Worker:

```bash
cp wrangler.example.jsonc wrangler.jsonc   # then fill in your zone / ids
```

`web/`, `share/`, and `relay/` each gitignore `wrangler.jsonc`, `dist/` (or equivalent), and `.wrangler/`. `web/` also gitignores generated `worker-configuration.d.ts` (CI regenerates it from the example config).

---

## 2. How the four packages fit together

```
                    ┌──────────────────────────────────────┐
                    │            autoslides/               │
                    │  Electron: UI + local HLS proxy +    │
                    │  disk slides_* + Drive.              │
                    └──────────┬─────────────┬─────────────┘
                               │             │ publish fragment
                               │ local       │
                               │ 127.0.0.1   ▼
                               │        ┌────────────┐
                               │        │  share/    │  share.ruc.edu.kg
                               │        │  KV + D1   │  /v1 viewer, / index
                               │        └─────┬──────┘
                               │              │ anonymous course/session GETs
                               ▼              ▼
                         Yanhekt  cbiz.yanhekt.cn / cvideo.yanhekt.cn / coss.yanhekt.cn
                               ▲
                    ┌──────────┴──────────┐
                    │       web/          │  learn.ruc.edu.kg
                    │  Worker + Vue SPA   │
                    └──┬───────────────┬──┘
                       │ catalog/login │ recorded HLS
                       │ /notes        │
                       │               ▼
                       │        ┌────────────┐
                       │        │  relay/    │  relay.ruc.edu.kg
                       │        │  Cache API │  /playlist, /segment
                       │        └─────┬──────┘
                       │              │ signed fetch
                       └──────────────┘
```

### Playback

| Stream | Desktop | Web |
|---|---|---|
| **Live** | Direct CDN URLs (optional campus-intranet IP mapping + NIC bind) | Direct CDN URLs (CORS-open). No relay. |
| **Recorded** | Main-process HTTP proxy on `127.0.0.1` (`videoProxyService`). Signs path + query, rewrites the playlist so segments stay on localhost. `loginToken` in the local URL is a **per-account cache key**, not forwarded to Yanhekt. | Browser talks to `relay/` (`GET /playlist`, `GET /segment`). Default policy is **direct**: the SPA uses `RELAY_PUBLIC_ORIGIN` so the viewer hits the relay's own edge. Same-origin `/playlist`+`/segment` on the web Worker **403** in that mode so a hand-written URL cannot walk around the gate. |

Electron can also expose a **LAN relay** (`localRelayService`) with Worker-compatible `/playlist`+`/segment` for phones on the same network. That is desktop-only and gated by Developer mode.

### Slides

| | Desktop | Web |
|---|---|---|
| Pixels | `slides_*` folders on disk (PNG) | IndexedDB `ArrayBuffer` (field still named `blob`) |
| Provenance | colocated `metadata.json` | same schema, stored on the folder record |
| Timeline | colocated `timeline.json` | reconstructed for share; in-memory during watch |
| Export | PDF (PDFKit) / PPTX / Drive import | PDF (`pdf-lib`) / ZIP (`fflate`) / Notes sync |

### Identity

Both clients speak campus CAS (`sso.bit.edu.cn`) and then hold a Yanhekt **32-hex** login token. Desktop parks a live CAS cookie jar in memory for SMS 2FA (300s, dies on renderer reload). Web cannot park a Worker isolate across minutes of SMS, so it AES-GCM-seals the half-finished flow into a `resumeToken` the SPA posts back.

### Share / Index

Desktop Drive and web Notes can publish a compact v2/v3 fragment to `share/`. The Index stores **ids + image fingerprint only**; titles are hydrated from Yanhekt at read time. Slide images are resolved from the public COSS bucket `images` on `coss.yanhekt.cn`.

---

## 3. Conventions every package shares

### Node, tests, types

- Node **22** in CI (`electron@41` and several deps want ≥ 22.12).
- **Vitest**, `environment: 'node'`. Tests import from `'vitest'` explicitly so `tsc` needs no extra `types`.
- `npm test` / `npm run typecheck` in every package. Vue packages also run `vue-tsc` (`npx vue-tsc --noEmit` in `autoslides/`, `npm run typecheck:web` in `web/`).
- `npm audit --audit-level=moderate` must stay at **0** (CI `security` matrix). Prefer targeted `overrides` over `npm audit fix --force` (force has tried to downgrade Electron Forge and pptxgenjs).

### Worker config

| Package | `name` in wrangler | `main` | Bindings (names) |
|---|---|---|---|
| `web/` | `autoslides-web` | `src/index.ts` | `ASSETS`, optional `RELAY`, `SHARE`; vars `SSO_RESUME_KEY`, `RELAY_PUBLIC_ORIGIN`, `ALLOW_OFFCAMPUS_RELAY`, `AI_ORIGIN` |
| `share/` | `autoslides-share` | `src/worker.ts` | `ASSETS`, `SHARE_KV`, `INDEX_DB` (D1 `autoslides-index-v2`); cron `0 * * * *` |
| `relay/` | `yanhekt-proxy` | `src/index.ts` | static `public/`; **no** D1/KV. Smart Placement toward `cvideo.yanhekt.cn` |

`web/` needs `compatibility_flags: ["nodejs_compat"]` — campus SSO phone-lookup uses RSA **PKCS#1 v1.5** via `node:crypto`. Web Crypto only does OAEP.

Observability is **off** on `web/` and `relay/` in the templates: recorded URLs carry `t=` login tokens in the query string.

### Product names are per surface (owner rulings)

Do not unify these. Code ids stay frozen.

| Concept | Desktop UI | Web UI | Frozen code id |
|---|---|---|---|
| Cloud notes workspace | **Drive** / 云存储 | **Notes** / 笔记 | `cloud-notes`, `/notes` |
| Course pin | **Pinned** / 置顶 | **Subscribed** | desktop local pins vs Yanhekt subscriptions |
| Slide review | **Slides** / 课程幻灯片 | **Slides** | `slides-review` |
| Public catalog | **Public Index** / 公共索引 | (share site) | `cloudIndex` internally |

Retired user-visible names: “Results View”, “Cloud Notes”, “Cloud Index”. Do not put them in new copy.

Yanhekt managed groups (6-char server limit, lookup by reserved name):

- `ASnote` — **AutoSlides Database** / AutoSlides 数据库 (slide import/export target)
- `ASuser` — **Watch Notes** / 随堂笔记 (watch-mode)

### UI copy

- **Title Case** for nav, menus, modal titles, buttons, field labels.
- **Sentence case** for descriptions, placeholders, helper text, chips, status.
- Ellipsis is the character `…` (`U+2026`), never `...`.
- Small words (`a`, `an`, `the`, `to`, `of`, `for`, `and`, `or`, `in`, `on`) stay lowercase in titles unless first/last.

### Commits and versions

Commit subject: `<NN.NN> <area>: <description>` (e.g. `22.26 ci: …`). Increment the patch for routine work. Desktop `autoslides/package.json` version is independent of that sprint counter (currently `5.0.0`). GitHub release tags are `v*`.

License: Apache-2.0 (`LICENSE`).

### Numeric Yanhekt ids

List/detail payloads return `course_id` / `session_id` / live ids as **numbers** at runtime. Router params and `Map` keys are strings. Wrap with `String(...)` at every handoff (`lookupCourseById`, route params, subscribe snapshot joins). Bare `===` against a string param silently misses.

---

## 4. Deliberate copies and the drift checker

`web/frontend` is a **clone story**: a third party should be able to deploy `web/` without the Electron tree, so the SPA **never** imports `autoslides/src`. Algorithms that must stay behaviour-identical are copied and adapted per runtime.

`share/` is the opposite exception: the Worker **imports the canonical module**

```ts
import { decodeSharePayload } from '../../autoslides/src/shared/shareLink';
```

so encode (desktop) and decode (viewer/Index) cannot drift. `shareLink.ts` is documented as dependency-free on purpose (`TextEncoder` / `btoa` only).

The cost of copies is silent rot. Root script:

```bash
node scripts/check-drift.mjs            # CI — fail if only some members of a group changed
node scripts/check-drift.mjs --update   # re-stamp AFTER porting (or a conscious decision not to)
```

A group is “in sync” when **no** member changed or **every** member changed. Groups are defined in `scripts/check-drift.mjs` (`GROUPS`); hashes live in `scripts/drift-manifest.json`.

| Group | Members |
|---|---|
| `shareLink` | `autoslides/src/shared/shareLink.ts` ↔ `web/frontend/src/lib/notes/shareLink.ts` |
| `notesContent` | `autoslides/src/shared/notesContent.ts` ↔ `web/frontend/src/lib/notes/notesContent.ts` |
| `notesTypes` | `autoslides/src/shared/notesTypes.ts` ↔ `web/frontend/src/lib/notes/notesTypes.ts` |
| `sanitizeFileName` | `autoslides/src/shared/sanitizeFileName.ts` ↔ `web/frontend/src/lib/sanitizeFileName.ts` |
| `slideMetadataTypes` | `autoslides/src/shared/slideMetadataTypes.ts` ↔ `web/frontend/src/lib/slideMetadataTypes.ts` |
| `changeDetection` | SSIM change detector (renderer processing ↔ web `lib/processing`) |
| `phase1Duplicates` | pHash near-duplicate filter |
| `phase2Exclusion` | pHash exclusion list |
| `phase3AI` | LLM/ML classification + thresholds |
| `postCropDedup` | phase 3b after in-place auto-crop |
| `videoErrorRecovery` | HLS fatal/backoff skeleton, including manifest `loadSource` retry |
| `yanhektCrypto` | **all four packages**: `autoslides/src/shared/crypto.ts`, `web/src/lib/yanhekt.ts`, `relay/src/yanhekt.ts`, `share/src/lib/yanhekt.ts` |

Golden MD5 vectors (asserted in `crypto.test.ts` / `yanhekt.test.ts`):

- Client signature `md5(VIDEO_MAGIC + "_v1_undefined")` → `72b77856f6df3f563ab6e658631cac3d`
- Path hash `md5(VIDEO_MAGIC + "_100")` → `c3d47d7b3aa8caf2983b313cb6cd142f`

`VIDEO_MAGIC` is `1138b69dfef641d9d7ba49137d2d4875`. The literal suffix `"undefined"` on the client signature is mandatory — it is not a missing value.

Workers have no Node/WebCrypto MD5. `relay/` ships a pure-JS MD5 (`relay/src/md5.ts`). `web/` and `share/` use CryptoJS or a hardcoded client signature where only the constant is needed (Index `verifyUser`).

---

## 5. `autoslides/` — Electron desktop

**Identity.** `package.json` name `autoslides`, productName `AutoSlides`, version `5.0.0`, `main` `.vite/build/main.js`. Electron Forge + Vite; Windows/Linux installers go through `electron-builder.yml` on top of a Forge `--prepackaged` tree. macOS DMG is Forge + DropDMG (`make:mac`).

### Commands

```bash
cd autoslides
npm start              # Forge + Vite, hot reload
npm run demo           # DEMO_MODE=1, isolated userData AutoSlides-Demo
npm run lint           # ESLint, including domain-boundary import rules
npm test               # vitest run
npx tsc --noEmit && npx vue-tsc --noEmit
npm run package        # Forge package
npm run make:mac | make:win | make:linux
npm run screenshots:build && npm run docs:images   # Playwright → ../docs
```

### Path aliases

Configured in `tsconfig.json` and every Vite/Vitest config. **`@common` ≠ `@shared`.**

| Alias | Disk |
|---|---|
| `@main/*` | `src/main/*` |
| `@renderer/*` | `src/renderer/*` |
| `@shared/*` | `src/renderer/shared/*` |
| `@common/*` | `src/shared/*` |
| `@features/*` | `src/renderer/features/*` |

Cross-domain hops use aliases; same-domain imports stay relative. ESLint `no-restricted-imports` enforces the [dependency rules](#51-dependency-rules) — a new lint error there is a real boundary violation.

### Process topology

```
main.ts                          tools.ts (second BrowserWindow)
  WindowManager, services,         ToolsApp.vue
  registerAllIpcHandlers()           Web Capture + Yuketang
        │                                      │
        ▼                                      ▼
preload/index.ts  ──contextBridge──►  window.electronAPI
        │
        ▼
renderer.ts → App.vue
  LeftPanel + MainContent + RightPanel
  Info tab (nav)  |  N playback tabs (kept mounted, CSS-hidden)
  Web Workers: slideProcessor, postProcessor, autoCrop, slideClassifier
```

- **Main** (`src/main.ts`): lifecycle, `BrowserWindow`, one `IpcServices` bag, one `registerAllIpcHandlers(services)` call. Privileged `asmedia://` scheme is registered **before** `app.ready`.
- **Preload** (`src/preload/`): nine domain modules spread in `index.ts`. The contract is `src/preload/electronApi.ts` (`ElectronAPI`). Each exported namespace is typed `ElectronAPI['<ns>']`, so a method added on only one side fails `tsc` in preload. `src/vite-env.d.ts` only maps it onto `Window`.
- **Renderer** (`src/renderer.ts`): load `configStore` then mount. No Pinia — module-level `reactive`/`ref` singletons.
- **Tools window**: Web Capture + Yuketang only. Compress lives in Lectures. Guest `<webview>` gets `src/webviewCapturePreload.ts`.
- **Demo**: `src/renderer/demo/` + `src/main/demo/`. Production never imports it. Inversion of control through `@shared/overrideRegistry` (empty `overrides` object; demo bootstrap is the only writer). Deleting both `demo/` trees plus the documented guarded hooks leaves a working real app. ESLint forbids production imports of `@renderer/demo`.

Forge unpacks native bits from asar (`*.node`, `sharp`, `@img`, `ort-wasm`) so Node can load binaries and ONNX Runtime Web can `file://`-import its WASM. Extra resources: `resources/models`, `ffmpeg-static`, `@ffprobe-installer`. Packaged builds flip Electron fuses (`RunAsNode: false`, `OnlyLoadAppFromAsar: true`, …).

### Main-process domains (`src/main/`)

| Domain | Directory | Owns |
|---|---|---|
| platform | `platform/` | `configService`, `authService` + `campusSso/`, `apiClient`, `notesService`, `intranetMappingService`, `windowManager`, `themeService`, `powerManagementService`, `cacheManagementService` |
| infra | `infra/` | `ffmpegService`, `sharpService`, `onnxModelService`, `fileDownloadService`, `logger` |
| video | `video/` | `videoProxyService`, `localRelayService`, `m3u8DownloadService`, `compressLectureService`, `asmediaProtocol`, posters/thumbnails |
| extraction | `extraction/` | `slideExtractionService`, `slideMetadataService`, `slideTimelineService`, `qtExtractorService` |
| ai | `ai/` | `llmApiService`, `aiFilteringService`, `aiPromptsService`, `copilotService`, auto-crop + ML model services |
| export | `export/` | `pdfService`, `coverFontService`, `yuketangService`, `noteExportService` |
| download | `download/` | `updateDownloadService`, `extractorInstallerService` |

IPC lives in `src/main/ipc/`. `registerAllIpcHandlers` fans out to 31 registrars (`authIpc`, `configIpc`, `videoIpc`, `notesIpc`, `slideMetadataIpc`, `slideTimelineIpc`, …). Services are injected; IPC modules do not import singletons.

`configIpc` broadcasts the full `AppConfig` after every mutating handler via `config:onUpdate`. `authToken` and `ssoDeviceCookies` are **standalone store keys**, not part of `AppConfig` — never broadcast. `ssoDeviceCookies` has no IPC channel (main-only; lets a trusted device skip SMS).

### Renderer (`src/renderer/`)

```
renderer/
├── components/     Vue SFCs grouped by domain (course, video, results, lectures, …)
├── features/       composables + domain state (no SFC)
├── shared/         pipelines, workers, stores, i18n, styles
│   ├── processing/        stage 1 SSIM extraction
│   ├── postProcessing/    stages 1–3b filtering
│   ├── autoCrop/          detector client + in-place cropper
│   ├── mlClassifier/      onnxruntime-web client
│   ├── workers/           *.worker.ts
│   ├── orchestration/     extraction + task state machines
│   ├── services/          configStore, dataStore, queues, clients
│   └── styles/            theme.css tokens
└── demo/           deletable screenshot add-on
```

**Stores (singletons):**

- `configStore` — reactive `AppConfig`, seeded by `loadConfig()`, kept in sync by `config:onUpdate`. Non-settings code reads it synchronously. Settings composables write through `electronAPI.config`.
- `tabStore` — playback tabs. `activeTabId === null` ⇒ the persistent **Info tab**. Manual tabs cap at `maxManualTabs`; task tabs cap at `parallelTasks`. Inactive playback tabs are **CSS-hidden, never unmounted**.
- `navigationStore` — Info-tab target (`home` / `live` / `recorded` / `search` / workspace / `settings`).
- `rightPanelStore` — `task` | `download` | `notes`. Auto-hidden on workspace pages without touching the user's collapse preference.

**Layout.** Three columns on browsing + playback; two columns on workspace pages (right panel collapsed). Workspace targets: `slides-review` (Slides), `cloud-notes` (Drive), `lectures`, `developer` (Settings → General → Developer mode). Settings is **not** a workspace page — it keeps the three-column chrome.

`courseSelection` is the single entry point for opening a course/stream from anywhere.

### Preload namespaces (`window.electronAPI`)

`auth`, `config`, `api`, `intranet`, `localRelay`, `video`, `compressLecture`, `lectures`, `download`, `qtExtractor`, `update`, `extractorInstaller`, `slideExtraction`, `dialog`, `powerManagement`, `window`, `shell`, `menu`, `cache`, `app`, `ai`, `copilot`, `trash`, `crop`, `slideMetadata`, `slideTimeline`, `pdfmaker`, `noteExport`, `tools`, `webCapture`, `yuketang`, `autoCrop`, `mlClassifier`, `cloudNotes`.

Object-valued IPC **must** be JSON-cloned first. See [Gotcha: Vue proxies](#vue-proxies-cannot-cross-structured-clone).

### Shared utilities (`src/shared/`, `@common/*`)

Pure TS, no Node/Electron IO:

- `crypto.ts` — `VIDEO_MAGIC`, `encryptVideoUrl`, `getVideoSignature`, `addSignatureToUrl`, `getClientSignature` (Node `crypto`, not CryptoJS). `authService` still uses CryptoJS for CAS AES — do not unify blindly.
- `apiTypes.ts` — canonical Yanhekt payload models. Both `apiClient.ts` files re-export them. Never redeclare. App-level `Course` stays in `useCourseList.ts`.
- `sanitizeFileName.ts` — **not** interchangeable with `downloadNaming.sanitizeDownloadName` (see [Gotchas](#sanitizers-and-the-__-delimiter)).
- `lectureNaming.ts` / `lectureVideoNaming.ts` — `__c<courseId>s<sessionId>` suffix **after** sanitizing.
- `sidecars/metadata/` + `sidecars/timeline/` — `metadata.json` / `timeline.json` types and pure reducers (`deriveCues`, relink, gaps). Main services own disk.
- `shareLink.ts` / `shareTimeline.ts` — fragment codec. Canonical; `share/` imports this file.
- `notesContent.ts` / `notesTypes.ts` — Editor.js document + trailing `code` block namespaced `autoslides`.

### Desktop features a newcomer actually trips on

- **Dual-stream HLS.** `useVideoPlayer` + `useDualStreamPlayer`. Drift sync, one audible stream.
- **Video proxy.** Per-login-token `Map` so two accounts do not clobber one signing session. `getRecordedWithResign` re-signs on a resolved 403. Always strip upstream cache validators and set `Cache-Control: no-store` on proxied m3u8/TS — otherwise Chromium `userData/Cache` fills with hundreds of MB per lecture (HLS.js already buffers in memory).
- **Prefer anonymous Yanhekt requests** (`preferAnonymousApiRequests`, default false). When on **and** the method opted in, omit `Authorization`. Opted-in: course list/info first hop, public live list, search live, video token. Never anonymous: session **list**, personal lists, subscriptions, `/v1/user`, logout, notes. `getTagList` is always unauth. Full matrix: [§9.3](#93-auth-vs-anonymous).
- **Campus SSO SMS.** `main/platform/campusSso/`. Three outcomes from `loginAndGetToken`: token, failure (`reason`), or `smsChallenge`. Live CAS jar parked in `pendingVerifications.ts` (300s). Captcha is detected, never solved. Browser login is the escape hatch.
- **Multi-account.** Active account = `StoredAccount` whose token matches the standalone `authToken` key. Switching changes `userId` but **not** `isLoggedIn` — surfaces that only watch `isLoggedIn` show stale data. In-flight downloads captured their token at start.
- **Drive.** Yanhekt `/v1/note*` + MinIO. `cloudStorageStore` serializes provisioning of `ASnote` + `ASuser`. Server `/v1/note/list` **ignores** `groupId` — load the full catalog (`pageSize=500`) and filter client-side. Keyword search is **server-side** (`keyword=`). Ungroup = recreate the note. Batch import/export is ASnote-gated. Index mode is a toggle inside Drive, not a separate nav target.
- **Watch-mode notes.** Keyed by playback tab. Find-or-create an ASuser note when a manual tab starts extraction with `cloudWatchSyncEnabled`. Slides buffer in a non-reactive `pendingSlides` map and upload only after post-processing reports them kept; pending is **dropped** on stop/clear/tab close. Mutate through the reactive proxy (`state.entries[tabId]`), never a raw local ref.
- **Lectures.** List view = local `.mp4`/`.mkv` only. Library also seeds sessions from `slides_*` folders that parse to courseId+sessionId **and** have `timeline.json`. Player uses `asmedia://` (HTTP 206 Range). Slides strip: `deriveCues` → seek. Compress queue shares FFmpeg with Tools-era compress.
- **Qt extractor.** Optional C++ CLI. Requires `qtExtractor.autoRunAfterDownload` **and** a verified binary. SSIM threshold is frozen on the `DownloadItem` at queue time. Flags: `--json --compatible [--write-timeline if ≥ 2.0.0] --video --output --ssim-threshold --enable-downsampling … --chunk-size 100`. Never `--phash-*` / `--ml-classify` / `--jpeg-quality` (post-processing is ours). `--compatible` emits `Slide_*.png`. Host stamps `kind: "recorded"` after success.
- **Queues are reload-volatile.** `DownloadService.items` / `PostProcessingService.jobs` die on renderer reload **by design**. Do not add persistence without an explicit request.
- **Cache management.** Settings → General is **manual only**. `session.clearCache()` + `clearCodeCaches({})`; do not raw-unlink `Cache/` while Chromium is running. Never delete `userData/models` or `config.json` from the ordinary clear path.
- **Onboarding.** `resolveOnboarding` in `@common/onboarding`. Completing/skipping stamps `lastOnboardingVersion` to `app.getVersion()`. Do not backfill that key in `migrateOnboardingFlag()`.

### 5.1 Dependency rules

**Main process**

```
infra/          ← nothing internal
platform/       ← infra/
video/          ← infra/, platform/
extraction/     ← infra/, platform/
ai/             ← infra/, platform/
export/         ← infra/, platform/
download/       ← infra/, platform/
```

**Renderer**

```
shared/workers/             ← no internal deps
shared/processing/          ← shared/workers/
shared/postProcessing/      ← shared/workers/
shared/autoCrop/            ← shared/workers/
shared/services/            ← no internal deps
shared/orchestration/       ← shared/services/

features/<any>/             ← shared/<any>/
features/video/             ← features/course/          (Course type — whitelisted)
features/download/          ← features/video/, course/, ai/
features/settings/          ← features/platform/, ai/
features/cloudNotes/        ← features/course/          (tabStore)
features/lectures/          ← features/course/, video/
```

### Source tree (`autoslides/src/`)

```
src/
├── main.ts | renderer.ts | tools.ts | webviewCapturePreload.ts | App.vue
├── main/           ai/ demo/ download/ export/ extraction/ infra/ ipc/ platform/ video/
├── preload/        electronApi.ts + domain modules + index.ts
├── renderer/       components/ demo/ features/ shared/
└── shared/         sidecars/ + crypto, apiTypes, shareLink, notes*, lectureNaming, …
```

### UI / logging (desktop)

Theme is **ink on paper** (`renderer/shared/styles/theme.css`). Chrome is warm paper + near-black ink; `--accent` **is** the ink. Hue is allowed in three roles only: `--control-accent` (checkbox/progress/links — never a button fill), status (`--danger` / `--success` / `--warning`), and `--illustration-accent` on the Home drawing. **No accent bars** (thick colored `border-left`). No per-component dark-mode media queries — `theme.css` swaps via `prefers-color-scheme`. JS that must re-read a token uses `onColorSchemeChange()` from `@shared/utils/prefersDark`.

Logging: `createLogger(namespace)` (`@main/infra/logger` / `@shared/utils/logger`). `debug`/`info` are dev-only (main also gates on `!app.isPackaged`); `warn`/`error` always emit. `no-console` is ESLint-enforced.

---

## 6. `web/` — browser client

Tracked layout is the honest public Worker: what a third-party clone would deploy.

```
web/
├── src/                    Worker (Hono)
│   ├── index.ts            finalizeApp(createApp())
│   ├── app.ts              createApp() mounts routes; finalizeApp() is LAST
│   ├── env.ts              Env bindings
│   ├── lib/                yanhekt.ts, campusSso.ts, resumeSeal.ts, relayPolicy.ts
│   └── routes/             yanhektProxy, login, relayProxy, config, aiProxy, shareProxy
├── frontend/               Vue 3 SPA (Vite)
│   └── src/                App.vue, router/, stores/, composables/, lib/, workers/, demo/
├── wrangler.example.jsonc
├── vite.config.ts | vite.demo.config.ts
└── README.md
```

### Commands

```bash
cd web
cp wrangler.example.jsonc wrangler.jsonc
npm run cf-typegen          # worker-configuration.d.ts (gitignored)
npm run build               # Vite → dist/, THEN dist/demo/ (order matters)
npm run dev                 # wrangler dev :8787, serves dist/
npm run dev:web             # Vite :5173, proxies /api /playlist /segment → :8787
npm run demo                # static /demo/ only
npm run typecheck && npm run typecheck:web && npm test
npm run deploy              # build + wrangler deploy
```

`npm run build` must run before `wrangler dev` / `deploy` — assets.directory is `./dist`. The root Vite build **empties** `dist/`; the demo build must run second.

### Worker lifecycle

`createApp()` mounts CORS on `/api/*` and the real routes. `finalizeApp(app)` registers the JSON 404 for leftover `/api/*` and the `ASSETS.fetch` SPA fallback. **Always register finalize last** — Hono resolves to the first matching handler, so a catch-all registered too early shadows everything after it.

`src/index.ts` exports `default finalizeApp(createApp<Env>())`.

### Routes

| Path | Module | Notes |
|---|---|---|
| `GET /api/config` | `routes/config.ts` | `{ relay, network: { asn, onAllowlist } }`, `Cache-Control: no-store` |
| `/api/yanhekt/*` | `routes/yanhektProxy.ts` | Allowlisted proxy to `cbiz.yanhekt.cn` |
| `POST /api/login` | `routes/login.ts` | Password CAS. 200 token, or **202** `sms_required` |
| `POST /api/login/sms` | `routes/login.ts` | Sealed resume + code |
| `/api/ai/*` | `routes/aiProxy.ts` | Proxies to `AI_ORIGIN`; `User-Agent: AutoSlides/web`. Unset → 503 |
| `GET /api/share/get?id=` | `routes/shareProxy.ts` | `SHARE` service binding. Unset → 503 |
| `GET /playlist`, `GET /segment` | `routes/relayProxy.ts` | Same pathnames as `relay/`, so rewritten m3u8 stays coherent |

Login routes sit **outside** the Yanhekt Bearer gate.

### Yanhekt proxy auth split

Every SPA request to `/api/yanhekt/*` must send `Authorization: Bearer <32-hex>`. Missing/malformed **403s before any upstream fetch** (`LOGIN_TOKEN_RE = /^[0-9a-f]{32}$/i`) — the Worker is not an open proxy.

When forwarding to cbiz:

- **Omit** the user Bearer on anonymous-safe GETs: `/v2/course/list`, `/v1/course`, `/v1/live`, `/v1/course/session`, `/v1/tag/list`, `/v2/live/list` except `user_relationship_type=1`. `/v1/course` and `/v1/live` match **exactly**, not by prefix, so a subpath cannot inherit the omit.
- **Keep** it for session list, personal lists, subscriptions, notes, `/v1/user`, logout, MinIO.

The SPA still sends a token on `getAvailableSemesters`; the Worker strips it upstream. Query strings are forwarded **verbatim** (PHP-style `semesters[]=`). Non-GET bodies stream as raw `ArrayBuffer` with the incoming `Content-Type` (MinIO multipart).

Allowlist is prefix-match for GET, **exact** match for writes.

### Relay policy

`src/lib/relayPolicy.ts` → `resolveRelayPolicy(env)`:

| Vars | Mode | Browser streams from | Worker's `/playlist`+`/segment` |
|---|---|---|---|
| `RELAY_PUBLIC_ORIGIN` set, `ALLOW_OFFCAMPUS_RELAY` not `"true"` | **`direct`** (production default) | that origin | **403** |
| `ALLOW_OFFCAMPUS_RELAY: "true"` | **`binding`** | this origin | forwarded over `RELAY` binding |
| neither set | **`binding`** | this origin | forwarded (a clone has nowhere else to send the browser) |

Worker-to-Worker hops never meet the relay's campus-ASN edge — that is why `direct` exists. `GET /api/config` publishes the mode + origin + `request.cf.asn`. The SPA caches it in `runtimeConfigStore` (memory only) and `useVideoPlayer` awaits it before building recorded URLs.

On any network-type HLS error in `direct` mode the SPA probes `relay`'s `/cf.txt` (credential-less). A definite block sets `errorKind: 'relay_offcampus'` and **stops the retry ladder**. A challenged relay fails hls.js's manifest XHR opaquely (no status — challenge pages lack CORS), and `hls.startLoad()` cannot retry a manifest that never loaded: `retryNetworkLoad` in `useVideoErrorRecovery.ts` re-issues `loadSource(hls.url)` for manifest failures. That fix is a drift group with desktop.

`CAMPUS_ASNS` in `relayPolicy.ts` (`4847`, `23910`) is informational for the config payload, not the actual WAF.

### SSO resume seal

A Worker cannot park a half-finished CAS flow. `/api/login` answers **202** `sms_required` with an AES-GCM-sealed bag (cookies + 2FA context, 300s, nonce-bound) that the SPA posts to `/api/login/sms`.

- Sealing needs `SSO_RESUME_KEY` (`vars` in the gitignored wrangler file). **Unset is supported**: second-factor accounts degrade to the token-paste error, so a clone still deploys.
- The resume token is a **session secret**: memory-only in `authStore`, never `localStorage`.
- The long-lived `deviceKeepsake` **is** persisted (it only makes CAS skip a second factor).
- RSA step needs PKCS#1 v1.5 → `nodejs_compat` + `node:crypto`.

### Frontend

Mirrors the Electron **shell** (left navigator, no right panel) and playback. Vue Router **history** mode in production (`frontend/src/router/`). Routes include `/`, `/live`, `/recorded/:courseId?`, `/search`, `/slides/:folderName?`, `/notes/:noteId?`, `/settings`, `/login`, `/player/live|recorded/...`, plus `/terms` `/privacy` `/disclosure`. SPA fallback is on the Worker asset side (`not_found_handling: "single-page-application"`).

Recorded playback goes through the relay as above; live uses raw CDN URLs. Safari/iOS falls back to **native HLS** (`canPlayType("application/vnd.apple.mpegurl")`) — Electron never needed that.

Slide extraction is the same SSIM pipeline in Web Workers; pixels live in IndexedDB (`frontend/src/lib/slideStore.ts`). **Never re-`put` a `Blob`** — WebKit detaches it; later reads throw `NotFoundError` / `WebKitBlobResource error 1`. Store `ArrayBuffer`; rebuild a short-lived `Blob` on read. `SlideRecord.aiDecision` persists phase-3 verdicts so re-runs skip already-judged files.

Post-processing on web: same phases; auto-crop + 3b are **hardcoded on** when AI filtering is enabled (no web toggles). Phase-3 builtin AI is same-origin `POST /api/ai/chat/completions`. Copilot/custom still call those hosts from the browser (CORS-open).

Notes page + watch-mode ASuser sync mirror desktop conceptually, with the product-name split above. `notesContent` must preserve `timeline` on save so a desktop-imported note is not stripped.

PDF bookmarks use UTF-16 hex outlines so CJK folder names need no embedded font; body CJK still needs standalone TTF (not `.ttc` / CFF). See `frontend/public/fonts/README.md`.

### Demo at `/demo/`

A **second** static build of the same frontend (`vite.demo.config.ts` → `dist/demo`), run after the main build. Compile-time `__DEMO__` switches the router to **hash** history — Workers' SPA fallback would otherwise serve the **root** `index.html` for `/demo/live`. `demo/isolateStorage.ts` swaps `localStorage` for an in-memory copy and suffixes every IndexedDB name `-demo` (same origin as the real app). `demo/main.ts` must run **before** `main.ts` is evaluated: stores read `localStorage` at import time. Deleting `frontend/src/demo/` + `vite.demo.config.ts` leaves a fully real app.

### Tests

Worker tests (`npm test`): `resumeSeal` round-trip/expiry/tamper; Yanhekt golden signature; `/api/yanhekt` gate + allowlist + anonymous omit (`createApp().request` + stubbed `fetch`); relay policy 403-vs-binding.

### Differences vs desktop (the ones that cause bugs)

1. No right panel, no task/download queues, no local filesystem, no Qt extractor, no Lectures compress, no Yuketang Tools window, no local ONNX ML (LLM only).
2. Native HLS on Safari/iOS.
3. `String()` at every Yanhekt id boundary.
4. Drive vs Notes, Pinned vs Subscribed (intentional).
5. IndexedDB ArrayBuffer rule.
6. Two-request SMS instead of a parked cookie jar.
7. Recorded playback is a policy, not a localhost port.

---

## 7. `share/` — viewer and public index

```
share/
├── src/                    v1 viewer (React) + Worker entry
│   ├── worker.ts           routing, v1 APIs, short-link shell
│   ├── v2.ts               Index APIs, fingerprintPayload, handlePublish
│   ├── lib/yanhekt.ts      anonymous course/session/tag client
│   ├── lib/searchQuery.ts  course-check page size 32 / 48 / 64
│   ├── lib/runtime.ts      KV helpers, Cache-API wrapper
│   └── resolver.ts         COSS ListObjectsV2 → full image URLs
├── apex/                   Index SPA (React), emitted at dist/
├── migrations/             0001_init.sql, 0002_has_timeline.sql
├── wrangler.example.jsonc
└── README.md
```

Two frontends, one Worker:

| Surface | Vite config | Output | Role |
|---|---|---|---|
| v1 viewer | `vite.config.ts` (`base: '/v1/'`) | `dist/v1/` | Decode `#fragment` or `/v1/s/<id>`, render slides, ZIP/PDF/timeline download |
| Index (apex) | `vite.apex.config.ts` (`base: '/'`) | `dist/` | Search, `/?c=&s=` lecture page, request-removal |
| Demos | `vite.demo.config.ts`, `vite.demo-v1.config.ts` | `dist/demo/`, `dist/demo/v1/` | Screenshot / public demo |

Static assets are served by Cloudflare's asset layer **without invoking the Worker**. The Worker runs only for APIs, short-link shells, and cron.

### Commands

```bash
cd share
cp wrangler.example.jsonc wrangler.jsonc   # SHARE_KV id, D1 id, domain
npm run db:migrate          # remote D1; db:migrate:local for local
npm run build               # clean + viewer + apex + demos
npm run preview             # wrangler dev
npm run typecheck && npm test
npm run deploy
```

Apply `migrations/0002_has_timeline.sql` before a deploy that expects `has_timeline`.

### v1 APIs (`src/worker.ts`)

| Method | Path | Behaviour |
|---|---|---|
| `POST` | `/v1/api/shorten` | `{ fragment }` → KV short id. Max 8192 bytes. Must `decodeSharePayload`. |
| `GET` | `/v1/api/get?id=` | `{ fragment, meta }` (meta from Yanhekt) |
| `GET` | `/v1/api/meta?courseId=&sessionId=` | `{ ok, meta }`, Cache-API 3600s |
| `GET` | `/v1/s/<id>` | Serve the v1 SPA shell via `ASSETS` |

Long `/v1/#…` links decode **locally** then call `/v1/api/meta` once.

### v2 APIs (`src/v2.ts`) — routed ahead of v1

| Method | Path | Behaviour |
|---|---|---|
| `POST` | `/v2/api/publish` | Verify Yanhekt token, upsert lecture + version |
| `POST` | `/v2/api/request-removal` | Publisher-only; uses stored `uploader_id` |
| `GET` | `/v2/api/search?q=&semesterIds=&page=` | Yanhekt-first, then D1 join. Cache 120s |
| `GET` | `/v2/api/lecture?courseId=&sessionId=` | Lecture + versions. Cache 120s |
| `GET` | `/v2/api/stats` | Reads KV `stats:home`. Cache 300s |

Cron `0 * * * *` → `refreshStats`: D1 counts, 12 recent rows (hydrated), Yanhekt semester list, college distribution → **one** KV write (`stats:home`).

### D1 (`autoslides-index-v2`, binding `INDEX_DB`)

Written **only on publish/removal**.

`lectures` — `(course_id, session_id)` PK, `version_count`, timestamps. **No titles.**

`versions` — `fingerprint` PK, `share_id`, `image_count`, `reviewed`, `edited`, `uploader_id`, `uploader_name`, `has_timeline`, `created_at`.

`uploader_*` is for moderation / request-removal **only**. Public JSON (`/v2/api/lecture`, search, stats) must strip it.

### Fingerprint and republish

```ts
sha256Hex(`${payload.p}|${payload.n}|${payload.h}|${canonO}`)
```

`c` / `s` / `l` / `t` are **excluded**. Republishing the same images with a timeline **updates** that row (`share_id`, `has_timeline`, publisher, review flags) and does **not** increment `version_count`. Fresh fingerprint → insert version + bump `version_count`.

### Search

Numeric `q` (`/^\d+$/`) is treated as a course id across all semesters. Otherwise Yanhekt `/v2/course/list` (+ `semesterIds`), then

```sql
SELECT … FROM lectures WHERE course_id IN (…) ORDER BY updated_at DESC LIMIT 30
```

Course-check page size (`courseCheckPageSize`): **32** (one semester), **48** (several), **64** (all semesters / numeric id).

### Images

Anonymous S3 ListObjectsV2 on `https://coss.yanhekt.cn/images?list-type=2&prefix=…`. `resolveShareImages` matches `payload.h` short hashes to full keys. Images are world-readable — the product discloses this.

### Publisher verification gotcha

`GET /v1/user` **403s** without Yanhekt's `Xclient-*` headers. Workers have no Node MD5, so Index hardcodes `Xclient-Signature: '72b77856f6df3f563ab6e658631cac3d'`.

### Tests

`src/v2.test.ts` — `fingerprintPayload` canonical `o`, independence from key order, exclusion of ids/`t`; `handlePublish` insert vs in-place update; token rejection. Fake D1.

---

## 8. `relay/` — recorded HLS proxy

Cloud port of `autoslides/src/main/video/videoProxyService.ts`. **Recorded VOD only** (`cvideo.yanhekt.cn`). Live uses IP failover on the clients and is out of scope.

Internal Worker/package name is still **`yanhekt-proxy`** (the directory was renamed from `yanhekt-proxy/` → `relay/`). Web's service binding must use that name.

```
relay/
├── src/index.ts         routes, cache, rewrite, 403 retry
├── src/yanhekt.ts       signMediaUrl / getClientSignature
├── src/md5.ts           pure-JS MD5 (Workers have no MD5)
├── src/*.test.ts
├── public/              index.html test player, cf.txt, _headers
└── wrangler.example.jsonc
```

No D1, no KV. State is Cache API + in-isolate `inflight` coalescing.

### Commands

```bash
cd relay
cp wrangler.example.jsonc wrangler.jsonc
npm run dev          # :8787
npm run typecheck && npm test
npm run deploy
```

### Routes

| Path | Cost | Behaviour |
|---|---|---|
| `GET /` | asset, 0 Worker | Test player |
| `GET /cf.txt` | asset, 0 Worker | Body `ok\n`. CORS `*` + `Access-Control-Expose-Headers: x-client-asn` via `public/_headers` |
| `GET /playlist?u=&t=` | Worker | Fetch+sign m3u8, rewrite child URLs onto this origin |
| `GET /segment?u=&t=` | Worker | Fetch+sign media; Range passthrough |

`/cf.txt` is a **reachability beacon**. The web client fetches it credential-less when recorded playback fails. A WAF challenge page carries no CORS headers, so the fetch rejects — that is how “blocked” is distinguished from a media error.

### Gates (before cache or upstream)

1. `t` must match `/^[0-9a-f]{32}$/i` → else **403** `Invalid login token`. Junk must not ride the shared cache.
2. `u` host must be `yanhekt.cn` or `*.yanhekt.cn` → else **403** (open-proxy guard).

`t=` is a **format gate**, not forwarded to Yanhekt. It is rewritten into every playlist URL so later `/segment` hits keep the same check. Treat generated URLs as secrets: any well-formed 32-hex `t=` can use the shared cache + anonymous video token.

`&nocache=1` bypasses VOD cache read **and** write; `/playlist` injects it into child URLs.

### Shared anonymous video token

`GET https://cbiz.yanhekt.cn/v1/auth/video/token?id=0` with client signature headers and **no** user Bearer. Cached under a synthetic key with TTL = Yanhekt expiry minus 30s (floor 60s). Concurrent mints in one isolate share one Promise.

### Shared VOD cache

Recorded content is token-independent and immutable. Cache keys are `md5(upstream URL)` only (playlists and full **200** segment bodies), TTL 6h, per-PoP best-effort. Segment responses `tee()` one branch to the client and one into cache (`waitUntil`). Range misses that upstream as 206 are **not** cached (Cache API rejects 206).

### 403 retry

Up to **3** attempts: invalidate cached token, re-mint, re-sign, retry. Surface 403 only after that.

### Tests

`yanhekt.test.ts` — golden magic / client signature / path hash / `signMediaUrl`. `index.test.ts` — stubbed `caches` + `fetch`: token gate, host filter, 403 re-mint, `nocache`, cache hit, `rewriteM3u8` including `#EXT-X-KEY`.

---

## 9. Yanhekt API

Yanhekt (`yanhekt.cn`) is the campus lecture platform every package talks to. This section is the contract: hosts, headers, which calls need a login token, and the JSON shapes we actually read. Examples below were probed **2026-09-09** against course **62313** / session **751843** (泛函分析, Functional Analysis, 2025–2026 第一学期) unless noted. Personal fields from the probe token (`badge`, `nickname`, `phone`, note titles, enrolled-only lists) are redacted.

Writes were **not** live-tested; request bodies come from our clients.

### 9.1 Hosts and envelope

| Host | Role |
|---|---|
| `cbiz.yanhekt.cn` | Business REST (`/v1`, `/v2`) |
| `cvideo.yanhekt.cn` | Recorded HLS (`.m3u8` / `.ts`) |
| `clive8.yanhekt.cn` … `clive15.yanhekt.cn` | Live HLS (unsigned, CORS-open) |
| `coss.yanhekt.cn` | Public MinIO/COS (`/images/…`) |
| `www.yanhekt.cn` | Official SPA. **Spoof this Origin** on server-side cbiz calls |
| `sso.bit.edu.cn` | Campus CAS (login only; not Yanhekt) |

Almost every cbiz response is:

```json
{ "code": 0, "message": "", "data": {} }
```

`code` is a number **or** a numeric string (`0` / `"0"`). Success is `code === 0 || String(code) === "0"`. HTTP status is **200 even on auth failure** — do not key off status. Strict-auth failures may also set `displayable` and `module` (e.g. `/v1/user` after logout: `"displayable": true, "module": "user_regular_runtime", "data": []`).

| `code` | Meaning (observed / handled) |
|---|---|
| `0` | OK. Some gated GETs still return this with `data: []` (see [§9.3](#93-auth-vs-anonymous)) |
| `61101113` | `用户未登录` — no/invalid Bearer on a strict-auth endpoint |
| `12111010` | Course not found (`GET /v1/course`) |
| `13001001` | Auth failed (desktop error map) |
| `99151011` | Upstream down (desktop error map) |

`data` is **not** always an object:

- Laravel paginator: `{ current_page, data: [...], last_page, per_page, total, … }` (`/v2/course/list`, public `/v2/live/list`, `/v1/note/list`, …).
- Bare array: authenticated `/v2/course/session/list`, `/v1/note/group/list`, `/v1/tag/list`.
- Silent empty array **and** `code: 0`: unauth session list, unauth personal live, unauth private course list.
- Single object: `/v1/course`, `/v1/course/session`, `/v1/video`, `/v1/user`, `/v1/auth/video/token`.

Ids arrive as **JSON numbers**. Normalise with `String(...)` at router / `Map` / share-payload boundaries.

### 9.2 Headers and signatures

Server-side callers (Electron main, `web/` Worker, `share/`, `relay/`) send:

```http
Origin: https://www.yanhekt.cn
Referer: https://www.yanhekt.cn/
Xdomain-Client: web_user
Xclient-Version: v1
Xclient-Signature: 72b77856f6df3f563ab6e658631cac3d
Xclient-Timestamp: <unix seconds>
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) … Chrome/140.0.0.0 Safari/537.3
Authorization: Bearer <32-hex login token>   # omit on anonymous-ok GETs
```

`Xclient-Signature` is the constant `md5(VIDEO_MAGIC + "_v1_undefined")` with `VIDEO_MAGIC = 1138b69dfef641d9d7ba49137d2d4875`. The suffix `"undefined"` is a literal, not a missing value. Golden tests pin `72b77856f6df3f563ab6e658631cac3d`. It does **not** incorporate the path, body, token, or timestamp.

For public course/session/list/video **metadata** GETs, live probes show the signature is cosmetic: the headers that actually matter are **`Xdomain-Client: web_user`** plus **`Origin: https://www.yanhekt.cn`** (or that Referer). We still send the full set so we match the official SPA and the authenticated routes.

**Browser on `learn.ruc.edu.kg` cannot call cbiz.** A foreign Origin is HTTP **403** at the edge (not merely missing CORS). `web/src/routes/yanhektProxy.ts` spoofs the official Origin. The SPA must still send `Authorization: Bearer <32-hex>` on every `/api/yanhekt/*` request (malformed → 403 **before** upstream) so the Worker is not an open proxy; the Worker then **strips** Bearer on anonymous-ok GETs.

Notes (`/v1/note*`, MinIO) only require `Authorization` + `Xdomain-Client: web_user` + official Origin; desktop `notesService` does not send `Xclient-*`.

CDN signing is a **different** scheme — [§9.6](#96-recorded-vod-and-the-cdn). CDN requests never send the user Bearer.

### 9.3 Auth vs anonymous

A 32-hex **login token** comes from campus CAS ([§9.8](#98-campus-cas)). It is not a JWT we parse.

Two failure modes when Bearer is missing:

1. **Strict** — `code: 61101113`, `message: "用户未登录"`.
2. **Silent empty** — `code: 0` and `data: []` (the official UI shows “请登录后再次尝试” for session list). A bogus Bearer does **not** unlock these.

| Endpoint | Unauth (no Bearer) | Auth |
|---|---|---|
| `GET /v2/course/list` | Full catalog page | Same |
| `GET /v1/course?id=` | Full course detail | Same + `user_mapping_type` may change (`0` → `2` on the probe) |
| `GET /v1/course/session?session_id=` | Full session + nested `course` + historical `live` + `video_ids`. `user_progress: []` | Same public fields. Still **no** `videos[]`. `user_progress` is a **watch-history object** if this account has played the session, else still `[]`. Desktop reads it via `getSessionProgress`; the web Worker keeps the Bearer on this hop for the same reason — **never anonymous** |
| `GET /v1/tag/list?with_sub=true` | Full tag tree | Same |
| `GET /v2/live/list` (no `user_relationship_type`, or `=0`) | Public catalog | Same |
| `GET /v2/live/list?keyword=` | Public search | Same |
| `GET /v1/live?id=&with_session=true&with_course=true` | Full broadcast detail | Same |
| `GET /v1/video?id=` | VOD URLs + duration | Same |
| `GET /v1/auth/video/token?id=0` | 16-char token, TTL **600s** | Same |
| `GET /v2/course/session/list?course_id=` | `code: 0`, `data: []` | Bare array of sessions **with** `videos[]` |
| `GET /v2/live/list?user_relationship_type=1` | `code: 0`, `data: []` (bare array) | Paginated personal lives |
| `GET /v2/course/private/list?…` | `code: 0`, `data: []` (bare array) | Paginated enrolled courses |
| `GET /v1/user` | `61101113` | Profile |
| `GET /v1/course/subscription/list` | `61101113` | Paginated subscriptions |
| `GET /v1/note/list`, `GET /v1/note`, `GET /v1/note/group/list` | `61101113` | Account notes |
| `GET /v1/cas/logout` | n/a | Best-effort revoke |
| `PUT /v1/course/session/user/progress` | (not probed unauth) | Official SPA heartbeat. Desktop sends it while a *watched* recording plays (`reportSessionProgress`), gated on the resume settings |
| `POST/PUT/DELETE` notes, subscribe, MinIO | Auth required (from our clients) | — |

**Desktop** (`preferAnonymousApiRequests`, default **false**): when the flag is on **and** the method opted in, omit `Authorization`. Opted-in: course list, `/v1/course` first hop, public live list, live search, video token. Always unauth: `getTagList`. Never anonymous: session **list**, personal lists, subscriptions, `/v1/user`, logout, notes.

**Web Worker** strips Bearer upstream for: `GET /v1/tag/list`, `GET /v2/course/list`, exact `GET /v1/course`, exact `GET /v1/live`, `GET /v1/course/session`, `GET /v2/live/list` when `user_relationship_type !== "1"`. Prefix matching on GET would otherwise treat `/v1/course/subscription/list` as anonymous — the omit list uses **exact** `/v1/course` so subscription stays authenticated.

**Share** never sends a user Bearer except `GET /v1/user` on publish / removal. **Relay** never sends one; it mints the anonymous video token.

Auth protects **discovery** (enumerate sessions of a course, personal catalogs, notes) and account APIs. It does **not** protect VOD once `session_id` or `video_id` is known ([§9.6](#96-recorded-vod-and-the-cdn)).

### 9.4 Identity

Four id namespaces. Do not mix them.

| Id | What it is | Example (泛函分析) |
|---|---|---|
| **course** | Offering in a term (`/v1/course?id=`, `/v2/course/list`) | `62313` |
| **session** | One calendar slot of that course (`/v1/course/session?session_id=`) | `751843` |
| **live / broadcast** | One live capture of a session (`/v2/live/list` row `id`; nested `live.id`) | `652885` |
| **video** | One recorded asset (`videos[].id` / `video_ids[]` / `/v1/video?id=`) | `456913` |

**`session_id` is globally unique** and enough to recover `course_id`. `GET /v1/course/session?session_id=751843` (anonymous) returns `course_id: 62313` plus a nested `course` (names, college, term). Share already fans this out; desktop course pages still enumerate via the **list** hop, which needs `course_id` **and** a login token.

Live identity is a separate namespace. A finished session’s nested `live.id` is the broadcast id (`l` in share payloads). Live-list rows carry the real course id on `session.course_id` (present on sampled rows); nested `course.id` is often missing. **A broadcast id is resolvable on its own**: `GET /v1/live?id=<live id>&with_session=true&with_course=true` (anonymous) returns the broadcast plus its session and full course — including `course.id` and `classrooms[]`, neither of which a list row has. Never page the live list to find a row by id.

`GET /v1/video?id=` returns `course_id: 0` and `session_id: 0` — you cannot go video → session.

Share payload v2/v3 stores `c` / `s` / `l` (course / session / live). `c` is denormalised convenience for recorded links; Index D1 is ids-only and hydrates titles from Yanhekt at read time.

### 9.5 Catalog, course, session, live

Used by desktop `ApiClient`, web `/api/yanhekt/*`, share `lib/yanhekt.ts`. Query `semesters[]` is repeated for each tag id (empty = all terms). `keyword` on course list accepts a name **or** a numeric course id (`keyword=62313` returns one row).

#### `GET /v2/course/list`

Anonymous. Paginator. **Only** this list (and subscribe/private list) returns `classrooms[]`. Professors here are **strings**.

```json
{
  "code": 0,
  "message": "",
  "data": {
    "current_page": 1,
    "last_page": 1,
    "per_page": "2",
    "total": 1,
    "data": [
      {
        "id": 62313,
        "name_zh": "泛函分析",
        "name_en": "Functional Analysis",
        "code": "100171139",
        "number": "20252026110017113901",
        "school_year": "2025-2026",
        "semester": "1",
        "college_name": "数学与统计学院",
        "college_code": "217",
        "participant_count": 61,
        "image_url": "https://coss.yanhekt.cn/images/colleges/shuxue.png",
        "professors": ["石靖"],
        "classrooms": [
          { "id": 289, "name": "文萃楼F302", "number": "2701C3002X" }
        ]
      }
    ]
  }
}
```

(`semester` is a **string** on the list, a **number** on `/v1/course`. Writers stringify.)

#### `GET /v1/course?id=62313&with_professor_badges=true`

Anonymous. Single object. **No `classrooms`.** Professors are objects. Cover often comes from `image_url` or `college.image_url`.

```json
{
  "code": 0,
  "data": {
    "id": 62313,
    "name_zh": "泛函分析",
    "name_en": "Functional Analysis",
    "school_year": "2025-2026",
    "semester": 1,
    "college_name": "数学与统计学院",
    "image_url": "https://coss.yanhekt.cn/images/colleges/shuxue.png",
    "professor_badges": ["6120120125"],
    "professors": [
      { "id": 4344, "name": "石靖", "title": "副教授", "badge": "6120120125" }
    ],
    "college": { "id": 36, "name": "数学与统计学院", "name_en": "School of Mathematics and Statistics" },
    "tags": [
      { "param": "degrees", "name": "本科" },
      { "param": "colleges", "name": "数学与统计学院" },
      { "param": "attributes", "name": "专业课" },
      { "id": 100, "param": "semesters", "name": "2025-2026 第一学期" }
    ]
  }
}
```

Desktop `getCourseInfo` uses this hop (anonymous-ok) then the session **list** (auth). Share uses it to fill professors when session-nested `course` is thin.

#### `GET /v2/course/session/list?course_id=62313`

**Auth required** (`data: []` if not). Bare array (not a paginator). This is how desktop/web hydrate playback: `videos[].main` / `videos[].vga` are the unsigned VOD URLs we later sign.

Probe: **29** sessions; first row is `751843`:

```json
{
  "code": 0,
  "data": [
    {
      "id": 751843,
      "course_id": 62313,
      "title": "第1周 星期三 第2大节",
      "week_number": 4,
      "day": "3",
      "started_at": "2025-09-17 09:55:00",
      "ended_at": "2025-09-17 11:30:00",
      "location": "2701C3002X",
      "video_ids": [456913],
      "videos": [
        {
          "id": 456913,
          "duration": "5936",
          "format": "m3u8",
          "main": "https://cvideo.yanhekt.cn/vod/2025/09/17/46558716/0/Video1/Video1.m3u8",
          "vga": "https://cvideo.yanhekt.cn/vod/2025/09/17/46558716/0/VGA/VGA.m3u8",
          "start_main": "0",
          "start_vga": "21"
        }
      ]
    }
  ]
}
```

`day` is a string here, a number on session-by-id. Other keys we do not require: `badge`, `section_start` / `section_end`, `is_live`, `is_record`, `week_type`.

#### `GET /v1/course/session?session_id=751843&with_video=true`

Anonymous. Desktop `getSessionById` is **unused** (kept so the two session hops stay distinct). Share `fetchSession` / `fetchLectureMeta` use this. Nested `course` has **no professors** and empty `image_url`; overlay `/v1/course` for those. `with_video=true` still does **not** attach `videos[]` — only `video_ids`. Recover VOD via `/v1/video?id=` or the authenticated list.

```json
{
  "code": 0,
  "data": {
    "id": 751843,
    "course_id": 62313,
    "title": "第1周 星期三 第2大节",
    "week_number": 4,
    "day": 3,
    "started_at": "2025-09-17 09:55:00",
    "ended_at": "2025-09-17 11:30:00",
    "location": "2701C3002X",
    "badge": "6120120125",
    "video_ids": [456913],
    "course": {
      "id": 62313,
      "name_zh": "泛函分析",
      "name_en": "Functional Analysis",
      "college_name": "数学与统计学院",
      "school_year": "2025-2026",
      "semester": 1,
      "image_url": ""
    },
    "live": {
      "id": 652885,
      "source_id": 62313,
      "status": 3,
      "title": "泛函分析",
      "subtitle": "文萃楼F302",
      "target": "https://clive13.yanhekt.cn/live/23375_Video1.m3u8",
      "target_vga": "https://clive13.yanhekt.cn/live/23375_VGA.m3u8",
      "target_room": "https://clive13.yanhekt.cn/live/23375_Video2.m3u8"
    },
    "user_progress": []
  }
}
```

Finished `live.target*` URLs 404 on the CDN; they are useful while `status` is live. Auth does **not** add `videos[]` here.

**`user_progress`.** Anonymous (and auth when this account has never played the session) is `[]` — that is what the 泛函分析 probe returned even with Bearer. After a watch, the same GET with Bearer returns an **object** instead of an array:

```json
{
  "id": "<row id>",
  "badge": "<account badge>",
  "session_id": 751843,
  "progress_overall": "5936",
  "progress_current": "2300",
  "status": 0,
  "created_at": "<first watch>",
  "updated_at": "<last heartbeat>"
}
```

`progress_overall` / `progress_current` are decimal **strings** of integer seconds. `overall` matches session duration; `current` is the playhead.

Desktop reads it through `ApiClient.getSessionProgress` — the same hop as `getSessionById` but **never** `allowAnonymous`, since the field only exists for the account holding the Bearer. Parsing (`[]` vs object, the strings, the "already finished" rule) is pure and lives in `@common/watchProgress`; a saved position under 10 s, or within 15 s of `overall`, resolves to "start at 0".

#### `PUT /v1/course/session/user/progress`

Official SPA, while a recorded session is playing. **Auth required.** Used by both AutoSlides clients (opt-in, default off); allowlisted as an exact-match `PUT` on the web Worker.

```http
PUT /v1/course/session/user/progress
Content-Type: application/json
Authorization: Bearer <32-hex>
Xdomain-Client: web_user

{"session_id":"751843","seconds":2305}
```

```json
{ "code": 0, "message": "", "data": { "success": true } }
```

`session_id` is a string; `seconds` is the current playhead (same unit as `progress_current`). The official player posts this as a heartbeat; a later `GET /v1/course/session?session_id=` then shows the object above.

Desktop sends it from `renderer/shared/services/watchProgressService.ts`, shared by the playback page and the Lectures player: a **wall-clock** 5 s interval reporting `floor(currentTime / 5) * 5` whenever that bucket changes and the video is playing, plus one final report on teardown. Wall-clock rather than `timeupdate` because a watch tab may run at 16x, where media time would fire several PUTs a second. Both surfaces are user-controlled (`resumeFromServerProgress` / `resumeFromServerProgressLectures`, **default on** since 22.42 — the position is the user's own, on the platform they are signed in to, and the official player behaves the same way); **task-queue tabs never resume or report** — a batch extraction must cover the lecture from 0.

**Web sends it from the relay instead.** A 5 s interval would cost ~1000 Worker requests per 90-minute lecture — four times what streaming it costs — so the heartbeat rides a request the browser is already making. `getRecordedPlaybackData` adds `&sid=<session id>` to the relay playlist URL; `relay/`'s rewriter carries it into every segment line; and an hls.js `fLoader` appends the live playhead as `&p=<floor(t/5)*5>` to each segment fetch. The relay then PUTs it inside `ctx.waitUntil` — a **subrequest**, which Cloudflare does not bill as a request. The relay cannot derive the position itself: hls.js fetches up to a full 30 s buffer ahead, so a segment's own media offset would resume the lecture roughly a minute late. The only billed reports are at the edges: **on pause** (the play→pause edge, spotted in a purely local 5 s tick so it covers every way a video can stop, in single and dual mode) and **on close** (`stop()` plus a `pagehide` handler). There is deliberately no wall-clock fallback for sessions that cannot piggyback — native HLS, or a relay that ignores `sid` — because that would reintroduce exactly the per-lecture-minute cost the design exists to avoid; those viewers still resume correctly and lose only granularity if the tab is killed mid-play. Native HLS is narrower than "Safari": `Hls.isSupported()` is true wherever `ManagedMediaSource`, `MediaSource` or `WebKitMediaSource` exists, so desktop Safari, iPadOS and iOS 17.1+ all piggyback — it is iPhones before 17.1 and MSE-disabled browsers that do not. Dual streams report from the **master** instance only. This is the one place `relay/` forwards `t=` to Yanhekt, as the Bearer the progress API requires, and it only happens when the caller sends `sid`.

#### `GET /v2/live/list`

`page`, `page_size` (desktop default 16), optional `keyword`, optional `user_relationship_type` (`0` / omitted = public catalog, **anonymous-ok**; `1` = personal, **auth**, unauth → empty array).

Public catalog is a paginator (probe: thousands of rows). A row:

```json
{
  "id": 770304,
  "title": "物理光学课程实践",
  "subtitle": "理教楼403",
  "status": 1,
  "schedule_started_at": "2026-09-09 15:15:00",
  "schedule_ended_at": "2026-09-09 17:40:00",
  "participant_count": 126,
  "img": "https://coss.yanhekt.cn/images/colleges/guangdian.png",
  "source_id": 73385,
  "target": "https://clive10.yanhekt.cn/live/10429_Video1.m3u8",
  "target_vga": "https://clive10.yanhekt.cn/live/10429_VGA.m3u8",
  "target_room": "https://clive10.yanhekt.cn/live/10429_Video2.m3u8",
  "course": { "id": null, "image_url": "" },
  "session": { "course_id": 73385, "professor": null, "section_group_title": "第2周 星期三 第4大节" }
}
```

**No `name_en` anywhere on a live row** — not at the top level, not on the nested `course`, which also has no `id`. An English UI therefore falls back to the Chinese broadcast title unless something resolves it: use the row's `session.course_id` with `GET /v1/course?id=` (anonymous, ~1.6 KB), cached per **course** so a weekly course costs one lookup for all its broadcasts. Desktop does this on every live surface (`features/course/liveCourseTitles.ts`); web does it on the player only, and a cold deep link gets it free from `/v1/live?id=`.

Our `LiveStream.status` comment is `0=ended, 1=live, 2=upcoming`. Live-list rows in this probe used `1` (same-day) and `2` (later days); a **finished** session’s nested `live.status` was `3`. Prefer schedule timestamps. Cover: use `img`, not `course.image_url` (often `""`). Course id: use `session.course_id` (or `source_id`), not `course.id`.

#### `GET /v1/live?id=766560&with_session=true&with_course=true`

Broadcast detail **by id**, anonymous-ok. Probed 2026-09-11 against live `766560` / course `68437`.

**Both `with_*` flags are required.** Omitting either answers `61101114 系统繁忙` with `data: []` — a hard error, not a partial payload. Unknown id → `12131011 直播不存在`; missing `id` → `61101210`.

This is the only way to resolve a broadcast id without paging the live list, and it is what `web/` uses for a cold deep link to `/player/live/:id` (`PlayerRoute.hydrateLive`). Desktop has no equivalent path — it always opens live from an in-hand list row.

The payload is a live-list row **plus** more, so `transformLiveStreamToCourse` consumes it unchanged:

| Field | List row | `/v1/live?id=` |
|---|---|---|
| `id`, `title`, `subtitle`, `status`, `schedule_*`, `target`, `target_vga`, `img` | yes | identical |
| `session` | 5 keys (`badge`, `course_id`, `number`, `section_group`, `section_group_title`) | 21 keys — adds `id`, `title`, `week_number`, `day`, `started_at`/`ended_at`, `location`, `professor` |
| `course.id` | **null** | real course id |
| `course.name_en` | absent | present |
| `course.classrooms[]` | **absent** | present — the only live-side source, and what adaptive SSIM needs |
| `participant_count` | present (e.g. `69`) | **absent** |
| `looking_count` | absent | present — *current viewers*, not enrolment. Do **not** map it onto `participant_count` |

`session.professor` can still be `null` here (observed on `770335`), same as on list rows — keep the optional chaining.

`course.name_en` arrives HTML-escaped on some courses (`Design &#97;nd Practice of Opto-electronic system`) — the dirty-`name_en` case: render through `usableEnglishTitle()`, which decodes entities before its CJK check.

#### `GET /v1/tag/list?with_sub=true`

Always unauth in desktop (`getTagList` deletes Authorization). Four top-level tags: `degrees`, `semesters`, `colleges`, `attributes`. We only walk `param === "semesters"` → `children[]` `{ id, name, sort }`. Probe (newest first by `sort`): `110` = `2026-2027 第一学期`, `107` = `2025-2026 第二学期`, `100` = `2025-2026 第一学期`, … (13 children). `parseSemesterName` turns `2025-2026 第一学期` into `{ schoolYear: 2025, semester: 1, labelEn: "2025 Fall" }` (share’s `labelEn` is `Fall 2025` — same data, different word order).

#### Personal course lists (auth)

- `GET /v2/course/private/list?page=&page_size=&user_relationship_type=1&with_introduction=true` — enrolled courses. Unauth: empty array. Shape of a row matches course list (string professors, `classrooms[]`).
- `GET /v1/course/subscription/list?page=&page_size=` — **strict** auth (`61101113`). Default upstream `page_size` is **4** if omitted; always pass an explicit size. Rows are richer (`professor_names`, object `professors`, `college`, `professor_badges`, …). Desktop pins vs web subscriptions: [product names](#product-names-are-per-surface-owner-rulings).
- `POST /v1/course/subscription` body `{ "course_id": "<id>" }`; `DELETE` same URL + same JSON body. `Content-Type: application/json` is required on DELETE-with-body. Success `{ code: 0 }`. (Not live-tested.)

### 9.6 Recorded VOD and the CDN

#### `GET /v1/auth/video/token?id=0`

Anonymous. `id=0` is what we send (the official site sometimes sends a badge; `0` is accepted). Returns a **16-char** token, `now` / `expired_at` unix seconds, TTL **600s**. Relay caches it under a synthetic key with expiry minus 30s (floor 60s). Desktop caches per login token with a configurable refresh window.

```json
{ "code": 0, "data": { "token": "<16-char>", "expired_at": 1788945263, "now": 1788944663 } }
```

#### `GET /v1/video?id=456913`

Anonymous. Not on the web allowlist; desktop does not call it in production (session **list** already has `videos[]`). Documented because session-by-id only returns `video_ids`:

```json
{
  "code": 0,
  "data": {
    "id": 456913,
    "course_id": 0,
    "session_id": 0,
    "format": "m3u8",
    "main": "https://cvideo.yanhekt.cn/vod/2025/09/17/46558716/0/Video1/Video1.m3u8",
    "vga": "https://cvideo.yanhekt.cn/vod/2025/09/17/46558716/0/VGA/VGA.m3u8",
    "audio": "https://cvideo.yanhekt.cn/vod/2025/09/17/46558716/0/SubAudio/09_53_19_21.aac",
    "audio_origin": "https://cvideo.yanhekt.cn/vod/2025/09/17/46558716/0/SubAudio/09_53_19_21.aac",
    "duration": "5936",
    "start_main": "0",
    "start_vga": "21"
  }
}
```

`main` = camera, `vga` = screen. Those two `.m3u8` URLs are **not** playable raw (CDN **403** until path-encrypt + query signature). AutoSlides never calls this endpoint in production — the authenticated session **list** already has `videos[].main` / `vga`.

**`audio` / `audio_origin` — classroom SubAudio sidecar.** Among the cbiz hops this repo uses, **only** `GET /v1/video` returns them. They are absent from:

- authenticated `/v2/course/session/list` `videos[]` (same video id `456913` has `main`/`vga`/`start_*` but no `audio*`)
- anonymous `/v1/course/session` (no `videos[]` at all, only `video_ids`)
- live list (`target` / `target_vga` / `target_room` only)

The file sits next to the VOD as `…/{asset}/0/SubAudio/{HH}_{MM}_{SS}_{ms}.aac`. The timestamp is the recorder clock, typically ~1–2 minutes before `started_at` (this lecture: `09_53_19_21` vs session `09:55:00`). It is **not** referenced from the signed HLS playlists — `Video1.m3u8` / `VGA.m3u8` are plain `#EXTINF` + `.ts` lists (no `#EXT-X-MEDIA`, no `.aac`). Official playback uses whatever audio is already muxed into those TS segments.

Unlike the playlists, the AAC is **unsigned and world-readable**: a bare `GET` with no Origin, token, or signature returns HTTP 200, `Accept-Ranges: bytes`, ADTS magic `0xFFF1`. This lecture was 96 253 248 bytes for 5936 s (~130 kbps) — a speech-rate classroom mic stem, not a second HLS.

**It is zero-aligned with the video, despite the filename.** `ffprobe` over HTTP reports `aac, 32000 Hz, stereo, duration 5934.74 s` against the API's video `duration: 5936` — so the `09_53_19` is a recorder-clock *label*, not a lead-in, and no offset correction is needed. Do not re-derive this from the filename arithmetic; it looks like a ~100 s lead and is not one.

**What AutoSlides does with it.** Yanhekt's own UI warns 音源为蓝牙话筒，若老师未使用蓝牙话筒，则该路音频没有声音 — the track exists per-room and is silent when the teacher did not wear the mic, which is why nothing about it is assumed to be present.

- **Resolution is lazy and memoised.** Because only `/v1/video` carries the URL, knowing whether a lecture has a mic track costs one request per video id. The session page therefore always shows its mic button and resolves on click; `ApiClient.getMicAudioUrl` caches the answer, including the negative one.
- **Download** is `main/video/audioDownloadService.ts`, not the m3u8 downloader (no signing, no playlist, no ffmpeg). It writes `<outputDir>/audio_…__c<course>s<session>.aac` via a `.part` temp, and shares the intranet-aware axios factory (`main/infra/intranetAxios.ts`) with the m3u8 path so the campus host rewrite applies. `DownloadItem.videoType` gained `'audio'`; `download:cancel` routes by which service owns the id.
- **Playback** proxies it at `GET /audio?originalUrl=` on the local video proxy — unsigned, but proxied so intranet mode can rewrite the host. Range is forwarded and 206 passed through. The proxied URL is exposed as a sibling `audioUrl` on `VideoPlaybackUrls`, never as a `streams` entry (`streams` is the *video* stream list, enumerated by the stream picker and by the task queue).
- **On disk** it is a first-class Lectures asset: `[vtype=audio]`, counted in FILES, never in "Dual", and never a poster source or a `<video>` source.

#### Path encrypt + query signature

Used by desktop `videoProxyService` / `m3u8DownloadService` / LAN relay and by `relay/src/yanhekt.ts`. Web does not sign; it asks the relay.

1. Path: insert `md5(VIDEO_MAGIC + "_100")` = `c3d47d7b3aa8caf2983b313cb6cd142f` immediately before the filename.
2. Query: `Xvideo_Token` (from the token endpoint), `Xclient_Timestamp`, `Xclient_Signature = md5(VIDEO_MAGIC + "_v1_" + timestamp)`, `Xclient_Version=v1`, `Platform=yhkt_user`.

```
https://cvideo.yanhekt.cn/vod/…/Video1/c3d47d7b3aa8caf2983b313cb6cd142f/Video1.m3u8
  ?Xvideo_Token=…&Xclient_Timestamp=…&Xclient_Signature=…&Xclient_Version=v1&Platform=yhkt_user
```

A CDN **403** means the video token or signature was rejected. Retry: drop the cached token, re-mint, re-sign (desktop, LAN relay, and cloud relay: up to 3 attempts). Never send the user Bearer to `cvideo`.

Live `clive*.yanhekt.cn` URLs play **unsigned**. Desktop may rewrite the host to a campus-intranet IP and bind the NIC; web plays the raw URL.

### 9.7 Account, notes, MinIO, logout

#### `GET /v1/user`

Strict auth. Share `verifyUser` reads `data.badge` (publisher id) and `data.nickname`. Desktop/web also read `gender`, `phone`. Probe keys (values redacted): `id`, `badge`, `nickname`, `gender`, `phone`, `avatar`, `email`, `university_id`, `type`, `supervisor`, `password_first`. Unauth: `61101113`.

#### `GET /v1/cas/logout`

Best-effort revoke. Desktop `ApiClient.revokeToken` / web `revokeToken` fire-and-forget so local sign-out never waits. `deactivate` / account-switch **must not** call this (token stays valid for the other account). Live response: `{ "code": 0, "message": "", "data": { "success": true } }`. A subsequent `GET /v1/user` with the same Bearer is `61101113`.

#### Notes (`/v1/note*`) — always auth, `61101113` if not

Desktop `notesService` / web `notesClient` via the Worker allowlist. Group filter is **client-side** (list ignores `groupId`); `keyword=` **is** server-side. Group names max **6** characters (`ASnote` / `ASuser`). `note_group_id: 0` is rejected (`笔记分组ID不能小于1`); ungroup = create + copy + delete.

| Method | Path | Body / query | `data` we read |
|---|---|---|---|
| `GET` | `/v1/note/list?with_brief=false&keyword=&page=&page_size=&with_page=true` | — | Paginator. List `content` is `""` — fetch detail to edit. Keys include `id`, `uuid`, `title`, `note_group_id`, `version`, `created_at`, `updated_at` |
| `GET` | `/v1/note?id=` | — | Same plus stringified Editor.js `content`, `client_time`, `content_updated_time` |
| `POST` | `/v1/note` | `{ content: "", version: 2 }` | `{ id }` |
| `PUT` | `/v1/note` | `{ id, title, note_group_id? }` | `code: 0` |
| `PUT` | `/v1/note/content` | `{ id, content }` | `code: 0` |
| `DELETE` | `/v1/note` | `{ id }` | `code: 0` |
| `GET` | `/v1/note/group/list?with_note=false` | — | Array `{ id, name, notes, user_id? }`. Lookup managed groups **by name**, not id |
| `POST` | `/v1/note/group` | `{ name }` | `code: 0` (no id; re-list) |
| `DELETE` | `/v1/note/group` | `{ id }` | `code: 0` |

Writes inferred from `notesService.ts` / `notesClient.ts`.

#### `POST /v1/minio/upload`

Auth. `multipart/form-data`: `file` (image blob), `bucket=notes`. Response `{ host, path }` → public URL `host+path` on `coss.yanhekt.cn` (same bytes hash to the same URL). Worker forwards body + `Content-Type` verbatim.

Public reads need no auth:

- `GET https://coss.yanhekt.cn/images/{YYYY}/{M}/{md5}.png`
- S3 `GET https://coss.yanhekt.cn/images?list-type=2&prefix={YYYY/M/}&max-keys=1000` (`credentials: omit`) — share-link short hashes → full keys
- Default cover `https://coss.yanhekt.cn/images/front_cover.png`

### 9.8 Campus CAS

Not Yanhekt, but it is how we mint the 32-hex token. Desktop `campusSso/casFlow.ts`; web `lib/campusSso.ts` (Worker-only — `sso.bit.edu.cn` has no CORS).

`SERVICE_URL = https://cbiz.yanhekt.cn/v1/cas/callback`.

| Step | Call | Notes |
|---|---|---|
| 1 | `GET https://sso.bit.edu.cn/cas/login?service=…callback` | HTML: `#login-page-flowkey` (`execution`), `#login-croypto` (AES key), form action |
| 2 | `GET …/cas/api/protected/user/findCaptchaCount/{username}` | If a graphic captcha is required, **fail** with `captcha_required` — we never solve it |
| 3 | `POST` form action | `username`, AES-ECB password, `type=UsernamePassword`, `execution`, `croypto`. 302 → ticket; 200 + 2FA markers → SMS flow |
| 4 | `POST …/sms/getPhoneNumberByUserId` | RSA **PKCS#1 v1.5** + AES envelope (`hasCrypto`, `privateKey`). Web needs `nodejs_compat` |
| 5 | `POST …/sms/publicNoToken/sendSmsCode` | `{ phone, businessNo: "0008" }` |
| 6 | `POST …/sms/checkToken` | `{ phone, token: code, delete: false, trustDevice: true }` |
| 7 | `POST` 2FA form | `type=smsLogin`, `password=<code>`, `trustDevice=true`. 302 → ticket |
| 8 | `GET https://cbiz.yanhekt.cn/v1/cas/callback?ticket=ST-…` | 302 `Location` with `?token=<32-hex>` |

Desktop parks the live CAS cookie jar in memory for 300s (dies on renderer reload). Web AES-GCM-seals that bag into a `resumeToken` (`SSO_RESUME_KEY`; unset → 2FA accounts fall back to token-paste). Durable `trustDevice` cookies skip SMS on a known device (desktop `ssoDeviceCookies`; web `deviceKeepsake`). Browser login / paste-token remain the escape hatch.

### 9.9 Who calls what

| Call | Desktop | Web SPA | `web/` Worker | `share/` | `relay/` |
|---|---|---|---|---|---|
| Course list / detail / tags | `ApiClient` | `/api/yanhekt/…` | proxy; Bearer stripped | anonymous `fetchCourse*` / `fetchSemesters` | — |
| Session list | `getCourseInfo` (auth) | same | proxy; Bearer kept | — | — |
| Session by id | unused `getSessionById`; `getSessionProgress` (auth) reads `user_progress` | `getResumePosition` reads `user_progress` | allowlisted; **Bearer kept** (it carries `user_progress`) | `fetchSession` | — |
| Watch progress PUT | `reportSessionProgress` (watch + Lectures, opt-in) | tail + native-HLS only; the rest rides `/segment` | exact-match `PUT` allowlist | — | piggybacked on `/segment?…&sid=&p=` |
| Public live / search | anonymous-ok | proxy; stripped | stripped | — | — |
| Personal live / private courses / subscribe | auth | proxy; kept | kept | — | — |
| `/v1/user` | `verifyToken` | proxy | kept | `verifyUser` on publish | — |
| Logout | `revokeToken` | proxy | kept | — | — |
| Notes + MinIO | `notesService` | `/api/yanhekt/v1/note*` | kept | — | — |
| Video token | `getVideoToken` (anonymous-ok) | — | not allowlisted | — | anonymous mint `id=0` |
| Sign VOD | main-process proxy / LAN relay | — | — | — | `/playlist` `/segment` |
| Live HLS | optional intranet map | **direct CDN** | — | — | — |
| COSS list/get | `notesService` / `shareResolve` | `shareResolve` | — | `resolver.ts` | — |
| CAS | `campusSso/` | `/api/login` | `campusSso.ts` | — | — |

---

## 10. Cross-cutting protocols

### 10.1 Yanhekt video signing

Full contract (headers, anonymous vs auth, VOD path encrypt, live unsigned CDN): [§9](#9-yanhekt-api), especially [§9.6](#96-recorded-vod-and-the-cdn). CDN requests **never** send the user Bearer.

### 10.2 Share payload

Canonical: `autoslides/src/shared/shareLink.ts`.

| Version | Contents | Status |
|---|---|---|
| v1 | Human title in `t` | **Rejected** on decode |
| v2 | `c`/`s`/`l` ids + `p`/`n`/`h`/`o` images | Current, always accepted |
| v3 | v2 + `t` delta-string timeline | Emitted when Settings → Cloud → Sync → “Embed slide timeline” is on (desktop default) **and** the note has a timeline |

`t` (v3) = `idx:delta,idx:delta,…` — 0-based index into `h`, integer seconds since the previous cue (first delta is absolute). Reappearances reuse `idx`. Viewer rebuilds `timeline.json` via `@common/shareTimeline`; it is **not** stored on the server. Download-ZIP `timeline.json` is reconstructed the same way.

### 10.3 Slide sidecars (desktop disk; web mirrors the schema)

**`metadata.json`** (`SLIDE_METADATA_VERSION = 1`): `kind` (`recorded`/`live`) + `trigger` (`auto`/`watch`) drive `isWatchExtraction()`. `edited` is latched only by **human** crop/trash/delete, never by automated post-processing. `reviewed` sets on a ~2s dwell in Slides. All updaters no-op when the file is absent (no backfill). Single writer: `slideMetadataService`; renderer goes through `slideMetadataClient` (JSON-clone first).

**`timeline.json`** (`SLIDE_TIMELINE_VERSION = 1`): append-mostly `events` + `resolutions` map. Builtin recorded uses `video.currentTime`; Qt uses media PTS (`extractor: "qt"`), host stamps `kind: "recorded"` after extract. Live / web-capture / offline leave the file absent. Gaps are first-class (`unstable`, `ai_filtered`, `exclusion`, `manual_trash`). Phase-1/3b duplicates pass `TrashMetadata.duplicateOf` and **relink** the later event to the first-kept file. Missing file = no timeline (no backfill from filenames).

Consumers: Lectures slides strip (`deriveCues`); Slides preview Metadata (`appearancesForFile`); v3 share links.

### 10.4 Managed note content

Every AutoSlides-imported Editor.js note ends with a `code` block under sentinel `autoslides`, carrying `slides` (folder `metadata.json` or null), `timeline` (full `timeline.json` or null), and `note` (displayName / imageCount / importedAt / shareUrl). `noteImageUrls` ignores the block. Watch-mode titles look like `c62313s751843 · 泛函分析 · 第1周 星期三 第2大节` (live uses `l`). Disk `slides_*` folder names are unchanged.

---

## 11. Extraction and post-processing

Maths: [technical report](image-analysis-technical-report.pdf). Engineering:

**Stage 1 — SSIM extraction** (`processing/`). One shared pipeline; `useSlideExtraction` / `useTaskQueue` / `useWebCapture` are thin adapters around `slideExtractionManager.run`. Downsampled frames (default 480×270), SSIM in a Worker, double verification before commit. pHash was tried for *core comparison* and removed — do not reintroduce it there. Timeline logs `changeAt` / `confirmedAt`.

**Stage 2 — post-processing** (`postProcessing/`), four phases:

1. **Duplicates** — pHash + Hamming, adjacent near-dups.
2. **Exclusion list** — user pHash denylist (logos, intro cards).
3. **AI** — `simple` (2-class) or `distinguish` (3-class: `slide` / `not_slide` / `may_be_slide_edit`). Moves happen **batch-by-batch** so early successes survive a later failure. Distinguish + auto-crop: try in-place crop **before** trash; success keeps the frame (`onItemCropped`, not `onItemRemoved`); failure still trashes as `ai_filtered_edit`.
4. **3b post-crop pHash** — re-hash kept crops against remaining actives (first crop wins); dups trash as `duplicate` (crop-manifest left intact).

Desktop toggles: `enableAIFiltering`, `distinguishMaybeSlide`, `enableAutoCropAIFilteredEdit`, `enableDedupAfterAutoCropAIFilteredEdit` (last two default true; require Distinguish). Web: both crop paths hardcoded on when AI is enabled.

Automated crops call `crop:apply(..., autoCropped=true, isAutomated=true)` → `setCropped` only, never the human `edited` latch.

AI dispatch in watch mode is **arity-based**: 1 image → single-image endpoint + `'live'`-keyed prompt; >1 → batch + `'recorded'`-keyed prompt. Storage keys stay `live`/`recorded`.

**Stage 3 — auto-crop detector** (`autoCrop/`). Modes: `canny_then_yolo` (default), `canny_only`, `yolo_only`. YOLO is `onnxruntime-web` single-threaded (no SharedArrayBuffer). Built-in model in `resources/models/`; custom copies to `<userData>/models/` and self-heals to built-in if missing. Developer workspace lab draws a red box in memory — no disk writes.

`useTaskQueue` calls `ssimThresholdService.setCurrentClassrooms(...)` from `DataStore.getSessionData(sessionId)`, **not** via the pipeline's `Input.classrooms`. Don't "fix" this to match playback.

---

## 12. Gotchas

### Vue proxies cannot cross structured clone

Passing a Vue `reactive` / `ref` (or a nested field taken off one) across `ipcRenderer.invoke`, `Worker.postMessage`, or IndexedDB `put` throws `DataCloneError` **with no main-process log**. A surrounding `try/catch { /* best-effort */ }` makes the write look like a successful no-op — missing `metadata.json`, skipped Index publish, Export-to-local images-only.

`structuredClone` also throws on a Proxy. Canonical:

```ts
JSON.parse(JSON.stringify(value))
```

Copying a nested field still copies the Proxy: `{ metadata: viewer.resolved.metadata }` is not plain. `JSON.stringify` on a Proxy **works** (enumerable getters) — that is why Drive “Import to ASnote” (stringify content) wrote metadata while “Export to local” (`slideMetadata.write`) did not.

Do not add a new object-valued IPC / worker / IDB write from Vue state without a clone. Swallowing `DataCloneError` as “best-effort” without logging is how this stays invisible.

Known sites that already clone (or were the last place this bit): `slideMetadataClient.recordRecordedExtraction`, `slideTimelineClient.plain()`, `useNotesPublish`, `useShareIndexExport` (metadata was missed once; timeline was already cloned), preload `exportFolderStatus` / `prepareExportFolder`, web `slideStore.recordWatchExtraction`, `autoCropWorkerClient`.

### Sanitizers and the `__` delimiter

`@common/sanitizeFileName` strips `/` `\`. `downloadNaming.sanitizeDownloadName` replaces them with `_`. Both collapse `_{2,}` to `_`. Folder identity uses `__c…s…` as an unforgeable delimiter. **Append the suffix after sanitizing.** Never re-sanitize a string that already has the suffix, or `__` becomes `_` and matching breaks. `downloadService` and `extractionQueueService` must use the **same** sanitizer.

### IndexedDB Blobs on WebKit

See [web slideStore](#6-web--browser-client). ArrayBuffer in, short-lived Blob out. No migration path.

### Manifest retries vs CORS-opaque failures

hls.js reports a challenged relay as a generic network error with no status. `retryNetworkLoad` must `loadSource(hls.url)` for manifest failures; `startLoad()` spins forever on a manifest that never loaded. Drift group `videoErrorRecovery`.

### `direct` relay is a closed gate, not a convenience URL

If `RELAY_PUBLIC_ORIGIN` is set, the web Worker's own `/playlist`+`/segment` must 403. Otherwise anyone can bypass campus-ASN protection with a same-origin URL. `ALLOW_OFFCAMPUS_RELAY: "true"` is an explicit product decision (Worker-to-Worker, relay edge never sees the viewer).

### Share fingerprint ignores timeline

Adding `t` to an already-published image set updates the row in place. That is intentional (same slides, richer link) and surprising if you expected `version_count` to bump.

### Titles are not in D1

Index search/lecture pages will show empty names if Yanhekt is unreachable, not stale publisher-supplied titles. Do not “fix” this by storing titles.

### Anonymous vs authenticated Yanhekt

The matrix is [§9.3](#93-auth-vs-anonymous). Two unauth failure modes: `code: 61101113` (`用户未登录`) on strict endpoints (`/v1/user`, notes, subscription list), versus `code: 0` + `data: []` on session **list** / personal live / private course list. Marking a personal endpoint `allowAnonymous` (desktop) or stripping Bearer (web) yields empty data or `61101113`, not HTTP 401. Session **detail by id** is anonymous-ok (desktop unused; Index uses it). Copy the allowlists; don't guess.

### Multi-account stale UI

Watch `[isLoggedIn, userId]`, not `isLoggedIn` alone.

### Watch extraction vs Watch Notes

`trigger: 'watch'` folders are incomplete by nature (`isWatchExtraction`) and must not be auto-imported as official ASnote lecture notes. Watch **Notes** (ASuser, right-panel / web Notes sync) are a separate path, p-p-gated.

### SMS state dies on reload

Desktop parked CAS jar and web `resumeToken` are both 300s session secrets. Documented volatility, same as the in-memory queues.

### `createApp` / `finalizeApp` order

Any extra router must mount **between** them. A same-path handler registered after `finalizeApp` is dead.

### Demo hash history

History-mode `/demo/live` would render the real app via SPA fallback. Demo is hash-routed and storage-isolated. Build order: main then demo.

### ONNX + asar + Vite

`ort-wasm` must stay unpacked; `ort.env.wasm.wasmPaths` must point at the real filesystem. Vite configs stream `/ort-wasm/*` in dev and copy WASM once per renderer in prod (duplicate Rollup chunks are dropped).

### Audit overrides

CI `npm audit --audit-level=moderate` is a hard gate. Current pins live in each package's `package.json` `overrides` (and two `autoslides/vendor/` shims for unpatched `extract-zip` / `image-size`). Do not `npm audit fix --force`. Drop a pin only after a temporary removal + reinstall proves the in-range latest is patched.

---

## 13. CI, tests, and how to verify a change

### Workflows

| File | Trigger | Jobs |
|---|---|---|
| `.github/workflows/ci.yml` | push `main` + **all PRs** | `autoslides` (lint, tsc, vue-tsc, vitest, **drift**); `workers` matrix `web|share|relay` (typecheck, test, web also `typecheck:web`); `security` matrix all four (`npm audit --audit-level=moderate`); `package` Windows `npm run package` (retry loop for transient Electron downloads) |
| `build.yml` | push `main` | Windows NSIS + Linux AppImage/deb artifacts (30-day) |
| `release.yml` | tag `v*` | Draft GitHub release with those artifacts. **macOS is local** (`make:mac` + DropDMG + quarantine strip) |

Node 22 everywhere. Web CI generates types with `npx wrangler types -c wrangler.example.jsonc --strict-vars false` so `SSO_RESUME_KEY` stays `string`.

### Local checklist (match CI)

1. `cd autoslides && npx tsc --noEmit && npx vue-tsc --noEmit && npm run lint && npm test`
2. Touched a Worker: `cd web|share|relay && npm run typecheck && npm test` (web also `npm run typecheck:web`)
3. Touched an Electron↔web copied file: `node scripts/check-drift.mjs` (re-stamp with `--update` after porting)
4. `npm audit --audit-level=moderate` in each touched package — must report 0
5. Smoke the domain you changed (`npm start` / `wrangler dev`). Screenshot-driven UI review is a human pass; do not drive the live app unless asked.

### First-time Worker clone

```bash
cp wrangler.example.jsonc wrangler.jsonc
# web: set domain, SSO_RESUME_KEY (openssl rand -base64 32), optional RELAY_PUBLIC_ORIGIN
#      and service bindings RELAY=yanhekt-proxy, SHARE=autoslides-share
# share: wrangler kv namespace create SHARE_KV
#        wrangler d1 create autoslides-index-v2
#        npm run db:migrate
# relay: set domain; keep observability off
npm run build && npm run deploy    # web and share; relay has no frontend build
```

Leaving `SSO_RESUME_KEY` unset is valid. Leaving `AI_ORIGIN` unset 503s `/api/ai/*`. Leaving `RELAY` / `SHARE` unbound 503s those routes.

---

## Where to look next

| Need | Start here |
|---|---|
| User walkthrough, screenshots | root [`README.md`](../README.md) |
| Web user/clone guide | [`web/README.md`](../web/README.md) |
| Share encoding + Index privacy | [`share/README.md`](../share/README.md) |
| Yanhekt cbiz / CDN / CAS | this document [§9](#9-yanhekt-api) |
| Relay signing + cache | [`relay/README.md`](../relay/README.md) |
| SSIM / pHash / ML / crop maths | [`docs/image-analysis-technical-report.pdf`](image-analysis-technical-report.pdf) |
| Drift groups | [`scripts/check-drift.mjs`](../scripts/check-drift.mjs) |
| Desktop IPC contract | [`autoslides/src/preload/electronApi.ts`](../autoslides/src/preload/electronApi.ts) |
| Share codec (canonical) | [`autoslides/src/shared/shareLink.ts`](../autoslides/src/shared/shareLink.ts) |
| Web route table | [`web/src/app.ts`](../web/src/app.ts) |
| Relay entry | [`relay/src/index.ts`](../relay/src/index.ts) |
| Index publish | [`share/src/v2.ts`](../share/src/v2.ts) |
