/**
 * Encryption of release files: gzip, then the same format as
 *   openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt
 * ("Salted__" + 8-byte salt + ciphertext; key and IV from PBKDF2-SHA256), so a
 * file can also be opened by hand:
 *   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass file:<passphrase file> -in F | gunzip
 *
 * Copied byte for byte to autoslides/src/main/platform/courseIndex/seal.ts
 * (scripts/check-drift.mjs): edit this file, then copy it over.
 */

import { createCipheriv, createDecipheriv, createHash, pbkdf2, pbkdf2Sync, randomBytes } from 'node:crypto';
import { gunzip, gunzipSync, gzipSync } from 'node:zlib';

const MAGIC = Buffer.from('Salted__');
const ITERATIONS = 200_000;

function split(k: Buffer): { key: Buffer; iv: Buffer } {
  return { key: k.subarray(0, 32), iv: k.subarray(32, 48) };
}

function keyIv(passphrase: string, salt: Buffer): { key: Buffer; iv: Buffer } {
  return split(pbkdf2Sync(Buffer.from(passphrase, 'utf8'), salt, ITERATIONS, 48, 'sha256'));
}

function keyIvAsync(passphrase: string, salt: Buffer): Promise<{ key: Buffer; iv: Buffer }> {
  return new Promise((resolve, reject) => {
    pbkdf2(Buffer.from(passphrase, 'utf8'), salt, ITERATIONS, 48, 'sha256', (err, k) => (err ? reject(err) : resolve(split(k))));
  });
}

function checkSealed(sealed: Buffer): void {
  if (sealed.length < 16 || !sealed.subarray(0, 8).equals(MAGIC)) throw new Error('not an encrypted release file');
}

function decipher(sealed: Buffer, key: Buffer, iv: Buffer): Buffer {
  const d = createDecipheriv('aes-256-cbc', key, iv);
  try {
    return Buffer.concat([d.update(sealed.subarray(16)), d.final()]);
  } catch {
    throw new Error('could not decrypt (wrong passphrase?)');
  }
}

/** Encrypt raw bytes (no gzip). */
export function encrypt(plain: Buffer, passphrase: string, salt: Buffer = randomBytes(8)): Buffer {
  const { key, iv } = keyIv(passphrase, salt);
  const c = createCipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([MAGIC, salt, c.update(plain), c.final()]);
}

export function decrypt(sealed: Buffer, passphrase: string): Buffer {
  checkSealed(sealed);
  const { key, iv } = keyIv(passphrase, sealed.subarray(8, 16));
  return decipher(sealed, key, iv);
}

/** gzip + encrypt. */
export function seal(plain: Buffer, passphrase: string): Buffer {
  return encrypt(gzipSync(plain), passphrase);
}

/** decrypt + gunzip. */
export function unseal(sealed: Buffer, passphrase: string): Buffer {
  return gunzipSync(decrypt(sealed, passphrase));
}

/** decrypt + gunzip without blocking the thread (key derivation and gunzip run in the pool). */
export async function unsealAsync(sealed: Buffer, passphrase: string): Promise<Buffer> {
  checkSealed(sealed);
  const { key, iv } = await keyIvAsync(passphrase, sealed.subarray(8, 16));
  const zipped = decipher(sealed, key, iv);
  return new Promise((resolve, reject) => gunzip(zipped, (err, out) => (err ? reject(err) : resolve(out))));
}

/**
 * A short public name for a passphrase (8 hex digits), so a reader can tell
 * which passphrase a file needs without trying it. Safe to publish only
 * because the passphrases are long and random.
 */
export function passphraseId(passphrase: string): string {
  return createHash('sha256').update(`autoslides-index-passphrase\n${passphrase}`, 'utf8').digest('hex').slice(0, 8);
}
