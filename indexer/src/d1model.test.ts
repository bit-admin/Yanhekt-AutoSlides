import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { courseStatements, D1_SCHEMA_SQL, dataVersionStatement, projectCourse, termKey } from './d1model.ts';

const localCourse = {
  id: 101,
  name_zh: '电路分析基础',
  name_en: ' Fundamentals of Circuits Analysis ',
  code: '199999999',
  number: '01S0120262027119999999901',
  school_year: '2026-2027',
  semester: 1,
  college_code: '213',
  college_name: '示例学院',
  type_name: '本科课程',
  image_url: ' ',
  professors: JSON.stringify([{ id: 1, name: '王一', title: '实验师', badge: 'B0000001' }, { id: 2, name: '李二', title: '' }]),
  professor_names: '王一、李二',
  tags: JSON.stringify([{ param: 'semesters', name: '2026-2027 第一学期' }]),
  detail_status: 'ok',
  first_seen_at: 1_760_000_000_000,
  detail_fetched_at: 1_760_000_500_000,
};

test('projectCourse keeps only what the Index serves', () => {
  const { row, grams, gone } = projectCourse(localCourse, { ids: [100002, 100003], gone: [100000] });
  assert.deepEqual(row, {
    id: 101,
    name: '电路分析基础',
    number: '01S0120262027119999999901',
    term: '2026-2027-1',
    teachers: '["王一","李二"]',
    session_ids: '[100002,100003]',
    detail: 1,
    fetched_at: 1_760_000_500,
  });
  assert.deepEqual(gone, [100000]);
  assert.ok(!JSON.stringify(row).includes('B0000001'), 'no staff numbers');
  assert.ok(!JSON.stringify(row).includes('Fundamentals'), 'no English name');
  assert.ok(grams.includes('电路') && grams.includes('王一') && grams.includes('n:01s0120262027119999999901'));
  assert.ok(!grams.includes('w:fundamentals'));
});

test('termKey', () => {
  assert.equal(termKey('2026-2027', '2'), '2026-2027-2');
  assert.equal(termKey('', 1), null);
});

test('statements: grams under the term (registrar code under any term); session ids merge across copies', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(D1_SCHEMA_SQL);
  for (const s of courseStatements(localCourse, { ids: [1, 3], gone: [] })) db.exec(s);

  const terms = db.prepare('SELECT DISTINCT term FROM course_grams ORDER BY term').all().map((r) => (r as { term: string }).term);
  assert.deepEqual(terms, ['', '2026-2027-1']);
  assert.equal((db.prepare("SELECT term FROM course_grams WHERE gram LIKE 'n:%'").get() as { term: string }).term, '');

  // Another device: a thinner, older copy that saw session 2 and knows 3 is gone.
  for (const s of courseStatements({ ...localCourse, detail_status: null, professors: null, professor_names: null }, { ids: [2], gone: [3] })) {
    db.exec(s);
  }
  const c = db.prepare('SELECT detail, teachers, session_ids FROM courses WHERE id = 101').get() as Record<string, unknown>;
  assert.deepEqual({ ...c }, { detail: 1, teachers: '["王一","李二"]', session_ids: '[1,2]' });

  db.exec(dataVersionStatement(42));
  assert.equal((db.prepare("SELECT value FROM meta WHERE key = 'data'").get() as { value: string }).value, '42');
});
