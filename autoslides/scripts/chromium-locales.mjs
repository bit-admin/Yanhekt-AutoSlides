#!/usr/bin/env node
// Keeps only the Chromium localizations for the app's own languages
// (en/zh/ja/ko, plus British English and Traditional Chinese) in a packaged
// app. Each other locale pack is ~0.9 MB and the app has no UI in it.
//
// macOS: `<locale>.lproj/locale.pak` in the Electron framework, plus the empty
// `<locale>.lproj` markers under Contents/Resources that tell macOS which
// languages the app offers (trimmed to the same list, so macOS picks among
// these and an unlisted language gets English).
// Windows / Linux: `locales/<locale>.pak` beside the executable. Chromium falls
// back to en-US when the system language has no pack.
//
// Runs from Forge's postPackage hook (on macOS before the bundle is re-signed),
// long before electron-builder wraps the prepackaged app (its
// `electronLanguages` option does not run on that path).
//
//   node scripts/chromium-locales.mjs trim --platform darwin --output out/AutoSlides-darwin-arm64
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** macOS `.lproj` names kept. */
export const KEPT_MAC_LOCALES = ['en', 'en_GB', 'zh_CN', 'zh_TW', 'ja', 'ko'];
/** Windows / Linux `.pak` names kept (Chromium's hyphenated spelling; English is en-US). */
export const KEPT_PAK_LOCALES = ['en-US', 'en-GB', 'zh-CN', 'zh-TW', 'ja', 'ko'];
// macOS ships grammatical-gender variants beside each base pack.
const GENDER_SUFFIXES = ['', '_FEMININE', '_MASCULINE', '_NEUTER'];

const LPROJ = '.lproj';
const PAK = '.pak';

/** Whether `<name>.lproj` stays. Directories that are not Chromium locales (e.g. `Base`) stay too. */
export function isKeptLocale(name) {
  if (!/^[a-z]{2,3}(_[A-Z0-9]+)*$/.test(name)) return true;
  return KEPT_MAC_LOCALES.some(base => GENDER_SUFFIXES.some(suffix => name === base + suffix));
}

function sizeOf(full) {
  const stat = fs.statSync(full);
  if (!stat.isDirectory()) return stat.size;
  return fs.readdirSync(full).reduce((sum, file) => sum + sizeOf(path.join(full, file)), 0);
}

// A renamed or missing pack would fall back silently at runtime; stop the package instead.
function requireAll(dir, files) {
  const missing = files.filter(file => !fs.existsSync(path.join(dir, file)));
  if (missing.length) throw new Error(`chromium-locales: ${dir} has no ${missing.join(', ')}`);
}

function trimDir(dir, ext, isKept, required) {
  if (!fs.existsSync(dir)) throw new Error(`chromium-locales: ${dir} is missing`);
  requireAll(dir, required);
  const removed = [];
  let bytes = 0;
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith(ext)) continue;
    const name = entry.slice(0, -ext.length);
    if (isKept(name)) continue;
    const full = path.join(dir, entry);
    bytes += sizeOf(full);
    fs.rmSync(full, { recursive: true, force: true });
    removed.push(name);
  }
  return { removed, bytes };
}

/** Trims both locale directories of a macOS `.app`. */
export function trimMacLocales(appPath) {
  const framework = path.join(appPath, 'Contents/Frameworks/Electron Framework.framework/Versions/A/Resources');
  const app = path.join(appPath, 'Contents/Resources');
  const packs = trimDir(framework, LPROJ, isKeptLocale,
    KEPT_MAC_LOCALES.map(locale => path.join(locale + LPROJ, 'locale.pak')));
  const markers = trimDir(app, LPROJ, isKeptLocale, KEPT_MAC_LOCALES.map(locale => locale + LPROJ));
  return { packs, markers };
}

/** Trims `locales/*.pak` of a packaged Windows or Linux app folder. */
export function trimPakLocales(outputPath) {
  const packs = trimDir(path.join(outputPath, 'locales'), PAK, name => KEPT_PAK_LOCALES.includes(name),
    KEPT_PAK_LOCALES.map(locale => locale + PAK));
  return { packs };
}

/** Trims the packaged output folder Forge produced for `platform`. */
export function trimLocales(platform, outputPath) {
  if (platform === 'darwin') return trimMacLocales(path.join(outputPath, 'AutoSlides.app'));
  if (platform === 'win32' || platform === 'linux') return trimPakLocales(outputPath);
  throw new Error(`chromium-locales: unsupported platform ${platform}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, ...rest] = process.argv.slice(2);
  const flag = name => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
  const platform = flag('--platform');
  const output = flag('--output');
  if (command !== 'trim' || !platform || !output) {
    process.stderr.write('usage: chromium-locales.mjs trim --platform <darwin|win32|linux> --output <packaged folder>\n');
    process.exit(2);
  }
  const { packs, markers } = trimLocales(platform, path.resolve(output));
  const kept = platform === 'darwin' ? KEPT_MAC_LOCALES : KEPT_PAK_LOCALES;
  process.stdout.write(
    `chromium-locales: kept ${kept.join(', ')}; removed ${packs.removed.length} packs ` +
    `(${(packs.bytes / 1024 / 1024).toFixed(2)} MiB)` +
    (markers ? ` and ${markers.removed.length} app localizations` : '') + '\n',
  );
}
