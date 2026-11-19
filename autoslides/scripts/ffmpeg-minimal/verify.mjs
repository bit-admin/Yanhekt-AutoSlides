// Checks a minimal FFmpeg against the app's contract (`requirements` in
// ../media-tools.mjs): version, GPL/no-nonfree, components, and on macOS
// system-only dylibs. Runs without node_modules.
//   node scripts/ffmpeg-minimal/verify.mjs <ffmpeg>
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assertCapabilities, assertVersion, requirements } from '../media-tools.mjs';

const file = path.resolve(process.argv[2] ?? '');
const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../media-tools/manifest.json', import.meta.url)), 'utf8'));
const run = (args) => execFileSync(file, args, { encoding: 'utf8', timeout: 15000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });

const version = run(['-version']);
assertVersion(version, 'ffmpeg', { version: manifest.version });
if (!version.includes('autoslides-minimal')) throw new Error('Not the AutoSlides minimal build');
assertCapabilities(Object.fromEntries(Object.keys(requirements).map((kind) => [kind, run(['-hide_banner', `-${kind}`])])));
if (process.platform === 'darwin') {
  const libraries = execFileSync('otool', ['-L', file], { encoding: 'utf8' }).split('\n').slice(1).map((line) => line.trim().split(' ')[0]).filter(Boolean);
  const foreign = libraries.filter((lib) => !lib.startsWith('/usr/lib/') && !lib.startsWith('/System/Library/'));
  if (foreign.length) throw new Error(`Non-system dylibs: ${foreign.join(', ')}`);
}
process.stdout.write(`${version.split(/\r?\n/, 1)[0]}: requirements met\n`);
