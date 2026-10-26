import { describe, expect, it } from 'vitest';
import { parseBookmarkPage, parseBookmarkWrite } from './yanhe2Bookmarks';

// Shapes measured 2026-10-27; values fabricated.
const page = (models: unknown[], total = models.length) => ({
  success: true,
  result: { err: 200, errMsg: '', data: { models, total, page: 1, 'per-page': 50 } },
});

describe('parseBookmarkPage', () => {
  it('reads course ids, titles and teacher names, speaker first, never staff numbers', () => {
    const parsed = parseBookmarkPage(page([{
      id: '501',
      course_id: '9001',
      course_title: '泛函分析',
      course_publish: '1',
      course_deleted_at: '0',
      collect_time: '1790000000',
      teachers: [
        { username: 'T0002', realname: '李四', is_speaker: '0' },
        { username: 'T0001', realname: '张三', is_speaker: '1' },
      ],
    }]));
    expect(parsed).toEqual({
      total: 1,
      rows: [{ courseId: '9001', title: '泛函分析', teachers: ['张三', '李四'], collectedAt: 1790000000, available: true }],
    });
  });

  it('marks unpublished or deleted courses and skips rows without an id', () => {
    const parsed = parseBookmarkPage(page([
      { course_id: '9002', course_title: 'A', course_publish: '0', course_deleted_at: '0' },
      { course_id: '9003', course_title: 'B', course_publish: '1', course_deleted_at: '1790000000' },
      { course_id: '', course_title: 'C' },
    ]));
    expect(parsed?.rows.map((r) => [r.courseId, r.available])).toEqual([['9002', false], ['9003', false]]);
  });

  it('reads an empty list, and refuses other shapes', () => {
    expect(parseBookmarkPage(page([]))).toEqual({ rows: [], total: 0 });
    expect(parseBookmarkPage({ success: true, result: { err: 500, data: {} } })).toBeNull();
    expect(parseBookmarkPage(null)).toBeNull();
  });
});

describe('parseBookmarkWrite', () => {
  it('counts added, already added and removed as done', () => {
    expect(parseBookmarkWrite({ success: true, result: { err: 200, data: '收藏成功' } })).toBe(true);
    expect(parseBookmarkWrite({ success: true, result: { err: 201, data: '重复收藏' } })).toBe(true);
    expect(parseBookmarkWrite({ success: true, result: { err: 200, data: '已取消收藏' } })).toBe(true);
    expect(parseBookmarkWrite({ success: true, result: { err: 500 } })).toBe(false);
    expect(parseBookmarkWrite('')).toBe(false);
  });
});
