/**
 * What a lecture already has in the output folder, and moving it aside for a
 * fresh run (issue #45: re-queuing a lecture used to download over its video
 * and extract into its old slides folder, where the Extractor appends to
 * `timeline.json`).
 *
 * A lecture is found by its id block (`__c<course>s<session>`), which every
 * Yanhekt download and slides folder carries, so the built-in and Qt folder
 * names need not agree on the rest of the name.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { createLogger } from '@main/infra/logger';
import { readOutputDir } from '@main/infra/outputDir';
import { expandTilde } from '@main/infra/pathUtils';
import { driveFolderCounts, type DriveFileStat } from '@common/driveStatus';
import { buildLectureIdSuffix, parseLectureIds } from '@common/lectureNaming';
import type { LectureOutputQuery, LectureOutputState, LectureSlidesState } from '@common/lectureOutputs';
import type { SlideMetadataService } from './slideMetadataService';

const log = createLogger('LectureOutputs');

const isSlideFile = (name: string): boolean => name.startsWith('Slide_') && name.endsWith('.png');
/** A bare name inside the output folder: no separators, nothing above it. */
const isBareName = (name: string): boolean =>
  !!name && !name.includes('/') && !name.includes('\\') && name !== '.' && name !== '..';

type Metadata = Pick<SlideMetadataService, 'read' | 'carryShares'>;

export interface LectureOutputsDeps {
  metadata: Metadata;
  /** Moves `slides_*` folders (and their trash / crop backups) to the system trash. */
  removeFolders: (names: string[], outputDir: string) => Promise<{ removed: number; failed: number }>;
  /** Moves one file to the system trash. */
  trashFile: (filePath: string) => Promise<void>;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function slideStats(folderPath: string): Promise<DriveFileStat[]> {
  try {
    const names = (await fs.readdir(folderPath)).filter(isSlideFile);
    const stats = await Promise.all(names.map(async (name) => {
      const stat = await fs.stat(path.join(folderPath, name)).catch(() => null);
      return stat?.isFile() ? { name, size: stat.size, mtimeMs: stat.mtimeMs } : null;
    }));
    return stats.filter((s): s is DriveFileStat => s !== null);
  } catch {
    return [];
  }
}

export class LectureOutputs {
  constructor(private readonly deps: LectureOutputsDeps) {}

  /** One state per query, in order. Folders are listed once for the whole batch. */
  async probe(outputDir: string, queries: LectureOutputQuery[]): Promise<LectureOutputState[]> {
    const root = path.resolve(expandTilde(outputDir));
    const folders = (await readOutputDir(root).catch(() => []))
      .filter((e) => e.isDirectory() && e.name.startsWith('slides'))
      .map((e) => e.name);

    return Promise.all(queries.map(async (query): Promise<LectureOutputState> => {
      const videoPath = query.videoFile && isBareName(query.videoFile) ? path.join(root, query.videoFile) : null;
      const videoExists = videoPath ? await exists(videoPath) : false;
      const suffix = buildLectureIdSuffix({ courseId: query.courseId, sessionId: query.sessionId });
      // Only a course + session id names one lecture; a course id alone is every session.
      const mine = query.sessionId && suffix.includes('s') ? folders.filter((name) => name.endsWith(suffix)) : [];
      return { key: query.key, videoExists, slides: await this.slidesState(root, mine) };
    }));
  }

  private async slidesState(root: string, names: string[]): Promise<LectureSlidesState | null> {
    if (names.length === 0) return null;
    const states = await Promise.all(names.map(async (name) => {
      const folderPath = path.join(root, name);
      const files = await slideStats(folderPath);
      const meta = await this.deps.metadata.read(folderPath).catch(() => null);
      return {
        name,
        folderPath,
        slideCount: files.length,
        extracted: !!meta?.extraction && files.length > 0,
        cropped: !!meta?.review?.cropped,
        reviewed: !!meta?.review?.reviewed,
        edited: !!meta?.review?.edited,
        uploaded: driveFolderCounts(meta, files).uploaded,
        shares: meta?.shares?.length ?? 0,
        slideVideo: await exists(`${folderPath}.mp4`),
      };
    }));
    // The folder that looks most complete speaks for the lecture.
    states.sort((a, b) => Number(b.extracted) - Number(a.extracted) || b.slideCount - a.slideCount);
    const [main] = states;
    return {
      folders: states.map((s) => s.name),
      folderPath: main.folderPath,
      slideCount: main.slideCount,
      extracted: states.some((s) => s.extracted),
      cropped: states.some((s) => s.cropped),
      reviewed: states.some((s) => s.reviewed),
      edited: states.some((s) => s.edited),
      uploaded: states.reduce((sum, s) => sum + s.uploaded, 0),
      shares: states.reduce((sum, s) => sum + s.shares, 0),
      slideVideo: states.some((s) => s.slideVideo),
    };
  }

  /**
   * Move a lecture's slides folders and/or video files to the system trash
   * before a fresh run. Share records of the folders go to the next folder of
   * the same lecture; upload records do not (those files are gone).
   */
  async retire(
    outputDir: string,
    target: { slidesFolders?: string[]; videoFiles?: string[] },
  ): Promise<{ removed: number; failed: number }> {
    const root = path.resolve(expandTilde(outputDir));
    const folders = (target.slidesFolders ?? []).filter((n) => isBareName(n) && n.startsWith('slides'));
    const videos = (target.videoFiles ?? []).filter(isBareName);
    let removed = 0;
    let failed = 0;

    for (const name of folders) {
      const meta = await this.deps.metadata.read(path.join(root, name), { afterWrites: true }).catch(() => null);
      const ids = parseLectureIds(name);
      const suffix = buildLectureIdSuffix(ids);
      if (meta?.shares?.length && suffix) this.deps.metadata.carryShares(suffix, meta.shares);
    }
    if (folders.length > 0) {
      const outcome = await this.deps.removeFolders(folders, root);
      removed += outcome.removed;
      failed += outcome.failed;
    }
    for (const name of videos) {
      const filePath = path.join(root, name);
      if (!(await exists(filePath))) continue;
      try {
        await this.deps.trashFile(filePath);
        removed++;
      } catch (error) {
        failed++;
        log.error('Could not move the old video to the trash', filePath, error);
      }
    }
    return { removed, failed };
  }
}
