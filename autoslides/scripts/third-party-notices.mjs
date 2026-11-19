#!/usr/bin/env node
// Writes THIRD-PARTY-NOTICES.txt for a packaged build: every package the app
// ships from npm (the production dependency tree; Vite bundles them into
// app.asar and strips their licence comments, and sharp/@img are copied as
// they are), with its licence text, plus the native pieces that are not npm
// packages (libvips, Sparkle on macOS). Electron/Chromium, FFmpeg and the
// models carry their own files; this one points to them.
//
//   node scripts/third-party-notices.mjs --out <file> [--platform darwin|win32|linux]
//
// Run by forge.config.ts generateAssets; the file lands in the app's resources.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LICENCE_FILE = /^(licen[cs]e|copying|notice)([-_.].*)?$/i;

/** The installed package `name` as Node would resolve it from `fromDir`. */
function findPackage(name, fromDir) {
  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name, 'package.json');
    if (fs.existsSync(candidate)) return path.dirname(candidate);
    if (dir === root || path.dirname(dir) === dir) return null;
  }
}

/** Production packages reachable from the app's `dependencies`, each once (name@version). */
export function collectPackages(appDir = root) {
  const app = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
  const found = new Map();
  const queue = Object.keys(app.dependencies ?? {})
    .filter((name) => !name.startsWith('@types/'))
    .map((name) => [name, appDir]);
  while (queue.length) {
    const [name, from] = queue.shift();
    const dir = findPackage(name, from);
    // An optional dependency for another platform is simply not installed.
    if (!dir) continue;
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const key = `${pkg.name}@${pkg.version}`;
    if (found.has(key)) continue;
    found.set(key, { name: pkg.name, version: pkg.version, licence: licenceOf(pkg), dir, homepage: homepageOf(pkg), author: authorOf(pkg) });
    for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies })) {
      if (!dep.startsWith('@types/')) queue.push([dep, dir]);
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

function licenceOf(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license?.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type ?? l).join(' OR ');
  return 'UNKNOWN';
}

function homepageOf(pkg) {
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  return pkg.homepage || repo || '';
}

export function licenceTexts(dir) {
  return fs.readdirSync(dir)
    .filter((name) => LICENCE_FILE.test(name) && fs.statSync(path.join(dir, name)).isFile())
    .sort()
    .map((name) => ({ name, text: fs.readFileSync(path.join(dir, name), 'utf8').trim() }));
}

// For a package that declares one of these and ships no licence file.
const STANDARD_TEXTS = {
  MIT: (holder) => `Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
  ISC: (holder) => `Copyright (c) ${holder}

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`,
};

function authorOf(pkg) {
  const a = pkg.author;
  const name = typeof a === 'string' ? a.replace(/\s*[<(].*$/, '') : a?.name;
  return name?.trim() || `the ${pkg.name} authors`;
}

const RULE = '='.repeat(78);
const section = (title, body) => `${RULE}\n${title}\n${RULE}\n\n${body.trim()}\n\n`;

export function buildNotices({ platform = process.platform, appDir = root } = {}) {
  const packages = collectPackages(appDir);
  let out = `AutoSlides third-party notices
${'-'.repeat(30)}

AutoSlides is licensed under the Apache License 2.0. It includes the
third-party software listed below, each under its own licence. Also shipped
with the app, with their own files:

- Electron (MIT): LICENSE.electron.txt (macOS) or LICENSE (Windows, Linux),
  and Chromium's notices in LICENSES.chromium.html.
- FFmpeg (GPL-3.0-or-later): media-tools/licenses/.
- The slide detector and classifier models: models/licenses/NOTICE.txt.

`;
  out += `Packages from npm (${packages.length}):\n\n`;
  for (const p of packages) out += `  ${p.name} ${p.version}  ${p.licence}\n`;
  out += '\n';

  for (const p of packages) {
    const texts = licenceTexts(p.dir);
    const head = `${p.name} ${p.version}\nLicence: ${p.licence}${p.homepage ? `\n${p.homepage}` : ''}`;
    const body = texts.length
      ? texts.map((t) => (texts.length > 1 ? `--- ${t.name} ---\n${t.text}` : t.text)).join('\n\n')
      : STANDARD_TEXTS[p.licence]
        ? `The package ships no licence file; it declares ${p.licence}, whose text follows.\n\n${STANDARD_TEXTS[p.licence](p.author)}`
        : `This package ships no licence file. Its package.json declares: ${p.licence}.`;
    out += section(head, body);
  }

  // libvips: the @img/sharp-libvips-* package has no licence text of its own.
  const vips = packages.find((p) => p.name.startsWith('@img/sharp-libvips-'));
  if (vips) {
    const versionsFile = path.join(vips.dir, 'versions.json');
    const versions = fs.existsSync(versionsFile) ? JSON.parse(fs.readFileSync(versionsFile, 'utf8')) : {};
    const list = Object.entries(versions).map(([lib, v]) => `  ${lib} ${v}`).join('\n');
    out += section(`libvips ${versions.vips ?? ''} and the libraries built into it (${vips.name})`, `
libvips is licensed under the GNU Lesser General Public License, version 3
or later. It is shipped as a shared library (lib/libvips-cpp.*), which you
may replace with your own build. The libraries below are compiled into it,
each under its own licence (zlib, MIT, BSD, LGPL, the libpng and libjpeg
licences, and others); their full list and texts are in
https://github.com/lovell/sharp-libvips/blob/main/THIRD-PARTY-NOTICES.md

${list}

--- GNU Lesser General Public License, version 3 ---
${fs.readFileSync(path.join(root, 'scripts/notices/LGPL-3.0.txt'), 'utf8').trim()}

--- GNU General Public License, version 3 (which the LGPL builds on) ---
${fs.readFileSync(path.join(root, 'scripts/notices/GPL-3.0.txt'), 'utf8').trim()}
`);
  }

  if (platform === 'darwin') {
    const sparkle = path.join(root, 'vendor/sparkle/LICENSE');
    if (!fs.existsSync(sparkle)) throw new Error('vendor/sparkle/LICENSE is missing: run `node scripts/sparkle.mjs prepare`');
    out += section('Sparkle (macOS updates, Frameworks/Sparkle.framework)\nLicence: MIT, with the notices of the code it includes\nhttps://sparkle-project.org', fs.readFileSync(sparkle, 'utf8'));
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const arg = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const out = arg('--out');
  if (!out) {
    process.stderr.write('usage: third-party-notices.mjs --out <file> [--platform darwin|win32|linux]\n');
    process.exit(2);
  }
  const text = buildNotices({ platform: arg('--platform') ?? process.platform });
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, text);
  process.stdout.write(`Wrote ${out} (${Math.round(text.length / 1024)} KB)\n`);
}
