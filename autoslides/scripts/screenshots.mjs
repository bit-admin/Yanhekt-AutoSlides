// Automated demo-mode screenshots via Playwright (Electron).
//
//   npm run package        # once, to produce .vite/ (re-run when app code changes)
//   npm run screenshots    # drives the unpackaged build in demo mode, writes PNGs
//
// We launch the UNPACKAGED Forge build (local electron + .vite/build/main.js):
// the packaged .app disables the EnableNodeCliInspectArguments / RunAsNode fuses,
// which Playwright's _electron needs, so it cannot attach to the packaged binary.
// Fuses only apply to packaged builds, so the unpackaged launch works.

import { _electron as electron } from 'playwright'
import electronPath from 'electron'
import { fileURLToPath } from 'node:url'
import { existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')        // autoslides/
const mainEntry = path.join(projectRoot, '.vite', 'build', 'main.js')
const outDir = path.join(projectRoot, 'out', 'screenshots')  // autoslides/out (gitignored)

// Capture mode:
//   native  — macOS only. Captures the real window (traffic lights, rounded
//             corners, drop shadow) via `screencapture -l<windowID>`. Needs
//             Screen Recording permission; falls back to web mode on failure.
//   web     — Playwright page.screenshot (web contents only, no window chrome).
// Default: native on macOS, web elsewhere. Override with --native / --no-native
// (--no-chrome is kept as an alias for --no-native).
const forceNative = process.argv.includes('--native')
const forceWeb = process.argv.includes('--no-native') || process.argv.includes('--no-chrome')
if (forceNative && process.platform !== 'darwin') {
  console.warn('  ⚠ --native is macOS-only; using web capture on this platform.')
}
const macChrome = process.platform === 'darwin' && !forceWeb // native unless explicitly disabled
console.log(`  capture mode: ${macChrome ? 'native (macOS window chrome)' : 'web (page contents)'}`)

if (!existsSync(mainEntry)) {
  console.error(`\n✗ Build not found: ${mainEntry}\n  Run "npm run package" first (it produces .vite/), then "npm run screenshots".\n`)
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

const captured = []
const skipped = []
// Per-settings-tab section geometry (CSS px, relative to .modal-content top),
// written to sections.json so process-docs.mjs can split the long settings
// screenshots at live-DOM section boundaries instead of hardcoded pixel rows.
const sectionsManifest = {}

async function main() {
  const app = await electron.launch({
    executablePath: electronPath,
    args: [mainEntry],
    cwd: projectRoot,
    env: { ...process.env, DEMO_MODE: '1' },
  })

  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  // Match the app's real default window size (1400x900) so grid rows get their
  // full height — a shorter window clips the multi-line course cards.
  try {
    const bw = await app.browserWindow(win)
    await bw.evaluate((w) => { w.setContentSize(1400, 900); w.center() })
  } catch (e) {
    console.warn('  (could not resize window):', e.message)
  }

  // Let demo auto-login + initial fetch settle.
  await win.waitForTimeout(2500)

  // Best-effort: dismiss the onboarding overlay if it somehow appears (demo
  // mode suppresses it in App.vue, but stay defensive).
  if (await win.locator('.onboarding-overlay').count()) {
    await win.keyboard.press('Escape').catch(() => {})
    const skip = win.locator('.onboarding-overlay button', { hasText: /skip|finish|done|完成|跳过/i })
    if (await skip.count()) await skip.last().click().catch(() => {})
    await win.waitForTimeout(500)
  }

  // --- helpers -------------------------------------------------------------
  let chromeFailed = false

  // Capture the real native window (incl. traffic lights + shadow) via macOS
  // screencapture; returns true on success.
  const captureNativeWindow = async (page, file) => {
    const bw = await app.browserWindow(page)
    await bw.evaluate((w) => { if (!w.isVisible()) w.show(); w.focus() })
    await page.waitForTimeout(300)
    const sourceId = await bw.evaluate((w) => w.getMediaSourceId()) // "window:<id>:0"
    const winId = sourceId.split(':')[1]
    // No -o → include the drop shadow (transparent margins) for a polished look.
    execFileSync('screencapture', ['-x', `-l${winId}`, file], { stdio: 'ignore' })
    if (!existsSync(file) || statSync(file).size < 4000) throw new Error('blank/empty capture')
    return true
  }

  const shot = async (name, page = win) => {
    const file = path.join(outDir, `${name}.png`)
    if (macChrome && !chromeFailed) {
      try {
        await captureNativeWindow(page, file)
        captured.push(name)
        console.log(`  ✓ ${name}.png (native)`)
        return
      } catch (e) {
        chromeFailed = true
        console.warn(`  ⚠ native capture failed (${e.message}); falling back to page screenshots.`)
        console.warn('    Grant Screen Recording permission to your terminal to capture window chrome.')
      }
    }
    await page.screenshot({ path: file })
    captured.push(name)
    console.log(`  ✓ ${name}.png`)
  }

  const step = async (name, fn) => {
    try {
      await fn()
    } catch (e) {
      skipped.push(`${name} — ${e.message}`)
      console.warn(`  ⚠ skipped ${name}: ${e.message}`)
    }
  }

  // nav items in the left sidebar: 0 = Home, 1 = Live, 2 = Recorded
  const clickNav = async (i) => {
    await win.locator('.nav-item').nth(i).click()
    await win.waitForTimeout(1200)
  }

  // --- main window views ---------------------------------------------------
  await step('home', async () => {
    await clickNav(0)
    await win.waitForTimeout(800)
    await shot('home')
  })

  await step('tasklist', async () => {
    await clickNav(0)
    await win.locator('.view-switcher .view-tab').nth(0).click() // Task tab
    await win.waitForSelector('[data-task-id]', { timeout: 6000 })
    await win.waitForTimeout(500)
    await shot('tasklist')
  })

  await step('downloads', async () => {
    await win.locator('.view-switcher .view-tab').nth(1).click() // Download tab
    await win.waitForSelector('[data-download-id]', { timeout: 6000 })
    await win.waitForTimeout(500)
    await shot('downloads')
    await win.locator('.view-switcher .view-tab').nth(0).click() // back to Task
  })

  await step('live', async () => {
    await clickNav(1)
    // Scope to the visible mode container — live/recorded are both mounted.
    await win.locator('[data-mode="live"] .course-card').first().waitFor({ state: 'visible', timeout: 8000 })
    await win.waitForTimeout(600)
    await shot('live')
  })

  await step('recorded', async () => {
    await clickNav(2)
    await win.locator('[data-mode="recorded"] .course-card').first().waitFor({ state: 'visible', timeout: 8000 })
    await win.waitForTimeout(600)
    await shot('recorded')
  })

  await step('session', async () => {
    // From the recorded grid, open the first course → session list.
    await clickNav(2)
    await win.locator('[data-mode="recorded"] .course-card').first().waitFor({ state: 'visible', timeout: 8000 })
    await win.locator('[data-mode="recorded"] .course-card').first().click()
    await win.waitForSelector('.session-item', { timeout: 8000 })
    await win.waitForTimeout(600)
    await shot('session')
  })

  await step('playback', async () => {
    // Recorded → (open a course if on the grid) → play first session → dual demo.
    await clickNav(2)
    await win.waitForTimeout(600)
    const card = win.locator('[data-mode="recorded"] .course-card').first()
    if (await card.isVisible().catch(() => false)) {
      await card.click()
    }
    await win.waitForSelector('.session-item', { timeout: 8000 })
    await win.locator('.session-item').first().click()
    await win.waitForSelector('.video-content', { timeout: 12000 })
    await win.waitForTimeout(1500)
    await shot('playback')
  })

  // Single-stream "Screen recording" view with the populated slide gallery.
  await step('playback-screen', async () => {
    // Continue from the playback step (dual view is up). Switch the stream
    // selector to the screen recording → single-stream view reveals the gallery.
    await win.locator('.stream-selector select').selectOption('screen')
    await win.waitForSelector('.slide-gallery .gallery-grid .slide-thumbnail', { timeout: 8000 })
    await win.waitForTimeout(800)
    // Bring the gallery into view (it sits below the video in the window).
    await win.locator('.slide-gallery').scrollIntoViewIfNeeded().catch(() => {})
    await win.waitForTimeout(500)
    await shot('playback-screen')
  })

  await step('search', async () => {
    const input = win.locator('.nav-search-input')
    await input.click()
    await input.fill('Analysis')
    await input.press('Enter')
    await win.waitForTimeout(1500)
    await shot('search')
  })

  // --- advanced settings modal --------------------------------------------
  // Settings are always captured as WEB element screenshots cropped to the modal
  // (no window chrome), and as a "long screenshot": we lift the modal's height /
  // overflow caps so the full scrollable tab renders, then screenshot the
  // .modal-content element. The overlay backdrop is made transparent so
  // omitBackground gives clean rounded corners.
  const expandModal = () => win.evaluate(() => {
    const set = (sel, styles) => {
      const el = document.querySelector(sel)
      if (el) Object.assign(el.style, styles)
    }
    set('.modal-overlay', { background: 'transparent', alignItems: 'flex-start', padding: '0', overflow: 'visible' })
    set('.modal-content', { maxHeight: 'none', overflow: 'visible', margin: '0' })
    set('.modal-body', { overflow: 'visible' })
    set('.advanced-settings-content', { overflow: 'visible', maxHeight: 'none', height: 'auto' })
  })

  // Record each .advanced-setting-section's geometry within .modal-content, so
  // the docs pipeline can crop the long tabs into per-README-step sub-images.
  const recordSections = (name) => win.evaluate((tabName) => {
    const content = document.querySelector('.modal-content')
    if (!content) return null
    const cRect = content.getBoundingClientRect()
    const sections = [...content.querySelectorAll('.advanced-setting-section')].map((s) => {
      const r = s.getBoundingClientRect()
      return {
        title: (s.querySelector('h4')?.textContent || '').trim(),
        top: Math.round(r.top - cRect.top),
        bottom: Math.round(r.bottom - cRect.top),
      }
    })
    return { tabName, width: Math.round(cRect.width), height: Math.round(cRect.height), dpr: window.devicePixelRatio, sections }
  }, name)

  const shotModal = async (name) => {
    const file = path.join(outDir, `${name}.png`)
    const geom = await recordSections(name)
    if (geom) sectionsManifest[name] = geom
    // captureBeyondViewport (Playwright default for element shots) grabs the full
    // expanded modal even when it's taller than the window.
    await win.locator('.modal-content').screenshot({ path: file, omitBackground: true })
    captured.push(name)
    console.log(`  ✓ ${name}.png (modal, web)`)
  }

  await step('advanced-settings', async () => {
    // Open via the gear icon in the user banner.
    await clickNav(0)
    await win.locator('.user-banner-action').first().click()
    await win.waitForSelector('.advanced-tabs', { timeout: 6000 })
    await win.waitForTimeout(500)

    const tabs = [
      ['advanced-general', 0],
      ['advanced-image', 1],
      ['advanced-playback', 2],
      ['advanced-network', 3],
      ['advanced-ai', 4],
    ]
    for (const [name, idx] of tabs) {
      try {
        await win.locator('.advanced-tabs .tab-btn').nth(idx).click()
        await win.waitForTimeout(400)
        await expandModal()
        await win.waitForTimeout(350)
        await shotModal(name)
      } catch (e) {
        skipped.push(`${name} — ${e.message}`)
        console.warn(`  ⚠ skipped ${name}: ${e.message}`)
      }
    }

    // The AI tab has two classifier modes — advanced-ai.png above is LLM (the
    // default); also capture the ML variant. The classifier-mode toggle is the
    // first .ai-service-type-selector; its 2nd .mode-btn is "ML".
    try {
      await win.locator('.advanced-tabs .tab-btn').nth(4).click() // AI tab
      await win.waitForTimeout(300)
      await win.locator('.ai-service-type-selector').first().locator('.mode-btn').nth(1).click()
      await win.waitForTimeout(400)
      await expandModal()
      await win.waitForTimeout(350)
      await shotModal('advanced-ai-ml')
    } catch (e) {
      skipped.push(`advanced-ai-ml — ${e.message}`)
      console.warn(`  ⚠ skipped advanced-ai-ml: ${e.message}`)
    }

    // Close the modal so it doesn't overlay later windows. The overlay has no
    // Escape handler — clicking Cancel emits the close.
    await win.locator('.modal-content .cancel-btn').first().click().catch(() => {})
    await win.waitForTimeout(300)
    await win.waitForSelector('.modal-overlay', { state: 'detached', timeout: 4000 }).catch(() => {})
  })

  // --- first-run onboarding wizard (web element shots, like settings) ------
  // Onboarding is first-run-only and suppressed in demo mode, so App.vue exposes
  // a demo-only window.__demoSetOnboarding(bool) toggle. Each step is captured as
  // a transparent-background element shot of the 460px card.
  await step('onboarding', async () => {
    await clickNav(0)
    await win.evaluate(() => window.__demoSetOnboarding?.(true))
    await win.waitForSelector('.onboarding-card', { timeout: 6000 })
    // Transparent backdrop (drop the dark overlay + blur) so omitBackground
    // gives clean rounded-corner cards, matching the settings-modal treatment.
    await win.evaluate(() => {
      const ov = document.querySelector('.onboarding-overlay')
      if (ov) { ov.style.background = 'transparent'; ov.style.backdropFilter = 'none' }
    })
    const shotCard = async (name) => {
      await win.waitForTimeout(300)
      await win.locator('.onboarding-card').screenshot({ path: path.join(outDir, `${name}.png`), omitBackground: true })
      captured.push(name)
      console.log(`  ✓ ${name}.png (onboarding, web)`)
    }
    // step 0 = welcome hero; steps 1..6 = the dotted config steps.
    await shotCard('onboarding-welcome')
    await win.locator('.hero-cta').click() // Get Started → step 1
    const steps = ['onboarding-output', 'onboarding-connection', 'onboarding-audio',
      'onboarding-taskspeed', 'onboarding-parallel', 'onboarding-ai']
    for (let i = 0; i < steps.length; i++) {
      await win.waitForSelector('.onboarding-body', { timeout: 4000 })
      await shotCard(steps[i])
      if (i < steps.length - 1) await win.locator('.onboarding-footer .btn--primary').click()
    }
    // Dismiss (don't advance into the sign-in step) so later steps are clean.
    await win.evaluate(() => window.__demoSetOnboarding?.(false))
    await win.waitForSelector('.onboarding-card', { state: 'detached', timeout: 4000 }).catch(() => {})
  })

  // --- separate windows: Tools & Add-ons ----------------------------------
  // Opened directly on the target tab via IPC (deterministic; avoids the
  // ambiguous panel buttons, one of which opens Finder).
  const captureChildWindow = async (openExpr, name, readySelector) => {
    const child = await Promise.all([
      app.waitForEvent('window'),
      win.evaluate(openExpr),
    ]).then(([w]) => w)
    await child.waitForLoadState('domcontentloaded')
    try {
      const bw = await app.browserWindow(child)
      await bw.evaluate((w) => { w.setContentSize(1200, 800); w.center() })
    } catch { /* best effort */ }
    if (readySelector) await child.waitForSelector(readySelector, { timeout: 8000 }).catch(() => {})
    await child.waitForTimeout(1000)
    await shot(name, child)
    await child.close().catch(() => {})
    await win.waitForTimeout(400)
  }

  await step('tools-offline', () =>
    captureChildWindow(() => window.electronAPI.tools.openWindow('offline'), 'tools-offline', '.toolwin-tabs'))

  await step('tools-compress', () =>
    captureChildWindow(() => window.electronAPI.tools.openWindow('compress'), 'tools-compress', '.toolwin-tabs'))

  await step('addons-yuketang', () =>
    captureChildWindow(() => window.electronAPI.addons.openWindow('yuketang'), 'addons-yuketang', '.toolwin-tabs'))

  await step('addons-webcapture', () =>
    captureChildWindow(() => window.electronAPI.addons.openWindow('webcapture'), 'addons-webcapture', '.toolwin-tabs'))

  // Open a child window and return its handle (without capturing/closing it),
  // so multi-step flows (Results View) can drive it across several screenshots.
  const openChildWindow = async (openExpr, readySelector) => {
    const child = await Promise.all([
      app.waitForEvent('window'),
      win.evaluate(openExpr),
    ]).then(([w]) => w)
    await child.waitForLoadState('domcontentloaded')
    try {
      const bw = await app.browserWindow(child)
      await bw.evaluate((w) => { w.setContentSize(1280, 860); w.center() })
    } catch { /* best effort */ }
    if (readySelector) await child.waitForSelector(readySelector, { timeout: 8000 }).catch(() => {})
    await child.waitForTimeout(800)
    return child
  }

  // Results View (trash tab): folder list → image grid → may_be_slide_edit
  // preview → crop mode (demo data; reads no real files).
  await step('results', async () => {
    const child = await openChildWindow(() => window.electronAPI.tools.openWindow('trash'), '.folder-list')
    await shot('results-folders', child)

    // Open the "rich" folder (Functional Analysis week 9 sorts before week 10).
    await child.locator('.folder-item', { hasText: 'Functional Analysis' }).first().click()
    await child.waitForSelector('.results-grid', { timeout: 8000 })
    await child.waitForTimeout(700)
    await shot('results-grid', child)

    // Open the may_be_slide_edit item's preview, then enter crop mode.
    const editItem = child.locator('.result-item:has(.reason-ai_filtered_edit)').first()
    await editItem.locator('.item-preview-btn').click()
    await child.waitForSelector('.preview-modal', { timeout: 8000 })
    await child.waitForTimeout(500)
    await shot('results-preview', child)

    await child.locator('.preview-actions .preview-action-btn').first().click() // Crop
    await child.waitForSelector('.crop-selection', { timeout: 8000 })
    await child.waitForTimeout(500)
    await shot('results-crop', child)

    await child.close().catch(() => {})
    await win.waitForTimeout(400)
  })

  // PDF Maker (slides export): grouped folder list with image counts.
  await step('pdfmaker', () =>
    captureChildWindow(() => window.electronAPI.tools.openWindow('pdfmaker'), 'pdfmaker', '.folder-list'))

  // --- browser SSO login (real network) -----------------------------------
  // The browser-login view embeds a <webview> pointed at the LIVE BIT SSO page,
  // so this capture needs network — but it's fully reproducible, not manual.
  // Done LAST: it signs out first (to reveal the "Sign In" banner), which wipes
  // the demo session the other views depend on.
  await step('login', async () => {
    await clickNav(0)
    // Clear the leftover search text from the earlier search step.
    await win.locator('.nav-search-input').fill('').catch(() => {})
    // Sign out → logged-out state shows the "Sign In" banner.
    await win.locator('.user-info .user-banner-main').click()
    await win.waitForSelector('.user-menu-signout', { timeout: 6000 })
    await win.locator('.user-menu-signout').click()
    await win.waitForSelector('.signin-banner', { timeout: 6000 })
    await win.waitForTimeout(400)
    // Open the sign-in menu → "Sign in with browser".
    await win.locator('.signin-banner .user-banner-main').click()
    await win.waitForSelector('.signin-menu', { timeout: 6000 })
    // `.signin-option` also covers the UserMenuLinks rows — match by text.
    await win.locator('.signin-menu .signin-option', { hasText: /browser|浏览器/i }).click()
    // BrowserLoginView mounts a <webview> pointed at the live SSO page. The
    // webview tag isn't a "visible" DOM node to Playwright, so wait for its
    // container, then give the page generous time to load over the network.
    await win.waitForSelector('.browser-login-view', { timeout: 10000 })
    await win.waitForTimeout(9000)
    await shot('login')
  })

  // Record the run's device pixel ratio: native + element captures come out at
  // physical pixels (logical × dpr), so process-docs.mjs downscales by 1/dpr to
  // emit consistent 1× docs images regardless of the capture display's scaling.
  const runDpr = await win.evaluate(() => window.devicePixelRatio).catch(() => 1)

  await app.close()
  writeFileSync(path.join(outDir, 'sections.json'), JSON.stringify(sectionsManifest, null, 2))
  console.log(`  ✓ sections.json`)
  writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify({ dpr: runDpr }, null, 2))
  console.log(`  ✓ meta.json (dpr ${runDpr})`)
  writeNotes()

  console.log(`\nDone. ${captured.length} screenshot(s) → ${outDir}`)
  if (skipped.length) {
    console.log(`Skipped ${skipped.length}:`)
    for (const s of skipped) console.log(`  - ${s}`)
  }
}

function writeNotes() {
  const list = captured.map((n) => `- \`${n}.png\``).join('\n') || '- (none)'
  const notes = `# Demo-mode screenshots — notes

Generated by \`npm run screenshots\` (launches the app with \`DEMO_MODE=1\`, fabricated
student "Kate" with a made-up Math course list). The English-UI captures here feed the
README via \`npm run docs:images\` (\`scripts/process-docs.mjs\`), which renames/splits
them into \`docs/*.png\`. The full refresh flow is:

    npm run screenshots:build   # re-capture (re-package + screenshots)
    npm run docs:images         # process + copy into ../docs

The \`## Image processing applied\` section below is appended by \`process-docs.mjs\`.

## Captured this run
${list}

## Mapping: capture → docs/ target → README walkthrough
| Capture | docs/ target(s) | README section |
|---------|-----------------|----------------|
| login.png | login.png | A. 登录（浏览器 SSO，实时加载真实登录页） |
| onboarding-*.png (×7) | onboarding-*.png | 首次启动向导（欢迎 + 6 个配置步骤，置于「4. 使用与设置」前） |
| home.png | home.png | D. 基础页面（Home / 课程收藏夹） |
| live.png | live.png | D. 直播课程网格 |
| recorded.png | recorded.png | E. 录播课程网格 |
| session.png | session.png | E. 节次列表（加入任务 / 下载） |
| playback.png | playback.png | E. 双流播放 |
| playback-screen.png | playback-screen.png | F. 单流（屏幕录制）+ 幻灯片预览画廊 |
| tasklist.png | tasklist.png | F. 任务列表（进度 + 后处理） |
| downloads.png | downloads.png | F. 下载队列（下载后自动提取 + 后处理） |
| search.png | search.png | D. 搜索结果 |
| results-folders.png | results-folders.png | G. 审查幻灯片 — 文件夹（按课程分组） |
| results-grid.png | results-grid.png | G. 图像网格（视图 / 原因筛选 / 徽章 / NO SIGNAL / 编辑模式帧） |
| results-preview.png | results-preview.png | G. 放大预览（编辑模式帧） |
| results-crop.png | results-crop.png | G. 裁剪模式（裁剪框） |
| pdfmaker.png | pdfmaker.png | H. 导出（PDF / PPTX，按课程分组） |
| advanced-general.png | settings-general.png | B & I. 一般设置 |
| advanced-image.png | settings-image-output.png + settings-postprocess.png + settings-autocrop.png | I. 图像处理（**拆分为 3 张**） |
| advanced-playback.png | settings-playback.png | I. 下载与播放 |
| advanced-network.png | settings-network.png | I. 网络 |
| advanced-ai.png | settings-ai-service.png + settings-ai-behaviour.png | C & I. AI（**拆分为 2 张**） |
| advanced-ai-ml.png | settings-ai-ml.png | I. AI（ML 模式 / 严格度滑块） |
| tools-offline.png | tools-offline.png | J. 离线处理 |
| tools-compress.png | tools-compress.png | J. 讲座压缩 |
| addons-yuketang.png | addons-yuketang.png | K. 雨课堂 |
| addons-webcapture.png | addons-webcapture.png | K. 网页捕获 |

## Fully automated — no manual captures

Every \`docs/*.png\` is produced by this script + \`process-docs.mjs\`. Two captures that
*look* like they'd need real data but don't:

- **docs/login.png** — the script signs out, opens the browser-login view, and lets the
  **live** BIT SSO page load in the embedded webview before capturing. Needs network, but
  it's reproducible (not a hand-taken screenshot).
- **docs/extractor-install.png** — \`process-docs.mjs\` crops it from the top "Auto
  Extraction After Download" section of the \`advanced-playback\` capture (the Install
  Extractor button + executable path).

Not in the README walkthrough but worth noting: live slide extraction *running during
playback* (progress/SSIM while a real video plays) still needs a real video — the demo
gallery in \`playback-screen.png\` is seeded with fabricated slides.

## Notes on specific captures

- **Settings tabs** (\`advanced-*.png\`) are **web element screenshots cropped to the
  modal** (600px wide, no window chrome) and **long screenshots**: the modal's
  height/overflow caps are lifted so the whole scrollable tab renders in one image with
  transparent rounded corners. \`sections.json\` records each \`.advanced-setting-section\`'s
  geometry so \`process-docs.mjs\` can split the long tabs at real section boundaries.
- **Defaults**: demo boots from an isolated \`AutoSlides-Demo\` userData dir, so all
  settings show factory **defaults** (the demo never touches your real profile).
- **Results View & PDF Maker** (\`results-*.png\`, \`pdfmaker.png\`) use **fabricated**
  folders/slides drawn as SVGs — they read **no real files** (slides, the NO SIGNAL
  not_slide, the PowerPoint-edit frame, and the seeded crop box are all synthetic).
`
  writeFileSync(path.join(outDir, 'NOTES.md'), notes)
  console.log(`  ✓ NOTES.md`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
