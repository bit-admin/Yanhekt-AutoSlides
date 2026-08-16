/**
 * Share-link codec — ported from CANONICAL
 * `autoslides/src/shared/shareLink.ts` so the web Notes client can mint the same
 * long share URLs without importing across the Electron tree (vite root is
 * `frontend/`; third-party clones of `web/` must stay self-contained).
 *
 * Keep in sync with the desktop module: encode + decode stay dependency-free
 * (`TextEncoder`/`TextDecoder`/`btoa`/`atob` only).
 */

export const SHARE_ORIGIN = 'https://share.ruc.edu.kg';
export const SHARE_PATH = '/v1';

/** Default number of leading md5 hex chars stored per image. */
export const DEFAULT_SHORT_HASH_LEN = 7;

export interface SharePayload {
  v: 2;
  c?: string;
  s?: string;
  l?: string;
  p: string;
  n: number;
  h: string;
  o?: Record<string, string>;
}

export interface ShareIdentity {
  courseId?: string | number | null;
  sessionId?: string | number | null;
  liveId?: string | number | null;
}

function digitId(value: string | number | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return /^\d+$/.test(text) ? text : undefined;
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
      obj.v !== 2 ||
      typeof obj.p !== 'string' ||
      typeof obj.n !== 'number' ||
      typeof obj.h !== 'string'
    ) {
      return null;
    }
    const c = obj.c === undefined ? undefined : digitId(obj.c);
    const s = obj.s === undefined ? undefined : digitId(obj.s);
    const l = obj.l === undefined ? undefined : digitId(obj.l);
    if (obj.c !== undefined && !c) return null;
    if (obj.s !== undefined && !s) return null;
    if (obj.l !== undefined && !l) return null;
    return { ...obj, c, s, l } as SharePayload;
  } catch {
    return null;
  }
}

/** Full share URL (long, self-contained form) for a payload. */
export function buildShareUrl(payload: SharePayload): string {
  return `${SHARE_ORIGIN}${SHARE_PATH}#${encodeSharePayload(payload)}`;
}

/** A pasted share link, parsed into exactly one of its two forms. */
export interface ParsedShareLink {
  /** Long-link payload fragment (base64url, no leading `#`). */
  fragment?: string;
  /** Short-link id (the `<id>` in `/v1/s/<id>`). */
  shortId?: string;
}

const SHORT_LINK_RE = /\/v1\/s\/([A-Za-z0-9]+)\/?$/;

/**
 * Parse a pasted share link into its fragment (long form) or short id. Accepts a
 * full URL (`…/v1#<frag>` or `…/v1/s/<id>`) or a bare base64url payload pasted on
 * its own. Returns null if it doesn't look like a share link.
 */
export function parseShareLink(input: string): ParsedShareLink | null {
  const raw = input.trim();
  if (!raw) return null;

  // Any URL (or bare string) carrying a `#payload` is a long link.
  const hashIdx = raw.indexOf('#');
  if (hashIdx >= 0) {
    const frag = raw.slice(hashIdx + 1).trim();
    if (frag) return { fragment: frag };
  }

  // Short link: …/v1/s/<id>
  const m = raw.match(SHORT_LINK_RE);
  if (m) return { shortId: m[1] };

  // A bare base64url payload pasted on its own (no scheme, slash, query, or hash).
  if (/^[A-Za-z0-9_-]+$/.test(raw)) return { fragment: raw };

  return null;
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
  identity: ShareIdentity,
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

  const payload: SharePayload = { v: 2, p, n, h };
  const courseId = digitId(identity.courseId);
  const liveId = digitId(identity.liveId);
  const sessionId = courseId ? digitId(identity.sessionId) : undefined;
  if (courseId) payload.c = courseId;
  if (sessionId) payload.s = sessionId;
  if (liveId) payload.l = liveId;
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
