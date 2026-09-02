import { beforeEach, describe, expect, it, vi } from 'vitest';

const blocker = vi.hoisted(() => {
  const started = new Set<number>();
  let nextId = 1;
  return {
    started,
    start: vi.fn(() => {
      const id = nextId++;
      started.add(id);
      return id;
    }),
    stop: vi.fn((id: number) => {
      started.delete(id);
    }),
    isStarted: vi.fn((id: number) => started.has(id)),
    reset() {
      started.clear();
      nextId = 1;
      this.start.mockClear();
      this.stop.mockClear();
      this.isStarted.mockClear();
    }
  };
});

vi.mock('electron', () => ({
  powerSaveBlocker: {
    start: blocker.start,
    stop: blocker.stop,
    isStarted: blocker.isStarted
  },
  app: { isPackaged: true }
}));

vi.mock('@main/infra/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}));

import { PowerManagementService } from './powerManagementService';

describe('PowerManagementService refcount', () => {
  let service: PowerManagementService;

  beforeEach(() => {
    blocker.reset();
    service = new PowerManagementService();
  });

  it('starts one blocker for several holders and keeps it until the last release', async () => {
    await service.preventSleep('tab:1');
    await service.preventSleep('tab:2');
    expect(blocker.start).toHaveBeenCalledTimes(1);
    expect(service.isPreventingSleep()).toBe(true);

    await service.allowSleep('tab:1');
    expect(blocker.stop).not.toHaveBeenCalled();
    expect(service.isPreventingSleep()).toBe(true);
    expect(service.getHolders()).toEqual(['tab:2']);

    await service.allowSleep('tab:2');
    expect(blocker.stop).toHaveBeenCalledTimes(1);
    expect(service.isPreventingSleep()).toBe(false);
  });

  it('is idempotent per holder and ignores unknown releases', async () => {
    await service.preventSleep('settings');
    await service.preventSleep('settings');
    expect(blocker.start).toHaveBeenCalledTimes(1);

    await service.allowSleep('never-registered');
    expect(blocker.stop).not.toHaveBeenCalled();
    expect(service.isPreventingSleep()).toBe(true);

    await service.allowSleep('settings');
    await service.allowSleep('settings');
    expect(blocker.stop).toHaveBeenCalledTimes(1);
  });

  it('restarts the blocker when Electron stopped it externally', async () => {
    await service.preventSleep('tab:1');
    blocker.started.clear(); // simulate an external stop
    expect(service.isPreventingSleep()).toBe(false);

    await service.preventSleep('tab:2');
    expect(blocker.start).toHaveBeenCalledTimes(2);
    expect(service.isPreventingSleep()).toBe(true);
  });

  it('drops the holder when Electron fails to start the blocker', async () => {
    blocker.start.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(await service.preventSleep('tab:1')).toBe(false);
    expect(service.getHolders()).toEqual([]);
    expect(service.isPreventingSleep()).toBe(false);
  });

  it('cleanup stops the blocker and forgets all holders', async () => {
    await service.preventSleep('tab:1');
    await service.preventSleep('webCapture:x');
    service.cleanup();
    expect(blocker.stop).toHaveBeenCalledTimes(1);
    expect(service.getHolders()).toEqual([]);
    expect(service.isPreventingSleep()).toBe(false);
  });
});
