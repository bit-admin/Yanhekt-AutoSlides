import { afterEach, describe, expect, it, vi } from 'vitest';
import { cached, coalesce, invalidate, invalidateAll } from './requestCache';

/** Deferred promise so a test can hold a call in flight and settle it by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  invalidateAll();
  vi.useRealTimers();
});

describe('coalesce', () => {
  it('joins concurrent calls into a single invocation', async () => {
    const d = deferred<string>();
    const fn = vi.fn(() => d.promise);

    const a = coalesce('k', fn);
    const b = coalesce('k', fn);
    const c = coalesce('k', fn);

    expect(fn).toHaveBeenCalledTimes(1);
    d.resolve('note');
    await expect(Promise.all([a, b, c])).resolves.toEqual(['note', 'note', 'note']);
  });

  it('does not memoize — a later call re-runs once the first settled', async () => {
    const fn = vi.fn(async () => 'v');

    await coalesce('k', fn);
    await coalesce('k', fn);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('keeps distinct keys independent', async () => {
    const fn = vi.fn(async (key: string) => key);

    await Promise.all([coalesce('a', () => fn('a')), coalesce('b', () => fn('b'))]);

    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('cached', () => {
  it('serves a fresh memo without re-invoking', async () => {
    const fn = vi.fn(async () => 'v');

    await expect(cached('k', 60_000, fn)).resolves.toBe('v');
    await expect(cached('k', 60_000, fn)).resolves.toBe('v');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('re-invokes once the TTL has elapsed', async () => {
    vi.useFakeTimers();
    const fn = vi.fn(async () => 'v');

    await cached('k', 1_000, fn);
    vi.advanceTimersByTime(999);
    await cached('k', 1_000, fn);
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2);
    await cached('k', 1_000, fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('failures', () => {
  it('does not memoize a rejection and stays immediately retryable', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('v');

    await expect(cached('k', 60_000, fn)).rejects.toThrow('offline');
    await expect(cached('k', 60_000, fn)).resolves.toBe('v');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('rejects every joiner of a failed in-flight call', async () => {
    const d = deferred<string>();
    const fn = vi.fn(() => d.promise);

    const a = cached('k', 60_000, fn);
    const b = cached('k', 60_000, fn);
    d.reject(new Error('boom'));

    await expect(a).rejects.toThrow('boom');
    await expect(b).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('invalidate', () => {
  it('drops matching keys only', async () => {
    const note = vi.fn(async () => 'note');
    const course = vi.fn(async () => 'course');

    await cached('GET /v1/note?id=1', 60_000, note);
    await cached('GET /v1/course?id=9', 60_000, course);

    invalidate('GET /v1/note');

    await cached('GET /v1/note?id=1', 60_000, note);
    await cached('GET /v1/course?id=9', 60_000, course);

    expect(note).toHaveBeenCalledTimes(2);
    expect(course).toHaveBeenCalledTimes(1);
  });

  it('still delivers an in-flight result to its waiters, but does not memoize it', async () => {
    const d = deferred<string>();
    const fn = vi.fn(() => d.promise);

    const inFlight = cached('k', 60_000, fn);
    invalidate('k');
    d.resolve('v');

    await expect(inFlight).resolves.toBe('v');
    await cached('k', 60_000, async () => 'fresh');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('invalidateAll clears everything', async () => {
    const fn = vi.fn(async () => 'v');

    await cached('a', 60_000, fn);
    await cached('b', 60_000, fn);
    invalidateAll();
    await cached('a', 60_000, fn);
    await cached('b', 60_000, fn);

    expect(fn).toHaveBeenCalledTimes(4);
  });
});
