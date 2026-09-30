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
      kind: 'token',
      token: 'a'.repeat(32),
      durableCookies: [],
    });

    const result = await service.loginAndGetToken('user', 'pass');

    expect(result.success).toBe(true);
    expect(stored).toBeUndefined();
    expect(writes).toBeGreaterThan(0);
  });
});
