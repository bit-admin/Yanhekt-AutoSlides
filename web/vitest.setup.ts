// Frontend modules read Web Storage at import time — `configStore`'s one-time
// legacy-locale migration calls `localStorage.getItem` unguarded — and vitest
// runs these in a plain node environment. This in-memory shim keeps such
// imports working without pulling jsdom into a Worker project. Worker-side
// tests never touch it (the guard leaves a real implementation alone).
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}
