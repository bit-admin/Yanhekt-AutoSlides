/**
 * Share-link codec — the single source of truth for AutoSlides note sharing.
 *
 * CANONICAL FILE. The Cloudflare Worker site under `share/` imports this exact
 * module (relative path) for decoding, so the encode (app) and decode (web
 * viewer) halves can never drift. Keep it dependency-free and runnable in any
 * modern JS runtime (Electron renderer, browser, Cloudflare Worker, Node ≥18) —
 * it relies only on `TextEncoder`/`TextDecoder` and `btoa`/`atob`, which all of
 * those provide.
 *
 * A share link points at the public web viewer and carries, in its URL #fragment,
 * a compact payload: the note title plus, for each slide image, the `YYYY/M`
 * prefix and the first N hex chars of its md5. The viewer resolves the short
 * hashes to full object keys by listing the (publicly listable) coss `images`
 * bucket. Images are world-readable, so the link needs no auth.
 */

export const SHARE_ORIGIN = 'https://share.ruc.edu.kg';
export const SHARE_PATH = '/v1';

/** Default number of leading md5 hex chars stored per image. */
export const DEFAULT_SHORT_HASH_LEN = 7;

/** Compact, URL-fragment-friendly description of a shared note. */
export interface SharePayload {
  /** Schema version. */
  v: 1;
  /** Title (course + session display name). */
  t: string;
  /** Default object prefix, e.g. "2026/6". */
  p: string;
  /** Short-hash length: how many leading md5 hex chars `h` stores per image. */
  n: number;
  /** Concatenated n-char md5 prefixes for ALL images, in slide order. */
  h: string;
  /** Sparse override: slide index (as string) → prefix, when it differs from `p`. */
  o?: Record<string, string>;
}

/** A parsed coss image URL. */
export interface CossImageRef {
  prefix: string;
  hash: string;
  ext: string;
}

/** One image to resolve: its slide index, prefix, and short md5 prefix. */
export interface ShareImageRef {
  index: number;
  prefix: string;
  short: string;
}

// ── base64url ──────────────────────────────────────────────────────────────

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

// ── encode / decode ────────────────────────────────────────────────────────

/** Encode a payload to the base64url fragment (no leading `#`). */
export function encodeSharePayload(payload: SharePayload): string {
  const json = JSON.stringify(payload);
  return bytesToBase64Url(new TextEncoder().encode(json));
}

/** Decode a base64url fragment (with or without a leading `#`) back to a payload, or null if invalid. */
export function decodeSharePayload(fragment: string): SharePayload | null {
  try {
    const frag = fragment.startsWith('#') ? fragment.slice(1) : fragment;
    if (!frag) return null;
    const json = new TextDecoder().decode(base64UrlToBytes(frag));
    const obj = JSON.parse(json) as Partial<SharePayload>;
    if (
      !obj ||
      obj.v !== 1 ||
      typeof obj.t !== 'string' ||
      typeof obj.p !== 'string' ||
      typeof obj.n !== 'number' ||
      typeof obj.h !== 'string'
    ) {
      return null;
    }
    return obj as SharePayload;
  } catch {
    return null;
  }
}

/** Full share URL (long, self-contained form) for a payload. */
export function buildShareUrl(payload: SharePayload): string {
  return `${SHARE_ORIGIN}${SHARE_PATH}#${encodeSharePayload(payload)}`;
}

// ── helpers ────────────────────────────────────────────────────────────────

/** Parse a coss image URL into prefix/hash/ext, or null if it isn't one. */
export function parseCossImageUrl(url: string): CossImageRef | null {
  const m = url.match(/\/images\/(.+)\/([0-9a-f]{32})\.([a-z0-9]+)(?:[?#].*)?$/i);
  if (!m) return null;
  return { prefix: m[1], hash: m[2].toLowerCase(), ext: m[3].toLowerCase() };
}

/**
 * Build a payload from a note's image URLs (in slide order). Picks the most
 * common prefix as the default `p`; images on a different prefix get a sparse
 * `o` override. Non-coss URLs are skipped.
 */
export function buildSharePayload(
  title: string,
  urls: string[],
  n: number = DEFAULT_SHORT_HASH_LEN,
): SharePayload {
  const refs = urls
    .map(parseCossImageUrl)
    .filter((r): r is CossImageRef => r !== null);

  const counts = new Map<string, number>();
  for (const r of refs) counts.set(r.prefix, (counts.get(r.prefix) ?? 0) + 1);
  let p = refs[0]?.prefix ?? '';
  let best = -1;
  for (const [pref, c] of counts) {
    if (c > best) {
      best = c;
      p = pref;
    }
  }

  const o: Record<string, string> = {};
  let h = '';
  refs.forEach((r, i) => {
    h += r.hash.slice(0, n);
    if (r.prefix !== p) o[String(i)] = r.prefix;
  });

  const payload: SharePayload = { v: 1, t: title, p, n, h };
  if (Object.keys(o).length > 0) payload.o = o;
  return payload;
}

/** Expand a payload into per-image resolution refs (index, prefix, short hash). */
export function shareImageRefs(payload: SharePayload): ShareImageRef[] {
  const refs: ShareImageRef[] = [];
  const n = payload.n;
  if (n <= 0) return refs;
  const count = Math.floor(payload.h.length / n);
  for (let i = 0; i < count; i += 1) {
    refs.push({
      index: i,
      prefix: payload.o?.[String(i)] ?? payload.p,
      short: payload.h.slice(i * n, (i + 1) * n),
    });
  }
  return refs;
}
