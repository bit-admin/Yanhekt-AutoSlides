/**
 * The client passphrase for the index files (indexer/src/clientIndex.ts), put
 * in at build time and never written into the bundle as plain text.
 *
 * vite.main.config.ts reads it from $INDEX_CLIENT_PASSPHRASE (release.yml) or
 * ~/.config/autoslides/index-client-passphrase.txt (the release Mac, dev),
 * hides it with {@link hideKey} under a fresh random seed and defines
 * `__AUTOSLIDES_IK__`. Without it the build still works and the index is off.
 *
 * Obfuscation only: anyone who reads this code can undo it. It keeps the
 * passphrase out of a plain search of app.asar, and the bytes differ in every
 * build. What proves an index file is genuine is the manifest signature.
 */

import { createHash, randomBytes } from 'node:crypto';

export interface HiddenKey {
  /** Seed, base64. */
  s: string;
  /** Passphrase XOR the seed's keystream, base64. */
  x: string;
}

declare const __AUTOSLIDES_IK__: HiddenKey | null;

function keystream(seed: Buffer, length: number): Buffer {
  const out = Buffer.alloc(length);
  for (let at = 0, n = 0; at < length; n++) {
    at += createHash('sha256').update(seed).update(`ik${n}`).digest().copy(out, at);
  }
  return out;
}

function xor(a: Buffer, b: Buffer): Buffer {
  return Buffer.from(a.map((v, i) => v ^ b[i]));
}

export function hideKey(key: string, seed: Buffer = randomBytes(32)): HiddenKey {
  const bytes = Buffer.from(key, 'utf8');
  return { s: seed.toString('base64'), x: xor(bytes, keystream(seed, bytes.length)).toString('base64') };
}

export function revealKey(hidden: HiddenKey): string {
  const x = Buffer.from(hidden.x, 'base64');
  return xor(x, keystream(Buffer.from(hidden.s, 'base64'), x.length)).toString('utf8');
}

/** The client passphrase this build carries, or null (the index is then off). */
export function indexClientPassphrase(): string | null {
  const hidden = typeof __AUTOSLIDES_IK__ === 'undefined' ? null : __AUTOSLIDES_IK__;
  return hidden ? revealKey(hidden) : null;
}
