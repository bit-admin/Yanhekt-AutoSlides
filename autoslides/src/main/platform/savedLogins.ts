/**
 * Remembered SSO usernames and passwords, one row per account.
 *
 * The password is only ever stored as ciphertext (`passwordEnc`). This module
 * never sees plaintext and never decides how it was encrypted — callers encrypt
 * before `upsertSavedLogin` and decrypt after a read. Rows are keyed by the
 * Yanhekt badge (the same id as `StoredAccount`) and also by username, so a
 * later sign-in with the same campus username replaces the previous row even
 * if the badge was not known yet.
 *
 * Not part of `AppConfig`. The config snapshot is broadcast to every renderer;
 * ciphertext does not belong there. `ConfigService` keeps the array on its own
 * store key and these functions are the only mutation rules.
 */

export const SAVED_LOGIN_LIMITS = {
  badge: 64,
  username: 128,
  password: 256,
} as const;

export interface SavedLoginRecord {
  badge: string;
  /** Campus SSO username, stored as the user typed it. */
  username: string;
  /** Ciphertext (base64). Never a plaintext password. */
  passwordEnc: string;
  updatedAt: number;
}

export function sanitizeSavedLogins(stored: unknown): SavedLoginRecord[] {
  if (!Array.isArray(stored)) return [];
  const out: SavedLoginRecord[] = [];
  for (const row of stored) {
    if (!row || typeof row !== 'object') continue;
    const candidate = row as Partial<SavedLoginRecord>;
    if (typeof candidate.badge !== 'string' || !candidate.badge.trim()) continue;
    if (typeof candidate.username !== 'string' || !candidate.username.trim()) continue;
    if (typeof candidate.passwordEnc !== 'string' || !candidate.passwordEnc) continue;
    if (typeof candidate.updatedAt !== 'number' || !Number.isFinite(candidate.updatedAt)) continue;
    const badge = candidate.badge.trim();
    const username = candidate.username.trim();
    if (badge.length > SAVED_LOGIN_LIMITS.badge) continue;
    if (username.length > SAVED_LOGIN_LIMITS.username) continue;
    out.push({
      badge,
      username,
      passwordEnc: candidate.passwordEnc,
      updatedAt: candidate.updatedAt,
    });
  }
  return out;
}

/**
 * Insert or replace. A row with the same badge, or the same username on a
 * different badge, is dropped so the flyout never offers two passwords for
 * one campus username.
 */
export function upsertSavedLogin(rows: SavedLoginRecord[], next: SavedLoginRecord): SavedLoginRecord[] {
  const badge = next.badge.trim();
  const username = next.username.trim();
  const kept = rows.filter((row) => row.badge !== badge && row.username !== username);
  return [...kept, { ...next, badge, username }];
}

export function forgetSavedLogin(rows: SavedLoginRecord[], badge: string): SavedLoginRecord[] {
  const key = badge.trim();
  if (!key) return rows;
  return rows.filter((row) => row.badge !== key);
}
