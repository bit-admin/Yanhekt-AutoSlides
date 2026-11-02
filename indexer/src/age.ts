/**
 * age v1 file encryption (https://age-encryption.org/v1) with X25519
 * recipients, from Node built-ins only. Files open with the stock tool:
 *   age -d -i <identity file> term-….json.gz.age | gunzip
 *
 * Used for what the index release shares (clientIndex.ts): every reader is a
 * recipient with its own key pair, and the publisher needs only their public
 * `age1…` recipients, never a secret. The desktop app is one recipient; it
 * reads with the `age-encryption` package instead, because Electron's crypto
 * has no ChaCha20-Poly1305.
 *
 * Only what the index needs: X25519 stanzas, no passphrase (scrypt) or SSH
 * recipients, no armor. Other stanzas are skipped when decrypting, as the
 * spec says.
 */

import {
  createCipheriv, createDecipheriv, createHmac, createPrivateKey, createPublicKey, diffieHellman,
  generateKeyPairSync, hkdfSync, randomBytes, timingSafeEqual,
} from 'node:crypto';
import type { KeyObject } from 'node:crypto';

const INTRO = 'age-encryption.org/v1';
const X25519_INFO = 'age-encryption.org/v1/X25519';
const CHUNK = 64 * 1024;
const TAG = 16;
const PKCS8_PREFIX = Buffer.from('302e020100300506032b656e04220420', 'hex');
const SPKI_PREFIX = Buffer.from('302a300506032b656e032100', 'hex');

// --- bech32 (BIP 173), without its 90-character limit, as age uses it ---

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GEN[i];
  }
  return chk >>> 0;
}

function hrpExpand(hrp: string): number[] {
  const out: number[] = [];
  for (const c of hrp) out.push(c.charCodeAt(0) >> 5);
  out.push(0);
  for (const c of hrp) out.push(c.charCodeAt(0) & 31);
  return out;
}

function convertBits(data: ArrayLike<number>, from: number, to: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  const max = (1 << to) - 1;
  for (let i = 0; i < data.length; i++) {
    acc = (acc << from) | data[i];
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((acc >> bits) & max);
    }
  }
  if (pad) {
    if (bits > 0) out.push((acc << (to - bits)) & max);
  } else if (bits >= from || ((acc << (to - bits)) & max) !== 0) {
    throw new Error('bech32: bad padding');
  }
  return out;
}

function bech32Encode(hrp: string, bytes: Buffer): string {
  const data = convertBits(bytes, 8, 5, true);
  const mod = polymod([...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]) ^ 1;
  const checksum = [0, 1, 2, 3, 4, 5].map((i) => (mod >>> (5 * (5 - i))) & 31);
  return `${hrp}1${[...data, ...checksum].map((d) => CHARSET[d]).join('')}`;
}

function bech32Decode(text: string, expectedHrp: string): Buffer {
  if (text !== text.toLowerCase() && text !== text.toUpperCase()) throw new Error('bech32: mixed case');
  const s = text.toLowerCase();
  const at = s.lastIndexOf('1');
  if (at < 1 || s.length - at < 7) throw new Error('bech32: malformed');
  const hrp = s.slice(0, at);
  if (hrp !== expectedHrp) throw new Error(`bech32: expected ${expectedHrp}, got ${hrp}`);
  const data = [...s.slice(at + 1)].map((c) => {
    const v = CHARSET.indexOf(c);
    if (v < 0) throw new Error('bech32: bad character');
    return v;
  });
  if (polymod([...hrpExpand(hrp), ...data]) !== 1) throw new Error('bech32: bad checksum');
  return Buffer.from(convertBits(data.slice(0, -6), 5, 8, false));
}

// --- keys ---

const privateKeyOf = (scalar: Buffer): KeyObject =>
  createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, scalar]), format: 'der', type: 'pkcs8' });
const publicKeyOf = (point: Buffer): KeyObject =>
  createPublicKey({ key: Buffer.concat([SPKI_PREFIX, point]), format: 'der', type: 'spki' });
const rawPublic = (key: KeyObject): Buffer => (key.export({ format: 'der', type: 'spki' }) as Buffer).subarray(SPKI_PREFIX.length);

function identityScalar(identity: string): Buffer {
  const scalar = bech32Decode(identity.trim(), 'age-secret-key-');
  if (scalar.length !== 32) throw new Error('age: bad identity');
  return scalar;
}

function recipientPoint(recipient: string): Buffer {
  if (recipient !== recipient.toLowerCase()) throw new Error('age: recipients are lower case');
  const point = bech32Decode(recipient.trim(), 'age');
  if (point.length !== 32) throw new Error('age: bad recipient');
  return point;
}

/** A new key pair: the identity (`AGE-SECRET-KEY-1…`, secret) and its recipient (`age1…`, public). */
export function generateIdentity(): { identity: string; recipient: string } {
  const { privateKey, publicKey } = generateKeyPairSync('x25519');
  const scalar = (privateKey.export({ format: 'der', type: 'pkcs8' }) as Buffer).subarray(PKCS8_PREFIX.length);
  return { identity: bech32Encode('age-secret-key-', scalar).toUpperCase(), recipient: bech32Encode('age', rawPublic(publicKey)) };
}

/** The public recipient of an identity. */
export function recipientOf(identity: string): string {
  return bech32Encode('age', rawPublic(createPublicKey(privateKeyOf(identityScalar(identity)))));
}

/** Throws unless `recipient` is a well-formed `age1…` X25519 recipient. */
export function checkRecipient(recipient: string): void {
  recipientPoint(recipient);
}

// --- primitives ---

const hkdf = (ikm: Buffer, salt: Buffer, info: string): Buffer => Buffer.from(hkdfSync('sha256', ikm, salt, info, 32));

function seal(key: Buffer, nonce: Buffer, plain: Buffer): Buffer {
  const c = createCipheriv('chacha20-poly1305', key, nonce, { authTagLength: TAG });
  return Buffer.concat([c.update(plain), c.final(), c.getAuthTag()]);
}

function open(key: Buffer, nonce: Buffer, sealed: Buffer): Buffer | null {
  if (sealed.length < TAG) return null;
  const d = createDecipheriv('chacha20-poly1305', key, nonce, { authTagLength: TAG });
  d.setAuthTag(sealed.subarray(sealed.length - TAG));
  try {
    return Buffer.concat([d.update(sealed.subarray(0, sealed.length - TAG)), d.final()]);
  } catch {
    return null;
  }
}

/** Unpadded standard base64, as age writes it. */
const b64 = (b: Buffer): string => b.toString('base64').replace(/=+$/, '');

function unb64(s: string): Buffer {
  if (!/^[A-Za-z0-9+/]*$/.test(s) || s.length % 4 === 1) throw new Error('age: bad base64');
  const b = Buffer.from(s, 'base64');
  if (b64(b) !== s) throw new Error('age: non-canonical base64');
  return b;
}

function streamNonce(counter: number, last: boolean): Buffer {
  const n = Buffer.alloc(12);
  n.writeUIntBE(counter, 5, 6);
  n[11] = last ? 1 : 0;
  return n;
}

function headerMac(fileKey: Buffer, header: string): Buffer {
  return createHmac('sha256', hkdf(fileKey, Buffer.alloc(0), 'header')).update(header, 'latin1').digest();
}

// --- files ---

/** Encrypt `plain` to every recipient (`age1…`). */
export function encrypt(plain: Buffer, recipients: string[]): Buffer {
  if (recipients.length === 0) throw new Error('age: no recipients');
  const fileKey = randomBytes(16);
  let header = `${INTRO}\n`;
  for (const r of recipients) {
    const point = recipientPoint(r);
    const eph = generateKeyPairSync('x25519');
    const share = rawPublic(eph.publicKey);
    const shared = diffieHellman({ privateKey: eph.privateKey, publicKey: publicKeyOf(point) });
    const wrapKey = hkdf(shared, Buffer.concat([share, point]), X25519_INFO);
    // A 32-byte body is one line of 43 characters (under 64, so it ends the stanza).
    header += `-> X25519 ${b64(share)}\n${b64(seal(wrapKey, Buffer.alloc(12), fileKey))}\n`;
  }
  header += '---';
  header += ` ${b64(headerMac(fileKey, header))}\n`;

  const nonce = randomBytes(16);
  const key = hkdf(fileKey, nonce, 'payload');
  const chunks: Buffer[] = [Buffer.from(header, 'latin1'), nonce];
  const count = Math.max(1, Math.ceil(plain.length / CHUNK));
  for (let i = 0; i < count; i++) {
    chunks.push(seal(key, streamNonce(i, i === count - 1), plain.subarray(i * CHUNK, (i + 1) * CHUNK)));
  }
  return Buffer.concat(chunks);
}

interface Stanza {
  args: string[];
  body: Buffer;
}

function parseHeader(file: Buffer): { stanzas: Stanza[]; macInput: string; mac: Buffer; payloadAt: number } {
  let at = 0;
  const line = (): string => {
    const end = file.indexOf(0x0a, at);
    if (end < 0) throw new Error('age: truncated header');
    const s = file.subarray(at, end).toString('latin1');
    at = end + 1;
    return s;
  };
  if (line() !== INTRO) throw new Error('age: not an age v1 file');
  const stanzas: Stanza[] = [];
  for (;;) {
    const start = at;
    const l = line();
    if (l.startsWith('---')) {
      const m = /^--- ([A-Za-z0-9+/]{43})$/.exec(l);
      if (!m) throw new Error('age: bad header MAC line');
      return { stanzas, macInput: file.subarray(0, start + 3).toString('latin1'), mac: unb64(m[1]), payloadAt: at };
    }
    if (!l.startsWith('-> ')) throw new Error('age: bad stanza');
    const args = l.slice(3).split(' ');
    if (args.some((a) => a === '')) throw new Error('age: bad stanza arguments');
    const parts: Buffer[] = [];
    for (;;) {
      const b = line();
      if (b.length > 64) throw new Error('age: stanza line too long');
      parts.push(unb64(b));
      if (b.length < 64) break;
    }
    stanzas.push({ args, body: Buffer.concat(parts) });
  }
}

/** Decrypt an age file with `identity` (`AGE-SECRET-KEY-1…`). Throws when it is not one of the recipients or the file was altered. */
export function decrypt(file: Buffer, identity: string): Buffer {
  const scalar = identityScalar(identity);
  const me = privateKeyOf(scalar);
  const myPoint = rawPublic(createPublicKey(me));
  const { stanzas, macInput, mac, payloadAt } = parseHeader(file);

  let fileKey: Buffer | null = null;
  for (const s of stanzas) {
    if (s.args[0] !== 'X25519') continue;
    if (s.args.length !== 2 || s.body.length !== 32) throw new Error('age: bad X25519 stanza');
    const share = unb64(s.args[1]);
    if (share.length !== 32) throw new Error('age: bad X25519 share');
    const shared = diffieHellman({ privateKey: me, publicKey: publicKeyOf(share) });
    if (shared.every((v) => v === 0)) throw new Error('age: low-order X25519 share');
    const opened = open(hkdf(shared, Buffer.concat([share, myPoint]), X25519_INFO), Buffer.alloc(12), s.body);
    if (opened && opened.length === 16) {
      fileKey = opened;
      break;
    }
  }
  if (!fileKey) throw new Error('age: no identity matches this file');
  if (!timingSafeEqual(headerMac(fileKey, macInput), mac)) throw new Error('age: header MAC mismatch');

  const nonce = file.subarray(payloadAt, payloadAt + 16);
  if (nonce.length !== 16) throw new Error('age: truncated payload');
  const key = hkdf(fileKey, nonce, 'payload');
  const out: Buffer[] = [];
  let at = payloadAt + 16;
  for (let i = 0; ; i++) {
    const end = Math.min(at + CHUNK + TAG, file.length);
    const last = end === file.length;
    const chunk = open(key, streamNonce(i, last), file.subarray(at, end));
    if (!chunk) throw new Error('age: payload is corrupt or truncated');
    if (last && chunk.length === 0 && i > 0) throw new Error('age: empty final chunk');
    out.push(chunk);
    at = end;
    if (last) return Buffer.concat(out);
  }
}
