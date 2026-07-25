import { describe, it, expect } from 'vitest';
import { sanitizeFileName } from './sanitizeFileName';
import { sanitizeDownloadName } from '../renderer/shared/services/downloadNaming';
import { buildDownloadFileName } from '../renderer/shared/services/downloadNaming';
import {
  buildLectureIdSuffix,
  buildLectureStem,
  buildSlideFolderName,
  extractCourseName,
  extractSessionLabel,
  formatLectureDisplayName,
  lectureLabel,
  parseLectureIds,
  parseSessionInfo,
  parseSessionTitle,
  stripLectureIds,
} from './lectureNaming';

const SESSION = '第1周 星期三 第2大节';

describe('buildLectureIdSuffix', () => {
  it('emits both ids when both are numeric', () => {
    expect(buildLectureIdSuffix({ courseId: '12345', sessionId: '67890' })).toBe('__c12345s67890');
  });

  it('accepts numbers as well as strings (the API sends both)', () => {
    expect(buildLectureIdSuffix({ courseId: 12345, sessionId: 67890 })).toBe('__c12345s67890');
  });

  it('emits the course id alone when there is no session', () => {
    expect(buildLectureIdSuffix({ courseId: '98765' })).toBe('__c98765');
  });

  it('emits nothing without a course id — a session id alone cannot identify a lecture', () => {
    expect(buildLectureIdSuffix({ sessionId: '67890' })).toBe('');
    expect(buildLectureIdSuffix({})).toBe('');
  });

  it('degrades to no suffix for non-numeric ids rather than emitting something unparseable', () => {
    expect(buildLectureIdSuffix({ courseId: 'unknown', sessionId: '1' })).toBe('');
    expect(buildLectureIdSuffix({ courseId: '123abc' })).toBe('');
    expect(buildLectureIdSuffix({ courseId: '' })).toBe('');
  });
});

describe('parse / strip round-trip', () => {
  it('recovers the ids it wrote', () => {
    const name = buildSlideFolderName(
      { courseTitle: '泛函分析', sessionTitle: SESSION },
      { courseId: '12345', sessionId: '67890' },
    );
    expect(name).toBe('slides_泛函分析_第1周_星期三_第2大节__c12345s67890');
    expect(parseLectureIds(name)).toEqual({ courseId: '12345', sessionId: '67890' });
    expect(stripLectureIds(name)).toBe('slides_泛函分析_第1周_星期三_第2大节');
    expect(formatLectureDisplayName(name)).toBe('泛函分析_第1周_星期三_第2大节');
  });

  it('reports no ids for a legacy (<= v4.4.1) title-only name', () => {
    const legacy = 'slides_泛函分析_第1周_星期三_第2大节';
    expect(parseLectureIds(legacy)).toEqual({});
    expect(stripLectureIds(legacy)).toBe(legacy);
    expect(formatLectureDisplayName(legacy)).toBe('泛函分析_第1周_星期三_第2大节');
  });

  it('leaves sessionId undefined for a course-only suffix', () => {
    expect(parseLectureIds('slides_x__c98765'))
      .toEqual({ courseId: '98765', sessionId: undefined, liveId: undefined });
  });
});

// A live row's `id` is one BROADCAST, not a course; the real course id is
// `session.course_id`. A live folder carries both, so broadcasts of one course
// group together while each broadcast stays a distinct folder.
//
// Values below are real: live 761952 / 761951 are two broadcasts of course
// 71736, and 71735 is a DIFFERENT course sharing the title 电工和电子技术BⅡ.
describe('live broadcasts carry course id + broadcast id', () => {
  it('emits course then live, in that order', () => {
    expect(buildLectureIdSuffix({ courseId: '71736', liveId: '761952' })).toBe('__c71736l761952');
  });

  it('falls back to the broadcast alone when no course id resolved', () => {
    expect(buildLectureIdSuffix({ liveId: '761952' })).toBe('__l761952');
  });

  it('never writes a broadcast id into the course slot', () => {
    const name = buildSlideFolderName(
      { courseTitle: '电工和电子技术BⅡ', sectionGroupTitle: '第21周 星期日 第2大节' },
      { courseId: '71736', liveId: '761952' },
    );
    expect(parseLectureIds(name)).toEqual({
      courseId: '71736',
      sessionId: undefined,
      liveId: '761952',
    });
  });

  it('strips and displays like any other id block', () => {
    expect(formatLectureDisplayName('slides_泛函分析_2024秋季__c71736l761952'))
      .toBe('泛函分析_2024秋季');
    expect(formatLectureDisplayName('slides_泛函分析_2024秋季__l761952'))
      .toBe('泛函分析_2024秋季');
  });

  it('keeps two broadcasts of ONE course in distinct folders', () => {
    const parts = { courseTitle: '电工和电子技术BⅡ', sectionGroupTitle: '第21周 星期日 第2大节' };
    const a = buildSlideFolderName(parts, { courseId: '71736', liveId: '761952' });
    const b = buildSlideFolderName(parts, { courseId: '71736', liveId: '761951' });
    expect(a).not.toBe(b);
    // ...but reporting the same course, so they group together.
    expect(parseLectureIds(a).courseId).toBe(parseLectureIds(b).courseId);
  });

  it('separates two same-titled courses broadcasting at once', () => {
    const parts = { courseTitle: '电工和电子技术BⅡ', sectionGroupTitle: '第21周 星期日 第2大节' };
    expect(parseLectureIds(buildSlideFolderName(parts, { courseId: '71736', liveId: '761952' })).courseId)
      .not.toBe(parseLectureIds(buildSlideFolderName(parts, { courseId: '71735', liveId: '761878' })).courseId);
  });

  it('drops a session id that has no course to belong to', () => {
    expect(buildLectureIdSuffix({ sessionId: '751843', liveId: '761952' })).toBe('__l761952');
  });

  it('emits nothing for a non-numeric broadcast id', () => {
    expect(buildLectureIdSuffix({ liveId: 'abc' })).toBe('');
  });

  it('never treats a bare `__` as an id block', () => {
    expect(parseLectureIds('slides_weird__')).toEqual({});
  });
});

// A live row has no session object, but section_group_title is the same string
// a recorded session uses as its title — so everything except the session id
// (which cannot exist until the lecture is published) is recoverable.
describe('parseSessionTitle recovers week/day for live', () => {
  it('parses the API spaced form', () => {
    expect(parseSessionTitle('第21周 星期日 第2大节'))
      .toEqual({ weekNumber: 21, day: 7, section: 2 });
  });

  it('parses the sanitized underscore form used in folder names', () => {
    expect(parseSessionTitle('第1周_星期三_第2大节'))
      .toEqual({ weekNumber: 1, day: 3, section: 2 });
  });

  it('agrees with the recorded API day numbering (星期五 → 5)', () => {
    expect(parseSessionTitle('第2周 星期五 第2大节')?.day).toBe(5);
  });

  it('returns null for anything that is not a session title', () => {
    for (const bad of ['', '   ', 'Lecture 9', '2024秋季', undefined, null]) {
      expect(parseSessionTitle(bad)).toBeNull();
    }
  });
});

// The whole scheme rests on `__` being impossible inside a sanitized title.
describe('the `__` delimiter is unforgeable', () => {
  const hostile = 'A__B  C___D';

  it('cannot survive sanitizeFileName', () => {
    expect(sanitizeFileName(hostile)).not.toContain('__');
  });

  it('cannot survive sanitizeDownloadName', () => {
    expect(sanitizeDownloadName(hostile)).not.toContain('__');
  });

  it('so a title that mimics an id block still parses as the title', () => {
    const name = buildSlideFolderName({ courseTitle: 'Fake__c1s2' }, {});
    expect(parseLectureIds(name)).toEqual({});
    expect(name).toBe('slides_Fake_c1s2');
  });
});

describe('buildLectureStem', () => {
  it('joins sanitized course and session titles', () => {
    expect(buildLectureStem({ courseTitle: '泛函分析', sessionTitle: SESSION }))
      .toBe('泛函分析_第1周_星期三_第2大节');
  });

  it('falls back to the section group title only when there is no session', () => {
    expect(buildLectureStem({ courseTitle: 'X', sectionGroupTitle: '2024春季' })).toBe('X_2024春季');
    expect(buildLectureStem({ courseTitle: 'X', sessionTitle: 'S', sectionGroupTitle: '2024春季' }))
      .toBe('X_S');
  });

  it('skips missing parts instead of interpolating "undefined"', () => {
    expect(buildLectureStem({})).toBe('');
    expect(buildSlideFolderName({}, {})).toBe('slides');
  });
});

describe('session-suffix parsing tolerates the id block', () => {
  const withIds = 'slides_泛函分析_第1周_星期三_第2大节__c12345s67890';

  it('parses an id-bearing name', () => {
    expect(parseSessionInfo(withIds)).toEqual({
      courseName: '泛函分析',
      week: 1,
      weekday: 3,
      session: 2,
    });
  });

  it('still parses the legacy title-only form', () => {
    expect(parseSessionInfo('slides_泛函分析_第1周_星期三_第2大节')?.courseName).toBe('泛函分析');
  });

  it('parses the English lecture form', () => {
    expect(parseSessionInfo('slides_Real Analysis - Lecture 11__c1s2')).toEqual({
      courseName: 'Real Analysis',
      week: 11,
      weekday: 0,
      session: 11,
    });
  });

  it('drives the PDF cover helpers without leaking ids', () => {
    expect(extractCourseName(withIds)).toBe('泛函分析');
    expect(extractSessionLabel(withIds)).toBe('第1周 星期三 第2大节');
  });

  it('returns null for a name with no session pattern', () => {
    expect(parseSessionInfo('slides_MyWebPage')).toBeNull();
  });
});

describe('lectureLabel', () => {
  it('joins titles without sanitizing (the download name is sanitized later)', () => {
    expect(lectureLabel('A/B Testing', '第1周 星期三 第2大节')).toBe('A/B Testing_第1周 星期三 第2大节');
  });

  it('skips missing parts rather than interpolating "undefined"', () => {
    expect(lectureLabel(undefined, 'S')).toBe('S');
    expect(lectureLabel(null, undefined)).toBe('');
  });
});

describe('buildDownloadFileName', () => {
  it('appends the id block after sanitizing, so `__` survives', () => {
    const name = buildDownloadFileName({
      name: `camera_${lectureLabel('泛函分析', SESSION)}`,
      courseId: '12345',
      sessionId: '67890',
    });
    expect(name).toBe('camera_泛函分析_第1周_星期三_第2大节__c12345s67890');
  });

  it('keeps sanitizeDownloadName semantics for path separators', () => {
    // sanitizeDownloadName maps `/` to `_`, unlike sanitizeFileName which drops it.
    expect(buildDownloadFileName({ name: 'camera_A/B', courseId: '1' })).toBe('camera_A_B__c1');
  });

  it('matches the legacy name exactly when no ids are available', () => {
    expect(buildDownloadFileName({ name: 'camera_X_Y' })).toBe(sanitizeDownloadName('camera_X_Y'));
  });
});

// The defect this refactor exists to fix.
describe('collision regression: two courses sharing a title', () => {
  const parts = { courseTitle: '高等数学', sessionTitle: SESSION };
  const a = { courseId: '1001', sessionId: '5001' };
  const b = { courseId: '2002', sessionId: '6002' };

  it('gives the two lectures distinct slide folders', () => {
    expect(buildSlideFolderName(parts, a)).not.toBe(buildSlideFolderName(parts, b));
  });

  it('gives the two lectures distinct .mp4 names', () => {
    const label = `camera_${lectureLabel(parts.courseTitle, parts.sessionTitle)}`;
    expect(buildDownloadFileName({ name: label, ...a }))
      .not.toBe(buildDownloadFileName({ name: label, ...b }));
  });

  it('but still reuses one folder when the same lecture is re-extracted', () => {
    expect(buildSlideFolderName(parts, a)).toBe(buildSlideFolderName(parts, { ...a }));
  });

  it('and both still render the same clean display name', () => {
    expect(formatLectureDisplayName(buildSlideFolderName(parts, a)))
      .toBe(formatLectureDisplayName(buildSlideFolderName(parts, b)));
  });
});
