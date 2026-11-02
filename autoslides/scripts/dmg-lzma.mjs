// Recompresses the DMGs electron-builder wrote to out/make as LZMA (ULMO,
// macOS 10.15+). electron-builder's dmg.format stops at ULFO, so
// electron-builder.yml asks for an uncompressed UDRO image and this converts
// it. The .blockmap and latest-mac.yml describe the old bytes and nothing
// reads them for macOS, so they are removed.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2] ?? 'out/make');
const dmgs = fs.readdirSync(dir).filter(name => name.endsWith('.dmg'));
if (dmgs.length === 0) {
  process.stderr.write(`dmg-lzma: no .dmg in ${dir}\n`);
  process.exit(1);
}
fs.rmSync(path.join(dir, 'latest-mac.yml'), { force: true });
for (const name of dmgs) {
  const file = path.join(dir, name);
  const tmp = path.join(dir, `${name}.ulmo.dmg`);
  fs.rmSync(tmp, { force: true });
  execFileSync('hdiutil', ['convert', file, '-format', 'ULMO', '-o', tmp], { stdio: 'inherit' });
  fs.renameSync(tmp, file);
  fs.rmSync(`${file}.blockmap`, { force: true });
  process.stdout.write(`dmg-lzma: ${name} ${(fs.statSync(file).size / 1e6).toFixed(1)} MB\n`);
}
fs.rmSync(path.join(dir, 'latest-mac.yml'), { force: true });
