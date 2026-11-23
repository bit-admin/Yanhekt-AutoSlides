import { describe, expect, it } from 'vitest';
import { cloudCourseOf, COURSE_CLOUD_GROUP_MAX, COURSE_CLOUD_GROUPS, COURSE_CLOUD_TITLE_MAX, decodeCourseTitle, encodeCourseTitle, type CloudCourse } from './courseCloud';

// Fabricated ids and names.
const course: CloudCourse = { yanhektId: '1001', yanhe2Id: '2002', school_year: '2025-2026', semester: '1', number: 'X100', title: '示例课程' };

describe('courseCloud titles', () => {
  it('keeps group names within the server limit', () => {
    for (const name of Object.values(COURSE_CLOUD_GROUPS)) expect(name.length).toBeLessThanOrEqual(COURSE_CLOUD_GROUP_MAX);
  });
  it('round-trips a course', () => {
    expect(decodeCourseTitle(encodeCourseTitle(course) as string)).toEqual(course);
  });
  it('keeps a separator inside the course title', () => {
    const c = { ...course, title: '甲|乙' };
    expect(decodeCourseTitle(encodeCourseTitle(c) as string)?.title).toBe('甲|乙');
  });
  it('drops a title that does not fit, never truncates it', () => {
    const text = encodeCourseTitle({ ...course, title: '长'.repeat(90) }) as string;
    expect(text.length).toBeLessThanOrEqual(COURSE_CLOUD_TITLE_MAX);
    expect(decodeCourseTitle(text)?.title).toBe('');
    expect(decodeCourseTitle(text)?.yanhektId).toBe('1001');
  });
  it('ignores notes it did not write', () => {
    for (const t of ['我的笔记', 'AS1|x|y|z|n|t', 'AS1|||||t', 'AS2|1|2|3|4|5']) expect(decodeCourseTitle(t)).toBeNull();
  });
  it('reads a Yanhe 2.0-only pin key', () => {
    expect(cloudCourseOf({ id: 'yanhe2:77', title: 'T' })).toMatchObject({ yanhektId: '', yanhe2Id: '77' });
  });
});
