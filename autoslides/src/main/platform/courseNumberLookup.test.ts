import { describe, expect, it, vi } from 'vitest';

vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { CourseNumberLookup } from './courseNumberLookup';

type Found = { kind: 'yanhekt'; course: { number?: string } } | { kind: 'index'; row: { number: string | null } } | null;

function lookup(answer: Found | Error, token = 'cbiz-token') {
  const locate = vi.fn(async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  });
  const configService = { getAuthToken: () => token };
  return { created: new CourseNumberLookup({ locate } as never, configService as never), locate };
}

describe('CourseNumberLookup', () => {
  it('answers the number from Yanhekt or the index, and asks once per course', async () => {
    const yanhekt = lookup({ kind: 'yanhekt', course: { number: 'K-0001' } });
    expect(await yanhekt.created.numberOf('80101')).toBe('K-0001');
    expect(await yanhekt.created.numberOf('80101')).toBe('K-0001');
    expect(yanhekt.locate).toHaveBeenCalledTimes(1);
    expect(yanhekt.locate).toHaveBeenCalledWith({ id: '80101' }, null, 'cbiz-token');
    expect(await lookup({ kind: 'index', row: { number: 'K-0002' } }).created.numberOf('80102')).toBe('K-0002');
  });

  it('answers null without a sign-in and asks nothing', async () => {
    const signedOut = lookup({ kind: 'index', row: { number: 'K-0001' } }, '');
    expect(await signedOut.created.numberOf('80101')).toBeNull();
    expect(signedOut.locate).not.toHaveBeenCalled();
  });

  it('answers null for a bad id, a course without a number, no such course or no answer, and does not keep a miss', async () => {
    expect(await lookup({ kind: 'index', row: { number: 'K' } }).created.numberOf('live_1')).toBeNull();
    expect(await lookup({ kind: 'index', row: { number: null } }).created.numberOf('80101')).toBeNull();
    const missing = lookup(null);
    expect(await missing.created.numberOf('80101')).toBeNull();
    expect(await missing.created.numberOf('80101')).toBeNull();
    expect(missing.locate).toHaveBeenCalledTimes(2);
    expect(await lookup(new Error('no answer')).created.numberOf('80101')).toBeNull();
  });
});
