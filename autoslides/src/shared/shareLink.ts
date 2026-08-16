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
 * a compact payload: course/session (or live) ids plus, for each slide image, the
 * `YYYY/M` prefix and the first N hex chars of its md5. The viewer resolves names
 * via the Worker (Yanhekt, no user Bearer) and short hashes to full object keys
 * by listing the public coss `images` bucket. Images are world-readable.
 */

export const SHARE_ORIGIN = 'https://share.ruc.edu.kg';
export const SHARE_PATH = '/v1';

/** Default number of leading md5 hex chars stored per image. */
export const DEFAULT_SHORT_HASH_LEN = 7;

/**
 * Compact, URL-fragment-friendly description of a shared note.
 *
 * v2 drops the human title (`t`) — course/session names are resolved from
 * Yanhekt via the share Worker using `c` + `s` (or `l` for a live broadcast).
 * v3 is v2 plus an optional compact slide timeline (`t` as a delta-string).
 */
export interface SharePayload {
  /** Schema version. v3 carries `t`; v2 is images + ids only. */
  v: 2 | 3;
  /** Course id (digits). */
  c?: string;
  /** Session id (digits). Recorded lectures. */
  s?: string;
  /** Live broadcast id (digits). Live watch notes. */
  l?: string;
  /** Default object prefix, e.g. "2026/6". */
  p: string;
  /** Short-hash length: how many leading md5 hex chars `h` stores per image. */
  n: number;
  /** Concatenated n-char md5 prefixes for ALL images, in slide order. */
  h: string;
  /** Sparse override: slide index (as string) → prefix, when it differs from `p`. */
  o?: Record<string, string>;
  /**
   * v3 only. Compact chapter list: `idx:delta,idx:delta,…` where `idx` is the
   * 0-based image index in `h` and `delta` is integer seconds since the previous
   * cue (first delta is the absolute start). Reappearances reuse `idx`.
   */
  t?: string;
}

/** One coalesced chapter: [slideIndex, startTimeSeconds]. */
export type ShareTimelineCue = [number, number];

/**
 * Encode coalesced (slideIndex, startSeconds) cues as a delta-string.
 * Times are rounded to integer seconds; deltas are non-negative.
 */
export function encodeShareTimeline(cues: ReadonlyArray<readonly [number, number]>): string {
  let prev = 0;
  const parts: string[] = [];
  for (const [idx, start] of cues) {
    if (!Number.isFinite(idx) || idx < 0 || !Number.isInteger(idx)) continue;
    const abs = Math.round(start);
    if (!Number.isFinite(abs) || abs < prev) continue;
    parts.push(`${idx}:${abs - prev}`);
    prev = abs;
  }
  return parts.join(',');
}

/**
 * Decode a delta-string back to absolute [slideIndex, startSeconds] cues.
 * Returns null when the string is empty or malformed.
 */
export function decodeShareTimeline(t: string): ShareTimelineCue[] | null {
  if (typeof t !== 'string' || t.length === 0) return null;
  const parts = t.split(',');
  const out: ShareTimelineCue[] = [];
  let abs = 0;
  for (const part of parts) {
    const m = /^(\d+):(\d+)$/.exec(part);
    if (!m) return null;
    const idx = Number(m[1]);
    const delta = Number(m[2]);
    abs += delta;
    out.push([idx, abs]);
  }
  return out.length > 0 ? out : null;
}

/** True when the payload carries a usable v3 timeline. */
export function payloadHasTimeline(payload: SharePayload): boolean {
  return payload.v === 3 && typeof payload.t === 'string' && payload.t.length > 0;
}

/** Ids recorded in a share payload. Kept local so this file stays dependency-free. */
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

/** Recover lecture ids from a decoded payload. */
export function sharePayloadIdentity(payload: SharePayload): ShareIdentity {
  return { courseId: payload.c, sessionId: payload.s, liveId: payload.l };
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
      (obj.v !== 2 && obj.v !== 3) ||
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

    const count = obj.n > 0 ? Math.floor(obj.h.length / obj.n) : 0;
    let t: string | undefined;
    if (obj.v === 3) {
      if (typeof obj.t !== 'string') return null;
      const cues = decodeShareTimeline(obj.t);
      if (!cues || cues.some(([idx]) => idx >= count)) return null;
      t = obj.t;
    }

    const payload: SharePayload = { v: obj.v, p: obj.p, n: obj.n, h: obj.h };
    if (c) payload.c = c;
    if (s) payload.s = s;
    if (l) payload.l = l;
    if (obj.o && typeof obj.o === 'object') payload.o = obj.o;
    if (t) payload.t = t;
    return payload;
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
  opts?: { t?: string },
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

  const delta = opts?.t;
  if (delta) {
    const cues = decodeShareTimeline(delta);
    if (cues && cues.length > 0 && cues.every(([idx]) => idx < refs.length)) {
      payload.v = 3;
      payload.t = delta;
    }
  }
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
