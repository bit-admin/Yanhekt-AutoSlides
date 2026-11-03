// Sparkle 2 for macOS in-place updates (src/main/download/macSparkleUpdater.ts).
//
//   node scripts/sparkle.mjs prepare           pinned Sparkle into vendor/sparkle
//   node scripts/sparkle.mjs build             compile the bridge to vendor/sparkle/sparkle_bridge.node
//   node scripts/sparkle.mjs public-key        print SUPublicEDKey (base64)
//   node scripts/sparkle.mjs appcast --dmg <new.dmg> --out <dir> [--previous <dir>]
//
// `prepare` and `build` run from Forge's generateAssets hook for darwin.
// `appcast` runs in release.yml: it writes <out>/appcast.xml for the new DMG,
// plus one .delta per earlier Sparkle-enabled DMG found in --previous. Every
// archive is signed with the update signing key (the same ed25519 key as the
// .sig files: AUTOSLIDES_UPDATE_SIGNING_KEY, --key <path>, or
// ~/.config/autoslides/update-signing-key.pem).
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SPARKLE = {
  version: '2.10.1',
  url: 'https://github.com/sparkle-project/Sparkle/releases/download/2.10.1/Sparkle-2.10.1.tar.xz',
  sha256: '1a856d2a9edb8e628de88121d7be04cf0e2167f8641650b78fca00b14244cf27',
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const vendorDir = path.join(root, 'vendor/sparkle');
export const frameworkPath = path.join(vendorDir, 'Sparkle.framework');
export const bridgePath = path.join(vendorDir, 'sparkle_bridge.node');
const bridgeSource = path.join(root, 'native/sparkle-bridge/sparkle_bridge.mm');
const cacheDir = path.join(root, '.cache/sparkle');
const stampPath = path.join(vendorDir, '.sparkle-sha256');
const keysFile = path.join(root, 'src/main/download/updateSigningKeys.json');
const defaultKeyPath = path.join(os.homedir(), '.config', 'autoslides', 'update-signing-key.pem');

async function sha256Of(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function downloadPinned() {
  const archive = path.join(cacheDir, `Sparkle-${SPARKLE.version}.tar.xz`);
  if (fs.existsSync(archive) && await sha256Of(archive) === SPARKLE.sha256) return archive;
  fs.mkdirSync(cacheDir, { recursive: true });
  const response = await fetch(SPARKLE.url, { signal: globalThis.AbortSignal.timeout(600000) });
  if (!response.ok) throw new Error(`Sparkle download failed: HTTP ${response.status}`);
  const temp = archive + '.part';
  fs.writeFileSync(temp, Buffer.from(await response.arrayBuffer()));
  if (await sha256Of(temp) !== SPARKLE.sha256) {
    fs.rmSync(temp, { force: true });
    throw new Error(`SHA-256 mismatch: ${SPARKLE.url}`);
  }
  fs.renameSync(temp, archive);
  return archive;
}

export async function prepare() {
  if (fs.existsSync(stampPath) && fs.readFileSync(stampPath, 'utf8').trim() === SPARKLE.sha256
      && fs.existsSync(frameworkPath)) {
    process.stdout.write(`Sparkle ${SPARKLE.version} already in vendor/sparkle\n`);
    return;
  }
  const archive = await downloadPinned();
  const staging = fs.mkdtempSync(path.join(cacheDir, '.extract-'));
  try {
    // bsdtar keeps the framework's symlinks (Versions/Current and friends).
    execFileSync('tar', ['-xf', archive, '-C', staging, 'Sparkle.framework', 'bin'], { stdio: 'inherit' });
    fs.rmSync(vendorDir, { recursive: true, force: true });
    fs.mkdirSync(vendorDir, { recursive: true });
    fs.renameSync(path.join(staging, 'Sparkle.framework'), frameworkPath);
    fs.renameSync(path.join(staging, 'bin'), path.join(vendorDir, 'bin'));
    fs.writeFileSync(stampPath, SPARKLE.sha256 + '\n');
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  process.stdout.write(`Prepared Sparkle ${SPARKLE.version} in vendor/sparkle\n`);
}

function nodeIncludeDir() {
  const candidates = [
    process.env.NODE_INCLUDE_DIR,
    path.join(path.dirname(process.execPath), '..', 'include', 'node'),
  ].filter(Boolean);
  const found = candidates.find((dir) => fs.existsSync(path.join(dir, 'node_api.h')));
  if (!found) throw new Error(`node_api.h not found (looked in ${candidates.join(', ')}); set NODE_INCLUDE_DIR`);
  return found;
}

/** Compiles the bridge for arm64. N-API is ABI-stable, so Node's headers serve Electron. */
export function build({ arch = 'arm64' } = {}) {
  if (!fs.existsSync(frameworkPath)) throw new Error('Run `node scripts/sparkle.mjs prepare` first');
  execFileSync('xcrun', [
    'clang++', '-x', 'objective-c++', '-std=c++17', '-fobjc-arc', '-O2',
    '-arch', arch, '-mmacosx-version-min=12.0',
    '-bundle', '-undefined', 'dynamic_lookup',
    '-I', nodeIncludeDir(),
    '-F', vendorDir,
    '-framework', 'Sparkle', '-framework', 'AppKit', '-framework', 'Foundation',
    // The .node sits in Contents/Resources; Sparkle in Contents/Frameworks.
    '-Wl,-rpath,@executable_path/../Frameworks',
    '-Wl,-rpath,@loader_path/../Frameworks',
    '-o', bridgePath,
    bridgeSource,
  ], { stdio: 'inherit' });
  process.stdout.write(`Built ${path.relative(root, bridgePath)}\n`);
}

/** SUPublicEDKey: the raw 32-byte ed25519 public key of the first update signing key. */
export function publicEdKey() {
  const { keys } = JSON.parse(fs.readFileSync(keysFile, 'utf8'));
  const der = crypto.createPublicKey(keys[0].publicKey).export({ format: 'der', type: 'spki' });
  return der.subarray(-32).toString('base64');
}

function loadPrivateKey(args) {
  const fromEnv = process.env.AUTOSLIDES_UPDATE_SIGNING_KEY;
  if (fromEnv && fromEnv.trim()) return crypto.createPrivateKey(fromEnv);
  const keyPath = flagValue(args, '--key') ?? defaultKeyPath;
  if (!fs.existsSync(keyPath)) throw new Error(`No update signing key at ${keyPath}`);
  return crypto.createPrivateKey(fs.readFileSync(keyPath));
}

/** Sparkle's key file format: the base64 32-byte ed25519 seed. */
export function sparkleSeedOf(privateKey) {
  const der = privateKey.export({ format: 'der', type: 'pkcs8' });
  return der.subarray(-32).toString('base64');
}

function flagValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function shortVersionOfDmg(name) {
  return name.match(/^AutoSlides-(\d+\.\d+\.\d+)-macOS-arm64\.dmg$/)?.[1] ?? null;
}

/** True when the DMG's app ships Sparkle (only those can apply a delta). */
function dmgHasSparkle(dmg) {
  const mount = fs.mkdtempSync(path.join(os.tmpdir(), 'autoslides-dmg-'));
  try {
    execFileSync('hdiutil', ['attach', '-nobrowse', '-readonly', '-noverify', '-mountpoint', mount, dmg], { stdio: 'ignore' });
    try {
      return fs.existsSync(path.join(mount, 'AutoSlides.app/Contents/Frameworks/Sparkle.framework'));
    } finally {
      execFileSync('hdiutil', ['detach', mount, '-force'], { stdio: 'ignore' });
    }
  } finally {
    fs.rmSync(mount, { recursive: true, force: true });
  }
}

/**
 * Writes appcast.xml (and .delta files) for one release into `out`.
 * The feed lists only the new version and names files without a URL, so
 * Sparkle resolves them against the feed's own folder: GitHub or the proxy.
 */
export function appcast(args) {
  const dmg = flagValue(args, '--dmg');
  const out = flagValue(args, '--out');
  const previous = flagValue(args, '--previous');
  if (!dmg || !out) throw new Error('appcast needs --dmg <file> and --out <dir>');
  const version = shortVersionOfDmg(path.basename(dmg));
  if (!version) throw new Error(`Not a release DMG name: ${path.basename(dmg)}`);

  // generate_appcast reads every archive in one folder and writes deltas there.
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'autoslides-appcast-'));
  try {
    fs.copyFileSync(dmg, path.join(work, path.basename(dmg)));
    for (const name of previous && fs.existsSync(previous) ? fs.readdirSync(previous) : []) {
      const oldVersion = shortVersionOfDmg(name);
      if (!oldVersion || oldVersion === version) continue;
      const file = path.join(previous, name);
      if (!dmgHasSparkle(file)) {
        process.stdout.write(`No delta from ${oldVersion}: that release has no Sparkle\n`);
        continue;
      }
      fs.copyFileSync(file, path.join(work, name));
    }
    const seed = sparkleSeedOf(loadPrivateKey(args));
    execFileSync(path.join(vendorDir, 'bin/generate_appcast'), [
      '--ed-key-file', '-',
      '--maximum-deltas', '5',
      '-o', path.join(work, 'appcast.xml'),
      work,
    ], { input: seed + '\n', stdio: ['pipe', 'inherit', 'inherit'] });

    const xml = fs.readFileSync(path.join(work, 'appcast.xml'), 'utf8');
    const feed = singleItemFeed(xml, version);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'appcast.xml'), feed);
    for (const name of fs.readdirSync(work).filter((n) => n.endsWith('.delta'))) {
      if (!feed.includes(`"${name}"`)) continue;
      fs.copyFileSync(path.join(work, name), path.join(out, name));
    }
    process.stdout.write(`Wrote ${path.join(out, 'appcast.xml')}\n`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

/**
 * Keeps the one <item> for `version` and strips any URL down to the file
 * name, so the feed works from whichever folder serves it.
 */
export function singleItemFeed(xml, version) {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const item = items.find((text) => text.includes(`<sparkle:shortVersionString>${version}</sparkle:shortVersionString>`));
  if (!item) throw new Error(`generate_appcast wrote no item for ${version}`);
  const relative = item.replace(/url="[^"]*\/([^"/]+)"/g, 'url="$1"');
  const head = xml.slice(0, xml.indexOf('<item>'));
  const tail = xml.slice(xml.lastIndexOf('</item>') + '</item>'.length);
  return head + relative + tail;
}

async function main(args) {
  const [command] = args;
  if (command === 'prepare') return prepare();
  if (command === 'build') return build({ arch: flagValue(args, '--arch') ?? 'arm64' });
  if (command === 'public-key') return void process.stdout.write(publicEdKey() + '\n');
  if (command === 'appcast') return appcast(args);
  throw new Error('Usage: sparkle.mjs prepare | build [--arch arm64] | public-key | appcast --dmg <file> --out <dir> [--previous <dir>]');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
