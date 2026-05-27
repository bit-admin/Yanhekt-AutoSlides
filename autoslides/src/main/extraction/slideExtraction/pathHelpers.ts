import * as path from 'path';
import * as fs from 'fs/promises';

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
