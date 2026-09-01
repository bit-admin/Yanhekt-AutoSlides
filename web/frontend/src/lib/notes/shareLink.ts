/**
 * Share-link codec — ported from CANONICAL
 * `autoslides/src/shared/shareLink.ts` so the web Notes client can mint the same
 * long share URLs without importing across the Electron tree (vite root is
 * `frontend/`; third-party clones of `web/` must stay self-contained).
 *
 * Keep in sync with the desktop module: encode + decode stay dependency-free
 * (`TextEncoder`/`TextDecoder`/`btoa`/`atob` only). `timelineDeltaFromUnknown`
 * is the web port of `@common/shareTimeline.shareTimelineDeltaFromNote` and
 * may import `notesContent` for filename order.
 */

import { exportSlideFilenames } from './notesContent';

export const SHARE_ORIGIN = 'https://share.ruc.edu.kg';
export const SHARE_PATH = '/v1';

/** Default number of leading md5 hex chars stored per image. */
export const DEFAULT_SHORT_HASH_LEN = 7;

export interface SharePayload {
  v: 2 | 3;
  c?: string;
  s?: string;
  l?: string;
  p: string;
  n: number;
  h: string;
  o?: Record<string, string>;
  /** v3 only. `idx:delta,idx:delta,…` (integer seconds). */
  t?: string;
}

export type ShareTimelineCue = [number, number];

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

export function payloadHasTimeline(payload: SharePayload): boolean {
  return payload.v === 3 && typeof payload.t === 'string' && payload.t.length > 0;
}

type EventLike = { id?: unknown; changeAt?: unknown; initialFile?: unknown };
type ResLike = { state?: unknown; file?: unknown; duplicateOf?: unknown };
type TimelineLike = { events: EventLike[]; resolutions: Record<string, ResLike> };

function asTimeline(raw: unknown): TimelineLike | null {
  if (!raw || typeof raw !== 'object') return null;
  const events = (raw as { events?: unknown }).events;
  const resolutions = (raw as { resolutions?: unknown }).resolutions;
  if (!Array.isArray(events) || !resolutions || typeof resolutions !== 'object') return null;
  return { events: events as EventLike[], resolutions: resolutions as Record<string, ResLike> };
}

function basenameOf(filename: string): string {
  const parts = filename.split(/[/\\]/);
  return parts[parts.length - 1] ?? '';
}

/**
 * Duck-typed port of Electron `resolveCanonicalFile` (shareTimeline / deriveCues).
 * Follows duplicateOf chains to a canonical file; gaps / cycles → null.
 */
function resolveCanonicalFile(
  tl: TimelineLike,
  targetFilename: string | undefined,
  seen: Set<string> = new Set(),
): string | null {
  if (!targetFilename) return null;
  if (seen.has(targetFilename)) return null;
  seen.add(targetFilename);

  for (const event of tl.events) {
    if (event.initialFile !== targetFilename) continue;
    const id = typeof event.id === 'string' ? event.id : '';
    const res = tl.resolutions[id];
    if (!res) return null;
    if (res.state === 'canonical' && typeof res.file === 'string') return res.file;
    if (res.state === 'duplicate') {
      return resolveCanonicalFile(
        tl,
        typeof res.duplicateOf === 'string' ? res.duplicateOf : undefined,
        seen,
      );
    }
    return null;
  }

  for (const res of Object.values(tl.resolutions)) {
    if (res.state === 'canonical' && res.file === targetFilename && typeof res.file === 'string') {
      return res.file;
    }
  }
  return null;
}

/** Resolved on-screen file for one event, or null for a gap. */
function cueFile(tl: TimelineLike, event: EventLike): string | null {
  const id = typeof event.id === 'string' ? event.id : '';
  const res = tl.resolutions[id];
  if (!res || res.state === 'gap') return null;
  if (res.state === 'canonical') return typeof res.file === 'string' ? res.file : null;
  if (res.state === 'duplicate') {
    return resolveCanonicalFile(tl, typeof res.duplicateOf === 'string' ? res.duplicateOf : undefined);
  }
  return null;
}

/**
 * Duck-typed port of Electron `shareTimelineDeltaFromNote`: coalesce resolved
 * slide cues and key them by `exportSlideFilenames(imageCount, timeline)` so
 * indices match share image order (`h`). Unmappable cues are skipped (so a
 * count mismatch cannot drop the whole `t` the way first-appearance indexing
 * did). Returns undefined when there is no timeline or no mappable cue.
 */
export function timelineDeltaFromUnknown(raw: unknown, imageCount?: number): string | undefined {
  const tl = asTimeline(raw);
  if (!tl?.events.length || imageCount == null || imageCount <= 0) return undefined;

  const filenames = exportSlideFilenames(imageCount, raw);
  if (filenames.length === 0) return undefined;

  const indexOf = new Map<string, number>();
  filenames.forEach((name, i) => {
    const base = basenameOf(name);
    if (base && !indexOf.has(base)) indexOf.set(base, i);
  });

  const sorted = [...tl.events]
    .filter((e): e is EventLike => !!e && typeof e === 'object')
    .sort((a, b) => Number(a.changeAt) - Number(b.changeAt));

  const pairs: Array<[number, number]> = [];
  let lastFile: string | null = null;
  for (const event of sorted) {
    const file = cueFile(tl, event);
    if (!file) {
      lastFile = null;
      continue;
    }
    if (file === lastFile) continue;
    lastFile = file;
    const idx = indexOf.get(basenameOf(file));
    if (idx === undefined) continue;
    const start = Math.round(Number(event.changeAt));
    if (!Number.isFinite(start)) continue;
    pairs.push([idx, start]);
  }
  return pairs.length > 0 ? encodeShareTimeline(pairs) : undefined;
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

/**
 * Fast local check before any COSS listing. Short links return `'short'`
 * (fragment lives in share-Worker KV). The web player resolves those via
 * same-origin `GET /api/share/get` (service binding), not a browser request
 * to share.ruc.edu.kg. Desktop returns `'ok'` and resolves via main.
 */
export type ShareTimelinePrecheck = 'ok' | 'empty' | 'invalid' | 'no-timeline' | 'short';

export function precheckShareLinkTimeline(input: string): ShareTimelinePrecheck {
  const raw = input.trim();
  if (!raw) return 'empty';
  const parsed = parseShareLink(raw);
  if (!parsed) return 'invalid';
  if (parsed.shortId && !parsed.fragment) return 'short';
  if (!parsed.fragment) return 'invalid';
  const payload = decodeSharePayload(parsed.fragment);
  if (!payload) return 'invalid';
  return payloadHasTimeline(payload) ? 'ok' : 'no-timeline';
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
