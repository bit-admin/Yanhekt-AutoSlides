import { describe, expect, it, vi } from 'vitest';

vi.mock('@shared/utils/logger', () => ({ createLogger: () => ({ debug: vi.fn() }) }));

import type { ApiClient } from '@shared/services/apiClient';
import { fillIndexCourses, indexRowToCourse } from './courseIndexSearch';

const row = {
  id: '70101', name: '测试课程', number: 'TEST-COURSE',
  term: '2025-2026-1', teachers: ['Test Teacher'],
};

describe('fillIndexCourses', () => {
  it('retains Index metadata when expired detail is unavailable', async () => {
    const course = indexRowToCourse(row, row.term);
    const before = { ...course, professors: [...(course.professors ?? [])] };
    const getCourseDetail = vi.fn(async () => null);
    const api = { getCourseDetail } as unknown as ApiClient;

    await fillIndexCourses([course], api, 'tok', () => true);

    expect(course).toEqual(before);
    expect(getCourseDetail).toHaveBeenCalledWith(row.id, 'tok');
  });

  it('continues enriching other cards after an unavailable detail', async () => {
    const courses = [indexRowToCourse(row, row.term), indexRowToCourse({ ...row, id: '70102' }, row.term)];
    const api = {
      getCourseDetail: vi.fn(async (id: string) => id === row.id ? null : {
        course_id: id, title: row.name, title_en: 'Test Course', professor: 'Test Teacher',
        college_name: 'Test College', image_url: 'https://example.test/cover.png',
      }),
    } as unknown as ApiClient;

    await fillIndexCourses(courses, api, 'tok', () => true);

    expect(courses[0].title).toBe(row.name);
    expect(courses[1]).toMatchObject({ title: row.name, titleEn: 'Test Course', college_name: 'Test College' });
  });
});
