import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getName: () => 'AutoSlides', getVersion: () => '0.0.0' } }));
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));
vi.mock('@main/infra/sharpService', () => ({ sharpService: { isAvailable: () => false } }));

import { mergeShareLectureMeta } from './shareService';

const WORKER = { courseTitle: '示例课程', sessionTitle: '第2次课', instructor: '某老师', schoolYear: '2024-2025', semester: '2' };

describe('mergeShareLectureMeta', () => {
  it('names the session from the app lookup, not the Worker position label', () => {
    expect(mergeShareLectureMeta(WORKER, { courseTitle: '示例课程', sessionTitle: '第1周 星期三 第2大节' })).toEqual({
      ...WORKER,
      sessionTitle: '第1周 星期三 第2大节',
    });
  });

  it('drops the position label when the app found no title', () => {
    for (const own of [null, { courseTitle: '', sessionTitle: '' }]) {
      expect(mergeShareLectureMeta(WORKER, own)).toMatchObject({ courseTitle: '示例课程', sessionTitle: '' });
    }
  });

  it('keeps a real Worker session title when the app found none', () => {
    const worker = { ...WORKER, sessionTitle: '第4周 星期一 第5大节' };
    expect(mergeShareLectureMeta(worker, null)?.sessionTitle).toBe('第4周 星期一 第5大节');
  });

  it('uses the app titles when the Worker answered nothing, and is null when neither knows', () => {
    expect(mergeShareLectureMeta(null, { courseTitle: '示例课程', sessionTitle: '第1周' })).toEqual({
      courseTitle: '示例课程',
      sessionTitle: '第1周',
    });
    expect(mergeShareLectureMeta(null, null)).toBeNull();
    expect(mergeShareLectureMeta(null, { courseTitle: '', sessionTitle: '' })).toBeNull();
  });
});
