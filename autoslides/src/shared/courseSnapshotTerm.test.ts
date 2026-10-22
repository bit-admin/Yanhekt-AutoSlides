import { describe, expect, it } from 'vitest';
import { isTermKey, normalizeTermKeys, parseTermKey, termKeyOf } from './courseSnapshotTerm';

describe('course snapshot term keys', () => {
  it('parses a term key whose years follow each other', () => {
    expect(parseTermKey('2019-2020-2')).toEqual({ schoolYear: 2019, semester: 2 });
    expect(isTermKey('2019-2021-1')).toBe(false);
    expect(isTermKey('2019-2020-3')).toBe(false);
    expect(termKeyOf(2023, 1)).toBe('2023-2024-1');
  });

  it('normalizes a stored list: valid, distinct, newest first', () => {
    expect(normalizeTermKeys(['2019-2020-1', 'x', '2021-2022-2', '2019-2020-1', 5])).toEqual(['2021-2022-2', '2019-2020-1']);
    expect(normalizeTermKeys(undefined)).toEqual([]);
  });
});
