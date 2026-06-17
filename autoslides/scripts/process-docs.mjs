// Process demo-mode screenshots into the repo's docs/ images for the README.
//
//   npm run screenshots:build   # (re)capture into autoslides/out/screenshots
//   npm run docs:images         # this script: rename/split/copy → ../docs
//
// What it does:
//   - COPY: rename each non-split capture 1:1 into docs/ (native window shots
//     already carry shadow + rounded corners; modal shots already have
//     transparent rounded corners — no pixel processing needed).
//   - SPLIT: the two over-long settings tabs are cropped into per-README-step
//     sub-images, using the live-DOM section geometry recorded in sections.json
//     (so boundaries survive layout changes). Uses ImageMagick (`magick`).
//   - CROP: a single named top-band of a capture is lifted into a standalone
//     docs image (the source is still copied whole elsewhere). Used for the
//     extractor-install image, which is just the top "Auto Extraction After
//     Download" section of the Playback settings tab.
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

// capture name (without .png) → docs/ name (without .png). 1:1 verbatim copy.
const COPY = {
  login: 'login',
  'onboarding-welcome': 'onboarding-welcome',
  'onboarding-output': 'onboarding-output',
  'onboarding-connection': 'onboarding-connection',
  'onboarding-audio': 'onboarding-audio',
  'onboarding-taskspeed': 'onboarding-taskspeed',
  'onboarding-parallel': 'onboarding-parallel',
  'onboarding-ai': 'onboarding-ai',
  home: 'home',
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
  'tools-offline': 'tools-offline',
  'tools-compress': 'tools-compress',
  'addons-yuketang': 'addons-yuketang',
  'addons-webcapture': 'addons-webcapture',
  'advanced-general': 'settings-general',
  'advanced-playback': 'settings-playback',
  'advanced-network': 'settings-network',
  'advanced-ai-ml': 'settings-ai-ml',
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
  for (const [src, dst] of Object.entries(COPY)) {
    const from = path.join(srcDir, `${src}.png`)
    const to = path.join(docsDir, `${dst}.png`)
    if (!existsSync(from)) { warn(`missing capture: ${src}.png (skipped)`); continue }
    copyFileSync(from, to)
    outputs.push(to)
    copied++
    console.log(`  ✓ ${src}.png → docs/${dst}.png`)
    log.push(`- copy \`${src}.png\` → \`docs/${dst}.png\``)
  }

  // --- SPLIT ----------------------------------------------------------------
  const manifestPath = path.join(srcDir, 'sections.json')
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}
  let split = 0
  for (const [src, cfg] of Object.entries(SPLIT)) {
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
