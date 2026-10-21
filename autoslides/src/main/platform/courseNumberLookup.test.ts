import { describe, expect, it, vi } from 'vitest';

vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { CourseNumberLookup } from './courseNumberLookup';

function lookup(options: { token?: string; rows?: unknown[]; fail?: boolean } = {}) {
  const getCourseList = vi.fn(async () => {
    if (options.fail) throw new Error('no answer');
    return { data: options.rows ?? [{ id: 80102, number: 'K-0002' }, { id: 80101, number: 'K-0001' }] };
  });
  const configService = { getAuthToken: () => ('token' in options ? options.token : 'cbiz-token') };
  return { created: new CourseNumberLookup({ getCourseList } as never, configService as never), getCourseList };
}

describe('CourseNumberLookup', () => {
  it("answers the row whose id is the course's, and asks once per course", async () => {
    const { created, getCourseList } = lookup();
    expect(await created.numberOf('80101')).toBe('K-0001');
    expect(await created.numberOf('80101')).toBe('K-0001');
    expect(getCourseList).toHaveBeenCalledTimes(1);
  });

  it('answers null with no sign-in, a bad id, no such course or no answer, and does not keep a failure', async () => {
    expect(await lookup({ token: '' }).created.numberOf('80101')).toBeNull();
    expect(await lookup().created.numberOf('live_1')).toBeNull();
    expect(await lookup({ rows: [] }).created.numberOf('80101')).toBeNull();
    const failing = lookup({ fail: true });
    expect(await failing.created.numberOf('80101')).toBeNull();
    expect(await failing.created.numberOf('80101')).toBeNull();
    expect(failing.getCourseList).toHaveBeenCalledTimes(2);
  });
});
