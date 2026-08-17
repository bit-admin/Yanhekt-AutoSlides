import * as path from 'path';

/**
 * Chromium-managed cache directories under userData (and under each
 * Partitions/<name>/). Session.clearCache / clearCodeCaches cover HTTP +
 * V8/WASM; GPU/Dawn/shader dirs have no session API and are deleted as files.
 */
export const CHROMIUM_CACHE_DIR_NAMES = [
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'DawnCache',
  'ShaderCache',
  'GrShaderCache',
  'GraphiteDawnCache',
] as const;

/** GPU / Dawn / shader caches — no Electron session API, filesystem only. */
export const FILESYSTEM_ONLY_CACHE_DIR_NAMES = [
  'GPUCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'DawnCache',
  'ShaderCache',
  'GrShaderCache',
  'GraphiteDawnCache',
] as const;

/** App-owned caches next to Chromium's userData tree. */
export const APP_CACHE_DIR_NAMES = [
  'thumbnails',
  'lecture-posters',
  'updates',
] as const;

export function collectCacheRoots(
  userDataPath: string,
  appTempPath: string,
  partitionNames: string[] = [],
): string[] {
  const roots: string[] = [];

  for (const name of CHROMIUM_CACHE_DIR_NAMES) {
    roots.push(path.join(userDataPath, name));
  }
  for (const name of APP_CACHE_DIR_NAMES) {
    roots.push(path.join(userDataPath, name));
  }
  roots.push(appTempPath);

  for (const partition of partitionNames) {
    const base = path.join(userDataPath, 'Partitions', partition);
    for (const name of CHROMIUM_CACHE_DIR_NAMES) {
      roots.push(path.join(base, name));
    }
  }

  return roots;
}

export function collectFilesystemOnlyCacheRoots(
  userDataPath: string,
  partitionNames: string[] = [],
): string[] {
  const roots: string[] = [];
  for (const name of FILESYSTEM_ONLY_CACHE_DIR_NAMES) {
    roots.push(path.join(userDataPath, name));
  }
  for (const partition of partitionNames) {
    const base = path.join(userDataPath, 'Partitions', partition);
    for (const name of FILESYSTEM_ONLY_CACHE_DIR_NAMES) {
      roots.push(path.join(base, name));
    }
  }
  return roots;
}
