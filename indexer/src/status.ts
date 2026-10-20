/** `status` command and the end-of-run progress report. */

import type { LaneProgress } from './crawler.ts';
import type { SqliteStore } from './store.ts';
import { cnClock } from './time.ts';

/** One line per lane: where it is, how far through its range, and what to run to continue. */
export function laneLines(progress: LaneProgress[], nowMs: number): string[] {
  return progress.map(({ spec, state, runStartCursor }) => {
    const moved = Math.abs(state.cursor - runStartCursor);
    let where = `next id ${state.cursor}`;
    if (spec.end != null) {
      const total = Math.abs(spec.end - spec.start) + 1;
      const covered = Math.min(total, Math.abs(state.cursor - spec.start));
      const pct = ((covered / total) * 100).toFixed(1);
      const left = Math.max(0, total - covered);
      where += `, ${pct}% of ${spec.start}→${spec.end} (${left} ids left)`;
      if (!state.done && moved > 0) where += `, ≈${Math.ceil(left / moved)} more run(s) at this pace`;
    }
    if (state.done) where += ' — done';
    else if (state.parkedUntilMs != null && state.parkedUntilMs > nowMs) {
      where += ` — at the newest id, waiting until ${cnClock(state.parkedUntilMs)} UTC+8`;
    }
    return `${spec.key.padEnd(24)} ${where}; this run ${moved} ids`;
  });
}

export function printStatus(store: SqliteStore): void {
  const db = store.db;
  const t = store.totals();
  console.log('Totals');
  console.log(`  sessions  ${t.sessions}  (with video ids ${t.sessionsWithVideo}; ids ${t.minSessionId}–${t.maxSessionId})`);
  console.log(`  courses   ${t.courses}  (with detail ${t.coursesDetailed})`);
  console.log(`  videos    ${t.videos}  (queued ${t.videosQueued})`);

  console.log('\nLanes (saved positions)');
  const lanes = store.allLanes();
  if (Object.keys(lanes).length === 0) console.log('  (none yet)');
  for (const [key, l] of Object.entries(lanes)) {
    const parked = l.parkedUntilMs && l.parkedUntilMs > Date.now() ? `, waiting until ${cnClock(l.parkedUntilMs)} UTC+8` : '';
    console.log(`  ${key.padEnd(24)} next id ${l.cursor}${l.done ? ' (done)' : ''}${parked}`);
  }

  const terms = db
    .prepare(
      `SELECT c.school_year AS year, c.semester AS sem, COUNT(*) AS sessions,
              COUNT(DISTINCT s.course_id) AS courses, MIN(s.id) AS lo, MAX(s.id) AS hi
       FROM sessions s LEFT JOIN courses c ON c.id = s.course_id
       GROUP BY c.school_year, c.semester ORDER BY lo DESC`,
    )
    .all() as Array<{ year: string | null; sem: number | null; sessions: number; courses: number; lo: number; hi: number }>;
  console.log('\nCoverage by term');
  if (terms.length === 0) console.log('  (none yet)');
  for (const r of terms) {
    const label = r.year ? `${r.year} 第${r.sem === 2 ? '二' : r.sem === 1 ? '一' : String(r.sem)}学期` : '(unknown)';
    console.log(`  ${label.padEnd(20)} ${String(r.sessions).padStart(7)} sessions  ${String(r.courses).padStart(5)} courses  ids ${r.lo}–${r.hi}`);
  }

  const uploads = db.prepare("SELECT key, value FROM crawl_state WHERE key LIKE 'upload:%'").all() as Array<{ key: string; value: string }>;
  if (uploads.length > 0) {
    console.log('\nLast upload position (per D1 database and table)');
    for (const u of uploads) {
      const { t: at } = JSON.parse(u.value) as { t: number };
      console.log(`  ${u.key.split(':').slice(1).join(' / ')}: rows changed up to ${at ? cnClock(at) : '—'} UTC+8`);
    }
  }

  const runs = db.prepare('SELECT * FROM runs ORDER BY id DESC LIMIT 5').all() as Array<Record<string, number | string | null>>;
  console.log('\nRecent runs');
  if (runs.length === 0) console.log('  (none yet)');
  for (const r of runs) {
    const mins = r.ended_at ? Math.round((Number(r.ended_at) - Number(r.started_at)) / 60_000) : null;
    console.log(
      `  ${cnClock(Number(r.started_at))}  ${mins == null ? 'running/crashed' : `${mins} min`}  ${r.requests} req, ` +
        `${r.sessions_found} sessions, ${r.sessions_missing} missing, ${r.courses} courses, ${r.videos} videos — ${r.stop_reason ?? ''}`,
    );
  }
}
