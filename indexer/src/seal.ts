/**
 * Encryption of release files: gzip, then the same format as
 *   openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt
 * ("Salted__" + 8-byte salt + ciphertext; key and IV from PBKDF2-SHA256), so a
 * file can also be opened by hand:
 *   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass file:<passphrase file> -in F | gunzip
 */

import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

const MAGIC = Buffer.from('Salted__');
const ITERATIONS = 200_000;

function keyIv(passphrase: string, salt: Buffer): { key: Buffer; iv: Buffer } {
  const k = pbkdf2Sync(Buffer.from(passphrase, 'utf8'), salt, ITERATIONS, 48, 'sha256');
  return { key: k.subarray(0, 32), iv: k.subarray(32, 48) };
}

/** Encrypt raw bytes (no gzip). */
export function encrypt(plain: Buffer, passphrase: string, salt: Buffer = randomBytes(8)): Buffer {
  const { key, iv } = keyIv(passphrase, salt);
  const c = createCipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([MAGIC, salt, c.update(plain), c.final()]);
}

export function decrypt(sealed: Buffer, passphrase: string): Buffer {
  if (sealed.length < 16 || !sealed.subarray(0, 8).equals(MAGIC)) throw new Error('not an encrypted release file');
  const { key, iv } = keyIv(passphrase, sealed.subarray(8, 16));
  const d = createDecipheriv('aes-256-cbc', key, iv);
  try {
    return Buffer.concat([d.update(sealed.subarray(16)), d.final()]);
  } catch {
    throw new Error('could not decrypt (wrong passphrase?)');
  }
}

/** gzip + encrypt. */
export function seal(plain: Buffer, passphrase: string): Buffer {
  return encrypt(gzipSync(plain), passphrase);
}

/** decrypt + gunzip. */
export function unseal(sealed: Buffer, passphrase: string): Buffer {
  return gunzipSync(decrypt(sealed, passphrase));
}
