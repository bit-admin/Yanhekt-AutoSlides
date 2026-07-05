import * as path from 'path';
import * as os from 'os';

/** Expand a leading `~` to the user's home directory. */
export function expandTilde(targetPath: string): string {
  return targetPath.startsWith('~') ? path.join(os.homedir(), targetPath.slice(1)) : targetPath;
}
