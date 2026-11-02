import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => Promise<unknown>>());
vi.mock('electron', () => ({
  app: { getName: () => 'AutoSlides', getVersion: () => '0.0.0', isPackaged: false },
  ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => handlers.set(channel, handler) },
}));
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { ApiClient } from '@main/platform/apiClient';
import { registerApiIpcHandlers } from './apiIpc';
import type { IpcServices } from './types';

function setup(answer: unknown) {
  const apiClient = new ApiClient();
  const makeRequest = vi.fn(async () => answer);
  (apiClient as unknown as { makeRequest: typeof makeRequest }).makeRequest = makeRequest;
  registerApiIpcHandlers({ apiClient } as IpcServices);
  const handler = handlers.get('api:getCourseDetail');
  if (!handler) throw new Error('detail handler not registered');
  return { handler, makeRequest };
}

describe('api:getCourseDetail enrichment', () => {
  beforeEach(() => handlers.clear());

  it.each([12121028, '12121028'])('resolves null for expiry (%s) instead of rejecting the IPC handler', async (code) => {
    const { handler, makeRequest } = setup({ code, message: '课程已过期', data: null });
    await expect(handler(undefined, 70101, 'tok')).resolves.toBeNull();
    expect(makeRequest).toHaveBeenCalledWith(
      'GET', 'https://cbiz.yanhekt.cn/v1/course?id=70101&with_professor_badges=true', 'tok',
      undefined, { allowAnonymous: true },
    );
  });

  it('still returns available metadata', async () => {
    const { handler } = setup({ code: 0, data: { name_zh: '测试课程', professors: [] } });
    await expect(handler(undefined, '70101', 'tok')).resolves.toMatchObject({ course_id: '70101', title: '测试课程' });
  });

  it('still rejects other upstream errors', async () => {
    const { handler } = setup({ code: 13001001, message: 'invalid token' });
    await expect(handler(undefined, '70101', 'tok')).rejects.toThrow('Authentication failed');
  });
});

describe('api:getSessionDownloadInfo problems', () => {
  beforeEach(() => handlers.clear());

  it('carries the lookup kind across IPC in the message', async () => {
    const apiClient = new ApiClient();
    (apiClient as unknown as { makeRequest: unknown }).makeRequest = vi.fn(async () => ({ code: 12121028, message: '课程已过期' }));
    registerApiIpcHandlers({ apiClient } as IpcServices);
    const handler = handlers.get('api:getSessionDownloadInfo');
    const error = await handler?.(undefined, '850101', 'tok').catch((e: unknown) => e);
    const { parseSessionLookupProblem } = await import('@common/sessionLookupProblem');
    expect(parseSessionLookupProblem(error)).toBe('expired');
  });
});
