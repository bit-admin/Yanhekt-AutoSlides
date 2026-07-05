import * as path from 'path';
import * as os from 'os';

/** Expand a leading `~` to the user's home directory. */
export function expandTilde(targetPath: string): string {
  return targetPath.startsWith('~') ? path.join(os.homedir(), targetPath.slice(1)) : targetPath;
}

/**
 * True when the path contains a `..` segment. Paths arriving from file
 * pickers, config, or directory listings never do — a `..` at an IPC
 * boundary indicates a traversal attempt or a renderer bug.
 */
export function hasTraversalSegment(targetPath: string): boolean {
  return targetPath.split(/[\\/]+/).includes('..');
}

/** Throw unless `name` is a bare filename (no separators, no traversal). */
export function assertBareFilename(name: string): void {
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    throw new Error('Invalid filename: contains path separators or traversal characters');
  }
}
