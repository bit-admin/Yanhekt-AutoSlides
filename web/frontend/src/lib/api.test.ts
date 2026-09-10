import { describe, expect, it } from 'vitest';
import { ttlFor } from './api';

/**
 * GET_TTL_MS is scanned in order and the first matching prefix wins, so the
 * table's ordering is behaviour, not formatting. These cases pin the pairs
 * where one path is a prefix of another.
 */
describe('ttlFor', () => {
  it('never memoizes the hop that carries user_progress', () => {
    // /v1/course/session sits under the 5-minute /v1/course rule by string
    // prefix. Memoizing it would resurrect a stale playhead when a lecture is
    // reopened, so it must be matched by its own 0 entry first.
    expect(ttlFor('/v1/course/session?session_id=42&with_video=true')).toBe(0);
  });

  it('still memoizes course detail itself', () => {
    expect(ttlFor('/v1/course?id=9&with_professor_badges=true')).toBe(5 * 60 * 1000);
  });

  it('gives the subscription list its own shorter TTL, not /v1/course’s', () => {
    expect(ttlFor('/v1/course/subscription/list?page=1')).toBe(60 * 1000);
  });

  it('separates the v2 session list from the v1 progress hop', () => {
    expect(ttlFor('/v2/course/session/list?course_id=9')).toBe(5 * 60 * 1000);
  });

  it('keeps the semester tree long and the live list short', () => {
    expect(ttlFor('/v1/tag/list?with_sub=true')).toBe(60 * 60 * 1000);
    expect(ttlFor('/v2/live/list?page=1&page_size=16')).toBe(30 * 1000);
  });

  it('falls back to coalesce-only for unlisted paths', () => {
    expect(ttlFor('/v1/user')).toBe(0);
    expect(ttlFor('/v1/video?id=7')).toBe(0);
  });
});
