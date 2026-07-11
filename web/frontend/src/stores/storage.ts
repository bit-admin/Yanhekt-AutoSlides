// Tiny typed localStorage helpers. All keys use the `autoslides.` namespace.
// Reads never throw: a malformed or missing value falls back to the default.

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota / private-mode failures are non-fatal — the in-memory state stays
    // authoritative for the session.
  }
}
