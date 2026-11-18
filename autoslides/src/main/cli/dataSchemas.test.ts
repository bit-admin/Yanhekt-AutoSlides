import { describe, expect, it, vi } from 'vitest';

vi.mock('@main/infra/logger', () => ({
  createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }),
  setLoggerConsoleMode: () => {},
}));
import Ajv from 'ajv';
import type { CourseData, SessionData } from '@common/apiTypes';
import { courseJson, sessionRowJson } from './commands/course';
import { courseRowJson } from './commands/search';
import { COURSE_SCHEMA_TERMINAL, SEARCH_SCHEMA, SESSION_SCHEMA, TERMS_SCHEMA, WHOAMI_SCHEMA_TERMINAL } from './dataSchemas';
import { expectMatchesSchema, expectNotMatchesSchema } from './dataSchemas.testkit';
import { buildSchema } from './help';
import { APP_COMMANDS } from './app';

describe('command data schemas', () => {
  it('every app command publishes one that compiles', () => {
    const ajv = new Ajv({ strict: false });
    for (const [id, command] of Object.entries(APP_COMMANDS)) {
      expect(() => ajv.compile(command.dataSchema), id).not.toThrow();
    }
  });

  it('schema publishes them with a version', () => {
    const doc = buildSchema(APP_COMMANDS as never, 'autoslides', '5.2.3', 'app');
    expect(doc.data_schema_version).toBe(1);
    expect(doc.commands.every((c) => typeof c.data_schema === 'object')).toBe(true);
  });

  it('match the rows the commands build', () => {
    const course = { id: 70101, name_zh: '课程', name_en: 'Course', professors: ['示例教师'], college_name: '', school_year: '2026', semester: '1', classrooms: [{ name: '示例教室' }], participant_count: 12 } as unknown as CourseData;
    const session = { session_id: 850101, title: '第1讲', week_number: 1, day: 2, started_at: '2026-09-01 08:00:00', ended_at: '', duration: 0, vga_url: 'x', main_url: '' } as unknown as SessionData;
    expectMatchesSchema(SEARCH_SCHEMA, { keyword: '课程', term: null, source: 'yanhekt', page: 1, last_page: 1, total: 1, courses: [courseRowJson(course)] });
    const detail = courseJson({ course_id: 70101, title: '课程', title_en: '', professors: [], college_name: '', school_year: '2026', semester: '1' } as never);
    expectMatchesSchema(COURSE_SCHEMA_TERMINAL, { course: detail, sessions: [sessionRowJson(session)], auth: null });
    expectMatchesSchema(COURSE_SCHEMA_TERMINAL, { course: detail, sessions: null, auth: { source: 'env', account: null }, note: 'n' });
    expectMatchesSchema(SESSION_SCHEMA, {
      session: { ...sessionRowJson(session), mic: false },
      course: { id: '70101', title: '课程', title_en: null, college: null, term: '2026-2027-1' },
    });
    expectMatchesSchema(TERMS_SCHEMA, { terms: [{ id: '42', term: '2026-2027-1', label: '2026-2027 第一学期', label_en: 'Autumn 2026', current: true }] });
  });

  it('catch a wrong type or a missing field', () => {
    expectNotMatchesSchema(WHOAMI_SCHEMA_TERMINAL, { source: 'flag', account: null });
    expectNotMatchesSchema(WHOAMI_SCHEMA_TERMINAL, { source: 'somewhere', account: null, badge: null });
    expectNotMatchesSchema(SEARCH_SCHEMA, { keyword: 'x', term: null, source: 'yanhekt', page: '1', last_page: 1, total: 0, courses: [] });
  });

  it('allow a field added later', () => {
    expectMatchesSchema(WHOAMI_SCHEMA_TERMINAL, { source: 'env', account: null, badge: null, added_later: 1 });
  });
});
