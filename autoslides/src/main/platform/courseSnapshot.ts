/**
 * Temporary: search earlier Yanhekt terms from a course list bundled with the
 * app (`vendor/course-snapshot/<schoolYear>-<semester>.json.gz`), or imported
 * into `<userData>/course-snapshot/` from files of the same format.
 *
 * Yanhekt's own course search only covers the current term. Until the course
 * index can stand in, this snapshot answers "which courses ran in that term"
 * with id, Chinese name and teachers only; the renderer loads everything else
 * from `/v1/course` per result. An imported term replaces the built-in one.
 * Clear Cache removes the imported folder (`cachePaths.ts`).
 *
 * File format, one file per term, named `2023-2024-1.json.gz` (or `.json`):
 * a JSON array of `[courseId, "中文课程名", ["教师", …]]`.
 *
 * Delete this file, the vendor folder and its `extraResource` entry when the
 * index replaces it.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzip, gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { app } from 'electron';
import { createLogger } from '@main/infra/logger';
import { isTermKey } from '@common/courseSnapshotTerm';
import type {
  CourseSnapshotImportResult,
  CourseSnapshotPage,
  CourseSnapshotRejectReason,
  CourseSnapshotRow,
  CourseSnapshotTerm,
} from '@common/apiTypes';

const log = createLogger('CourseSnapshot');
const gunzipAsync = promisify(gunzip);
const gzipAsync = promisify(gzip);

/** A snapshot file name: the term key, then `.json.gz` or `.json`. */
const FILE_NAME = /^(\d{4}-\d{4}-[12])\.json(\.gz)?$/i;

/** The folder under userData that imported terms go to. Clear Cache removes it. */
export const COURSE_SNAPSHOT_DIR_NAME = 'course-snapshot';

interface Entry {
  row: CourseSnapshotRow;
  /** Normalized name and teachers, for matching. */
  name: string;
  teachers: string[];
}

/** Width-fold (NFKC: full-width letters, Ⅱ → II), lower-case, no whitespace. */
export function normalizeForMatch(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

/** One `[id, name, teachers]` row, or null when it does not have that shape. */
export function parseRow(raw: unknown): CourseSnapshotRow | null {
  if (!Array.isArray(raw)) return null;
  const [id, name, teachers] = raw as [unknown, unknown, unknown];
  const idText = typeof id === 'number' ? String(id) : typeof id === 'string' ? id.trim() : '';
  if (!/^\d+$/.test(idText) || typeof name !== 'string' || !name.trim()) return null;
  if (teachers !== undefined && !Array.isArray(teachers)) return null;
  const list = (teachers ?? []).filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean);
  return { id: String(Number(idText)), name: name.split(/\s+/).filter(Boolean).join(' '), teachers: list };
}

/** File bytes (gzip or plain) → rows. Throws when it is not a JSON array. */
async function decodeFile(bytes: Buffer): Promise<unknown[]> {
  const isGzip = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  const text = (isGzip ? await gunzipAsync(bytes) : bytes).toString('utf8').replace(/^\uFEFF/, '');
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('not a JSON array');
  return parsed;
}

function toEntry(row: CourseSnapshotRow): Entry {
  return { row, name: normalizeForMatch(row.name), teachers: row.teachers.map(normalizeForMatch) };
}

/**
 * Rank one entry against the keyword's words, or -1 when a word is missing.
 * Every word must appear in the name or in a teacher's name. A name that
 * equals the whole keyword ranks first, then a name that starts with the
 * first word, then any other name match, then teacher-only matches.
 */
function rank(entry: Entry, words: string[], whole: string): number {
  let nameHits = 0;
  for (const word of words) {
    const inName = entry.name.includes(word);
    if (inName) nameHits++;
    else if (!entry.teachers.some((t) => t.includes(word))) return -1;
  }
  if (entry.name === whole) return 4;
  if (nameHits > 0 && entry.name.startsWith(words[0])) return 3;
  if (nameHits > 0) return 2;
  return 1;
}

/** One page of matches, best first; newer courses (higher id) first within a rank. */
export function searchEntries(entries: readonly Entry[], keyword: string, page: number, pageSize: number): Omit<CourseSnapshotPage, 'term'> {
  const words = keyword.split(/\s+/).map(normalizeForMatch).filter(Boolean);
  const whole = words.join('');
  const hits: { entry: Entry; score: number }[] = [];
  for (const entry of entries) {
    const score = words.length === 0 ? 0 : rank(entry, words, whole);
    if (score >= 0) hits.push({ entry, score });
  }
  hits.sort((a, b) => b.score - a.score || Number(b.entry.row.id) - Number(a.entry.row.id));
  const size = Math.max(1, Math.floor(pageSize));
  const lastPage = Math.max(1, Math.ceil(hits.length / size));
  const current = Math.min(Math.max(1, Math.floor(page)), lastPage);
  const start = (current - 1) * size;
  return {
    total: hits.length,
    current_page: current,
    last_page: lastPage,
    data: hits.slice(start, start + size).map((h) => h.entry.row),
  };
}

export interface CourseSnapshotDirs {
  /** Shipped with the app. */
  builtin: () => string;
  /** Imported by the user; wins over the built-in file of the same term. */
  imported: () => string;
}

export class CourseSnapshotService {
  /** term → its entries, or null when no folder has that term. */
  private readonly terms = new Map<string, Promise<Entry[] | null>>();
  private listing: Promise<CourseSnapshotTerm[]> | null = null;

  constructor(private readonly dirs: CourseSnapshotDirs = defaultSnapshotDirs) {}

  /** Null when the term is not in the snapshot. */
  async search(term: string, keyword: string, page = 1, pageSize = 16): Promise<CourseSnapshotPage | null> {
    if (!isTermKey(term)) return null;
    const entries = await this.load(term);
    if (!entries) return null;
    return { term, ...searchEntries(entries, keyword ?? '', page, pageSize) };
  }

  /** Every term either folder has, newest first, with its course count and source. */
  list(): Promise<CourseSnapshotTerm[]> {
    this.listing ??= this.readListing().catch((error: unknown) => {
      this.listing = null;
      throw error;
    });
    return this.listing;
  }

  /**
   * Copy snapshot files into the imported folder, one term per file. Each file
   * is checked and rewritten in the canonical gzip form; a file that does not
   * fit the format is reported and skipped, the rest still import.
   */
  async importFiles(filePaths: readonly string[]): Promise<CourseSnapshotImportResult> {
    const imported: CourseSnapshotImportResult['imported'] = [];
    const rejected: CourseSnapshotImportResult['rejected'] = [];
    const reject = (file: string, reason: CourseSnapshotRejectReason) => rejected.push({ file: path.basename(file), reason });

    const target = this.dirs.imported();
    await fs.mkdir(target, { recursive: true });
    for (const file of filePaths) {
      const term = FILE_NAME.exec(path.basename(file))?.[1];
      if (!term || !isTermKey(term)) {
        reject(file, 'name');
        continue;
      }
      let raw: unknown[];
      try {
        raw = await decodeFile(await fs.readFile(file));
      } catch (error: unknown) {
        log.warn(`Course snapshot import: ${path.basename(file)} unreadable:`, error);
        reject(file, 'format');
        continue;
      }
      const rows = raw.map(parseRow);
      if (rows.some((r) => r === null)) {
        reject(file, 'format');
        continue;
      }
      if (rows.length === 0) {
        reject(file, 'empty');
        continue;
      }
      // One row per id, the last one winning, in id order like the built-in files.
      const byId = new Map((rows as CourseSnapshotRow[]).map((r) => [r.id, r]));
      const sorted = [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id));
      const out = `[\n${sorted.map((r) => JSON.stringify([Number(r.id), r.name, r.teachers])).join(',\n')}\n]\n`;
      const dest = path.join(target, `${term}.json.gz`);
      const temp = `${dest}.${process.pid}.tmp`;
      await fs.writeFile(temp, await gzipAsync(out, { level: 9 }));
      await fs.rename(temp, dest);
      this.terms.delete(term);
      imported.push({ term, courses: sorted.length });
    }
    this.listing = null;
    log.info(`Imported ${imported.length} term(s), rejected ${rejected.length}`);
    return { imported, rejected };
  }

  /** Forget everything read so far, after Clear Cache removed the imported folder. */
  reset(): void {
    this.terms.clear();
    this.listing = null;
  }

  private load(term: string): Promise<Entry[] | null> {
    let pending = this.terms.get(term);
    if (!pending) {
      pending = this.readTerm(term);
      this.terms.set(term, pending);
    }
    return pending;
  }

  private async readTerm(term: string): Promise<Entry[] | null> {
    for (const dir of [this.dirs.imported(), this.dirs.builtin()]) {
      const rows = await this.readRows(path.join(dir, `${term}.json.gz`));
      if (rows) {
        log.info(`Loaded ${rows.length} courses for ${term} from ${dir}`);
        return rows.map(toEntry);
      }
    }
    return null;
  }

  /** Rows of one file, malformed rows skipped. Null when missing or unreadable. */
  private async readRows(file: string): Promise<CourseSnapshotRow[] | null> {
    try {
      const raw = await decodeFile(await fs.readFile(file));
      return raw.map(parseRow).filter((r): r is CourseSnapshotRow => r !== null);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') log.warn(`Course snapshot ${file} unreadable:`, error);
      return null;
    }
  }

  private async termsIn(dir: string): Promise<string[]> {
    try {
      return (await fs.readdir(dir))
        .map((name) => /^(\d{4}-\d{4}-[12])\.json\.gz$/.exec(name)?.[1])
        .filter((t): t is string => t !== undefined && isTermKey(t));
    } catch {
      return [];
    }
  }

  private async readListing(): Promise<CourseSnapshotTerm[]> {
    const builtinDir = this.dirs.builtin();
    const importedDir = this.dirs.imported();
    const builtin = new Set(await this.termsIn(builtinDir));
    const imported = new Set(await this.termsIn(importedDir));
    const out: CourseSnapshotTerm[] = [];
    for (const term of new Set([...builtin, ...imported])) {
      const fromImport = imported.has(term);
      // Counted without keeping the rows: only terms that get searched stay in memory.
      const rows = await this.readRows(path.join(fromImport ? importedDir : builtinDir, `${term}.json.gz`));
      if (!rows) continue;
      out.push({
        term,
        courses: rows.length,
        source: fromImport ? 'imported' : 'builtin',
        replacesBuiltin: fromImport && builtin.has(term),
      });
    }
    return out.sort((a, b) => (a.term < b.term ? 1 : a.term > b.term ? -1 : 0));
  }
}

/** Packaged: `<resources>/course-snapshot` (forge `extraResource`). Dev: the vendor folder. */
const defaultSnapshotDirs: CourseSnapshotDirs = {
  builtin: () =>
    app.isPackaged
      ? path.join(process.resourcesPath, 'course-snapshot')
      : path.join(app.getAppPath(), 'vendor', 'course-snapshot'),
  imported: () => path.join(app.getPath('userData'), COURSE_SNAPSHOT_DIR_NAME),
};
