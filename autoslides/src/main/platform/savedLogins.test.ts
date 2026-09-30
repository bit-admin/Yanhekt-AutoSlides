import { describe, expect, it } from 'vitest';
import {
  forgetSavedLogin,
  sanitizeSavedLogins,
  upsertSavedLogin,
  type SavedLoginRecord,
} from './savedLogins';

function row(patch: Partial<SavedLoginRecord> = {}): SavedLoginRecord {
  return {
    badge: '3120200001',
    username: '3120200001',
    passwordEnc: 'Y2lwaGVy',
    updatedAt: 1,
    ...patch,
  };
}

describe('sanitizeSavedLogins', () => {
  it('drops anything that is not a complete ciphertext row', () => {
    const kept = row();
    expect(sanitizeSavedLogins([
      kept,
      null,
      { badge: '  ', username: 'a', passwordEnc: 'x', updatedAt: 1 },
      { badge: 'b', username: '', passwordEnc: 'x', updatedAt: 1 },
      { badge: 'b', username: 'u', passwordEnc: '', updatedAt: 1 },
      { badge: 'b', username: 'u', passwordEnc: 'x', updatedAt: Number.NaN },
      'nope',
    ])).toEqual([kept]);
  });

  it('trims badge and username and rejects over-long ones', () => {
    const [kept] = sanitizeSavedLogins([row({ badge: '  ab  ', username: '  user  ' })]);
    expect(kept).toMatchObject({ badge: 'ab', username: 'user' });
    expect(sanitizeSavedLogins([row({ username: 'u'.repeat(129) })])).toEqual([]);
  });

  it('returns an empty list for a missing or non-array store value', () => {
    expect(sanitizeSavedLogins(undefined)).toEqual([]);
    expect(sanitizeSavedLogins({ badge: 'a' })).toEqual([]);
  });
});

describe('upsertSavedLogin', () => {
  it('replaces the row for the same badge and keeps other accounts', () => {
    const other = row({ badge: 'other', username: 'other', updatedAt: 1 });
    const first = row({ passwordEnc: 'old', updatedAt: 1 });
    const next = row({ passwordEnc: 'new', updatedAt: 2 });
    expect(upsertSavedLogin([other, first], next)).toEqual([other, next]);
  });

  it('replaces a different badge that already uses this username', () => {
    const stale = row({ badge: 'old-badge', username: 'campus-id', passwordEnc: 'old' });
    const next = row({ badge: 'new-badge', username: 'campus-id', passwordEnc: 'new', updatedAt: 3 });
    expect(upsertSavedLogin([stale], next)).toEqual([next]);
  });
});

describe('forgetSavedLogin', () => {
  it('removes only the named badge', () => {
    const keep = row({ badge: 'keep', username: 'keep' });
    const drop = row({ badge: 'drop', username: 'drop' });
    expect(forgetSavedLogin([keep, drop], 'drop')).toEqual([keep]);
    expect(forgetSavedLogin([keep], '  ')).toEqual([keep]);
  });
});
