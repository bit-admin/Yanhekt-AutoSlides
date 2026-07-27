import { describe, it, expect } from 'vitest';
import { parseHttpRange } from './httpRange';

describe('parseHttpRange', () => {
  it('parses open-ended start range', () => {
    expect(parseHttpRange('bytes=100-', 1000)).toEqual({ start: 100, end: 999 });
  });

  it('parses closed range', () => {
    expect(parseHttpRange('bytes=0-499', 1000)).toEqual({ start: 0, end: 499 });
  });

  it('parses suffix range', () => {
    expect(parseHttpRange('bytes=-200', 1000)).toEqual({ start: 800, end: 999 });
  });

  it('clamps end to size-1', () => {
    expect(parseHttpRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 });
  });

  it('returns unsatisfiable when start past EOF', () => {
    expect(parseHttpRange('bytes=1000-', 1000)).toBe('unsatisfiable');
  });

  it('returns null without header', () => {
    expect(parseHttpRange(null, 1000)).toBeNull();
  });
});
