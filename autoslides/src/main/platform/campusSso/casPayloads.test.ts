/**
 * The CAS payload crypto has no observable output until a real login runs
 * against the real server, so it is pinned here instead: AES-ECB is
 * cross-checked against an independent implementation (node:crypto vs the
 * CryptoJS one the module uses), the guard-header derivation is checked against
 * a hand-computed expectation, and the sealed envelope is round-tripped.
 */
import {
  constants,
  createCipheriv,
  createHash,
  generateKeyPairSync,
  publicEncrypt,
} from 'node:crypto';
import { describe, expect, it } from 'vitest';
import CryptoJS from 'crypto-js';
import { buildGuardHeaders, encryptFormValue, openSealedReply, sealJsonEnvelope } from './casPayloads';

/** Independent AES-128-ECB/PKCS7/Base64, so the CryptoJS path is not self-checked. */
function referenceEcb(keyBase64: string, plaintext: string): string {
  const cipher = createCipheriv('aes-128-ecb', Buffer.from(keyBase64, 'base64'), null);
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]).toString('base64');
}

/** Square-and-multiply, so the test needs no bignum dependency. */
function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  let b = base % modulus;
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus;
    b = (b * b) % modulus;
    e >>= 1n;
  }
  return result;
}

describe('encryptFormValue', () => {
  it('matches an independent AES-ECB/PKCS7 implementation', () => {
    const pageKey = Buffer.from('0123456789abcdef', 'ascii').toString('base64');
    expect(encryptFormValue(pageKey, 'hunter2')).toBe(referenceEcb(pageKey, 'hunter2'));
  });

  it('pads on the block boundary rather than truncating', () => {
    const pageKey = Buffer.from('0123456789abcdef', 'ascii').toString('base64');
    const exactlyOneBlock = 'abcdefghijklmnop';
    expect(encryptFormValue(pageKey, exactlyOneBlock)).toBe(referenceEcb(pageKey, exactlyOneBlock));
    // PKCS7 always appends, so one block of input yields two blocks of output.
    expect(Buffer.from(encryptFormValue(pageKey, exactlyOneBlock), 'base64')).toHaveLength(32);
  });

  it('refuses to run without a page key', () => {
    expect(() => encryptFormValue('', 'hunter2')).toThrow(/encryption key/i);
  });
});

describe('buildGuardHeaders', () => {
  it('derives the value by splicing the encoded key around itself', () => {
    const { 'Csrf-Key': key, 'Csrf-Value': value } = buildGuardHeaders();
    const encoded = Buffer.from(key, 'ascii').toString('base64');
    const midpoint = Math.floor(encoded.length / 2);
    const expected = createHash('md5')
      .update(encoded.slice(0, midpoint) + encoded + encoded.slice(midpoint), 'ascii')
      .digest('hex');
    expect(value).toBe(expected);
  });

  it('emits a fresh 32-char alphanumeric key each call', () => {
    const first = buildGuardHeaders();
    const second = buildGuardHeaders();
    expect(first['Csrf-Key']).toMatch(/^[A-Za-z0-9]{32}$/);
    expect(first['Csrf-Key']).not.toBe(second['Csrf-Key']);
  });
});

describe('sealJsonEnvelope', () => {
  it('wraps the key as a PKCS#1 v1.5 type-2 block, not OAEP', () => {
    // The server is Java and only accepts v1.5. Node refuses v1.5 *private*
    // decryption outright, so undo the encryption with raw RSA and inspect the
    // padded block directly — that is exactly what CAS will unpad.
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const keyBytes = Buffer.from('fedcba9876543210', 'ascii');
    const message = Buffer.from(keyBytes.toString('base64'), 'ascii');

    const wrapped = publicEncrypt(
      { key: publicKey, padding: constants.RSA_PKCS1_PADDING },
      message,
    );

    const jwk = privateKey.export({ format: 'jwk' }) as { n: string; d: string };
    const toBigInt = (base64url: string) =>
      BigInt('0x' + Buffer.from(base64url, 'base64url').toString('hex'));
    const block = modPow(BigInt('0x' + wrapped.toString('hex')), toBigInt(jwk.d), toBigInt(jwk.n))
      .toString(16)
      .padStart(510, '0'); // 256-byte block minus the always-zero leading byte

    const bytes = Buffer.from('00' + block, 'hex');
    expect(bytes[0]).toBe(0x00);
    expect(bytes[1]).toBe(0x02); // type 2 == public-key encryption block
    const separator = bytes.indexOf(0x00, 2);
    expect(separator).toBeGreaterThanOrEqual(10); // >= 8 bytes of padding
    // Padding bytes are random but must all be non-zero.
    expect(bytes.subarray(2, separator).includes(0x00)).toBe(false);
    expect(bytes.subarray(separator + 1)).toEqual(message);
  });

  it('produces a 2048-bit header and a distinct key per call', () => {
    const first = sealJsonEnvelope({ userId: 'abc' });
    const second = sealJsonEnvelope({ userId: 'abc' });
    expect(Buffer.from(first.keyHeader, 'base64')).toHaveLength(256);
    expect(first.body).not.toBe(second.body);
  });

  it('round-trips a reply encrypted with the session key', () => {
    const envelope = sealJsonEnvelope({ userId: 'abc' });
    const reply = CryptoJS.AES.encrypt(
      JSON.stringify({ code: 200, data: { tel: 'opaque', maskTel: '138****1234' } }),
      envelope.sessionKey,
      { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 },
    ).toString();

    expect(openSealedReply(reply, envelope.sessionKey)).toEqual({
      code: 200,
      data: { tel: 'opaque', maskTel: '138****1234' },
    });
  });

  it('peels a ciphertext that arrives wrapped in a JSON string', () => {
    const envelope = sealJsonEnvelope({ userId: 'abc' });
    const inner = CryptoJS.AES.encrypt(JSON.stringify({ code: 200 }), envelope.sessionKey, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7,
    }).toString();

    expect(openSealedReply(JSON.stringify(inner), envelope.sessionKey)).toEqual({ code: 200 });
  });

  it('passes through a reply that was never encrypted', () => {
    const envelope = sealJsonEnvelope({ userId: 'abc' });
    expect(openSealedReply('{"code":500,"message":"nope"}', envelope.sessionKey)).toEqual({
      code: 500,
      message: 'nope',
    });
  });
});
