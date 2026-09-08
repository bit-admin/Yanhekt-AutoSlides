// README screenshots, captured from the /demo/ build with Playwright.
//
//   npm run screenshots                     # build the demo, capture, write share/docs/*.png
//   npm run screenshots -- --no-build       # reuse the existing dist/demo
//   npm run screenshots -- --only viewer    # one shot
//
// The demo serves deterministic data and Playwright pins locale, colour scheme
// and clock, so the only post-step is a 2× → 1× downscale and the images land
// straight in docs/ — no two-stage pipeline like the desktop app's.
//
// Unlike web/, the demo here spans TWO builds under one origin (/demo/ and
// /demo/v1/), which `vite preview` cannot serve together — so this script runs
// a small static server over dist/ instead, exactly as Cloudflare's asset layer
// does in production.
//
// Every shot runs inside step(), which records a failure and carries on: one
// broken view must never cost the whole run.

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..'); // share/
const distDir = path.join(projectRoot, 'dist');
const outDir = path.join(projectRoot, 'docs');
const tmpDir = path.join(projectRoot, 'node_modules', '.cache', 'screenshots');
const PORT = 4176;
const BASE = `http://localhost:${PORT}`;

const args = process.argv.slice(2);
const skipBuild = args.includes('--no-build');
const onlyArg = args.find((a) => a.startsWith('--only'));
const only = onlyArg
  ? new Set(
      (onlyArg.includes('=') ? onlyArg.split('=')[1] : args[args.indexOf(onlyArg) + 1] || '').split(','),
    )
  : null;

const captured = [];
const skipped = [];

/** Ids the demo fabricates — mirrors demo/demoData.ts. */
const COURSE = '501';
const WEEK = 9;
const SESSION = `${COURSE}${String(WEEK).padStart(2, '0')}`;

/**
 * Freeze the page clock. Upload dates are baked into the demo data, but the
 * index renders them with toLocaleDateString and the run must not depend on
 * when it happens to be executed.
 */
const FIXED_TIME = new Date('2026-09-02T14:30:00+08:00');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/** Cloudflare's asset layer in miniature: real files, directory → index.html. */
function startServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', BASE);
    let file = path.join(distDir, path.normalize(decodeURIComponent(url.pathname)));
    if (!file.startsWith(distDir)) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!existsSync(file)) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

async function step(name, fn) {
  if (only && !only.has(name)) return;
  try {
    await fn();
    captured.push(name);
    console.log(`  ✓ ${name}`);
  } catch (error) {
    skipped.push({ name, reason: error.message.split('\n')[0] });
    console.warn(`  ✗ ${name}: ${error.message.split('\n')[0]}`);
  }
}

/** Capture at 2× and let ImageMagick do the downscale, for crisp 1× PNGs. */
function downscale(from, to) {
  execFileSync('magick', [from, '-resize', '50%', '-strip', to]);
}

function makeShooter(page) {
  return async (name, options = {}) => {
    const raw = path.join(tmpDir, `${name}@2x.png`);
    const target = options.locator ? page.locator(options.locator) : page;
    await target.screenshot({ path: raw, fullPage: options.fullPage ?? false });
    downscale(raw, path.join(outDir, `${name}.png`));
  };
}

/**
 * Load a demo URL, wait for the view's own root element, let it settle.
 *
 * `height` is per shot: `.page` is `min-height: 100vh`, so a one-size viewport
 * leaves several hundred pixels of empty paper under the short views.
 */
async function open(page, url, ready, { settle = 600, height = 860 } = {}) {
  await page.setViewportSize({ width: 1280, height });
  await page.goto('about:blank');
  await page.clock.setFixedTime(FIXED_TIME);
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(ready, { timeout: 15000 });
  await page.waitForTimeout(settle);
  // The "fabricated data" pill is for visitors; the README says it in prose.
  await page.evaluate(() => window.__demoChrome?.(false));
}

async function main() {
  if (!skipBuild) {
    console.log('Building the demo…');
    execFileSync('npm', ['run', 'build:demo'], { cwd: projectRoot, stdio: 'inherit' });
  }
  for (const shell of ['demo/index.html', 'demo/v1/index.html']) {
    if (!existsSync(path.join(distDir, shell))) {
      throw new Error(`dist/${shell} is missing — run \`npm run build\` first`);
    }
  }

  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  const server = await startServer();
  const browser = await chromium.launch();
  try {
    // Deterministic capture conditions. Documentation screenshots are English
    // by house convention even though the README around them is Chinese; here
    // the site's chrome is English anyway, but the locale also fixes the
    // date formatting in the file lists.
    const context = await browser.newContext({
      colorScheme: 'light',
      locale: 'en-US',
      timezoneId: 'Asia/Shanghai',
      viewport: { width: 1280, height: 860 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    const shot = makeShooter(page);

    await captureIndex(page, shot);
    await captureViewer(page, shot);
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\nDone. ${captured.length} image(s) → ${path.relative(projectRoot, outDir)}`);
  if (skipped.length) console.log(`${skipped.length} skipped: ${skipped.map((s) => s.name).join(', ')}`);
}

// ------------------------------------------------------------------- index ---

async function captureIndex(page, shot) {
  await step('index-home', async () => {
    await open(page, '/demo/', '.feed .result-item', { settle: 900, height: 760 });
    await shot('index-home', { fullPage: true });
  });

  await step('index-search', async () => {
    await open(page, '/demo/?q=Analysis', '.result-groups', { settle: 900, height: 900 });
    await shot('index-search');
  });

  // The master–detail course view only exists when a session is opened from
  // loaded results (the app keeps the course's sessions in memory); a cold
  // visit to the same URL renders the single-session page instead.
  await step('index-course', async () => {
    await open(page, '/demo/?q=Functional', '.result-groups', { settle: 900, height: 560 });
    await page.locator('.result-group .result-item').first().click();
    await page.waitForSelector('.course-split .version', { timeout: 15000 });
    await page.waitForTimeout(500);
    await shot('index-course');
  });

  await step('index-lecture', async () => {
    await open(page, `/demo/?c=${COURSE}&s=${SESSION}`, '.course-detail-pane .version', { settle: 900, height: 420 });
    await shot('index-lecture');
  });

  await step('index-paste', async () => {
    await open(page, '/demo/', '.paste-toggle', { settle: 700, height: 620 });
    await page.locator('.paste-toggle').click();
    await page.waitForSelector('.search-input[placeholder^="Paste"]', { timeout: 5000 });
    await page.waitForTimeout(300);
    await shot('index-paste');
  });
}

// ------------------------------------------------------------------ viewer ---

async function captureViewer(page, shot) {
  await step('viewer', async () => {
    await open(page, '/demo/v1/', '.doc__body .slide__img', { settle: 900, height: 900 });
    await shot('viewer');
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
