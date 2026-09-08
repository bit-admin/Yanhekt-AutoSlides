// Process demo-mode screenshots into the repo's docs/ images for the README.
//
//   npm run screenshots:build   # (re)capture into autoslides/out/screenshots
//   npm run docs:images         # this script: rename/split/copy → ../docs
//   node scripts/process-docs.mjs --only cloud-notes-share   # just that capture
//
// What it does:
//   - COPY: rename each non-split capture 1:1 into docs/ (native window shots
//     already carry shadow + rounded corners; modal shots already have
//     transparent rounded corners — no pixel processing needed).
//   - SPLIT: the two over-long settings tabs are cropped into per-README-step
//     sub-images, using the live-DOM section geometry recorded in sections.json
//     (so boundaries survive layout changes). Uses ImageMagick (`magick`).
//   - COVER: hide live login QR codes (Yuketang) with a rounded rect so docs
//     never ship a scannable WeChat login code.
//   - CROP: a single named top-band of a capture is lifted into a standalone
//     docs image (the source is still copied whole elsewhere). Used for the
//     extractor-install image, which is just the top "Auto Extraction After
//     Download" section of the Playback settings tab.
//   - REGION_CROP: a rectangle of a window capture (account-switcher flyout,
//     etc.) is lifted into a standalone docs image. Prefers a CSS box recorded
//     in sections.json; falls back to fractions of the PNG.
//   - Appends an "## Image processing applied" log to out/screenshots/NOTES.md.
//
// No manual images: every docs/*.png comes from a capture. (docs/login.png is the
// browser-login view with the live SSO page loaded — needs network but the
// screenshot script captures it automatically.)

import { fileURLToPath } from 'node:url'
import { existsSync, mkdirSync, readFileSync, copyFileSync, appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')                 // autoslides/
const repoRoot = path.resolve(projectRoot, '..')                  // repo root
const srcDir = path.join(projectRoot, 'out', 'screenshots')
const docsDir = path.join(repoRoot, 'docs')

// --only <capture,…> limits processing to those CAPTURE names (the left-hand
// side of the maps below), so refreshing one image cannot rewrite the other
// fifty. Pairs with `node scripts/screenshots.mjs --only <same names>`.
const onlyArg = process.argv.find((a) => a.startsWith('--only'))
const only = onlyArg
  ? new Set(
      (onlyArg.includes('=') ? onlyArg.split('=')[1] : process.argv[process.argv.indexOf(onlyArg) + 1] || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    )
  : null
/** True when this capture is excluded by --only. */
const skipSrc = (src) => !!only && !only.has(src)

// capture name (without .png) → docs/ name (without .png). 1:1 verbatim copy.
const COPY = {
  login: 'login',
  'onboarding-welcome': 'onboarding-welcome',
  'onboarding-output': 'onboarding-output',
  'onboarding-connection': 'onboarding-connection',
  'onboarding-audio': 'onboarding-audio',
  'onboarding-ai': 'onboarding-ai',
  'onboarding-signin': 'onboarding-signin',
  'onboarding-signin-sms': 'onboarding-signin-sms',
  'onboarding-signin-ready': 'onboarding-signin-ready',
  'onboarding-cloud': 'onboarding-cloud',
  'onboarding-done': 'onboarding-done',
  'onboarding-whats-new': 'onboarding-whats-new',
  home: 'home',
  'home-signed-out': 'home-signed-out',
  'user-menu': 'user-menu',
  live: 'live',
  recorded: 'recorded',
  session: 'session',
  playback: 'playback',
  'playback-screen': 'playback-screen',
  tasklist: 'tasklist',
  downloads: 'downloads',
  search: 'search',
  'results-folders': 'results-folders',
  'results-grid': 'results-grid',
  'results-preview': 'results-preview',
  'results-crop': 'results-crop',
  pdfmaker: 'pdfmaker',
  'cloud-notes': 'cloud-notes',
  'cloud-notes-editor': 'cloud-notes-editor',
  'cloud-notes-share': 'cloud-notes-share',
  'cloud-index-recent': 'cloud-index-recent',
  'cloud-index-browse': 'cloud-index-browse',
  'tools-webcapture': 'tools-webcapture',
  'tools-yuketang': 'tools-yuketang',
  'advanced-general': 'settings-general',
  'advanced-playback': 'settings-playback',
  'advanced-network': 'settings-network',
  'advanced-ai-ml': 'settings-ai-ml',
  'advanced-cloud': 'settings-cloud',
  'lectures-library': 'lectures-library',
  'lectures-list': 'lectures-list',
  'lectures-course': 'lectures-course',
  'lectures-player': 'lectures-player',
  'watch-notes': 'watch-notes',
}

// README still names the Tools captures addons-*. Copy the live files there too.
const COPY_ALIASES = {
  'tools-yuketang': ['addons-yuketang'],
  'tools-webcapture': ['addons-webcapture'],
}

// Hide live login QR codes in docs outputs. Fractions of image width/height so
// the cover survives DPR. Applied to the COPY dest and any aliases of `src`.
const COVER = {
  'tools-yuketang': { x0: 0.396, y0: 0.373, x1: 0.602, y1: 0.647, rxFrac: 0.012 },
}

// Long settings tabs split into bands at section-title boundaries. `at` lists
// the section titles where a new band starts; bands map 1:1 to `parts`.
const SPLIT = {
  'advanced-image': {
    at: ['Post-Processing', 'Auto Crop'],
    parts: ['settings-image-output', 'settings-postprocess', 'settings-autocrop'],
  },
  'advanced-ai': {
    at: ['AI Behaviour'],
    parts: ['settings-ai-service', 'settings-ai-behaviour'],
  },
}

// Single-band crops: rows [0, section `to`.top) of a capture → a standalone
// docs image (the source is still copied whole via COPY). Uses sections.json.
const CROP = {
  'advanced-playback': { to: 'Download', out: 'extractor-install' },
  // 基础设置 walkthrough: tab pills + General block only (not Auth/Appearance/Cache).
  'advanced-general': { to: 'Authentication', out: 'settings-general-basics' },
}

// Extra bands of a long capture for the 基础设置 walkthrough. Prefer a recorded
// `.setting-label` top (`toLabel`) / section title (`from`); y0/y1 are PNG-row
// fallbacks for captures that predate label recording.
const BAND = [
  {
    src: 'advanced-image',
    out: 'settings-image-basics',
    toLabel: 'SSIM Threshold',
    y1: 468,
  },
  {
    src: 'advanced-image',
    out: 'settings-postprocess-basics',
    from: 'Post-Processing',
    toLabel: 'Hamming Distance Threshold for pHash (256-bit)',
    y0: 951,
    y1: 1389,
  },
  // README D. AI 设置: classifier + service type, without Request Settings.
  {
    src: 'advanced-ai',
    out: 'settings-ai-service',
    to: 'Request Settings',
    y1: 558,
  },
  // README 设置 > AI: Request Settings + completion params table.
  {
    src: 'advanced-ai',
    out: 'settings-ai-request',
    from: 'Request Settings',
    to: 'AI Behaviour',
    y0: 558,
    y1: 1449,
  },
]

// Window-capture corner crops. `out` is a docs/ basename. If sections.json has
// `{ contentWidth, contentHeight, crop: { x, y, width, height } }` in CSS px
// (screenshots.mjs records this for user-menu), that box is mapped onto the
// PNG (native shots include drop-shadow margins). Otherwise x0/y0/x1/y1 are
// fractions of the PNG — calibrated on a 1440×900 native capture.
const REGION_CROP = {
  'user-menu': {
    out: 'user-menu-switcher',
    x0: 16 / 1552,
    y0: 560 / 1012,
    x1: 616 / 1552,
    y1: 1,
  },
}

const log = []
const warn = (m) => { console.warn(`  ⚠ ${m}`); log.push(`- ⚠ ${m}`) }

function identify(file, fmt) {
  return execFileSync('magick', ['identify', '-format', fmt, file], { encoding: 'utf8' }).trim()
}

function main() {
  if (!existsSync(srcDir)) {
    console.error(`\n✗ No captures at ${srcDir}\n  Run "npm run screenshots:build" first.\n`)
    process.exit(1)
  }
  mkdirSync(docsDir, { recursive: true })

  // Capture display scaling: captures come out at physical px (logical × dpr);
  // we downscale every output by 1/dpr at the end so docs are a consistent 1×
  // set regardless of which display ran the screenshots.
  const metaPath = path.join(srcDir, 'meta.json')
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {}
  const dpr = meta.dpr > 1 ? meta.dpr : 1
  const outputs = [] // docs/*.png paths written this run (for the downscale pass)

  // --- COPY -----------------------------------------------------------------
  let copied = 0
  const coverFiles = []
  for (const [src, dst] of Object.entries(COPY)) {
    if (skipSrc(src)) continue
    const from = path.join(srcDir, `${src}.png`)
    const to = path.join(docsDir, `${dst}.png`)
    if (!existsSync(from)) { warn(`missing capture: ${src}.png (skipped)`); continue }
    copyFileSync(from, to)
    outputs.push(to)
    copied++
    console.log(`  ✓ ${src}.png → docs/${dst}.png`)
    log.push(`- copy \`${src}.png\` → \`docs/${dst}.png\``)
    if (COVER[src]) coverFiles.push({ file: to, spec: COVER[src], src })
  }

  for (const [src, aliases] of Object.entries(COPY_ALIASES)) {
    if (skipSrc(src)) continue
    const from = path.join(srcDir, `${src}.png`)
    if (!existsSync(from)) { warn(`missing capture: ${src}.png (alias skipped)`); continue }
    for (const dst of aliases) {
      const to = path.join(docsDir, `${dst}.png`)
      copyFileSync(from, to)
      outputs.push(to)
      copied++
      console.log(`  ✓ ${src}.png → docs/${dst}.png (alias)`)
      log.push(`- copy \`${src}.png\` → \`docs/${dst}.png\` (alias)`)
      if (COVER[src]) coverFiles.push({ file: to, spec: COVER[src], src })
    }
  }

  // --- COVER (redact live QR codes) ----------------------------------------
  for (const { file, spec, src } of coverFiles) {
    const w = parseInt(identify(file, '%w'), 10)
    const h = parseInt(identify(file, '%h'), 10)
    const x0 = Math.round(spec.x0 * w)
    const y0 = Math.round(spec.y0 * h)
    const x1 = Math.round(spec.x1 * w)
    const y1 = Math.round(spec.y1 * h)
    const rx = Math.max(4, Math.round((spec.rxFrac ?? 0.012) * w))
    execFileSync('magick', [
      file,
      '-fill', '#f4f4f6',
      '-stroke', '#e2e2e8',
      '-strokewidth', '1',
      '-draw', `roundrectangle ${x0},${y0} ${x1},${y1} ${rx},${rx}`,
      file,
    ])
    console.log(`  ✓ covered QR on ${path.basename(file)}`)
    log.push(`- cover QR on \`${path.basename(file)}\` (from \`${src}.png\`)`)
  }

  // --- SPLIT ----------------------------------------------------------------
  const manifestPath = path.join(srcDir, 'sections.json')
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}
  let split = 0
  for (const [src, cfg] of Object.entries(SPLIT)) {
    if (skipSrc(src)) continue
    const from = path.join(srcDir, `${src}.png`)
    if (!existsSync(from)) { warn(`missing capture: ${src}.png (split skipped)`); continue }
    const geom = manifest[src]
    if (!geom || !geom.sections?.length) { warn(`no sections.json geometry for ${src} (split skipped)`); continue }

    const pngW = parseInt(identify(from, '%w'), 10)
    const pngH = parseInt(identify(from, '%h'), 10)
    const scale = pngH / geom.height // CSS px → image px (handles any DPR)

    // Boundary rows: 0, each split-title section top (scaled), pngH.
    const bounds = [0]
    for (const title of cfg.at) {
      const sec = geom.sections.find((s) => s.title === title)
      if (!sec) { warn(`section "${title}" not found in ${src} (using even split fallback)`); continue }
      bounds.push(Math.round(sec.top * scale))
    }
    bounds.push(pngH)

    if (bounds.length - 1 !== cfg.parts.length) {
      warn(`${src}: expected ${cfg.parts.length} bands but got ${bounds.length - 1}; skipping split`)
      continue
    }

    for (let i = 0; i < cfg.parts.length; i++) {
      const y = bounds[i]
      const h = bounds[i + 1] - y
      const to = path.join(docsDir, `${cfg.parts[i]}.png`)
      execFileSync('magick', [from, '-crop', `${pngW}x${h}+0+${y}`, '+repage', to])
      outputs.push(to)
      split++
      console.log(`  ✓ ${src}.png [${y}..${y + h}] → docs/${cfg.parts[i]}.png`)
      log.push(`- split \`${src}.png\` rows ${y}–${y + h} (CSS top ${Math.round(y / scale)}px) → \`docs/${cfg.parts[i]}.png\``)
    }
  }

  // --- CROP -----------------------------------------------------------------
  let cropped = 0
  for (const [src, cfg] of Object.entries(CROP)) {
    if (skipSrc(src)) continue
    const from = path.join(srcDir, `${src}.png`)
    if (!existsSync(from)) { warn(`missing capture: ${src}.png (crop skipped)`); continue }
    const geom = manifest[src]
    const sec = geom?.sections?.find((s) => s.title === cfg.to)
    if (!sec) { warn(`section "${cfg.to}" not found in ${src} (crop skipped)`); continue }

    const pngW = parseInt(identify(from, '%w'), 10)
    const pngH = parseInt(identify(from, '%h'), 10)
    const scale = pngH / geom.height
    const h = Math.round(sec.top * scale)
    const to = path.join(docsDir, `${cfg.out}.png`)
    execFileSync('magick', [from, '-crop', `${pngW}x${h}+0+0`, '+repage', to])
    outputs.push(to)
    cropped++
    console.log(`  ✓ ${src}.png [0..${h}] → docs/${cfg.out}.png`)
    log.push(`- crop \`${src}.png\` rows 0–${h} (down to "${cfg.to}" section) → \`docs/${cfg.out}.png\``)
  }

  // --- BAND (walkthrough slices of a long tab) -----------------------------
  for (const cfg of BAND) {
    if (skipSrc(cfg.src)) continue
    const from = path.join(srcDir, `${cfg.src}.png`)
    if (!existsSync(from)) { warn(`missing capture: ${cfg.src}.png (band skipped)`); continue }
    const pngW = parseInt(identify(from, '%w'), 10)
    const pngH = parseInt(identify(from, '%h'), 10)
    const geom = manifest[cfg.src]
    const scale = geom?.height ? pngH / geom.height : 1
    let y0 = cfg.y0 ?? 0
    let y1 = cfg.y1 ?? pngH
    if (cfg.from && geom?.sections) {
      const sec = geom.sections.find((s) => s.title === cfg.from)
      if (sec) y0 = Math.round(sec.top * scale)
    }
    if (cfg.toLabel && geom?.labels) {
      const lab = geom.labels.find((l) => l.title === cfg.toLabel)
      if (lab) y1 = Math.round(lab.top * scale)
    } else if (cfg.to && geom?.sections) {
      const sec = geom.sections.find((s) => s.title === cfg.to)
      if (sec) y1 = Math.round(sec.top * scale)
    }
    y0 = Math.max(0, Math.min(pngH, y0))
    y1 = Math.max(y0 + 1, Math.min(pngH, y1))
    const h = y1 - y0
    const to = path.join(docsDir, `${cfg.out}.png`)
    execFileSync('magick', [from, '-crop', `${pngW}x${h}+0+${y0}`, '+repage', to])
    outputs.push(to)
    cropped++
    console.log(`  ✓ ${cfg.src}.png [${y0}..${y1}] → docs/${cfg.out}.png`)
    log.push(`- band \`${cfg.src}.png\` rows ${y0}–${y1} → \`docs/${cfg.out}.png\``)
  }

  // --- REGION_CROP (window-shot corners) -----------------------------------
  for (const [src, cfg] of Object.entries(REGION_CROP)) {
    if (skipSrc(src)) continue
    const from = path.join(srcDir, `${src}.png`)
    if (!existsSync(from)) { warn(`missing capture: ${src}.png (region crop skipped)`); continue }
    const pngW = parseInt(identify(from, '%w'), 10)
    const pngH = parseInt(identify(from, '%h'), 10)
    const geom = manifest[src]
    let x, y, w, h
    if (geom?.crop && geom.contentWidth && geom.contentHeight) {
      const contentW = geom.contentWidth * dpr
      const contentH = geom.contentHeight * dpr
      const ox = (pngW - contentW) / 2
      const oy = (pngH - contentH) / 2
      const pad = 24 * dpr
      x = Math.round(ox + geom.crop.x * dpr - pad)
      y = Math.round(oy + geom.crop.y * dpr - pad)
      w = Math.round(geom.crop.width * dpr + 2 * pad)
      h = Math.round(geom.crop.height * dpr + 2 * pad)
    } else {
      x = Math.round(cfg.x0 * pngW)
      y = Math.round(cfg.y0 * pngH)
      w = Math.round((cfg.x1 - cfg.x0) * pngW)
      h = Math.round((cfg.y1 - cfg.y0) * pngH)
    }
    x = Math.max(0, x)
    y = Math.max(0, y)
    w = Math.max(1, Math.min(pngW - x, w))
    h = Math.max(1, Math.min(pngH - y, h))
    const to = path.join(docsDir, `${cfg.out}.png`)
    execFileSync('magick', [from, '-crop', `${w}x${h}+${x}+${y}`, '+repage', to])
    outputs.push(to)
    cropped++
    const via = geom?.crop ? 'DOM box' : 'fractions'
    console.log(`  ✓ ${src}.png [${x},${y} ${w}×${h}] (${via}) → docs/${cfg.out}.png`)
    log.push(`- region-crop \`${src}.png\` ${w}×${h}+${x}+${y} (${via}) → \`docs/${cfg.out}.png\``)
  }

  // --- DPR NORMALIZE --------------------------------------------------------
  // Downscale every output by 1/dpr so a retina (2×) capture run yields the same
  // 1× docs images as a non-retina run (smaller files, consistent set).
  if (dpr > 1) {
    const pct = `${(100 / dpr).toFixed(4)}%`
    for (const f of outputs) execFileSync('magick', [f, '-resize', pct, f])
    console.log(`  ✓ downscaled ${outputs.length} image(s) ${pct} (dpr ${dpr} → 1×)`)
    log.push(`- downscaled all ${outputs.length} outputs to 1× (capture dpr ${dpr}, resize ${pct})`)
  }

  appendNotes()
  console.log(`\nDone. ${copied} copied, ${split} split bands, ${cropped} cropped → ${docsDir}` +
    (dpr > 1 ? ` (normalized from dpr ${dpr})` : ''))
}

function appendNotes() {
  const notesPath = path.join(srcDir, 'NOTES.md')
  const ts = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const block = `

## Image processing applied (\`npm run docs:images\`, ${ts})

\`scripts/process-docs.mjs\` wrote these \`docs/*.png\` from this run's captures:

${log.join('\n')}

Split/crop boundaries come from \`sections.json\` (live-DOM \`.advanced-setting-section\`
geometry), scaled by \`pngHeight / modalCssHeight\`. No image is manual —
\`docs/login.png\` is the browser-login view captured against the live SSO page.
`
  if (existsSync(notesPath)) appendFileSync(notesPath, block)
  console.log('  ✓ appended processing log to NOTES.md')
}

main()
