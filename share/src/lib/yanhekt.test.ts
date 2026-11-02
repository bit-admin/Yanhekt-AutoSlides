import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addCourse, testDb, type TestDb } from '../api/testDb';
import { fetchLectureMeta } from './yanhekt';

const EXPIRED = { code: 12121028, message: '课程已过期', data: [] };
let db: TestDb;

beforeEach(() => {
  db = testDb();
  addCourse(db, { id: 22222, name: '复变函数', year: '2024-2025', semester: 2, teachers: [['张三', '教授']], sessions: [200201] });
  // Yanhekt refuses both reads for an earlier term's lecture.
  vi.stubGlobal('fetch', async () => Response.json(EXPIRED));
});
afterEach(() => vi.unstubAllGlobals());

describe('fetchLectureMeta for an expired course', () => {
  it('names the course from the Index when Yanhekt refuses it', async () => {
    expect(await fetchLectureMeta('22222', '200201', db as never)).toMatchObject({
      courseId: '22222',
      sessionId: '200201',
      courseTitle: '复变函数',
      sessionTitle: '',
      instructor: '张三',
      professors: ['张三'],
      schoolYear: '2024-2025',
      semester: '2',
    });
    expect(await fetchLectureMeta('22222', undefined, db as never)).toMatchObject({ courseTitle: '复变函数' });
  });

  it('is null for a course the Index lacks, or without the database', async () => {
    expect(await fetchLectureMeta('33333', '1', db as never)).toBeNull();
    expect(await fetchLectureMeta('22222', '200201')).toBeNull();
  });
});
