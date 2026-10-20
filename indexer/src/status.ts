/** `status` command: what is in the database and where the lanes are. */

import type { DatabaseSync } from 'node:sqlite';
import { cnClock } from './time.ts';

function one(db: DatabaseSync, sql: string): number {
  const row = db.prepare(sql).get() as Record<string, number> | undefined;
  return row ? Number(Object.values(row)[0] ?? 0) : 0;
}

export function printStatus(db: DatabaseSync): void {
  const lanes = db.prepare("SELECT value FROM crawl_state WHERE key = 'lanes'").get() as { value: string } | undefined;
  const state = lanes ? JSON.parse(lanes.value) : null;

  console.log('Totals');
  console.log(`  sessions        ${one(db, 'SELECT COUNT(*) FROM sessions')}` +
    `  (with video ${one(db, "SELECT COUNT(*) FROM sessions WHERE video_ids <> '[]'")},` +
    ` cancelled/no video ${one(db, "SELECT COUNT(*) FROM sessions WHERE video_ids = '[]'")},` +
    ` gone ${one(db, 'SELECT COUNT(*) FROM sessions WHERE gone_at IS NOT NULL')})`);
  console.log(`  courses         ${one(db, 'SELECT COUNT(*) FROM courses')}` +
    `  (detail ok ${one(db, "SELECT COUNT(*) FROM courses WHERE detail_status = 'ok'")},` +
    ` pending ${one(db, 'SELECT COUNT(*) FROM courses WHERE detail_status IS NULL')},` +
    ` missing/error ${one(db, "SELECT COUNT(*) FROM courses WHERE detail_status IN ('missing','error')")})`);
  console.log(`  videos          ${one(db, "SELECT COUNT(*) FROM videos WHERE status = 'ok'")}` +
    `  (missing ${one(db, "SELECT COUNT(*) FROM videos WHERE status = 'missing'")},` +
    ` queued ${one(db, 'SELECT COUNT(*) FROM pending_videos')})`);
  console.log(`  lives           ${one(db, 'SELECT COUNT(*) FROM lives')}`);
  console.log(`  failures        ${one(db, 'SELECT COUNT(*) FROM failures')}   skipped gaps ${one(db, 'SELECT COUNT(*) FROM gaps')}`);

  console.log('\nLanes');
  if (!state) console.log('  (not started)');
  else {
    const f = state.forward;
    const b = state.backfill;
    const parked = f.parkedUntilMs && f.parkedUntilMs > Date.now() ? `, parked until ${cnClock(f.parkedUntilMs)} UTC+8` : '';
    console.log(`  forward   next id ${f.cursor}${parked}${f.missRun ? `, ${f.missRun} misses in a row` : ''}`);
    console.log(`  backfill  next id ${b.cursor}${b.done ? ' (done)' : ''}${b.missRun ? `, ${b.missRun} misses in a row` : ''}`);
  }

  const terms = db
    .prepare(
      `SELECT c.school_year AS year, c.semester AS sem, COUNT(*) AS sessions,
              COUNT(DISTINCT s.course_id) AS courses, MIN(s.id) AS lo, MAX(s.id) AS hi
       FROM sessions s LEFT JOIN courses c ON c.id = s.course_id
       GROUP BY c.school_year, c.semester ORDER BY lo DESC`,
    )
    .all() as Array<{ year: string | null; sem: number | null; sessions: number; courses: number; lo: number; hi: number }>;
  console.log('\nCoverage by term (session ids seen)');
  if (terms.length === 0) console.log('  (none yet)');
  for (const t of terms) {
    const label = t.year ? `${t.year} 第${t.sem === 2 ? '二' : t.sem === 1 ? '一' : String(t.sem)}学期` : '(unknown)';
    console.log(`  ${label.padEnd(20)} ${String(t.sessions).padStart(7)} sessions  ${String(t.courses).padStart(5)} courses  ids ${t.lo}–${t.hi}`);
  }

  const runs = db
    .prepare('SELECT * FROM runs ORDER BY id DESC LIMIT 5')
    .all() as Array<Record<string, number | string | null>>;
  console.log('\nRecent runs');
  if (runs.length === 0) console.log('  (none yet)');
  for (const r of runs) {
    const start = cnClock(Number(r.started_at));
    const mins = r.ended_at ? Math.round((Number(r.ended_at) - Number(r.started_at)) / 60_000) : null;
    console.log(
      `  ${start}  ${mins == null ? 'running/crashed' : `${mins} min`}  ${r.requests} req, ` +
        `${r.sessions_found} sessions, ${r.sessions_missing} missing, ${r.videos} videos, ${r.courses} courses — ${r.stop_reason ?? ''}`,
    );
  }
}
