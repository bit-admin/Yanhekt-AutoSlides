/**
 * JSONL manifests (`trash-manifest.jsonl`, `crop-manifest.jsonl`) and the one
 * rule that keeps them true: everything that moves files in or out of a
 * managed folder, and everything that rewrites its manifest, runs one at a
 * time per folder.
 *
 * Without that, a restore that read the manifest, then moved files, then
 * wrote back what it had read would erase an entry appended meanwhile by
 * post-processing; the trashed file would stay on disk with nothing listing it.
 */
import { promises as fs } from 'fs';
import path from 'path';

const chains = new Map<string, Promise<unknown>>();

/**
 * Run `task` after everything already queued for `key` (a managed folder's
 * path). Different folders do not wait for each other. A task that throws
 * does not stop the ones behind it. Not re-entrant: a task must not take its
 * own key again.
 */
export function withFolderLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const id = path.resolve(key);
  const previous = chains.get(id) ?? Promise.resolve();
  const run = previous.then(task, task);
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  chains.set(id, settled);
  void settled.then(() => {
    if (chains.get(id) === settled) chains.delete(id);
  });
  return run;
}

/** Every parseable line of a manifest, in file order. A missing file is empty. */
export async function readManifest<T>(manifestPath: string, onBadLine?: (error: unknown) => void): Promise<T[]> {
  let content: string;
  try {
    content = await fs.readFile(manifestPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const entries: T[] = [];
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as T);
    } catch (error) {
      onBadLine?.(error);
    }
  }
  return entries;
}

let tempCounter = 0;

/**
 * Replace a manifest with `entries`, or remove it when there are none. The
 * new content is written beside it and renamed into place, so a crash or a
 * full disk leaves the old manifest whole, never half of the new one.
 */
export async function writeManifest<T>(manifestPath: string, entries: T[]): Promise<void> {
  if (entries.length === 0) {
    try {
      await fs.unlink(manifestPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    return;
  }
  const temp = `${manifestPath}.${process.pid}.${(tempCounter += 1)}.tmp`;
  const content = entries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
  try {
    await fs.writeFile(temp, content, 'utf8');
    await fs.rename(temp, manifestPath);
  } catch (error) {
    await fs.unlink(temp).catch(() => undefined);
    throw error;
  }
}

/** Add one line to a manifest. */
export async function appendManifest<T>(manifestPath: string, entry: T): Promise<void> {
  await fs.appendFile(manifestPath, JSON.stringify(entry) + '\n', 'utf8');
}
