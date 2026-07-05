import * as path from 'path';
import * as fs from 'fs/promises';

export { expandTilde } from '@main/infra/pathUtils';

/**
 * Reject filenames containing path traversal characters and enforce the
 * `Slide_*.png` naming convention used throughout the extraction pipeline.
 */
export function validateSlideFilename(filename: string): void {
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid filename: contains path traversal characters');
  }
  if (!filename.endsWith('.png') || !filename.startsWith('Slide_')) {
    throw new Error('Invalid filename: must be a slide PNG file (Slide_*.png)');
  }
}

export function getRootOutputDirectory(sessionOutputPath: string): string {
  return path.dirname(sessionOutputPath);
}

export function getRelativePathFromRoot(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath);
}

export function isPathInside(basePath: string, targetPath: string): boolean {
  const relativePath = path.relative(basePath, targetPath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
