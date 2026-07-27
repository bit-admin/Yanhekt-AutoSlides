import { describe, it, expect } from 'vitest';
import {
  allocateUniqueFileName,
  buildDefaultRenameStem,
  buildLectureVideoFileName,
  buildYanhektIdTag,
  episodeIndexForSession,
  formatEpisodeToken,
  formatLectureVideoDisplayName,
  formatSemesterToken,
  parseLectureVideoName,
  withAscompTag,
} from './lectureVideoNaming';

describe('parseLectureVideoName — legacy downloads', () => {
  it('parses screen_…__c…s… names', () => {
    const name = 'screen_泛函分析_第1周_星期三_第2大节__c62313s751843.mp4';
    const parsed = parseLectureVideoName(name);
    expect(parsed.courseId).toBe('62313');
    expect(parsed.sessionId).toBe('751843');
    expect(parsed.videoType).toBe('screen');
    expect(parsed.recognised).toBe(true);
    expect(parsed.hasEmbyTags).toBe(false);
    expect(parsed.ext).toBe('.mp4');
  });

  it('parses camera prefix', () => {
    const parsed = parseLectureVideoName('camera_X__c1s2.mp4');
    expect(parsed.videoType).toBe('camera');
    expect(parsed.recognised).toBe(true);
  });

  it('marks title-only files unrecognised', () => {
    const parsed = parseLectureVideoName('random_recording.mp4');
    expect(parsed.recognised).toBe(false);
    expect(parsed.courseId).toBeUndefined();
  });

  it('does not recognise course-only suffix (needs session)', () => {
    const parsed = parseLectureVideoName('screen_foo__c123.mp4');
    expect(parsed.courseId).toBe('123');
    expect(parsed.sessionId).toBeUndefined();
    expect(parsed.recognised).toBe(false);
  });
});

describe('parseLectureVideoName — Emby tags', () => {
  it('parses yhid + vtype tags', () => {
    const name =
      '泛函分析 - S01E02 - 第1周 星期三 第2大节 [yhid=c62313s751843] [vtype=screen].mp4';
    const parsed = parseLectureVideoName(name);
    expect(parsed.courseId).toBe('62313');
    expect(parsed.sessionId).toBe('751843');
    expect(parsed.videoType).toBe('screen');
    expect(parsed.hasEmbyTags).toBe(true);
    expect(parsed.hasVtypeTag).toBe(true);
    expect(parsed.recognised).toBe(true);
  });

  it('display name strips tags and prefixes', () => {
    expect(
      formatLectureVideoDisplayName(
        '泛函分析 - S01E02 - 第1周 星期三 第2大节 [yhid=c62313s751843] [vtype=screen].mp4',
      ),
    ).toBe('泛函分析 - S01E02 - 第1周 星期三 第2大节');

    expect(
      formatLectureVideoDisplayName('screen_泛函分析_第1周_星期三_第2大节__c62313s751843.mp4'),
    ).toBe('泛函分析_第1周_星期三_第2大节');
  });
});

describe('buildLectureVideoFileName', () => {
  it('appends tags after a sanitised stem', () => {
    const name = buildLectureVideoFileName({
      stem: '泛函分析 - S01E02 - 第1周 星期三 第2大节',
      courseId: '62313',
      sessionId: '751843',
      videoType: 'screen',
    });
    expect(name).toBe(
      '泛函分析 - S01E02 - 第1周 星期三 第2大节 [yhid=c62313s751843] [vtype=screen].mp4',
    );
    expect(parseLectureVideoName(name).recognised).toBe(true);
  });

  it('strips illegal path characters from the stem', () => {
    const name = buildLectureVideoFileName({
      stem: 'A:B/C',
      courseId: 1,
      sessionId: 2,
      videoType: 'camera',
    });
    expect(name).toContain('[yhid=c1s2]');
    expect(name).toContain('[vtype=camera]');
    expect(name).not.toMatch(/[/:]/);
  });
});

describe('buildYanhektIdTag', () => {
  it('requires a course id for the session form', () => {
    expect(buildYanhektIdTag({ courseId: '1', sessionId: '2' })).toBe('[yhid=c1s2]');
    expect(buildYanhektIdTag({ sessionId: '2' })).toBe('');
  });
});

describe('ascomp compress tag', () => {
  it('parses [ascomp=…] and strips it from the display name', () => {
    const name =
      '泛函分析 - S01E01 - 第1周 [yhid=c1s2] [vtype=screen] [ascomp=tiny].mp4';
    const parsed = parseLectureVideoName(name);
    expect(parsed.compressPreset).toBe('tiny');
    expect(formatLectureVideoDisplayName(name)).toBe('泛函分析 - S01E01 - 第1周');
  });

  it('appends ascomp after vtype on build', () => {
    const name = buildLectureVideoFileName({
      stem: 'Course - S01E01',
      courseId: 1,
      sessionId: 2,
      videoType: 'screen',
      compressPreset: 'small',
    });
    expect(name).toBe(
      'Course - S01E01 [yhid=c1s2] [vtype=screen] [ascomp=small].mp4',
    );
  });

  it('withAscompTag sets or replaces the tag without touching ids', () => {
    const legacy = 'screen_foo__c1s2.mp4';
    expect(withAscompTag(legacy, 'tiny')).toBe('screen_foo__c1s2 [ascomp=tiny].mp4');

    const tagged =
      'Course [yhid=c1s2] [vtype=screen] [ascomp=tiny].mp4';
    expect(withAscompTag(tagged, 'readable')).toBe(
      'Course [yhid=c1s2] [vtype=screen] [ascomp=readable].mp4',
    );
  });

  it('legacy __c…s… stays recognised after [ascomp=…] is appended', () => {
    const name = withAscompTag(
      'screen_泛函分析_第1周_星期三_第2大节__c62313s751843.mp4',
      'tiny',
    );
    expect(name).toBe(
      'screen_泛函分析_第1周_星期三_第2大节__c62313s751843 [ascomp=tiny].mp4',
    );
    const parsed = parseLectureVideoName(name);
    expect(parsed.recognised).toBe(true);
    expect(parsed.courseId).toBe('62313');
    expect(parsed.sessionId).toBe('751843');
    expect(parsed.videoType).toBe('screen');
    expect(parsed.compressPreset).toBe('tiny');
  });
});

describe('episodeIndexForSession', () => {
  const sessions = [
    { session_id: '30', week_number: 2, day: 1, started_at: '2024-09-09 08:00:00' },
    { session_id: '10', week_number: 1, day: 3, started_at: '2024-09-04 10:00:00' },
    { session_id: '20', week_number: 1, day: 1, started_at: '2024-09-02 08:00:00' },
  ];

  it('orders by week, day, started_at — not input array order', () => {
    // week1 Mon (20) → E01, week1 Wed (10) → E02, week2 Mon (30) → E03
    expect(episodeIndexForSession(sessions, '20')).toBe(1);
    expect(episodeIndexForSession(sessions, '10')).toBe(2);
    expect(episodeIndexForSession(sessions, '30')).toBe(3);
  });

  it('returns null for unknown session', () => {
    expect(episodeIndexForSession(sessions, '999')).toBeNull();
  });
});

describe('formatSemesterToken / formatEpisodeToken', () => {
  it('pads to two digits', () => {
    expect(formatSemesterToken(1)).toBe('S01');
    expect(formatSemesterToken('2')).toBe('S02');
    expect(formatSemesterToken(null)).toBe('');
    expect(formatEpisodeToken(5)).toBe('E05');
    expect(formatEpisodeToken(null)).toBe('');
  });
});

describe('buildDefaultRenameStem', () => {
  it('builds Course - SxxExx - Session', () => {
    expect(
      buildDefaultRenameStem({
        courseTitle: '泛函分析',
        sessionTitle: '第1周 星期三 第2大节',
        semester: 1,
        episode: 2,
      }),
    ).toBe('泛函分析 - S01E02 - 第1周 星期三 第2大节');
  });

  it('omits S/E when unknown rather than inventing week-based values', () => {
    expect(
      buildDefaultRenameStem({
        courseTitle: '泛函分析',
        sessionTitle: '第1周 星期三 第2大节',
      }),
    ).toBe('泛函分析 - 第1周 星期三 第2大节');
  });

  it('includes optional extras when toggled', () => {
    const stem = buildDefaultRenameStem({
      courseTitle: '泛函分析',
      sessionTitle: '第1周',
      semester: 1,
      episode: 1,
      instructor: '张三',
      schoolYear: '2024-2025',
      includeInstructor: true,
      includeSchoolYear: true,
    });
    expect(stem).toContain('(2024-2025)');
    expect(stem).toContain('张三');
  });
});

describe('allocateUniqueFileName', () => {
  it('returns the desired name when free', () => {
    expect(allocateUniqueFileName('a.mp4', new Set(['b.mp4']))).toBe('a.mp4');
  });

  it('allows replacing the source file', () => {
    expect(allocateUniqueFileName('a.mp4', new Set(['a.mp4']), 'a.mp4')).toBe('a.mp4');
  });

  it('appends (n) on collision', () => {
    const existing = new Set(['a.mp4', 'a (2).mp4']);
    expect(allocateUniqueFileName('a.mp4', existing)).toBe('a (3).mp4');
  });
});
