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

// Capture tool/add-on windows that read the real filesystem (Results View, PDF
// Maker) only when explicitly requested — they'd otherwise show real folders.
const includeFs = process.argv.includes('--include-fs')

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

  await step('search', async () => {
    const input = win.locator('.nav-search-input')
    await input.click()
    await input.fill('Analysis')
    await input.press('Enter')
    await win.waitForTimeout(1500)
    await shot('search')
  })

  // --- advanced settings modal --------------------------------------------
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
        await win.waitForTimeout(600)
        await shot(name)
      } catch (e) {
        skipped.push(`${name} — ${e.message}`)
        console.warn(`  ⚠ skipped ${name}: ${e.message}`)
      }
    }
    // Close the modal so it doesn't overlay later windows.
    await win.keyboard.press('Escape').catch(() => {})
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

  if (includeFs) {
    await step('tools-results', () =>
      captureChildWindow(() => window.electronAPI.tools.openWindow('trash'), 'tools-results', '.toolwin-tabs'))
    await step('tools-pdfmaker', () =>
      captureChildWindow(() => window.electronAPI.tools.openWindow('pdfmaker'), 'tools-pdfmaker', '.toolwin-tabs'))
  }

  await app.close()
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
student "Kate" with a made-up Math course list). These are **not** copied into the
README — \`docs/step*.png\` are left untouched. Copy/rename manually if you want to
update the README walkthrough.

## Captured this run
${list}

## Mapping to README steps (current UI; README images are from older versions)
| File | README step(s) | View |
|------|----------------|------|
| home.png | step4 | Home (greeting, saved searches, personal rows) |
| live.png | step4 | Live course grid (demo live/upcoming/ended) |
| recorded.png | step5 | Recorded course grid (math courses) |
| session.png | step5 | Session/lecture list for a course |
| playback.png | step5.1 | Dual-stream playback — fake math screen + illustrated camera |
| search.png | — | Search results |
| advanced-general.png | step14 | Advanced ▸ General |
| advanced-image.png | step15–17 | Advanced ▸ Image Processing (SSIM, pHash, autocrop) |
| advanced-playback.png | step18 | Advanced ▸ Playback & Download |
| advanced-network.png | step18.1 | Advanced ▸ Network |
| advanced-ai.png | step3, step19 | Advanced ▸ AI |
| tools-offline.png | step20 | Tools ▸ Offline Processing |
| tools-compress.png | step21 | Tools ▸ Compress Lecture |
| addons-yuketang.png | step22 | Add-ons ▸ Yuketang |
| addons-webcapture.png | step23 | Add-ons ▸ Web Capture |

## ⚠ Needs attention / cannot be auto-captured in demo mode

These require **real content** or **manual** capture:

- **Results View & PDF Maker** (\`tools-results\`, \`tools-pdfmaker\`) read the **real
  output directory** on disk — demo mode does not fake the filesystem, so they show
  your real folder names. They are captured only with \`node scripts/screenshots.mjs --include-fs\`.
  Point the output directory at an empty/staged folder first, or capture manually.
  (README: step7, step8, step8.1, step9, step10, step11, step13.)
- **step1** — login / browser SSO. Demo mode auto-logs-in and skips it; the real BIT
  login page cannot be faked.
- **step5.1** — dual-stream playback. \`playback.png\` shows a demo version (fake math
  screen + illustrated camera via video posters). The video does not actually play.
- **step6** — live slide extraction in the player + the slide preview gallery. Needs a
  real video + a real extraction run (the gallery is also hidden in dual-stream view).
- **step6.1** — auto-extract on download (C++ extractor). Needs a real download +
  installed AutoSlides Extractor.
- **step8.1 / step9 / step10 / step11** — Results View *with extracted slides*. The
  UI shell exists but thumbnails and removed-reason examples need a real extraction.
- **step0** — extractor install modal (shows a real GitHub release).
- **Language/theme**: demo mode uses the existing config's language and theme. Set them
  in Advanced ▸ General before capturing if README shots need a specific locale.
`
  writeFileSync(path.join(outDir, 'NOTES.md'), notes)
  console.log(`  ✓ NOTES.md`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
