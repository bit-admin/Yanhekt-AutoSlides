import { describe, expect, it } from 'vitest';
import { parseCourseDetail, parseCourseList } from './yanhe2Curriculum';

const listRow = (id: unknown, extra: Record<string, unknown> = {}) => ({
  Id: id,
  Title: '泛函分析',
  Teacher: 'teacher',
  Realname: 'teacher',
  TermName: '2026-2027-1',
  KkxyName: '数学与统计学院',
  information: '{"kcdm":"100171139","kkxn":"2026-2027","kkxq":"1","kcwybm":"20262027110017113901","zhiyuan_id":20668}',
  Teachers: [{ Username: '6120100001', Realname: 'teacher', IsSpeaker: '1' }],
  ...extra,
});

const listBody = (data: unknown, total: unknown = 1) => ({
  code: 1000,
  status: 200,
  message: '',
  params: { result: { data, total, page: 1, 'per-page': 50 }, t: null },
});

const sub = (id: string, begin: string, extra: Record<string, unknown> = {}) => ({
  id,
  sub_title: '2026-09-21第1-2节',
  class_begin: begin,
  class_over: String(Number(begin) + 5700),
  sub_status: '6',
  lecturer: '6120100001',
  lecturer_name: 'teacher',
  room_name: '良乡校区文萃楼-F102',
  ...extra,
});

const detailBody = (subList: unknown, extra: Record<string, unknown> = {}) => ({
  code: 0,
  msg: 'success',
  data: {
    id: '103690',
    title: '泛函分析',
    realname: 'teacher',
    kcwybm: '20262027110017113901',
    course_code: '0017113901',
    information: '{"kkxn":"2026-2027","kkxq":"1","kcwybm":"20262027110017113901"}',
    term_name: '2026-2027-1',
    kkxy_name: '数学与统计学院',
    sub_list: subList,
    ...extra,
  },
});

describe('parseCourseList', () => {
  it('reads PascalCase rows and stringifies the numeric id', () => {
    const parsed = parseCourseList(listBody([listRow(114922)], 1));
    expect(parsed).toEqual({
      rows: 1,
      total: 1,
      courses: [{
        courseId: '114922',
        title: '泛函分析',
        teacher: 'teacher',
        college: '数学与统计学院',
        term: '2026-2027-1',
        schoolYear: '2026-2027',
        semester: '1',
        courseCode: '20262027110017113901',
      }],
    });
  });

  it('falls back to the speaker and survives a broken information string', () => {
    const parsed = parseCourseList(listBody([listRow(7, { Teacher: '', Realname: '', information: '{oops' })]));
    expect(parsed?.courses[0]).toMatchObject({ teacher: 'teacher', schoolYear: '', semester: '', courseCode: '' });
  });

  it('skips rows without a usable id but still counts them for paging', () => {
    const parsed = parseCourseList(listBody([listRow(null), listRow('abc'), listRow(5)], 3));
    expect(parsed?.courses.map((c) => c.courseId)).toEqual(['5']);
    expect(parsed?.rows).toBe(3);
  });

  it('rejects the other envelope and a missing list', () => {
    expect(parseCourseList({ code: 0, data: [] })).toBeNull();
    expect(parseCourseList(listBody(undefined))).toBeNull();
    expect(parseCourseList(null)).toBeNull();
  });
});

describe('parseCourseDetail', () => {
  it('flattens year → month → week and sorts by start', () => {
    const detail = parseCourseDetail(detailBody({
      2026: {
        10: { 2: [sub('3', '1791158400')] },
        9: { 5: [sub('2', '1790553600')], 4: [sub('1', '1789948800')] },
      },
    }));
    expect(detail?.sessions.map((s) => s.subId)).toEqual(['1', '2', '3']);
    expect(detail?.sessions[0]).toEqual({
      courseId: '103690',
      subId: '1',
      title: '泛函分析',
      subTitle: '2026-09-21第1-2节',
      teacher: 'teacher',
      room: '良乡校区文萃楼-F102',
      college: '数学与统计学院',
      courseCode: '20262027110017113901',
      startAt: 1789948800,
      endAt: 1789954500,
      status: 'playable',
    });
  });

  it('uses kcwybm, not the shortened course_code', () => {
    expect(parseCourseDetail(detailBody([]))?.courseCode).toBe('20262027110017113901');
  });

  it('reads an empty sub_list as a course with no sessions', () => {
    const detail = parseCourseDetail(detailBody([]));
    expect(detail?.sessions).toEqual([]);
    expect(detail?.title).toBe('泛函分析');
    expect(parseCourseDetail(detailBody({}))?.sessions).toEqual([]);
    expect(parseCourseDetail(detailBody(undefined))?.sessions).toEqual([]);
  });

  it('maps the session lifecycle and keeps an unknown status', () => {
    const detail = parseCourseDetail(detailBody({ 2026: { 9: { 4: [
      sub('1', '100', { sub_status: '1' }),
      sub('2', '200', { sub_status: '2' }),
      sub('3', '300', { sub_status: '9', lecturer_name: '' }),
    ] } } }));
    expect(detail?.sessions.map((s) => s.status)).toEqual(['live', 'upcoming', 'unknown']);
    expect(detail?.sessions[2].teacher).toBe('teacher');
  });

  it('rejects a failed envelope', () => {
    expect(parseCourseDetail({ code: 1, msg: 'x', data: null })).toBeNull();
    expect(parseCourseDetail({ code: 0, data: { title: 'no id' } })).toBeNull();
  });
});
