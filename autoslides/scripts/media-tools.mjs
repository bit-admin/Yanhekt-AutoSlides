// Pinned build-time media tools. Forge calls prepare for both start and package;
// no downloads or system-tool discovery happen inside the running app.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';
import extractZip from 'extract-zip';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'scripts/media-tools/manifest.json');
const noticesPath = path.join(root, 'resources/media-tools');
const FORMAT = 'autoslides-media-tools/v1';
export const requirements = {
  encoders: ['libsvtav1', 'libx265', 'libopus', 'aac', 'mjpeg', 'pcm_s16le'],
  filters: ['crop', 'cropdetect', 'fps', 'scale', 'hqdn3d', 'unsharp', 'highpass', 'afftdn', 'speechnorm', 'loudnorm'],
  demuxers: ['hls', 'concat', 'mpegts', 'mov'],
  muxers: ['mp4', 'image2pipe'],
  bsfs: ['aac_adtstoasc'],
  protocols: ['file', 'http', 'https', 'pipe'],
};

export async function hashFile(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export function getTarget(manifest, platform, arch) {
  const key = `${platform}-${arch}`;
  const target = manifest.targets[key];
  if (!target) throw new Error(`Unsupported media-tools target: ${key}. Supported: ${Object.keys(manifest.targets).join(', ')}`);
  return { key, ...target };
}

export function bundlePath(platform, arch) {
  return path.join(root, 'vendor/media-tools', `${platform}-${arch}`, 'media-tools');
}

export function assertArchitecture(header, platform, arch) {
  let matches = false;
  if (platform === 'darwin' && arch === 'arm64') {
    matches = header.length >= 8 && header.readUInt32LE(0) === 0xfeedfacf && header.readUInt32LE(4) === 0x0100000c;
  } else if (platform === 'linux' && arch === 'x64') {
    matches = header.length >= 20 && header.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) &&
      header[4] === 2 && header[5] === 1 && header.readUInt16LE(18) === 62;
  } else if (platform === 'win32' && arch === 'x64' && header.length >= 64 && header.toString('ascii', 0, 2) === 'MZ') {
    const offset = header.readUInt32LE(60);
    matches = offset <= header.length - 6 && header.readUInt32LE(offset) === 0x00004550 && header.readUInt16LE(offset + 4) === 0x8664;
  }
  if (!matches) throw new Error(`Executable architecture does not match ${platform}-${arch}`);
}

export function assertVersion(output, tool, target) {
  const banner = output.split(/\r?\n/, 1)[0];
  const version = banner.match(new RegExp(`^${tool} version n?([^ ]+)`))?.[1];
  if (!version || (version !== target.version && !version.startsWith(`${target.version}-`))) {
    throw new Error(`Expected ${tool} ${target.version}, got: ${banner}`);
  }
  if (target.revision && !version.includes(target.revision)) throw new Error(`Unexpected ${tool} revision: ${version}`);
  if (output.includes('--enable-nonfree')) throw new Error('Non-redistributable FFmpeg build rejected');
  if (!output.includes('--enable-gpl')) throw new Error('Expected the GPL build (libx265 is required)');
}

export function assertCapabilities(outputs) {
  for (const [kind, names] of Object.entries(requirements)) {
    const available = new Set(outputs[kind].split(/\r?\n/).flatMap(line => {
      const match = kind === 'bsfs' || kind === 'protocols'
        ? line.match(/^\s*([a-zA-Z0-9_]+)\s*$/)
        : line.match(/^\s*[A-Z.]{1,6}\s+([a-zA-Z0-9_,]+)\s/);
      return match ? match[1].split(',') : [];
    }));
    for (const name of names) {
      if (!available.has(name)) throw new Error(`FFmpeg is missing required ${kind}: ${name}`);
    }
  }
}

function readHeader(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const header = Buffer.alloc(4096);
    return header.subarray(0, fs.readSync(fd, header));
  } finally {
    fs.closeSync(fd);
  }
}

// No input media and no encoding: these checks only enumerate compiled features.
export function verifyBundle(directory, platform, arch, target) {
  const native = platform === process.platform && arch === process.arch;
  const suffix = platform === 'win32' ? '.exe' : '';
  const versions = {};
  for (const tool of ['ffmpeg', 'ffprobe']) {
    const file = path.join(directory, `${tool}${suffix}`);
    if (!fs.lstatSync(file).isFile()) throw new Error(`Not a regular executable: ${file}`);
    assertArchitecture(readHeader(file), platform, arch);
    if (platform !== 'win32' && (fs.statSync(file).mode & 0o111) === 0) throw new Error(`Missing executable permission: ${file}`);
    if (native) {
      const output = execFileSync(file, ['-version'], { encoding: 'utf8', timeout: 15000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
      assertVersion(output, tool, target);
      versions[tool] = output;
    }
  }
  if (native) {
    const outputs = Object.fromEntries(Object.keys(requirements).map(kind => [kind,
      execFileSync(path.join(directory, `ffmpeg${suffix}`), ['-hide_banner', `-${kind}`], {
        encoding: 'utf8', timeout: 15000, maxBuffer: 4 * 1024 * 1024, windowsHide: true,
      }),
    ]));
    assertCapabilities(outputs);
    if (platform === 'darwin') {
      for (const tool of ['ffmpeg', 'ffprobe']) {
        const libraries = execFileSync('otool', ['-L', path.join(directory, tool)], { encoding: 'utf8' });
        const dependencies = libraries.split('\n').slice(1).map(line => line.trim().split(' ')[0]).filter(Boolean);
        if (dependencies.some(file => !file.startsWith('/usr/lib/') && !file.startsWith('/System/Library/'))) {
          throw new Error(`Non-system dylib dependency in bundled ${tool}: ${libraries}`);
        }
      }
    }
  }
  return { native, versions };
}

function safeMember(member) {
  if (!member || member.includes('\\') || member.includes(':') || member.startsWith('/') || member.split('/').some(part => part === '..' || part === '.')) {
    throw new Error(`Unsafe archive member: ${member}`);
  }
}

export async function download(artifact, cache) {
  const filename = path.basename(new URL(artifact.url).pathname);
  const directory = path.join(cache, artifact.sha256);
  const file = path.join(directory, filename);
  if (fs.existsSync(file)) {
    if (await hashFile(file) !== artifact.sha256) throw new Error(`Corrupt cached media artifact: ${file}. Remove it and retry.`);
    return file;
  }
  fs.mkdirSync(cache, { recursive: true });
  for (let attempt = 1; attempt <= 3; attempt++) {
    // Every downloaded archive gets its own empty directory, separate from scripts.
    const temp = fs.mkdtempSync(path.join(cache, '.download-'));
    try {
      const destination = path.join(temp, filename);
      const url = new URL(artifact.url);
      if (url.protocol !== 'https:' || !/^[a-f0-9]{64}$/.test(artifact.sha256)) throw new Error('Invalid media artifact pin');
      process.stdout.write(`Downloading ${filename} (attempt ${attempt}/3)\n`);
      const response = await fetch(url, { signal: globalThis.AbortSignal.timeout(600000) });
      if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}): ${url}`);
      await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(destination, { flags: 'wx' }));
      if (await hashFile(destination) !== artifact.sha256) throw new Error(`SHA-256 mismatch: ${url}`);
      fs.mkdirSync(directory, { recursive: true });
      fs.renameSync(destination, file);
      return file;
    } catch (error) {
      if (attempt === 3) throw error;
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }
}

export async function extractFiles(archive, artifact, destination) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'autoslides-media-extract-'));
  try {
    const zip = artifact.url.endsWith('.zip');
    if (zip) await extractZip(archive, { dir: temp });
    for (const [member, output] of Object.entries(artifact.files)) {
      safeMember(member);
      safeMember(output);
      const file = path.join(destination, output);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (zip) {
        const source = path.join(temp, member);
        if (!fs.lstatSync(source).isFile()) throw new Error(`Not a regular archive member: ${member}`);
        fs.copyFileSync(source, file);
      } else {
        // Stream only the named member to a file we chose. tar never writes
        // archive paths or links to disk, including for the .tar.xz Linux build.
        const child = spawn('tar', ['-xOf', archive, member], { stdio: ['ignore', 'pipe', 'pipe'], cwd: root });
        let stderr = '';
        child.stderr.setEncoding('utf8').on('data', text => { stderr = (stderr + text).slice(-4096); });
        const exited = new Promise((resolve, reject) => {
          child.once('error', reject);
          child.once('close', code => code === 0 ? resolve() : reject(new Error(`tar failed (${code}): ${stderr}`)));
        });
        await Promise.all([pipeline(child.stdout, fs.createWriteStream(file, { flags: 'wx' })), exited]);
      }
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

async function fileHashes(directory) {
  const hashes = {};
  async function walk(relative) {
    for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })) {
      const name = path.posix.join(relative, entry.name);
      if (name === 'build-info.json') continue;
      if (entry.isDirectory()) await walk(name);
      else if (entry.isFile()) hashes[name] = await hashFile(path.join(directory, name));
      else throw new Error(`Unexpected link in media bundle: ${name}`);
    }
  }
  await walk('');
  return hashes;
}

async function bundleFingerprint(manifest) {
  return crypto.createHash('sha256').update(JSON.stringify({ manifest, notices: await fileHashes(noticesPath) })).digest('hex');
}

export async function prepare(platform, arch) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const target = getTarget(manifest, platform, arch);
  const fingerprint = await bundleFingerprint(manifest);
  const destination = bundlePath(platform, arch);
  const infoFile = path.join(destination, 'build-info.json');
  if (fs.existsSync(infoFile)) {
    const info = JSON.parse(fs.readFileSync(infoFile, 'utf8'));
    const actual = await fileHashes(destination);
    const filesMatch = JSON.stringify(actual) === JSON.stringify(info.files);
    if (info.format === FORMAT && info.fingerprint === fingerprint && filesMatch) {
      verifyBundle(destination, platform, arch, target);
      process.stdout.write(`Verified cached media tools: ${target.key} (${target.version})\n`);
      return destination;
    }
  }
  const parent = path.dirname(destination);
  fs.mkdirSync(parent, { recursive: true });
  const temp = fs.mkdtempSync(path.join(parent, '.prepare-'));
  const staged = path.join(temp, 'media-tools');
  try {
    fs.mkdirSync(staged);
    fs.cpSync(noticesPath, path.join(staged, 'licenses'), { recursive: true });
    for (const artifact of target.artifacts) {
      const archive = await download(artifact, path.join(root, '.cache/media-tools'));
      await extractFiles(archive, artifact, staged);
    }
    if (platform !== 'win32') {
      for (const tool of ['ffmpeg', 'ffprobe']) fs.chmodSync(path.join(staged, tool), 0o755);
    }
    const { native, versions } = verifyBundle(staged, platform, arch, target);
    const info = {
      format: FORMAT, fingerprint, target: target.key, version: target.version,
      provider: target.provider, build: target.build, source: target.source,
      metadata: target.metadata, artifacts: target.artifacts, versions,
      files: await fileHashes(staged),
    };
    fs.writeFileSync(path.join(staged, 'build-info.json'), JSON.stringify(info, null, 2) + '\n');
    // Leave the previous bundle intact until the replacement has passed checks.
    const previous = path.join(temp, 'previous');
    if (fs.existsSync(destination)) fs.renameSync(destination, previous);
    try {
      fs.renameSync(staged, destination);
    } catch (error) {
      if (fs.existsSync(previous)) fs.renameSync(previous, destination);
      throw error;
    }
    process.stdout.write(`Prepared ${target.key}: FFmpeg/FFprobe ${target.version}${native ? ', capabilities verified' : ', cross-target architecture verified (native capabilities checked on target runner)'}\n`);
    return destination;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

async function main(args) {
  const [command, ...options] = args;
  const values = {};
  for (let i = 0; i < options.length; i += 2) {
    if (!['--platform', '--arch', '--directory'].includes(options[i]) || !options[i + 1] || options[i + 1].startsWith('--')) throw new Error(`Invalid option: ${options[i]}`);
    values[options[i]] = options[i + 1];
  }
  const platform = values['--platform'] ?? process.platform;
  const arch = values['--arch'] ?? process.arch;
  if (command === 'prepare') await prepare(platform, arch);
  else if (command === 'verify') {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const target = getTarget(manifest, platform, arch);
    const directory = values['--directory'] ? path.resolve(values['--directory']) : bundlePath(platform, arch);
    const info = JSON.parse(fs.readFileSync(path.join(directory, 'build-info.json'), 'utf8'));
    if (info.format !== FORMAT || info.target !== target.key || info.fingerprint !== await bundleFingerprint(manifest)) throw new Error('Bundle metadata does not match the pinned media tools');
    // The packaged copy must be the prepared bytes, not just carry its metadata.
    if (JSON.stringify(await fileHashes(directory)) !== JSON.stringify(info.files)) throw new Error(`Bundle files do not match build-info.json: ${directory}`);
    const { native } = verifyBundle(directory, platform, arch, target);
    process.stdout.write(`Verified ${directory}${native ? ' (version, architecture, codecs, filters and protocols)' : ' (architecture only; execute verification on the target runner)'}\n`);
  } else throw new Error('Usage: media-tools.mjs prepare|verify [--platform <os>] [--arch <cpu>] [--directory <bundle>]');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`Media tools: ${error.message}\n`);
    process.exitCode = 1;
  });
}
