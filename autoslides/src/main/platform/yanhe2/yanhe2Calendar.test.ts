import { describe, expect, it } from 'vitest';
import { fillScheduleDays, parseDayList, parseWeekSchedule } from './yanhe2Calendar';
import {
  beijingClock,
  beijingDate,
  isCalendarDate,
  lessonRange,
  periodNumber,
  shiftDate,
  timetablePeriodOf,
  toSearchTime,
  weekStartOf,
} from '@common/yanhe2Calendar';

const period = (id: number, name: string, list: unknown[]) => ({
  id,
  name,
  class_begin_time: '08:00:00',
  class_end_time: '09:35:00',
  list,
});

const row = (courseId: string, subId: string, startAt: string, extra: Record<string, unknown> = {}) => ({
  id: courseId,
  course_id: courseId,
  sub_id: subId,
  title: '泛函分析',
  sub_title: '2026-09-28第1-2节',
  lecturer: '6120100001',
  lecturer_name: 'teacher',
  room_name: '良乡校区文萃楼-F102',
  kkxy_name: '数学与统计学院',
  course_code: '20262027110017113901',
  start_at: startAt,
  end_at: '1790559300',
  sub_status: '2',
  status_label: '',
  ...extra,
});

describe('parseDayList', () => {
  it('keeps the page fields and drops the rest', () => {
    const day = parseDayList({ code: 0, total: 1, list: [period(46, '第一节', [row('103690', '1567406', '1790553600')])] });
    expect(day?.periods).toEqual([{
      id: 46,
      name: '第一节',
      beginTime: '08:00',
      endTime: '09:35',
      loaded: true,
      sessions: [{
        courseId: '103690',
        subId: '1567406',
        title: '泛函分析',
        subTitle: '2026-09-28第1-2节',
        teacher: 'teacher',
        room: '良乡校区文萃楼-F102',
        college: '数学与统计学院',
        courseCode: '20262027110017113901',
        startAt: 1790553600,
        endAt: 1790559300,
        status: 'upcoming',
      }],
    }]);
  });

  it('treats a whole-day answer as complete, empty periods included', () => {
    const day = parseDayList({
      code: 0,
      total: 1,
      list: [period(46, '第一节', [row('1', '10', '1790553600')]), period(50, '第二节', [])],
    });
    expect(day?.periods.map((p) => p.loaded)).toEqual([true, true]);
  });

  it('marks only the asked period as loaded', () => {
    const day = parseDayList({ code: 0, total: 0, list: [period(46, '第一节', []), period(50, '第二节', [])] }, 50);
    expect(day?.periods.map((p) => p.loaded)).toEqual([false, true]);
  });

  it('leaves empty periods to be asked when a whole-day answer was cut short', () => {
    const day = parseDayList({
      code: 0,
      total: 90,
      list: [period(46, '第一节', [row('1', '10', '1790553600')]), period(50, '第二节', [])],
    });
    expect(day?.periods.map((p) => p.loaded)).toEqual([true, false]);
  });

  it('maps session status and skips rows with no ids', () => {
    const day = parseDayList({
      code: 0,
      total: 3,
      list: [period(46, '第一节', [
        row('1', '10', '1790553700', { sub_status: '6' }),
        row('2', '11', '1790553600', { sub_status: '1' }),
        row('3', '', '1790553600'),
      ])],
    });
    expect(day?.periods[0].sessions.map((s) => [s.subId, s.status])).toEqual([['11', 'live'], ['10', 'playable']]);
  });

  it('rejects other envelopes', () => {
    expect(parseDayList({ code: -1, msg: '没有数据' })).toBeNull();
    expect(parseDayList({ success: true, result: { code: 200, list: [] } })).toBeNull();
    expect(parseDayList(null)).toBeNull();
  });
});

describe('parseWeekSchedule', () => {
  it('reads the session id from `id` and keeps free days', () => {
    const days = parseWeekSchedule({
      success: true,
      result: {
        code: 200,
        msg: '',
        list: [
          { day: '2026-09-29', course: [] },
          {
            day: '2026-09-28',
            course: [{
              id: '1569010',
              course_id: '104946',
              course_title: '智慧养老',
              status: '2',
              start_at: '1790579700',
              end_at: '1790588400',
              room_name: '良乡校区文萃楼-I205',
              lecturer_name: 'teacher',
            }],
          },
        ],
      },
    });
    expect(days?.map((d) => d.day)).toEqual(['2026-09-28', '2026-09-29']);
    expect(days?.[0].sessions[0]).toMatchObject({ subId: '1569010', courseId: '104946', title: '智慧养老', status: 'upcoming' });
    expect(days?.[1].sessions).toEqual([]);
  });

  it('reads an empty timetable as no days, not a failure', () => {
    expect(parseWeekSchedule({ success: true, result: { code: 400, msg: '课表为空' } })).toEqual([]);
  });

  it('fills the days the answer left out', () => {
    const monday = { day: '2026-10-05', sessions: [] };
    expect(fillScheduleDays([monday], '2026-10-04', '2026-10-06')).toEqual([
      { day: '2026-10-04', sessions: [] },
      monday,
      { day: '2026-10-06', sessions: [] },
    ]);
    expect(fillScheduleDays([], '2026-10-11', '2026-10-17')).toHaveLength(7);
  });

  it('rejects other envelopes', () => {
    expect(parseWeekSchedule({ code: 0, list: [] })).toBeNull();
    expect(parseWeekSchedule({ success: true, result: { code: 500 } })).toBeNull();
  });
});

describe('calendar dates', () => {
  it('validates real dates only', () => {
    expect(isCalendarDate('2026-09-28')).toBe(true);
    expect(isCalendarDate('2026-02-30')).toBe(false);
    expect(isCalendarDate('2026-9-28')).toBe(false);
    expect(isCalendarDate(20260928)).toBe(false);
  });

  it('drops zero padding for the day list', () => {
    expect(toSearchTime('2026-09-08')).toBe('2026-9-8');
  });

  it('steps days and finds the Monday that starts the week', () => {
    expect(shiftDate('2026-09-30', 1)).toBe('2026-10-01');
    expect(weekStartOf('2026-10-04')).toBe('2026-09-28');
    expect(weekStartOf('2026-10-05')).toBe('2026-10-05');
  });

  it('reads the clock and the date in Beijing', () => {
    expect(beijingClock(1790553600)).toBe('08:00');
    expect(beijingClock(0)).toBe('');
    // 2026-09-27 17:00 UTC is already the 28th in Beijing.
    expect(beijingDate(Date.UTC(2026, 8, 27, 17))).toBe('2026-09-28');
  });
});

describe('period and lesson names', () => {
  it('reads the number out of a period name', () => {
    expect(periodNumber('第一节')).toBe(1);
    expect(periodNumber('第五节')).toBe(5);
    expect(periodNumber('第十节')).toBe(10);
    expect(periodNumber('第十二节')).toBe(12);
    expect(periodNumber('第二十节')).toBe(20);
    expect(periodNumber('第3大节')).toBe(3);
    expect(periodNumber('午休')).toBeNull();
  });

  it('reads the lessons a session spans', () => {
    expect(lessonRange('2026-09-28第1-2节')).toEqual({ from: 1, to: 2 });
    expect(lessonRange('2026-09-28第8-10节')).toEqual({ from: 8, to: 10 });
    expect(lessonRange('第3节')).toEqual({ from: 3, to: 3 });
    expect(lessonRange('2026-09-28')).toBeNull();
  });
});

describe('timetablePeriodOf', () => {
  // 2026-09-28 08:00 +08 is 1790553600.
  const at = (clock: string) => 1790553600 + (Number(clock.slice(0, 2)) - 8) * 3600 + Number(clock.slice(3)) * 60;

  it('puts a session in the period it overlaps most', () => {
    expect(timetablePeriodOf(at('08:00'), at('09:35'))).toBe(1);
    expect(timetablePeriodOf(at('13:20'), at('14:55'))).toBe(3);
    expect(timetablePeriodOf(at('15:15'), at('17:40'))).toBe(4);
    expect(timetablePeriodOf(at('09:55'), at('12:20'))).toBe(2);
    // A session whose clock is a little off still lands in its period.
    expect(timetablePeriodOf(at('09:50'), at('12:15'))).toBe(2);
    expect(timetablePeriodOf(at('12:50'), at('15:00'))).toBe(3);
  });

  it('has no row for a session outside every period', () => {
    expect(timetablePeriodOf(at('21:10'), at('22:00'))).toBeNull();
    expect(timetablePeriodOf(at('12:20'), at('13:10'))).toBeNull();
    expect(timetablePeriodOf(0, 0)).toBeNull();
  });

  it('places a session with no end by its start', () => {
    expect(timetablePeriodOf(at('18:30'), 0)).toBe(5);
  });
});
