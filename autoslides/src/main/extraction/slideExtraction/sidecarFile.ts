/**
 * Reading and writing one JSON sidecar (`metadata.json`, `timeline.json`).
 *
 * - **One writer at a time per file.** Read-modify-write calls queue behind
 *   each other, so two updates cannot drop one another's change.
 * - **A write replaces the file whole.** The new content goes to a file beside
 *   it and is renamed into place: a crash or a full disk leaves the previous
 *   sidecar, never a truncated one.
 * - **Missing, damaged and unreadable are different.** Missing means "this
 *   folder has no sidecar" (updaters do nothing, by design: no backfill). A
 *   file that does not parse is set aside under another name before anything
 *   is written in its place, so its content can still be recovered. A file
 *   that cannot be read at all (permissions, I/O) is never written over,
 *   because what it holds is unknown.
 * - **A failed write is reported**, to the log and to the caller. The main
 *   flow may carry on, but it can tell.
 */
import { promises as fs } from 'fs';
import path from 'path';

export type SidecarRead<T> =
  | { state: 'ok'; value: T }
  | { state: 'missing' }
  /** The file exists but is not the JSON object it should be. */
  | { state: 'invalid'; error: unknown }
  /** The file could not be read (not "does not exist"). */
  | { state: 'unreadable'; error: unknown };

/**
 * `written`: the new content is on disk. `unchanged`: the update decided there
 * was nothing to write. `failed`: the write was attempted and did not land
 * (the previous content is intact). `blocked`: the existing file could not be
 * read, so it was left alone.
 */
export type SidecarWrite = 'written' | 'unchanged' | 'failed' | 'blocked';

interface SidecarLog {
  warn(message: string, ...detail: unknown[]): void;
  error(message: string, ...detail: unknown[]): void;
}

let tempCounter = 0;

export class SidecarFile<T extends object> {
  private chains = new Map<string, Promise<unknown>>();

  constructor(
    private readonly label: string,
    private readonly log: SidecarLog,
  ) {}

  /** What is on disk right now. Does not wait for queued writes. */
  async read(filePath: string): Promise<SidecarRead<T>> {
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { state: 'missing' };
      this.log.warn(`Failed to read ${this.label} at ${filePath}:`, error);
      return { state: 'unreadable', error };
    }
    try {
      const value = JSON.parse(content) as unknown;
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('not a JSON object');
      }
      return { state: 'ok', value: value as T };
    } catch (error) {
      this.log.warn(`${this.label} at ${filePath} is damaged:`, error);
      return { state: 'invalid', error };
    }
  }

  /** Resolves once every write queued for this file so far has finished. */
  async settled(filePath: string): Promise<void> {
    await (this.chains.get(filePath) ?? Promise.resolve());
  }

  /**
   * Queue a read-modify-write. `update` gets the current value (null when the
   * file is missing or was damaged) and returns the next one, or null to
   * write nothing.
   */
  mutate(filePath: string, update: (current: T | null) => T | null): Promise<SidecarWrite> {
    const prior = this.chains.get(filePath) ?? Promise.resolve();
    const run = prior.then(() => this.apply(filePath, update));
    // `apply` does not reject, but a throwing `update` must not wedge the queue.
    const tail = run.catch(() => undefined);
    this.chains.set(filePath, tail);
    void tail.then(() => {
      if (this.chains.get(filePath) === tail) this.chains.delete(filePath);
    });
    return run;
  }

  private async apply(filePath: string, update: (current: T | null) => T | null): Promise<SidecarWrite> {
    const current = await this.read(filePath);
    if (current.state === 'unreadable') return 'blocked';

    const next = update(current.state === 'ok' ? current.value : null);
    if (!next) return 'unchanged';

    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      if (current.state === 'invalid') {
        const aside = `${filePath}.damaged-${Date.now()}`;
        await fs.rename(filePath, aside);
        this.log.warn(`Kept the damaged ${this.label} as ${aside} before writing a new one`);
      }
      await writeFileAtomic(filePath, JSON.stringify(next, null, 2));
      return 'written';
    } catch (error) {
      this.log.error(`Failed to write ${this.label} at ${filePath}:`, error);
      return 'failed';
    }
  }
}

/** Write `content` beside `filePath`, flush it, then rename it into place. */
export async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  const temp = `${filePath}.${process.pid}.${(tempCounter += 1)}.tmp`;
  try {
    const handle = await fs.open(temp, 'w');
    try {
      await handle.writeFile(content, 'utf8');
      // Without this a power loss can leave the renamed file empty.
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temp, filePath);
  } catch (error) {
    await fs.unlink(temp).catch(() => undefined);
    throw error;
  }
}
