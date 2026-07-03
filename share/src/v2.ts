/**
 * AutoSlides Index — the /v2 API. Everything here is additive: v1 short links and
 * the v1 viewer are untouched. v2 adds a searchable metadata store (D1) fed by an
 * authenticated publish endpoint, plus cron-maintained homepage aggregates in KV.
 *
 * Write budget: D1 is written ONLY on publish (rare, human-initiated). The
 * homepage reads a single cron-built KV key (`stats:home`) and search/lecture
 * GETs are Cache-API wrapped, so ordinary browsing never hits D1.
 */

import { decodeSharePayload, type SharePayload } from '../../autoslides/src/shared/shareLink';
import type { SlideMetadataSource } from '../../autoslides/src/shared/slideMetadataTypes';
import {
  cached,
  ensureShortLink,
  json,
  sha256Hex,
  type Env,
  type ExecutionContext,
} from './lib/runtime';

const USER_ENDPOINT = 'https://cbiz.yanhekt.cn/v1/user';
const SEARCH_LIMIT = 30;
const RECENT_LIMIT = 12;

// Static client signature md5(VIDEO_MAGIC + '_v1_undefined') — mirrors the app's
// getClientSignature() (@common/crypto). It's a constant, and Workers can't run
// Node's md5 / Web Crypto has no MD5, so we hardcode the precomputed value.
const XCLIENT_SIGNATURE = '72b77856f6df3f563ab6e658631cac3d';

interface VerifiedUser {
  id: string;
  name: string;
}

/**
 * Verify a Yanhekt token by calling the real user endpoint with the same header
 * set the app uses (`apiClient.verifyToken`) — the Xclient signature headers are
 * required or the endpoint rejects the request. Returns the uploader's `badge`
 * (the id we record for later moderation) + nickname, or null when invalid.
 */
async function verifyUser(token: string): Promise<VerifiedUser | null> {
  try {
    const res = await fetch(USER_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json, text/plain, */*',
        Origin: 'https://www.yanhekt.cn',
        Referer: 'https://www.yanhekt.cn/',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.3',
        'Xdomain-Client': 'web_user',
        'xdomain-client': 'web_user',
        'Xclient-Version': 'v1',
        'Xclient-Signature': XCLIENT_SIGNATURE,
        'Xclient-Timestamp': Math.floor(Date.now() / 1000).toString(),
      },
    });
    if (!res.ok) {
      console.error('[publish] user endpoint HTTP', res.status);
      return null;
    }
    const body = (await res.json()) as { code?: unknown; data?: Record<string, unknown> };
    // Yanhekt wraps payloads as { code: 0, data: {...} }; tolerate string codes.
    if (body.code !== 0 && String(body.code) !== '0') {
      console.error('[publish] user endpoint code', body.code);
      return null;
    }
    const data = body.data ?? {};
    const id = data.badge;
    if (id === undefined || id === null || String(id).length === 0) {
      console.error('[publish] user payload missing badge');
      return null;
    }
    return { id: String(id), name: String(data.nickname ?? '') };
  } catch (err) {
    console.error('[publish] user verify threw', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Order-sensitive fingerprint of a payload's image-identity list. Same images in
 * the same order → same fingerprint (a duplicate); a reorder or any image change
 * → a new fingerprint (a new version). Override keys are sorted numerically so
 * the hash is stable across JSON round-trips.
 */
async function fingerprintPayload(payload: SharePayload): Promise<string> {
  const o = payload.o ?? {};
  const canonO = Object.keys(o)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => `${k}:${o[k]}`)
    .join(',');
  return sha256Hex(`${payload.p}|${payload.n}|${payload.h}|${canonO}`);
}

function imageCountOf(payload: SharePayload): number {
  return payload.n > 0 ? Math.round(payload.h.length / payload.n) : 0;
}

function indexUrlFor(origin: string, courseId: string, sessionId: string): string {
  return `${origin}/?l=${encodeURIComponent(courseId)}.${encodeURIComponent(sessionId)}`;
}

/** Lowercased haystack for LIKE search. */
function buildSearchText(s: SlideMetadataSource): string {
  return [
    s.courseTitle,
    s.sessionTitle,
    s.instructor,
    ...(s.professors ?? []),
    s.college,
    s.schoolYear,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

interface PublishBody {
  fragment?: unknown;
  source?: Partial<SlideMetadataSource>;
  review?: { reviewed?: unknown; edited?: unknown };
}

async function handlePublish(req: Request, env: Env, origin: string): Promise<Response> {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return json({ error: 'unauthorized' }, 401);

  const user = await verifyUser(token);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: PublishBody;
  try {
    body = (await req.json()) as PublishBody;
  } catch {
    return json({ error: 'bad-json' }, 400);
  }

  if (typeof body.fragment !== 'string' || body.fragment.length === 0) {
    return json({ error: 'missing-fragment' }, 400);
  }
  const payload = decodeSharePayload(body.fragment);
  if (!payload) return json({ error: 'invalid-payload' }, 400);

  const source = body.source ?? {};
  const courseId = source.courseId ? String(source.courseId) : '';
  const sessionId = source.sessionId ? String(source.sessionId) : '';
  if (!courseId || !sessionId) return json({ error: 'missing-ids' }, 400);

  const edited = body.review?.edited ? 1 : 0;
  // Editing implies reviewing — a human who edited necessarily looked.
  const reviewed = body.review?.reviewed || edited ? 1 : 0;

  const fingerprint = await fingerprintPayload(payload);
  const shareId = await ensureShortLink(env, body.fragment);
  const indexUrl = indexUrlFor(origin, courseId, sessionId);
  const db = env.INDEX_DB;

  const existing = await db
    .prepare('SELECT share_id FROM versions WHERE fingerprint = ?')
    .bind(fingerprint)
    .first<{ share_id: string }>();
  if (existing) {
    // Idempotent: identical slides in identical order — no D1 write.
    return json({ ok: true, duplicate: true, shareId, indexUrl });
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO versions
         (fingerprint, course_id, session_id, share_id, title, image_count,
          reviewed, edited, uploader_id, uploader_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      fingerprint,
      courseId,
      sessionId,
      shareId,
      payload.t ?? null,
      imageCountOf(payload),
      reviewed,
      edited,
      user.id,
      user.name,
      now,
    )
    .run();

  await db
    .prepare(
      `INSERT INTO lectures
         (course_id, session_id, course_title, session_title, instructor,
          professors, semester, school_year, college, week_number, day,
          search_text, version_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(course_id, session_id) DO UPDATE SET
         course_title  = excluded.course_title,
         session_title = excluded.session_title,
         instructor    = excluded.instructor,
         professors    = excluded.professors,
         semester      = excluded.semester,
         school_year   = excluded.school_year,
         college       = excluded.college,
         week_number   = excluded.week_number,
         day           = excluded.day,
         search_text   = excluded.search_text,
         version_count = version_count + 1,
         updated_at    = excluded.updated_at`,
    )
    .bind(
      courseId,
      sessionId,
      source.courseTitle ?? null,
      source.sessionTitle ?? null,
      source.instructor ?? null,
      source.professors ? JSON.stringify(source.professors) : null,
      source.semester ?? null,
      source.schoolYear ?? null,
      source.college ?? null,
      source.weekNumber ?? null,
      source.day ?? null,
      buildSearchText(source),
      now,
      now,
    )
    .run();

  return json({ ok: true, duplicate: false, shareId, indexUrl });
}

interface RemovalBody {
  courseId?: unknown;
  sessionId?: unknown;
}

/**
 * Uploader-initiated removal. Authenticates the requester with the same Yanhekt
 * token→badge logic as publish, then hard-deletes ONLY the versions of the given
 * lecture whose `uploader_id` matches the requester's badge — never anyone else's
 * versions. If that empties the lecture, the lecture row is deleted too so it
 * drops out of search/home.
 */
async function handleRemovalRequest(req: Request, env: Env): Promise<Response> {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return json({ error: 'unauthorized' }, 401);

  const user = await verifyUser(token);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: RemovalBody;
  try {
    body = (await req.json()) as RemovalBody;
  } catch {
    return json({ error: 'bad-json' }, 400);
  }
  const courseId = body.courseId ? String(body.courseId) : '';
  const sessionId = body.sessionId ? String(body.sessionId) : '';
  if (!courseId || !sessionId) return json({ error: 'missing-ids' }, 400);

  const db = env.INDEX_DB;
  // Count the requester's own versions first so we can report how many were removed.
  const owned = await db
    .prepare(
      'SELECT COUNT(*) AS n FROM versions WHERE course_id = ? AND session_id = ? AND uploader_id = ?',
    )
    .bind(courseId, sessionId, user.id)
    .first<{ n: number }>();
  const removed = owned?.n ?? 0;
  if (removed === 0) {
    // Nothing owned by this user here — no-op, but a clean 200 so the UI can say so.
    return json({ ok: true, removed: 0, lectureRemoved: false });
  }

  await db
    .prepare('DELETE FROM versions WHERE course_id = ? AND session_id = ? AND uploader_id = ?')
    .bind(courseId, sessionId, user.id)
    .run();

  // Reconcile the lecture's version_count; drop the lecture if now empty.
  const remaining = await db
    .prepare('SELECT COUNT(*) AS n FROM versions WHERE course_id = ? AND session_id = ?')
    .bind(courseId, sessionId)
    .first<{ n: number }>();
  const n = remaining?.n ?? 0;
  let lectureRemoved = false;
  if (n > 0) {
    await db
      .prepare('UPDATE lectures SET version_count = ?, updated_at = ? WHERE course_id = ? AND session_id = ?')
      .bind(n, new Date().toISOString(), courseId, sessionId)
      .run();
  } else {
    await db
      .prepare('DELETE FROM lectures WHERE course_id = ? AND session_id = ?')
      .bind(courseId, sessionId)
      .run();
    lectureRemoved = true;
  }

  return json({ ok: true, removed, lectureRemoved });
}

const LECTURE_COLS =
  'course_id, session_id, course_title, session_title, instructor, professors, ' +
  'semester, school_year, college, week_number, day, version_count, updated_at';

function rowToLecture(r: Record<string, unknown>): Record<string, unknown> {
  return {
    courseId: r.course_id,
    sessionId: r.session_id,
    courseTitle: r.course_title,
    sessionTitle: r.session_title,
    instructor: r.instructor,
    professors: r.professors ? safeParseArray(r.professors as string) : [],
    semester: r.semester,
    schoolYear: r.school_year,
    college: r.college,
    weekNumber: r.week_number,
    day: r.day,
    versionCount: r.version_count,
    updatedAt: r.updated_at,
  };
}

/** Maps a recent-versions join row to a homepage recent-file object. */
function rowToRecentFile(r: Record<string, unknown>): Record<string, unknown> {
  return {
    shareId: r.share_id,
    imageCount: r.image_count,
    createdAt: r.created_at,
    courseId: r.course_id,
    sessionId: r.session_id,
    courseTitle: r.course_title,
    sessionTitle: r.session_title,
    instructor: r.instructor,
    professors: r.professors ? safeParseArray(r.professors as string) : [],
    semester: r.semester,
    schoolYear: r.school_year,
    college: r.college,
  };
}

function safeParseArray(s: string): unknown[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

async function handleSearch(req: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
  return cached(req, ctx, 120, async () => {
    const raw = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    // Strip LIKE wildcards/escape chars so user input can't alter the pattern.
    const q = raw.replace(/[%_\\]/g, ' ').slice(0, 80).trim();
    const db = env.INDEX_DB;
    const rows = q
      ? await db
          .prepare(
            `SELECT ${LECTURE_COLS} FROM lectures
             WHERE search_text LIKE ? ORDER BY updated_at DESC LIMIT ?`,
          )
          .bind(`%${q}%`, SEARCH_LIMIT)
          .all()
      : await db
          .prepare(`SELECT ${LECTURE_COLS} FROM lectures ORDER BY updated_at DESC LIMIT ?`)
          .bind(SEARCH_LIMIT)
          .all();
    return json({ ok: true, query: q, results: rows.results.map(rowToLecture) });
  });
}

async function handleLecture(req: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
  return cached(req, ctx, 120, async () => {
    const courseId = url.searchParams.get('courseId') ?? '';
    const sessionId = url.searchParams.get('sessionId') ?? '';
    if (!courseId || !sessionId) return json({ error: 'missing-ids' }, 400);
    const db = env.INDEX_DB;
    const lecture = await db
      .prepare(`SELECT ${LECTURE_COLS} FROM lectures WHERE course_id = ? AND session_id = ?`)
      .bind(courseId, sessionId)
      .first();
    if (!lecture) return json({ error: 'not-found' }, 404);
    const versions = await db
      .prepare(
        `SELECT share_id, title, image_count, reviewed, edited, created_at
         FROM versions WHERE course_id = ? AND session_id = ?
         ORDER BY created_at ASC`,
      )
      .bind(courseId, sessionId)
      .all();
    // Uploader id/name are stored for moderation but deliberately NOT exposed to
    // the public frontend.
    return json({
      ok: true,
      lecture: rowToLecture(lecture),
      versions: versions.results.map((v) => ({
        shareId: v.share_id,
        title: v.title,
        imageCount: v.image_count,
        reviewed: !!v.reviewed,
        edited: !!v.edited,
        createdAt: v.created_at,
      })),
    });
  });
}

/** Recompute homepage aggregates and store the single `stats:home` KV blob. */
export async function refreshStats(env: Env): Promise<Record<string, unknown>> {
  const db = env.INDEX_DB;
  const counts = await db
    .prepare('SELECT COUNT(DISTINCT course_id) AS courses, COUNT(*) AS lectures FROM lectures')
    .first<{ courses: number; lectures: number }>();
  const vcount = await db
    .prepare('SELECT COUNT(*) AS versions FROM versions')
    .first<{ versions: number }>();
  // Recent FILES (versions), not lectures — each row opens directly at /v1/s/<shareId>.
  const recent = await db
    .prepare(
      `SELECT v.share_id, v.image_count, v.created_at,
              l.course_id, l.session_id, l.course_title, l.session_title, l.instructor,
              l.professors, l.semester, l.school_year, l.college
       FROM versions v
       JOIN lectures l ON l.course_id = v.course_id AND l.session_id = v.session_id
       ORDER BY v.created_at DESC LIMIT ?`,
    )
    .bind(RECENT_LIMIT)
    .all();
  const colleges = await db
    .prepare(
      `SELECT college, COUNT(*) AS n FROM lectures
       WHERE college IS NOT NULL AND college <> '' GROUP BY college ORDER BY n DESC LIMIT ?`,
    )
    .bind(RECENT_LIMIT)
    .all<{ college: string; n: number }>();
  const stats = {
    courseCount: counts?.courses ?? 0,
    lectureCount: counts?.lectures ?? 0,
    versionCount: vcount?.versions ?? 0,
    recent: recent.results.map(rowToRecentFile),
    colleges: colleges.results.map((c) => ({ college: c.college, count: c.n })),
    updatedAt: new Date().toISOString(),
  };
  await env.SHARE_KV.put('stats:home', JSON.stringify(stats));
  return stats;
}

async function handleStats(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  return cached(req, ctx, 300, async () => {
    const cachedStats = await env.SHARE_KV.get('stats:home');
    // Lazy first-run init: compute once if the cron hasn't populated it yet.
    const stats = cachedStats ? JSON.parse(cachedStats) : await refreshStats(env);
    return json({ ok: true, stats });
  });
}

/** Route every `/v2/api/*` request. Returns null for non-v2 paths. */
export async function routeV2(
  req: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  origin: string,
): Promise<Response | null> {
  const { pathname } = url;
  if (pathname === '/v2/api/publish' && req.method === 'POST') {
    return handlePublish(req, env, origin);
  }
  if (pathname === '/v2/api/request-removal' && req.method === 'POST') {
    return handleRemovalRequest(req, env);
  }
  if (pathname === '/v2/api/search' && req.method === 'GET') {
    return handleSearch(req, env, url, ctx);
  }
  if (pathname === '/v2/api/lecture' && req.method === 'GET') {
    return handleLecture(req, env, url, ctx);
  }
  if (pathname === '/v2/api/stats' && req.method === 'GET') {
    return handleStats(req, env, ctx);
  }
  return null;
}
