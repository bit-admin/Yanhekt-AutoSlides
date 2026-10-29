import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getName: () => 'AutoSlides', getVersion: () => '5.2.0' } }));

import { appPlatform, appUserAgent } from './appUserAgent';

const realPlatform = process.platform;
const realArch = process.arch;
function as(platform: string, arch: string) {
  Object.defineProperty(process, 'platform', { value: platform });
  Object.defineProperty(process, 'arch', { value: arch });
}

describe('appUserAgent', () => {
  afterEach(() => as(realPlatform, realArch));

  it('names the platform and architecture after the version', () => {
    as('win32', 'x64');
    expect(appUserAgent()).toBe('AutoSlides/5.2.0 (Windows; x64)');
    as('darwin', 'arm64');
    expect(appUserAgent()).toBe('AutoSlides/5.2.0 (macOS; arm64)');
    expect(appPlatform()).toBe('macOS; arm64');
    as('linux', 'x64');
    expect(appUserAgent()).toBe('AutoSlides/5.2.0 (Linux; x64)');
  });

  it('passes an unknown platform through', () => {
    as('freebsd', 'x64');
    expect(appUserAgent()).toBe('AutoSlides/5.2.0 (freebsd; x64)');
  });

  it('keeps the AutoSlides/<version> prefix the servers parse', () => {
    expect(appUserAgent().match(/AutoSlides\/(\d+(?:\.\d+)*)/i)?.[1]).toBe('5.2.0');
  });
});
