import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addCourse, testDb, type TestDb } from '../api/testDb';
import { fetchLectureMeta } from './yanhekt';

const EXPIRED = { code: 12121028, message: '课程已过期', data: [] };
let db: TestDb;

beforeEach(() => {
  db = testDb();
  addCourse(db, { id: 22222, name: '复变函数', year: '2024-2025', semester: 2, teachers: [['张三', '教授']], sessions: [200105, 200201, 200990] });
  // Yanhekt refuses both reads for an earlier term's lecture.
  vi.stubGlobal('fetch', async () => Response.json(EXPIRED));
});
afterEach(() => vi.unstubAllGlobals());

describe('fetchLectureMeta for an expired course', () => {
  it('reads the course and labels the session by its position in one Index read', async () => {
    expect(await fetchLectureMeta('22222', '200201', db)).toMatchObject({
      courseId: '22222',
      sessionId: '200201',
      courseTitle: '复变函数',
      sessionTitle: '第2次课',
      instructor: '张三',
      professors: ['张三'],
      schoolYear: '2024-2025',
      semester: '2',
    });
    expect(db.log).toHaveLength(1);
  });

  it('does not number a course-only share or an unindexed session', async () => {
    for (const sessionId of [undefined, '200202']) {
      expect(await fetchLectureMeta('22222', sessionId, db)).toMatchObject({
        courseTitle: '复变函数',
        sessionTitle: '',
      });
    }
  });

  it('keeps the Yanhekt session title even when the course falls back to the Index', async () => {
    vi.stubGlobal('fetch', async (url: string) => Response.json(
      new URL(url).pathname === '/v1/course/session' ? { code: 0, data: { title: '解析函数' } } : EXPIRED,
    ));
    expect(await fetchLectureMeta('22222', '200201', db)).toMatchObject({
      courseTitle: '复变函数',
      sessionTitle: '解析函数',
    });
  });

  it('is null for a course the Index lacks, or without the database', async () => {
    expect(await fetchLectureMeta('33333', '1', db)).toBeNull();
    expect(await fetchLectureMeta('22222', '200201')).toBeNull();
  });
});
