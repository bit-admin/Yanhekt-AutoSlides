import { describe, expect, it } from 'vitest';
import type { CourseData, SessionData } from '@common/apiTypes';
import { pickTwinCourse, pickTwinSession, yanhektStartSeconds } from './yanhe2Twin';

const course = (id: string, number: unknown): CourseData => ({
  id,
  number: number as string,
  name_zh: '泛函分析',
  professors: [],
  classrooms: [],
  school_year: '2026-2027',
  semester: '1',
  college_name: '',
  participant_count: 0,
});

const session = (id: string, startedAt: string): SessionData => ({
  id: '',
  session_id: id,
  video_id: '',
  title: '第4周 星期一 第1大节',
  duration: 0,
  week_number: 4,
  day: 1,
  started_at: startedAt,
  ended_at: '',
});

describe('yanhektStartSeconds', () => {
  it('reads the wall clock as Beijing time', () => {
    // The pair recorded in the notes: Yanhekt 2026-09-21 08:00 = Yanhe 2.0 class_begin 1789948800.
    expect(yanhektStartSeconds('2026-09-21 08:00:00')).toBe(1789948800);
    expect(yanhektStartSeconds('2026-09-21 15:15:00')).toBe(1789974900);
  });

  it('crosses midnight UTC', () => {
    expect(yanhektStartSeconds('2026-09-21 00:30:00')).toBe(1789948800 - 7.5 * 3600);
  });

  it('refuses other shapes', () => {
    expect(yanhektStartSeconds('')).toBeNull();
    expect(yanhektStartSeconds('1789948800')).toBeNull();
    expect(yanhektStartSeconds(1789948800)).toBeNull();
  });
});

describe('pickTwinCourse', () => {
  it('takes the row with exactly that number', () => {
    // A course-code keyword answers with every term's offering.
    const rows = [course('62313', '20252026110017113901'), course('74119', '20262027110017113901')];
    expect(pickTwinCourse(rows, '20262027110017113901')?.id).toBe('74119');
  });

  it('compares whole strings, never numbers', () => {
    expect(pickTwinCourse([course('1', '20261-03-0300225-1782873783828')], '20261-03-0300225-1782873783828')?.id).toBe('1');
    expect(pickTwinCourse([course('1', '0017113901')], '17113901')).toBeNull();
    expect(pickTwinCourse([course('1', '202620271MHE1000112')], '202620271mhe1000112')).toBeNull();
  });

  it('has no answer for none, two, or no key', () => {
    expect(pickTwinCourse([], '20262027110017113901')).toBeNull();
    expect(pickTwinCourse([course('1', 'x'), course('2', 'x')], 'x')).toBeNull();
    expect(pickTwinCourse([course('1', undefined)], '')).toBeNull();
  });
});

describe('pickTwinSession', () => {
  const sessions = [session('901186', '2026-09-21 08:00:00'), session('901190', '2026-09-23 08:00:00')];

  it('takes the session that starts at that second', () => {
    expect(pickTwinSession(sessions, 1789948800)?.session_id).toBe('901186');
  });

  it('has no answer for a different time, two at once, or no time', () => {
    expect(pickTwinSession(sessions, 1789948800 + 60)).toBeNull();
    expect(pickTwinSession([...sessions, session('9', '2026-09-21 08:00:00')], 1789948800)).toBeNull();
    expect(pickTwinSession(sessions, 0)).toBeNull();
  });
});
