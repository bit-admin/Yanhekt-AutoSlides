// README screenshots, captured from the demo build with Playwright.
//
//   npm run screenshots            # build the demo, capture, write web/docs/*.png
//   npm run screenshots -- --no-build   # reuse the existing dist/demo
//   npm run screenshots -- --only home,slides
//
// The desktop app needs a two-stage pipeline (out/screenshots → process-docs)
// because its captures carry window chrome, live QR codes, and settings pages
// too long for one frame. A browser build needs none of that: the demo serves
// deterministic data, Playwright pins locale/scheme/viewport, and the only
// post-step is a 2× → 1× downscale. So these land straight in docs/.
//
// Every shot runs inside step(), which records a failure and carries on: one
// broken view must never cost the whole run.

import { chromium, devices } from "playwright";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, ".."); // web/
const outDir = path.join(projectRoot, "docs");
const tmpDir = path.join(projectRoot, "node_modules", ".cache", "screenshots");
const PORT = 4174;
const BASE = `http://localhost:${PORT}/demo/`;

const args = process.argv.slice(2);
const skipBuild = args.includes("--no-build");
const onlyArg = args.find((a) => a.startsWith("--only"));
const only = onlyArg
  ? new Set((onlyArg.includes("=") ? onlyArg.split("=")[1] : args[args.indexOf(onlyArg) + 1] || "").split(","))
  : null;

const captured = [];
const skipped = [];

/** Course/session ids the demo fabricates (mirrors frontend/src/demo/demoData.ts). */
const COURSE = "501";
const WEEK = 12;
const SESSION = `${COURSE}${String(WEEK).padStart(2, "0")}`;
const LIVE = `${COURSE}${WEEK}0`;
const NOTE = "1201";

/**
 * Freeze the page clock. The demo builds its dates relative to "now", and the
 * home page greets by time of day — without this, running the script at 02:00
 * produces a README that says 夜深了 and lectures dated at odd hours.
 */
const FIXED_TIME = new Date("2026-09-02T14:30:00+08:00");

async function step(name, fn) {
  if (only && !only.has(name)) return;
  try {
    await fn();
    captured.push(name);
    console.log(`  ✓ ${name}`);
  } catch (error) {
    skipped.push({ name, reason: error.message.split("\n")[0] });
    console.warn(`  ✗ ${name}: ${error.message.split("\n")[0]}`);
  }
}

/** Wait for the preview server to answer before driving a browser at it. */
async function waitForServer(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`preview server never came up at ${url}`);
}

/**
 * Capture at 2× and hand ImageMagick the downscale, so docs images are crisp
 * 1× PNGs (same final resolution the desktop pipeline produces).
 */
function downscale(from, to) {
  execFileSync("magick", [from, "-resize", "50%", "-strip", to]);
}

function makeShooter(page, scale) {
  return async (name, options = {}) => {
    const raw = path.join(tmpDir, `${name}@${scale}x.png`);
    const target = options.locator ? page.locator(options.locator) : page;
    await target.screenshot({ path: raw, fullPage: options.fullPage ?? false });
    downscale(raw, path.join(outDir, `${name}.png`));
  };
}

/**
 * Go to a hash route, wait for the page's own root element, let it settle.
 *
 * The blank hop matters: these are hash URLs, so navigating straight from one
 * to the next changes only the fragment and the page never reloads — the old
 * view stays on screen and `waitForSelector` matches it. A full load per shot
 * also keeps each capture independent of the one before it.
 */
async function open(page, route, ready, settle = 700) {
  await page.goto("about:blank");
  await page.clock.setFixedTime(FIXED_TIME);
  await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(ready, { timeout: 15000 });
  await page.waitForTimeout(settle);
  // The demo's "fabricated data" pill is for visitors; the README says it in
  // prose instead of stamping it on every image.
  await page.evaluate(() => window.__demoChrome?.(false));
}

async function main() {
  if (!skipBuild) {
    console.log("Building the demo…");
    execFileSync("npm", ["run", "build:demo"], { cwd: projectRoot, stdio: "inherit" });
  }
  if (!existsSync(path.join(projectRoot, "dist", "demo", "index.html"))) {
    throw new Error("dist/demo is missing — run without --no-build");
  }

  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  const preview = spawn(
    "npx",
    ["vite", "preview", "--config", "vite.demo.config.ts", "--port", String(PORT), "--strictPort"],
    { cwd: projectRoot, stdio: "ignore" },
  );

  const browser = await chromium.launch();
  try {
    await waitForServer(BASE);

    // Deterministic capture conditions — the one clear advantage over the
    // desktop script, whose theme and language follow the capture machine.
    // Documentation screenshots are English by house convention, even though
    // the README around them is Chinese; the app's language follows the
    // browser locale, so setting it here is all it takes.
    const shared = { colorScheme: "light", locale: "en-US", timezoneId: "Asia/Shanghai" };

    await captureDesktop(browser, shared);
    await captureMobile(browser, shared);
  } finally {
    await browser.close();
    preview.kill();
  }

  console.log(`\nDone. ${captured.length} image(s) → ${path.relative(projectRoot, outDir)}`);
  if (skipped.length) console.log(`${skipped.length} skipped: ${skipped.map((s) => s.name).join(", ")}`);
}

// ------------------------------------------------------------------ desktop --

async function captureDesktop(browser, shared) {
  const context = await browser.newContext({
    ...shared,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const shot = makeShooter(page, 2);

  // First load seeds IndexedDB; give it a moment before the first capture.
  await open(page, "", ".home-page", 1500);

  await step("home", async () => {
    await open(page, "", ".home-page");
    await shot("home");
  });

  await step("live", async () => {
    await open(page, "#/live", ".course-page");
    await shot("live");
  });

  await step("recorded", async () => {
    await open(page, "#/recorded", ".course-page");
    await shot("recorded");
  });

  await step("subscriptions", async () => {
    await open(page, "#/subscriptions", ".course-page");
    await shot("subscriptions");
  });

  // The search box lives in the header, but the keyword is route state — so
  // deep-link the query instead of typing into a element that may be collapsed.
  await step("search", async () => {
    await open(page, "#/search?q=Analysis", ".search-page", 1600);
    await shot("search");
  });

  await step("course", async () => {
    await open(page, `#/recorded/${COURSE}`, ".session-page", 1200);
    await shot("course");
  });

  // Dual stream is the mode worth showing: both panes at once is what makes
  // this player different from watching on yanhekt.cn.
  await step("player", async () => {
    await open(page, `#/player/recorded/${COURSE}/${SESSION}`, ".playback-page", 2000);
    await page.locator(".playback-page select").first().selectOption("__dual__");
    await page.waitForTimeout(1500);
    await shot("player");
  });

  await step("player-live", async () => {
    await open(page, `#/player/live/${LIVE}`, ".playback-page", 2000);
    await shot("player-live");
  });

  await step("player-extract", async () => {
    await open(page, `#/player/recorded/${COURSE}/${SESSION}`, ".playback-page", 2000);
    const panel = page.locator(".playback-page .slide-extraction-panel").first();
    await panel.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(800);
    await shot("player-extract");
  });

  // The workspace opens with the first album already selected, so one shot
  // shows both the album list and its grid.
  await step("slides", async () => {
    await open(page, "#/slides", ".image-grid", 1600);
    await shot("slides");
  });

  await step("slides-removed", async () => {
    await open(page, "#/slides", ".image-grid", 1600);
    await page.locator(".sm-segments button").last().click();
    await page.waitForTimeout(1000);
    await shot("slides-removed");
  });

  // A single click selects (that is the export flow); the lightbox opens on
  // double-click.
  await step("slides-preview", async () => {
    await open(page, "#/slides", ".image-grid", 1600);
    await page.locator(".image-card").nth(1).dblclick();
    await page.waitForTimeout(1200);
    await shot("slides-preview");
  });

  // Deep-link a note: the workspace opens on an empty editor otherwise, which
  // shows the chrome but none of what a note actually holds.
  await step("notes", async () => {
    await open(page, `#/notes/${NOTE}`, ".notes-workspace", 2000);
    await shot("notes");
  });

  // Settings scrolls inside `.settings-body`, so neither `fullPage` nor a
  // plain element shot reaches past the viewport. Let the column grow first,
  // then capture it whole — the desktop script solves the same problem the
  // same way.
  await step("settings", async () => {
    await open(page, "#/settings", ".settings-page", 900);
    await page.evaluate(() => {
      const page_ = document.querySelector(".settings-page");
      const body = document.querySelector(".settings-body");
      if (page_ instanceof HTMLElement) page_.style.height = "auto";
      if (body instanceof HTMLElement) {
        body.style.overflow = "visible";
        body.style.height = "auto";
        body.style.maxHeight = "none";
      }
    });
    await page.waitForTimeout(400);
    await shot("settings", { locator: ".settings-page" });
  });

  // ?guest boots the demo signed out — the only way to reach the sign-in
  // screen, since a signed-in visitor is sent straight back to the app.
  await step("login", async () => {
    await open(page, "?guest#/login", ".login-page", 1200);
    await page.evaluate(() => window.__demoChrome?.(false));
    await shot("login");
  });

  await step("apps", async () => {
    await open(page, "#/apps", ".apps-page", 1200);
    await shot("apps");
  });

  await context.close();
}

// ------------------------------------------------------------------- mobile --

async function captureMobile(browser, shared) {
  const context = await browser.newContext({
    ...devices["iPhone 14 Pro"],
    ...shared,
  });
  const page = await context.newPage();
  const shot = makeShooter(page, 3);

  await open(page, "", ".home-page", 1500);

  await step("mobile-home", async () => {
    await open(page, "", ".home-page");
    await shot("mobile-home");
  });

  await step("mobile-player", async () => {
    await open(page, `#/player/recorded/${COURSE}/${SESSION}`, ".playback-page", 2000);
    await shot("mobile-player");
  });

  await step("mobile-slides", async () => {
    await open(page, "#/slides", ".slides-workspace", 1500);
    await shot("mobile-slides");
  });

  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
