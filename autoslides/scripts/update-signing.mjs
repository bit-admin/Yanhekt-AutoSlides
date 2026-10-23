// Signs release installers so the app can check an update before opening it.
//
//   node scripts/update-signing.mjs keygen [--out <path>]
//   node scripts/update-signing.mjs sign <file>...
//   node scripts/update-signing.mjs verify <file>...
//
// `sign` writes `<file>.sig` next to each file. Upload it to the release with
// the file. The private key comes from the AUTOSLIDES_UPDATE_SIGNING_KEY
// environment variable (PEM text; the GitHub Actions secret of that name), or
// else from --key <path>, or else from ~/.config/autoslides/update-signing-key.pem.
// Signing refuses a key whose public half is not in the app's key list
// (src/main/download/updateSigningKeys.json), so a release can never be signed
// with a key the app would reject.
//
// The format must match src/main/download/updateSignature.ts, which verifies
// it; updateSignature.test.ts signs with this file and verifies with that one.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SIGNATURE_FORMAT = 'autoslides-update-signature/v1';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const keysFile = path.join(root, 'src/main/download/updateSigningKeys.json');
const defaultKeyPath = path.join(os.homedir(), '.config', 'autoslides', 'update-signing-key.pem');

/** The bytes the signature covers. The verifier rebuilds them from the file it downloaded. */
export function signedMessage(filename, size, sha256) {
  return Buffer.from(`${SIGNATURE_FORMAT}\n${filename}\n${size}\n${sha256}\n`, 'utf8');
}

/** First 16 hex digits of the SHA-256 of the public key's SPKI DER. */
export function keyIdOf(publicKey) {
  const der = publicKey.export({ format: 'der', type: 'spki' });
  return crypto.createHash('sha256').update(der).digest('hex').slice(0, 16);
}

export async function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  let size = 0;
  for await (const chunk of fs.createReadStream(filePath)) {
    hash.update(chunk);
    size += chunk.length;
  }
  return { sha256: hash.digest('hex'), size };
}

/** Returns the `.sig` file's JSON text for `filePath`. */
export async function signFile(filePath, privateKey) {
  const filename = path.basename(filePath);
  const { sha256, size } = await hashFile(filePath);
  const signature = crypto.sign(null, signedMessage(filename, size, sha256), privateKey);
  const publicKey = crypto.createPublicKey(privateKey);
  return JSON.stringify({
    format: SIGNATURE_FORMAT,
    key: keyIdOf(publicKey),
    file: filename,
    size,
    sha256,
    signature: signature.toString('base64'),
  }, null, 2) + '\n';
}

function loadAppKeys() {
  const { keys } = JSON.parse(fs.readFileSync(keysFile, 'utf8'));
  return keys.map((k) => ({ id: k.id, key: crypto.createPublicKey(k.publicKey) }));
}

function loadPrivateKey(args) {
  const fromEnv = process.env.AUTOSLIDES_UPDATE_SIGNING_KEY;
  if (fromEnv && fromEnv.trim()) return crypto.createPrivateKey(fromEnv);
  const flag = args.indexOf('--key');
  const keyPath = flag >= 0 ? args[flag + 1] : defaultKeyPath;
  if (!keyPath || !fs.existsSync(keyPath)) {
    throw new Error(
      `No update signing key. Set AUTOSLIDES_UPDATE_SIGNING_KEY, pass --key <path>, or put the key at ${defaultKeyPath}.`
    );
  }
  return crypto.createPrivateKey(fs.readFileSync(keyPath, 'utf8'));
}

function fileArgs(args) {
  const files = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--key' || args[i] === '--out') { i++; continue; }
    files.push(args[i]);
  }
  return files;
}

function keygen(args) {
  const flag = args.indexOf('--out');
  const out = flag >= 0 ? args[flag + 1] : defaultKeyPath;
  if (fs.existsSync(out)) throw new Error(`${out} already exists; refusing to overwrite a signing key.`);
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.mkdirSync(path.dirname(out), { recursive: true, mode: 0o700 });
  fs.writeFileSync(out, privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600 });
  const entry = { id: keyIdOf(publicKey), publicKey: publicKey.export({ format: 'pem', type: 'spki' }) };
  process.stdout.write(`Private key written to ${out}\nAdd this entry to ${path.relative(process.cwd(), keysFile)}:\n`);
  process.stdout.write(JSON.stringify(entry, null, 2) + '\n');
}

async function sign(args) {
  const files = fileArgs(args);
  if (files.length === 0) throw new Error('sign: no files given');
  const privateKey = loadPrivateKey(args);
  const id = keyIdOf(crypto.createPublicKey(privateKey));
  if (!loadAppKeys().some((k) => k.id === id)) {
    throw new Error(`Signing key ${id} is not in ${keysFile}; the app would reject these signatures.`);
  }
  for (const file of files) {
    fs.writeFileSync(`${file}.sig`, await signFile(file, privateKey));
    process.stdout.write(`Signed ${path.basename(file)} (key ${id})\n`);
  }
}

async function verify(args) {
  const files = fileArgs(args);
  if (files.length === 0) throw new Error('verify: no files given');
  const keys = loadAppKeys();
  let failed = false;
  for (const file of files) {
    const sig = JSON.parse(fs.readFileSync(`${file}.sig`, 'utf8'));
    const { sha256, size } = await hashFile(file);
    const entry = keys.find((k) => k.id === sig.key);
    const ok = !!entry && crypto.verify(
      null,
      signedMessage(path.basename(file), size, sha256),
      entry.key,
      Buffer.from(sig.signature, 'base64')
    );
    process.stdout.write(`${ok ? 'OK  ' : 'FAIL'} ${path.basename(file)}\n`);
    if (!ok) failed = true;
  }
  if (failed) process.exitCode = 1;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const [command, ...args] = process.argv.slice(2);
  const run = { keygen, sign, verify }[command];
  if (!run) {
    process.stderr.write('Usage: update-signing.mjs keygen [--out <path>] | sign <file>... | verify <file>...\n');
    process.exit(2);
  }
  Promise.resolve(run(args)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
