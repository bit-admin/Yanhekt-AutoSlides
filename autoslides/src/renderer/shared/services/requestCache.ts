/**
 * Request coalescing + short-TTL memo for the Yanhekt transports.
 *
 * Deliberate copy of `web/frontend/src/lib/requestCache.ts` (drift group). The
 * desktop app has no Worker quota to protect, but the other reasons hold: a
 * repeat click, several mounted playback tabs and the task queue can all ask
 * Yanhekt the same question at once, and nothing downstream absorbs it.
 *
 * Two behaviours, one entry point:
 *   - **In-flight join** — a call arriving while the same key is already
 *     running returns that same promise. No added latency, no staleness; this
 *     alone turns N repeat clicks into one request.
 *   - **TTL memo** — a resolved value is reused until it expires. Opt-in per
 *     endpoint; `ttlMs: 0` keeps the join and skips the memo entirely, which is
 *     what note reads use (a document the user is editing must never be served
 *     stale).
 *
 * Rejections are never memoized and their in-flight entry is dropped on settle,
 * so a failure is immediately retryable — same rule the relay's playlist cache
 * follows (relay/src/index.ts).
 *
 * Callers key on the token so an account switch cannot be served the previous
 * account's data; sign-out additionally calls invalidateAll().
 */

/** Cap on memoized entries, so a long session cannot grow without bound. */
const MAX_ENTRIES = 200;

interface Entry {
  /** Live request; present only while in flight. */
  promise?: Promise<unknown>;
  /** Resolved value, kept until `expiresAt`. Absent when ttlMs was 0. */
  value?: unknown;
  /** Epoch ms after which `value` is stale. 0 when there is no memo. */
  expiresAt: number;
}

const entries = new Map<string, Entry>();

/** Drop the oldest insertions once the map outgrows its cap (Map keeps order). */
function evictIfNeeded(): void {
  if (entries.size <= MAX_ENTRIES) return;
  for (const key of entries.keys()) {
    if (entries.size <= MAX_ENTRIES) break;
    const entry = entries.get(key);
    // Never evict a request that is still running — its joiners hold the promise.
    if (entry?.promise) continue;
    entries.delete(key);
  }
}

/**
 * Run `fn` under `key`, joining an in-flight call and reusing a fresh memo.
 * `ttlMs` of 0 means join-only: dedupe concurrent calls, never memoize.
 */
export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const existing = entries.get(key);

  if (existing) {
    if (existing.promise) return existing.promise as Promise<T>;
    if (existing.expiresAt > Date.now() && 'value' in existing) {
      return Promise.resolve(existing.value as T);
    }
    // Expired memo — fall through and re-run.
    entries.delete(key);
  }

  const entry: Entry = { expiresAt: 0 };
  const promise = fn().then(
    (value) => {
      // A concurrent invalidate() may have dropped this entry mid-flight; in
      // that case the result still goes to its waiters but is not memoized.
      if (entries.get(key) === entry) {
        entry.promise = undefined;
        if (ttlMs > 0) {
          entry.value = value;
          entry.expiresAt = Date.now() + ttlMs;
        } else {
          entries.delete(key);
        }
        evictIfNeeded();
      }
      return value;
    },
    (error: unknown) => {
      // Failures are never memoized — the next call retries immediately.
      if (entries.get(key) === entry) entries.delete(key);
      throw error;
    },
  );

  entry.promise = promise;
  entries.set(key, entry);
  return promise;
}

/** Dedupe concurrent calls for `key` without memoizing the result. */
export function coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  return cached(key, 0, fn);
}

/**
 * Drop every entry whose key starts with `prefix`. Write paths call this so a
 * read started before the write cannot be joined (or memoized) after it.
 */
export function invalidate(prefix: string): void {
  for (const key of [...entries.keys()]) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
}

/** Drop everything. Called on sign-out and account switch. */
export function invalidateAll(): void {
  entries.clear();
}
