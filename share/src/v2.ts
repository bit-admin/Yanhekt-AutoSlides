/**
 * AutoSlides Index — the /v2 API.
 *
 * D1 stores only (course_id, session_id) + versions. Names come from Yanhekt
 * (anonymous GETs) at read time. Search is Yanhekt-first: keyword + semester
 * hit /v2/course/list, then we join our published sessions.
 *
 * Write budget: D1 is written ONLY on publish. Homepage reads cron-built
 * `stats:home` in KV (counts, recent, colleges, Yanhekt semester list).
 * Search/lecture GETs are Cache-API wrapped.
 */

import { decodeSharePayload, payloadHasTimeline, type SharePayload } from '../../autoslides/src/shared/shareLink';
import {
  cached,
  ensureShortLink,
  json,
  sha256Hex,
  type Env,
  type ExecutionContext,
} from './lib/runtime';
import {
  fetchCourseList,
  fetchLectureMeta,
  fetchSemesters,
  type LectureMeta,
} from './lib/yanhekt';

const USER_ENDPOINT = 'https://cbiz.yanhekt.cn/v1/user';
const SEARCH_LIMIT = 30;
const RECENT_LIMIT = 12;
const XCLIENT_SIGNATURE = '72b77856f6df3f563ab6e658631cac3d';

interface VerifiedUser {
  id: string;
  name: string;
}

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

export function indexUrlFor(origin: string, courseId: string, sessionId: string): string {
  return `${origin}/?c=${encodeURIComponent(courseId)}&s=${encodeURIComponent(sessionId)}`;
}

function lectureFromMeta(
  meta: LectureMeta | null,
  courseId: string,
  sessionId: string,
  extra: { versionCount?: number; updatedAt?: string } = {},
): Record<string, unknown> {
  return {
    courseId,
    sessionId,
    courseTitle: meta?.courseTitle ?? '',
    sessionTitle: meta?.sessionTitle ?? '',
    instructor: meta?.instructor ?? '',
    professors: meta?.professors ?? [],
    semester: meta?.semester ?? '',
    schoolYear: meta?.schoolYear ?? '',
    college: meta?.college ?? '',
    weekNumber: meta?.weekNumber,
    day: meta?.day,
    versionCount: extra.versionCount,
    updatedAt: extra.updatedAt,
  };
}

async function hydratePair(courseId: string, sessionId: string): Promise<LectureMeta | null> {
  return fetchLectureMeta(courseId, sessionId);
}

interface PublishBody {
  fragment?: unknown;
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

  const courseId = payload.c ? String(payload.c) : '';
  const sessionId = payload.s ? String(payload.s) : '';
  if (!courseId || !sessionId) return json({ error: 'missing-ids' }, 400);

  const edited = body.review?.edited ? 1 : 0;
  const reviewed = body.review?.reviewed || edited ? 1 : 0;

  const fingerprint = await fingerprintPayload(payload);
  const shareId = await ensureShortLink(env, body.fragment);
  const indexUrl = indexUrlFor(origin, courseId, sessionId);
  const hasTimeline = payloadHasTimeline(payload) ? 1 : 0;
  const db = env.INDEX_DB;

  const existing = await db
    .prepare('SELECT share_id FROM versions WHERE fingerprint = ?')
    .bind(fingerprint)
    .first<{ share_id: string }>();
  if (existing) {
    // Same image identity: refresh the fragment, timeline flag, and publisher.
    // created_at and lectures.version_count stay put.
    await db
      .prepare(
        `UPDATE versions
            SET share_id = ?, has_timeline = ?, uploader_id = ?, uploader_name = ?,
                reviewed = ?, edited = ?
          WHERE fingerprint = ?`,
      )
      .bind(shareId, hasTimeline, user.id, user.name, reviewed, edited, fingerprint)
      .run();
    return json({ ok: true, duplicate: true, updated: true, shareId, indexUrl });
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO versions
         (fingerprint, course_id, session_id, share_id, image_count,
          reviewed, edited, has_timeline, uploader_id, uploader_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      fingerprint,
      courseId,
      sessionId,
      shareId,
      imageCountOf(payload),
      reviewed,
      edited,
      hasTimeline,
      user.id,
      user.name,
      now,
    )
    .run();

  await db
    .prepare(
      `INSERT INTO lectures
         (course_id, session_id, version_count, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?)
       ON CONFLICT(course_id, session_id) DO UPDATE SET
         version_count = version_count + 1,
         updated_at    = excluded.updated_at`,
    )
    .bind(courseId, sessionId, now, now)
    .run();

  return json({ ok: true, duplicate: false, shareId, indexUrl });
}

interface RemovalBody {
  courseId?: unknown;
  sessionId?: unknown;
}

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
  const owned = await db
    .prepare(
      'SELECT COUNT(*) AS n FROM versions WHERE course_id = ? AND session_id = ? AND uploader_id = ?',
    )
    .bind(courseId, sessionId, user.id)
    .first<{ n: number }>();
  const removed = owned?.n ?? 0;
  if (removed === 0) {
    return json({ ok: true, removed: 0, lectureRemoved: false });
  }

  await db
    .prepare('DELETE FROM versions WHERE course_id = ? AND session_id = ? AND uploader_id = ?')
    .bind(courseId, sessionId, user.id)
    .run();

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

const LECTURE_COLS = 'course_id, session_id, version_count, updated_at';

async function hydrateRows(
  rows: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  return Promise.all(
    rows.map(async (r) => {
      const courseId = String(r.course_id ?? '');
      const sessionId = String(r.session_id ?? '');
      const meta = await hydratePair(courseId, sessionId);
      return lectureFromMeta(meta, courseId, sessionId, {
        versionCount: Number(r.version_count ?? 0),
        updatedAt: String(r.updated_at ?? ''),
      });
    }),
  );
}

async function handleSearch(req: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
  return cached(req, ctx, 120, async () => {
    const q = (url.searchParams.get('q') ?? '').trim();
    // A numeric keyword is a Yanhekt course id — exact match, all semesters.
    const isCourseId = /^\d+$/.test(q);
    const semesterId = isCourseId ? '' : (url.searchParams.get('semesterId') ?? '').trim();
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
    const db = env.INDEX_DB;

    if (!q && !semesterId) {
      const rows = await db
        .prepare(`SELECT ${LECTURE_COLS} FROM lectures ORDER BY updated_at DESC LIMIT ?`)
        .bind(SEARCH_LIMIT)
        .all();
      return json({ ok: true, query: q, results: await hydrateRows(rows.results) });
    }

    const list = await fetchCourseList({
      keyword: q,
      semesterId: semesterId || undefined,
      page,
      pageSize: 32,
    });
    const courses = list?.data ?? [];
    const courseIds = [...new Set(courses.map((c) => String(c.id ?? '')).filter(Boolean))];
    if (courseIds.length === 0) {
      return json({ ok: true, query: q, results: [] });
    }

    const placeholders = courseIds.map(() => '?').join(',');
    const rows = await db
      .prepare(
        `SELECT ${LECTURE_COLS} FROM lectures
         WHERE course_id IN (${placeholders})
         ORDER BY updated_at DESC LIMIT ?`,
      )
      .bind(...courseIds, SEARCH_LIMIT)
      .all();
    return json({ ok: true, query: q, results: await hydrateRows(rows.results) });
  });
}

async function handleLecture(req: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
  return cached(req, ctx, 120, async () => {
    const courseId = url.searchParams.get('courseId') ?? url.searchParams.get('c') ?? '';
    const sessionId = url.searchParams.get('sessionId') ?? url.searchParams.get('s') ?? '';
    if (!courseId || !sessionId) return json({ error: 'missing-ids' }, 400);
    const db = env.INDEX_DB;
    const lecture = await db
      .prepare(`SELECT ${LECTURE_COLS} FROM lectures WHERE course_id = ? AND session_id = ?`)
      .bind(courseId, sessionId)
      .first();
    if (!lecture) return json({ error: 'not-found' }, 404);
    const versions = await db
      .prepare(
        `SELECT share_id, image_count, reviewed, edited, has_timeline, created_at
         FROM versions WHERE course_id = ? AND session_id = ?
         ORDER BY created_at ASC`,
      )
      .bind(courseId, sessionId)
      .all();
    const meta = await hydratePair(courseId, sessionId);
    return json({
      ok: true,
      lecture: lectureFromMeta(meta, courseId, sessionId, {
        versionCount: Number(lecture.version_count ?? 0),
        updatedAt: String(lecture.updated_at ?? ''),
      }),
      versions: versions.results.map((v) => ({
        shareId: v.share_id,
        imageCount: v.image_count,
        reviewed: !!v.reviewed,
        edited: !!v.edited,
        hasTimeline: !!v.has_timeline,
        createdAt: v.created_at,
      })),
    });
  });
}

export async function refreshStats(env: Env): Promise<Record<string, unknown>> {
  const db = env.INDEX_DB;
  const [counts, vcount, recent, semesters] = await Promise.all([
    db
      .prepare('SELECT COUNT(DISTINCT course_id) AS courses, COUNT(*) AS lectures FROM lectures')
      .first<{ courses: number; lectures: number }>(),
    db.prepare('SELECT COUNT(*) AS versions FROM versions').first<{ versions: number }>(),
    db
      .prepare(
        `SELECT v.share_id, v.image_count, v.created_at, v.course_id, v.session_id
         FROM versions v
         ORDER BY v.created_at DESC LIMIT ?`,
      )
      .bind(RECENT_LIMIT)
      .all(),
    fetchSemesters(),
  ]);

  const recentFiles = await Promise.all(
    recent.results.map(async (r) => {
      const courseId = String(r.course_id ?? '');
      const sessionId = String(r.session_id ?? '');
      const meta = await hydratePair(courseId, sessionId);
      return {
        shareId: r.share_id,
        imageCount: r.image_count,
        createdAt: r.created_at,
        courseId,
        sessionId,
        courseTitle: meta?.courseTitle ?? '',
        sessionTitle: meta?.sessionTitle ?? '',
        instructor: meta?.instructor ?? '',
        professors: meta?.professors ?? [],
        semester: meta?.semester ?? '',
        schoolYear: meta?.schoolYear ?? '',
        college: meta?.college ?? '',
      };
    }),
  );

  const collegeMap = new Map<string, number>();
  for (const f of recentFiles) {
    if (f.college) collegeMap.set(f.college, (collegeMap.get(f.college) ?? 0) + 1);
  }

  const stats = {
    courseCount: counts?.courses ?? 0,
    lectureCount: counts?.lectures ?? 0,
    versionCount: vcount?.versions ?? 0,
    recent: recentFiles,
    colleges: [...collegeMap.entries()]
      .map(([college, count]) => ({ college, count }))
      .sort((a, b) => b.count - a.count),
    semesters,
    updatedAt: new Date().toISOString(),
  };
  await env.SHARE_KV.put('stats:home', JSON.stringify(stats));
  return stats;
}

async function handleStats(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  return cached(req, ctx, 300, async () => {
    const cachedStats = await env.SHARE_KV.get('stats:home');
    const parsed = cachedStats
      ? (JSON.parse(cachedStats) as { semesters?: Array<{ labelEn?: string }> })
      : null;
    const hasEn =
      Array.isArray(parsed?.semesters) &&
      (parsed.semesters.length === 0 || typeof parsed.semesters[0]?.labelEn === 'string');
    // Rebuild when missing or pre-English semester blobs so the first GET after
    // deploy does not wait for the hourly cron.
    const stats = parsed && hasEn ? parsed : await refreshStats(env);
    return json({ ok: true, stats });
  });
}

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
