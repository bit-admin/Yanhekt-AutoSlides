import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService, StoredYanhe2Session } from '../configService';

vi.mock('electron', () => ({ session: {} }));
vi.mock('@main/infra/logger', () => ({
  createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }),
}));

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const profileCalls: Array<{ jwt: string; answer: Deferred<unknown> }> = [];
const courseCalls: Array<{ jwt: string; answer: Deferred<unknown> }> = [];

vi.mock('./yanhe2Api', () => ({
  fetchYanhe2Profile: (jwt: string) => {
    const answer = deferred<unknown>();
    profileCalls.push({ jwt, answer });
    return answer.promise;
  },
}));
vi.mock('./yanhe2Curriculum', () => ({
  fetchYanhe2CourseDetail: vi.fn(),
  fetchYanhe2Courses: (jwt: string) => {
    const answer = deferred<unknown>();
    courseCalls.push({ jwt, answer });
    return answer.promise;
  },
}));

import { Yanhe2Service } from './yanhe2Service';

const ACCOUNT = '0000000001';
const FUTURE = Date.now() + 3_600_000;
const row = (jwt: string, over: Partial<StoredYanhe2Session> = {}): StoredYanhe2Session => ({
  jwt,
  expiresAt: FUTURE,
  userId: 11,
  tenantId: 22,
  playSigningPhone: '10000000000',
  ...over,
});

/** The session store as ConfigService keeps it: one row per account. */
function fakeConfig() {
  const rows = new Map<string, StoredYanhe2Session>();
  const config = {
    getYanhe2Session: (account: string) => rows.get(account) ?? null,
    setYanhe2Session: (account: string, session: StoredYanhe2Session) => void rows.set(account, session),
    expireYanhe2Session: (account: string) => {
      const current = rows.get(account);
      if (current) rows.set(account, { ...current, jwt: '', expiresAt: 0 });
    },
    clearYanhe2Session: (account: string) => void rows.delete(account),
  };
  return { rows, service: new Yanhe2Service(config as unknown as ConfigService) };
}

const profile = (over: Record<string, unknown> = {}) => ({
  kind: 'ok',
  profile: { userId: 11, tenantId: 22, playSigningPhone: '10000000000', ...over },
});

beforeEach(() => {
  profileCalls.length = 0;
  courseCalls.length = 0;
});

describe('a Yanhe 2.0 answer that arrives after the session changed', () => {
  it('a refusal of the old token does not expire the token signed in since', async () => {
    const { rows, service } = fakeConfig();
    rows.set(ACCOUNT, row('old'));
    const read = service.getMyCourses(ACCOUNT);
    rows.set(ACCOUNT, row('new'));
    courseCalls[0].answer.resolve({ kind: 'rejected' });

    // The read itself failed, but the account is not signed out.
    expect(await read).toEqual({ kind: 'failed' });
    expect(rows.get(ACCOUNT)).toEqual(row('new'));
    expect(service.isSignedIn(ACCOUNT)).toBe(true);
  });

  it('a refusal still expires the token it was sent with', async () => {
    const { rows, service } = fakeConfig();
    rows.set(ACCOUNT, row('old'));
    const read = service.getMyCourses(ACCOUNT);
    courseCalls[0].answer.resolve({ kind: 'rejected' });

    expect(await read).toEqual({ kind: 'signed_out' });
    expect(rows.get(ACCOUNT)).toMatchObject({ jwt: '', expiresAt: 0, userId: 11 });
  });

  it('two refusals of one token expire it once and both answer signed out', async () => {
    const { rows, service } = fakeConfig();
    rows.set(ACCOUNT, row('old'));
    const first = service.getMyCourses(ACCOUNT);
    const second = service.getMyCourses(ACCOUNT);
    courseCalls[0].answer.resolve({ kind: 'rejected' });
    courseCalls[1].answer.resolve({ kind: 'rejected' });
    expect(await first).toEqual({ kind: 'signed_out' });
    expect(await second).toEqual({ kind: 'signed_out' });
  });

  it('a refusal after signing out leaves the account without a row', async () => {
    const { rows, service } = fakeConfig();
    rows.set(ACCOUNT, row('old'));
    const read = service.getMyCourses(ACCOUNT);
    service.signOut(ACCOUNT);
    courseCalls[0].answer.resolve({ kind: 'rejected' });
    expect(await read).toEqual({ kind: 'signed_out' });
    expect(rows.has(ACCOUNT)).toBe(false);
  });

  it('a check that succeeds after signing out does not bring the session back', async () => {
    const { rows, service } = fakeConfig();
    rows.set(ACCOUNT, row('old'));
    const check = service.check(ACCOUNT);
    service.signOut(ACCOUNT);
    profileCalls[0].answer.resolve(profile({ playSigningPhone: '10000000009' }));

    expect(await check).toBe('none');
    expect(rows.has(ACCOUNT)).toBe(false);
  });

  it('a check of the old token does not write its profile over the new session', async () => {
    const { rows, service } = fakeConfig();
    rows.set(ACCOUNT, row('old'));
    const check = service.check(ACCOUNT);
    rows.set(ACCOUNT, row('new', { userId: 12 }));
    profileCalls[0].answer.resolve(profile({ playSigningPhone: '10000000009' }));

    expect(await check).toBe('signed_in');
    expect(rows.get(ACCOUNT)).toEqual(row('new', { userId: 12 }));
  });

  it('a check refused for the old token does not expire the new one', async () => {
    const { rows, service } = fakeConfig();
    rows.set(ACCOUNT, row('old'));
    const check = service.check(ACCOUNT);
    rows.set(ACCOUNT, row('new'));
    profileCalls[0].answer.resolve({ kind: 'rejected' });

    expect(await check).toBe('signed_in');
    expect(rows.get(ACCOUNT)).toEqual(row('new'));
  });

  it('a check still refreshes the profile of the token it checked, and expires a refused one', async () => {
    const { rows, service } = fakeConfig();
    rows.set(ACCOUNT, row('old'));
    const changed = service.check(ACCOUNT);
    profileCalls[0].answer.resolve(profile({ playSigningPhone: '10000000009' }));
    expect(await changed).toBe('signed_in');
    expect(rows.get(ACCOUNT)).toEqual(row('old', { playSigningPhone: '10000000009' }));

    const refused = service.check(ACCOUNT);
    profileCalls[1].answer.resolve({ kind: 'rejected' });
    expect(await refused).toBe('expired');
    expect(rows.get(ACCOUNT)).toMatchObject({ jwt: '', expiresAt: 0 });
  });

  it('a network failure keeps the session', async () => {
    const { rows, service } = fakeConfig();
    rows.set(ACCOUNT, row('old'));
    const check = service.check(ACCOUNT);
    profileCalls[0].answer.resolve({ kind: 'network' });
    expect(await check).toBe('network');
    expect(rows.get(ACCOUNT)).toEqual(row('old'));
  });
});
