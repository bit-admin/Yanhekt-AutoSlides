import { describe, expect, it } from 'vitest';
import { findDeepLinkArg, parseDeepLink } from './deepLink';

describe('parseDeepLink', () => {
  it('reads a course link', () => {
    expect(parseDeepLink('autoslides://course/70101')).toEqual({ kind: 'course', courseId: '70101' });
  });

  it('reads a session link', () => {
    expect(parseDeepLink('autoslides://session/850101')).toEqual({ kind: 'session', sessionId: '850101' });
  });

  it('allows a trailing slash, a triple slash, case and a query', () => {
    expect(parseDeepLink('autoslides://session/850101/')).toEqual({ kind: 'session', sessionId: '850101' });
    expect(parseDeepLink('autoslides:///course/70101')).toEqual({ kind: 'course', courseId: '70101' });
    expect(parseDeepLink('AutoSlides://Course/70101')).toEqual({ kind: 'course', courseId: '70101' });
    expect(parseDeepLink('autoslides://course/70101?from=web#top')).toEqual({ kind: 'course', courseId: '70101' });
    expect(parseDeepLink('  autoslides://course/70101  ')).toEqual({ kind: 'course', courseId: '70101' });
  });

  it('normalizes leading zeros', () => {
    expect(parseDeepLink('autoslides://course/0070101')).toEqual({ kind: 'course', courseId: '70101' });
  });

  it('rejects anything else', () => {
    for (const raw of [
      '',
      'not a url',
      'https://www.yanhekt.cn/session/850101',
      'autoslides://',
      'autoslides://course',
      'autoslides://course/',
      'autoslides://course/abc',
      'autoslides://course/-1',
      'autoslides://course/1.5',
      'autoslides://course/0',
      'autoslides://course/1234567890123456',
      'autoslides://course/70101/extra',
      'autoslides://live/70101',
      'autoslides://download/850101',
      'autoslides://settings/output_dir',
      'autoslidesx://course/70101',
    ]) {
      expect(parseDeepLink(raw), raw).toBeNull();
    }
  });
});

describe('findDeepLinkArg', () => {
  it('finds the link among Chromium switches', () => {
    expect(findDeepLinkArg(['C:\\AutoSlides.exe', '--allow-file-access', 'autoslides://session/850101'])).toBe(
      'autoslides://session/850101',
    );
  });

  it('returns null without one', () => {
    expect(findDeepLinkArg(['/usr/bin/autoslides', '--no-sandbox'])).toBeNull();
  });
});
