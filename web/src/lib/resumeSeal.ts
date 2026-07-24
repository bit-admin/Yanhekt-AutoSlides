/**
 * Sealed blobs that let a multi-request login work without server-side state.
 *
 * A Worker cannot hold a half-finished CAS flow open for the minutes a user
 * needs to read an SMS — it is request/response, and there is no process to park
 * anything in. So the flow's state is encrypted here, handed to the browser as
 * an opaque string, and posted back with the code. The alternative (a Durable
 * Object or KV challenge table) buys stricter secrecy at the cost of real
 * infrastructure; this keeps the Worker stateless.
 *
 * Two blob kinds, same construction:
 *
 * - **resume token** — one mid-login CAS flow (cookies + 2FA context). Short
 *   lived, single use, and a genuine session secret: whoever holds it *and* the
 *   texted code can finish the sign-in. Treat it accordingly — memory-only in
 *   the SPA, never logged.
 * - **device keepsake** — the long-lived cookies CAS sets for a remembered
 *   device. Harmless on its own (it only makes CAS skip a second factor) and
 *   deliberately persistent, since that is the entire point.
 *
 * AES-256-GCM, so a tampered or truncated blob fails to open rather than
 * decrypting to garbage. The key is derived from the SSO_RESUME_KEY secret; with
 * no secret bound, `sealerFor` returns null and the caller degrades to the
 * token-paste flow instead of inventing a key.
 */

/** Bumped if the payload shape changes, so old blobs are rejected not misread. */
const ENVELOPE_VERSION = "s1";

const IV_BYTES = 12;

/** Matches the desktop app's parked-challenge window. */
export const RESUME_TTL_SECONDS = 300;

/** Long enough to be worth having; short enough to age out of a shared browser. */
export const KEEPSAKE_TTL_SECONDS = 180 * 24 * 60 * 60;

interface SealedPayload<T> {
  v: string;
  /** Epoch ms. Enforced here, never trusted from the client. */
  exp: number;
  /** Ties a resume token to the response that issued it. */
  nonce: string;
  data: T;
}

export class Sealer {
  private constructor(private readonly key: CryptoKey) {}

  /**
   * Build a sealer from the Worker secret, or null when it is unbound — which is
   * how a deployment without the secret keeps working (minus SMS) instead of
   * failing closed on a key nobody configured.
   */
  static async from(secret: string | undefined): Promise<Sealer | null> {
    if (!secret) return null;
    // The secret is an arbitrary-length string, so hash it to exactly 256 bits.
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
    const key = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
    return new Sealer(key);
  }

  async seal<T>(data: T, ttlSeconds: number, nonce = randomNonce()): Promise<string> {
    const payload: SealedPayload<T> = {
      v: ENVELOPE_VERSION,
      exp: Date.now() + ttlSeconds * 1000,
      nonce,
      data,
    };

    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      this.key,
      new TextEncoder().encode(JSON.stringify(payload)),
    );

    // IV travels with the blob; it is not secret, only required to be unique.
    const joined = new Uint8Array(iv.length + ciphertext.byteLength);
    joined.set(iv, 0);
    joined.set(new Uint8Array(ciphertext), iv.length);
    return toBase64Url(joined);
  }

  /**
   * Open a blob, returning null for anything that is not intact, current, and
   * of the expected version. Callers get one answer for every failure mode on
   * purpose — a tampered blob and an expired one are the same to the client.
   */
  async open<T>(blob: string, expectedNonce?: string): Promise<T | null> {
    let joined: Uint8Array;
    try {
      joined = fromBase64Url(blob);
    } catch {
      return null;
    }
    if (joined.length <= IV_BYTES) return null;

    let plaintext: ArrayBuffer;
    try {
      plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: joined.subarray(0, IV_BYTES) },
        this.key,
        joined.subarray(IV_BYTES),
      );
    } catch {
      // Wrong key, or the auth tag did not verify.
      return null;
    }

    let payload: SealedPayload<T>;
    try {
      payload = JSON.parse(new TextDecoder().decode(plaintext)) as SealedPayload<T>;
    } catch {
      return null;
    }

    if (payload.v !== ENVELOPE_VERSION) return null;
    if (typeof payload.exp !== "number" || payload.exp <= Date.now()) return null;
    if (expectedNonce !== undefined && payload.nonce !== expectedNonce) return null;

    return payload.data;
  }
}

export function randomNonce(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
