import { describe, expect, it } from 'vitest';
import { isGuestUrlAllowed, parseGuestRect, scaleGuestRect } from './guestView';

describe('isGuestUrlAllowed', () => {
  it('allows web pages and the blank page on every surface', () => {
    expect(isGuestUrlAllowed('yuketang', 'https://example.com/a')).toBe(true);
    expect(isGuestUrlAllowed('browserLogin', 'about:blank')).toBe(true);
  });

  it('allows local files only in Web Capture', () => {
    expect(isGuestUrlAllowed('webCapture', 'file:///tmp/a.html')).toBe(true);
    expect(isGuestUrlAllowed('browserLogin', 'file:///tmp/a.html')).toBe(false);
  });

  it('refuses script and malformed addresses', () => {
    expect(isGuestUrlAllowed('webCapture', 'javascript:alert(1)')).toBe(false);
    expect(isGuestUrlAllowed('webCapture', 'not a url')).toBe(false);
    expect(isGuestUrlAllowed('webCapture', 42)).toBe(false);
  });
});

describe('scaleGuestRect', () => {
  it('keeps shared edges aligned after rounding', () => {
    expect(scaleGuestRect({ x: 10.5, y: 20, width: 100.25, height: 50 }, 1.1)).toEqual({
      x: 12, y: 22, width: 110, height: 55,
    });
  });
});

describe('parseGuestRect', () => {
  it('rejects missing, non-finite and negative sizes', () => {
    expect(parseGuestRect({ x: 0, y: 0, width: 1 })).toBeNull();
    expect(parseGuestRect({ x: 0, y: Infinity, width: 1, height: 1 })).toBeNull();
    expect(parseGuestRect({ x: 0, y: 0, width: -1, height: 1 })).toBeNull();
  });
});
