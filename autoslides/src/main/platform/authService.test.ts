/**
 * `MainAuthService` owns what lands in `ssoDeviceCookies`. These tests pin the
 * two ways a leaked downstream cookie leaves disk: the launch-time prune, and
 * a successful sign-in replacing the bag even when it has nothing to keep.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { isPackaged: true } }));

const casFlowMock = vi.hoisted(() => ({
  startPasswordSignIn: vi.fn(),
  finishSecondFactor: vi.fn(),
}));

vi.mock('./campusSso/casFlow', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./campusSso/casFlow')>()),
  ...casFlowMock,
}));

import { MainAuthService } from './authService';
import type { ConfigService, StoredSsoCookie } from './configService';
import type { Yanhe2Service } from './yanhe2/yanhe2Service';

const DAY_MS = 24 * 60 * 60 * 1000;

let stored: StoredSsoCookie[] | undefined;
let writes: number;

function configService(): ConfigService {
  return {
    getSsoDeviceCookies: () => stored ?? [],
    setSsoDeviceCookies: (cookies: StoredSsoCookie[]) => {
      writes++;
      stored = cookies.length === 0 ? undefined : cookies;
    },
  } as unknown as ConfigService;
}

function cookie(name: string, host: string): StoredSsoCookie {
  return { name, value: `${name}-value`, host, path: '/', expiresAt: Date.now() + DAY_MS };
}

beforeEach(() => {
  stored = undefined;
  writes = 0;
  casFlowMock.startPasswordSignIn.mockReset();
  casFlowMock.finishSecondFactor.mockReset();
});

describe('MainAuthService remembered-device cookies', () => {
  it('prunes cookies an older build persisted for a downstream host at launch', () => {
    stored = [cookie('SOURCEID_TGC', 'bit.edu.cn'), cookie('token', 'yanhekt.cn')];

    new MainAuthService(configService());

    expect(stored?.map((c) => c.name)).toEqual(['SOURCEID_TGC']);
  });

  it('deletes the key when nothing stored is keepable', () => {
    stored = [cookie('token', 'yanhekt.cn'), cookie('JWTUser', 'yanhekt.cn')];

    new MainAuthService(configService());

    expect(stored).toBeUndefined();
  });

  it('overwrites the stored bag on sign-in even with nothing to keep', async () => {
    const service = new MainAuthService(configService());
    stored = [cookie('SOURCEID_TGC', 'bit.edu.cn')];
    casFlowMock.startPasswordSignIn.mockResolvedValue({
      kind: 'signed_in',
      tokens: { yanhekt: 'a'.repeat(32) },
      durableCookies: [],
    });

    const result = await service.loginAndGetToken('user', 'pass');

    expect(result.success).toBe(true);
    expect(stored).toBeUndefined();
    expect(writes).toBeGreaterThan(0);
  });
});

describe('MainAuthService Yanhe 2.0', () => {
  const adopt = vi.fn();
  const yanhe2 = { adopt } as unknown as Yanhe2Service;
  let withMain = true;

  function config(): ConfigService {
    return {
      ...configService(),
      getYanhe2SignInWithMain: () => withMain,
      getAutoSignIn: () => true,
      getRememberPassword: () => true,
      getSavedLogins: () => [],
    } as unknown as ConfigService;
  }

  beforeEach(() => {
    withMain = true;
    adopt.mockReset();
  });

  it('asks the main sign-in for a Yanhe 2.0 token too, and stores it unbound to a badge', async () => {
    casFlowMock.startPasswordSignIn.mockResolvedValue({
      kind: 'signed_in',
      tokens: { yanhekt: 'a'.repeat(32), yanhe2: 'jwt' },
      durableCookies: [],
    });
    adopt.mockResolvedValue({ success: true, account: '1120230001', expiresAt: 1 });

    const result = await new MainAuthService(config(), yanhe2).loginAndGetToken('user', 'pass');

    expect(casFlowMock.startPasswordSignIn.mock.calls[0][3]).toEqual({ target: 'yanhekt', alsoYanhe2: true });
    expect(adopt).toHaveBeenCalledWith('jwt', null);
    expect(result).toEqual({ success: true, token: 'a'.repeat(32) });
  });

  it('does not ask when the setting is off', async () => {
    withMain = false;
    casFlowMock.startPasswordSignIn.mockResolvedValue({
      kind: 'signed_in',
      tokens: { yanhekt: 'a'.repeat(32) },
      durableCookies: [],
    });

    await new MainAuthService(config(), yanhe2).loginAndGetToken('user', 'pass');

    expect(casFlowMock.startPasswordSignIn.mock.calls[0][3]).toEqual({ target: 'yanhekt', alsoYanhe2: false });
    expect(adopt).not.toHaveBeenCalled();
  });

  it('keeps the main sign-in when storing Yanhe 2.0 fails', async () => {
    casFlowMock.startPasswordSignIn.mockResolvedValue({
      kind: 'signed_in',
      tokens: { yanhekt: 'a'.repeat(32), yanhe2: 'jwt' },
      durableCookies: [],
    });
    adopt.mockRejectedValue(new Error('offline'));

    const result = await new MainAuthService(config(), yanhe2).loginAndGetToken('user', 'pass');

    expect(result.success).toBe(true);
  });

  it('binds a Yanhe 2.0-only sign-in to the expected account', async () => {
    casFlowMock.startPasswordSignIn.mockResolvedValue({
      kind: 'signed_in',
      tokens: { yanhe2: 'jwt' },
      durableCookies: [],
    });
    adopt.mockResolvedValue({ success: false, reason: 'account_mismatch' });

    const result = await new MainAuthService(config(), yanhe2).yanhe2Login('1120230001', 'other', 'pass');

    expect(casFlowMock.startPasswordSignIn.mock.calls[0][3]).toEqual({ target: 'yanhe2' });
    expect(adopt).toHaveBeenCalledWith('jwt', '1120230001');
    expect(result.reason).toBe('account_mismatch');
  });

  it('skips auto sign-in without a saved password', async () => {
    const result = await new MainAuthService(config(), yanhe2).yanhe2AutoSignIn('1120230001');

    expect(result).toEqual({ success: false, reason: 'auto_sign_in_unavailable' });
    expect(casFlowMock.startPasswordSignIn).not.toHaveBeenCalled();
  });
});
