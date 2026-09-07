/**
 * Keep the demo out of the real app's storage.
 *
 * The demo is served from /demo/ on the SAME ORIGIN as the real site, so it
 * shares one `localStorage` and one IndexedDB with it. Without this module a
 * visit to the demo would seed fabricated slides into a real user's
 * `autoslides-web` database and overwrite their `autoslides.config`.
 *
 * This is the web counterpart of the desktop demo's `AutoSlides-Demo` userData
 * directory (`main/demo/demoEnv.ts`): same isolation, same happy side effect —
 * every demo load starts from a known, factory-default profile, which is what
 * makes the screenshot run deterministic.
 *
 * Both swaps must be installed before any store module is evaluated: stores
 * read `localStorage` at import time (`authStore.ts` reads the token into a
 * `ref` on the first line). That is why the demo has its own entry module,
 * `src/demo/main.ts`, which imports the real `main.ts` only afterwards.
 */

/** Prefix appended to every IndexedDB name the page opens. */
const DB_SUFFIX = "-demo";

/** In-memory `Storage` — same API, no persistence, invisible to the real app. */
function createMemoryStorage(seed: Record<string, string>): Storage {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  } as Storage;
}

/**
 * Swap `localStorage`/`sessionStorage` for memory-backed copies preloaded with
 * `seed`, and namespace every IndexedDB the page opens.
 *
 * Nothing the demo writes survives a reload, which is the point: the tour
 * always looks the same, and closing the tab leaves no trace.
 */
export function isolateStorage(seed: Record<string, string>): void {
  const memory = createMemoryStorage(seed);
  const session = createMemoryStorage({});

  try {
    Object.defineProperty(window, "localStorage", { value: memory, configurable: true });
    Object.defineProperty(window, "sessionStorage", { value: session, configurable: true });
  } catch {
    // A browser that refuses the redefinition still gets a working demo — it
    // just shares storage with the real app. Better than failing to boot.
  }

  const nativeOpen = indexedDB.open.bind(indexedDB);
  const nativeDelete = indexedDB.deleteDatabase.bind(indexedDB);
  const rename = (name: string) => (name.endsWith(DB_SUFFIX) ? name : name + DB_SUFFIX);

  indexedDB.open = ((name: string, version?: number) =>
    version === undefined
      ? nativeOpen(rename(name))
      : nativeOpen(rename(name), version)) as typeof indexedDB.open;
  indexedDB.deleteDatabase = ((name: string) =>
    nativeDelete(rename(name))) as typeof indexedDB.deleteDatabase;
}

/**
 * Drop the demo's own IndexedDB so the next load re-seeds from scratch. The
 * screenshot script calls this through `window.__demoReset` before capturing.
 */
export async function resetDemoDatabase(dbName: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}
