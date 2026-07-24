/**
 * Payload crypto for the campus CAS login flow.
 *
 * Three separate schemes live here, all dictated by what the CAS login page's
 * own JavaScript sends:
 *
 * 1. Form values (password, and any other `*_payload` field) are AES-ECB /
 *    PKCS7 / Base64 under the Base64 key the page publishes in
 *    `#login-croypto`.
 * 2. Requests to `/protected/` paths carry a pair of guard headers derived
 *    from a throwaway random key.
 * 3. The phone-lookup endpoint speaks a hybrid envelope: the JSON body is
 *    AES-ECB'd under a fresh 16-byte key, and that key travels in a header
 *    RSA-encrypted to the CAS public key. The reply is encrypted with the same
 *    ephemeral key.
 *
 * AES + MD5 go through CryptoJS (already this process's AES library — see
 * authService.ts). RSA uses node:crypto because CryptoJS has no RSA, and it
 * must be PKCS#1 v1.5: the page's key exchange predates OAEP and the server
 * rejects anything else.
 */
import { constants, publicEncrypt, randomBytes } from 'node:crypto';
import CryptoJS from 'crypto-js';

/**
 * CAS's public key for the phone-lookup envelope. A property of the server, so
 * it is reproduced verbatim; there is no way to discover it at runtime.
 */
const ENVELOPE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjVr1zKwohU3xA0afprWLSQvIymaSH/V27MedFc+CecXSnORIFMAp4uEIb4taDq/2X4eMeTI66Mu/rB5GKSFDbExF2Gu4NaO/CNDpf1gHMScUrIFCh4CDqzBnx17kclvezLkIK0T8FVa4cRsINvzjbnA6jUSMaf6Fm1n9wTAtW6QYBjssGOEtCj+c38PTBdFMmJbXp3brt1tEBesz6lb3Fjp76FGvDZ08xtYG8fxYPuiMwKU04eS+mcX/BunwgpU3zwekHYB+PWRIvq0lBry9Wms25sJE5T/RAv5fEuMLbBkfcZK3+7ivSZthTmPpr2Ap/ji70ZZ6u2jvR5VJq+LJHQIDAQAB
-----END PUBLIC KEY-----`;

const GUARD_KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const GUARD_KEY_LENGTH = 32;

/** How many times to peel a sealed reply before giving up (matches the page). */
const MAX_UNWRAP_ROUNDS = 4;

const ECB_PKCS7 = { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 } as const;

/**
 * AES-ECB/PKCS7/Base64 a form value under the page's published Base64 key.
 * Used for the password and for the JSON `*_payload` fields.
 */
export function encryptFormValue(pageKey: string, plaintext: string): string {
  if (!pageKey) {
    throw new Error('The login page did not publish an encryption key.');
  }
  const key = CryptoJS.enc.Base64.parse(pageKey);
  return CryptoJS.AES.encrypt(plaintext, key, ECB_PKCS7).toString();
}

/**
 * Guard headers required on every `/protected/` request. The value is an MD5
 * over the Base64 of the key with its own first half spliced back in front and
 * its second half appended — an anti-replay shape the page computes client
 * side, so we reproduce it exactly rather than inventing our own.
 */
export function buildGuardHeaders(): Record<string, string> {
  const raw = randomBytes(GUARD_KEY_LENGTH);
  let key = '';
  for (const byte of raw) {
    key += GUARD_KEY_ALPHABET[byte % GUARD_KEY_ALPHABET.length];
  }
  const encoded = Buffer.from(key, 'ascii').toString('base64');
  const midpoint = Math.floor(encoded.length / 2);
  const mixed = encoded.slice(0, midpoint) + encoded + encoded.slice(midpoint);
  return {
    'Csrf-Key': key,
    'Csrf-Value': CryptoJS.MD5(CryptoJS.enc.Latin1.parse(mixed)).toString(CryptoJS.enc.Hex),
  };
}

export interface SealedEnvelope {
  /** Base64 AES-ECB ciphertext — goes in the request body as-is. */
  body: string;
  /** Base64 RSA ciphertext of the AES key — goes in the `privateKey` header. */
  keyHeader: string;
  /** Kept so the reply, encrypted with the same key, can be opened. */
  sessionKey: CryptoJS.lib.WordArray;
}

/**
 * Wrap a JSON value in the hybrid envelope the phone-lookup endpoint expects.
 * The AES key is per-request and never leaves this process in the clear.
 */
export function sealJsonEnvelope(value: unknown): SealedEnvelope {
  const keyBytes = randomBytes(16);
  const sessionKey = CryptoJS.enc.Base64.parse(keyBytes.toString('base64'));
  const body = CryptoJS.AES.encrypt(compactJson(value), sessionKey, ECB_PKCS7).toString();
  // The header carries the *Base64 text* of the key, not its raw bytes.
  const keyHeader = publicEncrypt(
    { key: ENVELOPE_PUBLIC_KEY, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(keyBytes.toString('base64'), 'ascii'),
  ).toString('base64');
  return { body, keyHeader, sessionKey };
}

/**
 * Peel a sealed reply. The server nests inconsistently — sometimes a bare
 * Base64 ciphertext, sometimes that ciphertext wrapped in a JSON string,
 * sometimes a plain JSON object with no encryption at all — so unwrap
 * opportunistically and stop as soon as the value is no longer a string we can
 * make progress on.
 */
export function openSealedReply(payload: string, sessionKey: CryptoJS.lib.WordArray): unknown {
  let current: unknown = payload;

  for (let round = 0; round < MAX_UNWRAP_ROUNDS; round++) {
    if (typeof current !== 'string') return current;

    const parsed = tryParseJson(current);
    // A JSON string that decodes to a *different* string is just a wrapper.
    if (typeof parsed === 'string' && parsed !== current) {
      current = parsed;
      continue;
    }
    if (parsed !== undefined && typeof parsed !== 'string') return parsed;

    const decrypted = tryDecrypt(typeof parsed === 'string' ? parsed : current, sessionKey);
    if (decrypted === null) return current;

    const asJson = tryParseJson(decrypted);
    current = asJson === undefined ? decrypted : asJson;
  }

  return current;
}

/** Separator-free JSON, matching what the page hashes/encrypts. */
export function compactJson(value: unknown): string {
  return JSON.stringify(value ?? {});
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function tryDecrypt(text: string, sessionKey: CryptoJS.lib.WordArray): string | null {
  try {
    const plain = CryptoJS.AES.decrypt(text, sessionKey, ECB_PKCS7).toString(CryptoJS.enc.Utf8);
    return plain.length > 0 ? plain : null;
  } catch {
    return null;
  }
}
