import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConnection, openDatabase } from './idb';

/** A stand-in for one `indexedDB.open` request and the connection it opens. */
function fakeOpen() {
  const db = {
    close: vi.fn(),
    onversionchange: null as null | (() => void),
    onclose: null as null | (() => void),
  };
  const request = {
    result: db,
    error: null,
    onsuccess: null as null | (() => void),
    onerror: null as null | (() => void),
    onblocked: null as null | (() => void),
    onupgradeneeded: null as null | ((event: { oldVersion: number }) => void),
  };
  vi.stubGlobal('indexedDB', { open: vi.fn(() => request) });
  return { db, request };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('openDatabase', () => {
  it('closes its connection for a newer version elsewhere, and says so once', async () => {
    const { db, request } = fakeOpen();
    const onClosed = vi.fn();
    const opening = openDatabase('t', 1, () => {}, onClosed);
    request.onsuccess!();
    await opening;
    db.onversionchange!();
    db.onclose!();
    expect(db.close).toHaveBeenCalledTimes(1);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('closes a connection that arrives after the open was reported blocked', async () => {
    const { db, request } = fakeOpen();
    const opening = openDatabase('t', 1, () => {});
    request.onblocked!();
    await expect(opening).rejects.toThrow(/blocked/);
    request.onsuccess!();
    expect(db.close).toHaveBeenCalledTimes(1);
  });
});

describe('createConnection', () => {
  it('opens again once the shared connection was closed', async () => {
    const closers: Array<() => void> = [];
    const open = vi.fn(async (onClosed: () => void) => {
      closers.push(onClosed);
      return { n: closers.length } as unknown as IDBDatabase;
    });
    const get = createConnection(open);
    const first = await get();
    expect(await get()).toBe(first);
    closers[0]();
    const second = await get();
    expect(second).not.toBe(first);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('opens again after a failed open', async () => {
    const open = vi.fn().mockRejectedValueOnce(new Error('blocked')).mockResolvedValue({} as IDBDatabase);
    const get = createConnection(open);
    await expect(get()).rejects.toThrow('blocked');
    await expect(get()).resolves.toBeDefined();
  });

  it('does not let a late close of an old connection drop the new one', async () => {
    const closers: Array<() => void> = [];
    const open = vi.fn(async (onClosed: () => void) => {
      closers.push(onClosed);
      return { n: closers.length } as unknown as IDBDatabase;
    });
    const get = createConnection(open);
    await get();
    closers[0]();
    const second = await get();
    closers[0]();
    expect(await get()).toBe(second);
  });
});
