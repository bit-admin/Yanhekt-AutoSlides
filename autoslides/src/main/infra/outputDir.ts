import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { formatOutputDirProblem, type OutputDirProblemKind } from '@common/outputDirAccess';
import { isPathInsideRoot } from './pathUtils';

function codeOf(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | null)?.code;
}

function isAccessDenied(error: unknown): boolean {
  const code = codeOf(error);
  return code === 'EPERM' || code === 'EACCES';
}

function isNotFound(error: unknown): boolean {
  const code = codeOf(error);
  return code === 'ENOENT' || code === 'ENOTDIR';
}

// Anything under the home folder may be created recursively — home is always
// mounted, and a Linux account without ~/Downloads still gets the default.
// Elsewhere the parent must already exist: a missing parent outside home is
// most likely a disconnected drive, and creating it would plant a plain folder
// where the drive mounts (macOS then mounts it beside as "Name 1").
function isInsideHome(dir: string): boolean {
  const home = os.homedir();
  return path.resolve(dir) !== path.resolve(home) && isPathInsideRoot(home, dir);
}

async function parentExists(dir: string): Promise<boolean> {
  try {
    await fs.promises.stat(path.dirname(path.resolve(dir)));
    return true;
  } catch (error) {
    return !isNotFound(error);
  }
}

function parentExistsSync(dir: string): boolean {
  try {
    fs.statSync(path.dirname(path.resolve(dir)));
    return true;
  } catch (error) {
    return !isNotFound(error);
  }
}

async function missingKind(dir: string): Promise<OutputDirProblemKind> {
  return isInsideHome(dir) || (await parentExists(dir)) ? 'missing' : 'unreachable';
}

/**
 * List the configured output folder. A permission refusal or a missing folder
 * is rethrown with the `@common/outputDirAccess` marker so the renderer can
 * explain it; every other error propagates unchanged. Never creates anything.
 */
export async function readOutputDir(dir: string): Promise<fs.Dirent[]> {
  try {
    return await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (isAccessDenied(error)) throw new Error(formatOutputDirProblem('denied', dir));
    if (isNotFound(error)) throw new Error(formatOutputDirProblem(await missingKind(dir), dir));
    throw error;
  }
}

/**
 * Cheap health check for the output folder (no stat per entry). `error`
 * carries the marker for a denied / missing / unreachable folder; any other
 * failure is not something to warn about and reports ok.
 */
export async function probeOutputDir(dir: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const handle = await fs.promises.opendir(dir);
    await handle.close();
    return { ok: true };
  } catch (error) {
    if (isAccessDenied(error)) return { ok: false, error: formatOutputDirProblem('denied', dir) };
    if (isNotFound(error)) return { ok: false, error: formatOutputDirProblem(await missingKind(dir), dir) };
    return { ok: true };
  }
}

/**
 * User-requested "create it again". Refuses an unreachable folder and reports
 * a denied one, both with the marker.
 */
export async function recreateOutputDir(dir: string): Promise<void> {
  const insideHome = isInsideHome(dir);
  if (!insideHome && !(await parentExists(dir))) {
    throw new Error(formatOutputDirProblem('unreachable', dir));
  }
  try {
    await fs.promises.mkdir(dir, { recursive: insideHome });
  } catch (error) {
    if (codeOf(error) === 'EEXIST') return;
    if (isAccessDenied(error)) throw new Error(formatOutputDirProblem('denied', dir));
    if (isNotFound(error)) throw new Error(formatOutputDirProblem('unreachable', dir));
    throw error;
  }
}

/**
 * Launch / folder-change creation (synchronous: runs in the ConfigService
 * constructor). Same safety rule as `recreateOutputDir`; returns what happened
 * instead of throwing so startup never fails on it.
 */
export function ensureOutputDirSync(dir: string): 'exists' | 'created' | 'unreachable' | 'failed' {
  try {
    if (fs.statSync(dir).isDirectory()) return 'exists';
  } catch {
    // Missing, or unreadable (macOS privacy protection) — try to create below.
  }
  const insideHome = isInsideHome(dir);
  if (!insideHome && !parentExistsSync(dir)) return 'unreachable';
  try {
    fs.mkdirSync(dir, { recursive: insideHome });
    return 'created';
  } catch (error) {
    return codeOf(error) === 'EEXIST' ? 'exists' : 'failed';
  }
}
