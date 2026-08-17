import * as path from 'path';
import { describe, expect, it } from 'vitest';
import {
  APP_CACHE_DIR_NAMES,
  CHROMIUM_CACHE_DIR_NAMES,
  collectCacheRoots,
  collectFilesystemOnlyCacheRoots,
} from './cachePaths';

describe('collectCacheRoots', () => {
  it('includes Chromium, app, and temp roots', () => {
    const roots = collectCacheRoots('/data', '/tmp/AutoSlides');
    expect(roots).toContain(path.join('/data', 'Cache'));
    expect(roots).toContain(path.join('/data', 'Code Cache'));
    expect(roots).toContain(path.join('/data', 'GPUCache'));
    expect(roots).toContain(path.join('/data', 'thumbnails'));
    expect(roots).toContain(path.join('/data', 'lecture-posters'));
    expect(roots).toContain(path.join('/data', 'updates'));
    expect(roots).toContain('/tmp/AutoSlides');
    expect(roots).toHaveLength(
      CHROMIUM_CACHE_DIR_NAMES.length + APP_CACHE_DIR_NAMES.length + 1,
    );
  });

  it('adds each partition\'s Chromium cache dirs, not cookies or Local Storage', () => {
    const roots = collectCacheRoots('/data', '/tmp/AutoSlides', ['webcapture', 'yuketang']);
    expect(roots).toContain(path.join('/data', 'Partitions', 'webcapture', 'Cache'));
    expect(roots).toContain(path.join('/data', 'Partitions', 'yuketang', 'Code Cache'));
    expect(roots.every((root) => !root.endsWith('Cookies'))).toBe(true);
    expect(roots.every((root) => !root.includes('Local Storage'))).toBe(true);
  });
});

describe('collectFilesystemOnlyCacheRoots', () => {
  it('does not include HTTP or code cache (session APIs own those)', () => {
    const roots = collectFilesystemOnlyCacheRoots('/data', ['webcapture']);
    expect(roots).toContain(path.join('/data', 'GPUCache'));
    expect(roots).toContain(path.join('/data', 'Partitions', 'webcapture', 'DawnWebGPUCache'));
    expect(roots.some((root) => root.endsWith(`${path.sep}Cache`))).toBe(false);
    expect(roots.some((root) => root.includes('Code Cache'))).toBe(false);
  });
});
