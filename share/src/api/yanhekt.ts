/**
 * Live Yanhekt details for a course the Index holds: `/api/courses/{id}/yanhekt`
 * and `/api/courses/{id}/yanhekt/sessions`. Contract: docs/api.md.
 *
 * Yanhekt is read through the web Worker (the `WEB` service binding, its
 * `/api/yanhekt/*` proxy), not from here. That proxy wants a 32-hex Bearer and
 * checks only its format; both reads used here answer without an account, and
 * Yanhekt ignores a token it does not know (2026-10-23 probe), so a fixed
 * placeholder is sent. No account is involved.
 *
 * Only ids the Index holds are read (a course in D1, and that course's own
 * session ids), so this is not an open proxy onto Yanhekt. Answers are trimmed
 * to what the course page shows: no stream addresses, no watch progress.
 */

import type { Env } from '../lib/runtime';
import { courseSessions } from './search';

/** Not a login: the proxy checks the format only, Yanhekt ignores it. */
export const PLACEHOLDER_TOKEN = '0'.repeat(32);

/**
 * Sessions per `/yanhekt/sessions` call, each one service-binding call to the web Worker. Those calls are
 * not billed as requests (the browser's one call to this Worker is), but one request may run at most 32
 * Workers, this one included, so a page can never hold more than 31.
 */
export const SESSION_BATCH = 30;
const CONCURRENCY = 6;

export interface CourseDetails {
  id: number;
  nameZh: string;
  nameEn: string | null;
  /** The subject's course code, shared by every class of it (`1000001`); not the registrar code. */
  code: string | null;
  /** Yanhekt's level tag as it names it: `本科` or `研究生`, or null. */
  level: string | null;
  college: string | null;
  collegeEn: string | null;
  /** Course or college picture on Yanhekt's image host, or null. */
  image: string | null;
  /** Teacher names Yanhekt lists for the course; often empty. */
  teachers: string[];
}

export interface SessionDetails {
  id: number;
  title: string | null;
  week: number | null;
  /** 1 = Monday … 7 = Sunday. */
  day: number | null;
  /** China time as Yanhekt gives it, `YYYY-MM-DD HH:MM:SS`. */
  startedAt: string | null;
  endedAt: string | null;
  /** The classroom, from the session's broadcast record. */
  room: string | null;
  /** Yanhekt lists a recording for it (it may still be processing). */
  recorded: boolean;
}

/** A session id the Index lists that Yanhekt did not answer for: `gone` (deleted, or moved to another course) or `unavailable` (failed; retry later). */
export interface SessionMissing {
  id: number;
  error: 'gone' | 'unavailable';
}

export interface SessionsPage {
  course: number;
  /** All session ids the Index holds for the course. */
  total: number;
  from: number;
  /** `from` for the next call, or null after the last. */
  next: number | null;
  sessions: Array<SessionDetails | SessionMissing>;
}

export type Failure = { error: 'not-found' | 'yanhekt-unavailable' | 'yanhekt-not-configured'; message: string };

type Read<T> = { ok: true; data: T } | { ok: false; gone: boolean };

/**
 * Envelope codes that mean Yanhekt failed, not that the record is missing. `99151011` is its gateway's
 * "failed to invoke service" (`displayable: false`, `module: "frame_client_request"`): the backend
 * behind it is down, so every read answers with it until it comes back (docs/architecture.md §9.1).
 */
const OUTAGE_CODES = new Set(['99151011']);

/** One GET through the web Worker's Yanhekt proxy. `gone`: Yanhekt answered with a non-zero code other than an outage. */
async function readYanhekt<T>(web: NonNullable<Env['WEB']>, pathAndQuery: string): Promise<Read<T>> {
  try {
    // A service binding ignores the host; only path and query reach the callee.
    const res = await web.fetch(
      new Request(`https://web.internal/api/yanhekt${pathAndQuery}`, {
        headers: { Authorization: `Bearer ${PLACEHOLDER_TOKEN}`, Accept: 'application/json' },
      }),
    );
    if (!res.ok) return { ok: false, gone: false };
    const body = (await res.json()) as { code?: unknown; data?: T };
    if (OUTAGE_CODES.has(String(body.code))) return { ok: false, gone: false };
    if (String(body.code) !== '0') return { ok: false, gone: true };
    return body.data == null ? { ok: false, gone: true } : { ok: true, data: body.data };
  } catch {
    return { ok: false, gone: false };
  }
}

const text = (v: unknown): string => (v == null ? '' : String(v).trim());
const textOrNull = (v: unknown): string | null => text(v) || null;
const intOrNull = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : v == null || v === '' ? NaN : Number(v);
  return Number.isInteger(n) ? n : null;
};

interface RawCourse {
  id?: unknown;
  name_zh?: unknown;
  name_en?: unknown;
  college_name?: unknown;
  college?: { name?: unknown; name_en?: unknown; image_url?: unknown } | null;
  image_url?: unknown;
  professors?: Array<string | { name?: unknown }> | null;
  code?: unknown;
  type_name?: unknown;
  tags?: Array<{ param?: unknown; name?: unknown }> | null;
}

export function courseFromRaw(id: number, raw: RawCourse): CourseDetails {
  const teachers = (raw.professors ?? [])
    .map((p) => text(typeof p === 'string' ? p : p?.name))
    .filter(Boolean);
  return {
    id,
    nameZh: text(raw.name_zh),
    nameEn: textOrNull(raw.name_en),
    code: textOrNull(raw.code),
    level: levelOf(raw),
    college: textOrNull(raw.college_name) ?? textOrNull(raw.college?.name),
    collegeEn: textOrNull(raw.college?.name_en),
    image: httpsOrNull(raw.image_url) ?? httpsOrNull(raw.college?.image_url),
    teachers: [...new Set(teachers)],
  };
}

/** The `degrees` tag (`本科` / `研究生`); else `type_name` (`本科课程`) without its 课程. */
function levelOf(raw: RawCourse): string | null {
  const tag = (raw.tags ?? []).find((t) => text(t?.param) === 'degrees');
  return textOrNull(tag?.name) ?? textOrNull(text(raw.type_name).replace(/课程$/, ''));
}

function httpsOrNull(v: unknown): string | null {
  const s = text(v);
  return /^https:\/\/[^\s"'<>]+$/.test(s) ? s : null;
}

interface RawSession {
  id?: unknown;
  course_id?: unknown;
  title?: unknown;
  week_number?: unknown;
  day?: unknown;
  started_at?: unknown;
  ended_at?: unknown;
  video_ids?: unknown[] | null;
  live?: { subtitle?: unknown } | null;
}

const TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/;

export function sessionFromRaw(id: number, raw: RawSession): SessionDetails {
  const time = (v: unknown) => (TIME.test(text(v)) ? text(v) : null);
  const day = intOrNull(raw.day);
  return {
    id,
    title: textOrNull(raw.title),
    week: intOrNull(raw.week_number),
    day: day !== null && day >= 1 && day <= 7 ? day : null,
    startedAt: time(raw.started_at),
    endedAt: time(raw.ended_at),
    room: textOrNull(raw.live?.subtitle),
    recorded: Array.isArray(raw.video_ids) && raw.video_ids.length > 0,
  };
}

const notConfigured: Failure = { error: 'yanhekt-not-configured', message: 'Yanhekt details are not configured on this deployment' };
const unavailable: Failure = { error: 'yanhekt-unavailable', message: 'Yanhekt did not answer; try again later' };
const notIndexed = (id: number): Failure => ({ error: 'not-found', message: `no course ${id} in the index` });

/** `GET /api/courses/{id}/yanhekt`. */
export async function courseDetails(env: Env, id: number): Promise<CourseDetails | Failure> {
  if (!env.WEB) return notConfigured;
  if (!(await courseSessions(env.YANHEKT_DB, id))) return notIndexed(id);
  const read = await readYanhekt<RawCourse>(env.WEB, `/v1/course?id=${id}`);
  if (!read.ok) return read.gone ? { error: 'not-found', message: `Yanhekt has no course ${id}` } : unavailable;
  return courseFromRaw(id, read.data);
}

/** `GET /api/courses/{id}/yanhekt/sessions?from=`: up to SESSION_BATCH sessions, in the Index's order. */
export async function sessionDetails(env: Env, id: number, from: number): Promise<SessionsPage | Failure> {
  const web = env.WEB;
  if (!web) return notConfigured;
  const listed = await courseSessions(env.YANHEKT_DB, id);
  if (!listed) return notIndexed(id);
  const ids = listed.sessions.slice(from, from + SESSION_BATCH);
  const out: Array<SessionDetails | SessionMissing> = new Array(ids.length);
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const i = next++;
      const sid = ids[i];
      const read = await readYanhekt<RawSession>(web, `/v1/course/session?session_id=${sid}&with_video=true`);
      if (read.ok && text(read.data.course_id) === String(id)) out[i] = sessionFromRaw(sid, read.data);
      else out[i] = { id: sid, error: read.ok || read.gone ? 'gone' : 'unavailable' };
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));
  // Every read failing is an outage, not a page of "unavailable" rows.
  if (ids.length > 0 && out.every((s) => 'error' in s && s.error === 'unavailable')) return unavailable;
  const end = from + ids.length;
  return { course: id, total: listed.sessions.length, from, next: end < listed.sessions.length ? end : null, sessions: out };
}

export function isFailure(v: object): v is Failure {
  return 'error' in v && 'message' in v;
}

export function failureStatus(f: Failure): number {
  return f.error === 'not-found' ? 404 : f.error === 'yanhekt-not-configured' ? 503 : 502;
}

/** True when a page holds a session that failed to load and is worth asking for again. */
export function hasUnavailable(page: SessionsPage): boolean {
  return page.sessions.some((s) => 'error' in s && s.error === 'unavailable');
}
