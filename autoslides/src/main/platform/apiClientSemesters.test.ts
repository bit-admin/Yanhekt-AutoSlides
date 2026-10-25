import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getName: () => 'AutoSlides', getVersion: () => '0.0.0', isPackaged: false } }));
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { ApiClient } from './apiClient';
import type { CachedSemesterTag, ConfigService } from './configService';

/** A client whose `/v1/tag/semester/default` answers with `tag` or fails, over an in-memory store. */
function clientWith(answer: { id: number; name: string } | Error, saved: CachedSemesterTag | null = null) {
  const store = { tag: saved };
  const config = {
    getPreferAnonymousApiRequests: () => false,
    getCachedCurrentSemester: () => store.tag,
    setCachedCurrentSemester: (tag: CachedSemesterTag) => { store.tag = tag; },
  } as unknown as ConfigService;
  const client = new ApiClient(config);
  (client as unknown as { getDefaultSemesterTag: () => Promise<unknown> }).getDefaultSemesterTag = async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { client, store };
}

const CURRENT = { id: 401, name: '2026-2027 第一学期' };
const OLD: CachedSemesterTag = { id: 399, name: '2025-2026 第二学期', savedAt: 1 };

describe('getAvailableSemesters', () => {
  it('saves a fresh answer', async () => {
    const { client, store } = clientWith(CURRENT, OLD);
    expect(await client.getAvailableSemesters()).toEqual([
      { id: 401, label: '2026-2027 第一学期', labelEn: '2026 Fall', schoolYear: 2026, semester: 1 },
    ]);
    expect(store.tag).toMatchObject({ id: 401, name: '2026-2027 第一学期' });
  });

  it('falls back to the saved term when the request fails', async () => {
    const { client } = clientWith(new Error('network down'), OLD);
    expect(await client.getAvailableSemesters()).toEqual([
      { id: 399, label: '2025-2026 第二学期', labelEn: '2026 Spring', schoolYear: 2025, semester: 2 },
    ]);
  });

  it('throws when the request fails and nothing is saved', async () => {
    const { client } = clientWith(new Error('network down'));
    await expect(client.getAvailableSemesters()).rejects.toThrow('network down');
  });

  it('does not save when writes are off (command-line runs)', async () => {
    const { client, store } = clientWith(CURRENT, OLD);
    client.setSemesterCacheWrites(false);
    await client.getAvailableSemesters();
    expect(store.tag).toBe(OLD);
  });
});
