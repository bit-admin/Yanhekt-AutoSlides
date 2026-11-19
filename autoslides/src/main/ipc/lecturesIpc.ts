import { ipcMain, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { expandTilde, hasTraversalSegment, isPathInsideRoot } from '@main/infra/pathUtils';
import { readOutputDir } from '@main/infra/outputDir';
import { LECTURE_MEDIA_EXTENSIONS, LECTURE_SUBTITLE_EXTENSIONS } from '@common/lectureVideoNaming';
import { SLIDE_IMAGE_PATTERN } from '@common/slideVideo';
import { SLIDE_TIMELINE_FILENAME } from '@common/sidecars';
import type { IpcServices } from './types';
import { createLogger } from '@main/infra/logger';

const log = createLogger('LecturesIpc');

// Shared with asmediaProtocol and the renderer's bucketing so a format can
// never be scannable but unplayable (or vice versa). Includes the mic .aac.
const MEDIA_EXTENSIONS = LECTURE_MEDIA_EXTENSIONS;

/** A whole lecture's transcript is well under 1 MB; anything far past that is not one. */
const MAX_SUBTITLE_BYTES = 8 * 1024 * 1024;

function assertNoTraversal(targetPath: string): void {
  if (hasTraversalSegment(targetPath)) {
    throw new Error('Invalid path: contains traversal segments');
  }
}

export interface LectureVideoFileInfo {
  name: string;
  path: string;
  size: number;
  mtimeMs: number;
}

export interface LectureSlideFolderInfo {
  name: string;
  path: string;
  imageCount: number;
  mtimeMs: number;
  hasTimeline: boolean;
}

export function registerLecturesIpcHandlers(services: IpcServices): void {
  const { configService, localLecturePosterService } = services;

  ipcMain.handle('lectures:listVideos', async (): Promise<LectureVideoFileInfo[]> => {
    try {
      const outputDir = expandTilde(configService.getConfig().outputDirectory);
      const entries = await readOutputDir(outputDir);
      const videos: LectureVideoFileInfo[] = [];

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        // Subtitle sidecars are listed too; the renderer keeps them out of the
        // Library.
        if (!MEDIA_EXTENSIONS.has(ext) && !LECTURE_SUBTITLE_EXTENSIONS.has(ext)) continue;
        // Hidden files include a slide video still being written
        // (`.<name>.<pid>-<n>.partial.mp4`); `.compressing.tmp` is the retired
        // compress's temp, which an interrupted run may have left behind.
        if (entry.name.startsWith('.') || entry.name.includes('.compressing.tmp')) continue;

        const filePath = path.join(outputDir, entry.name);
        try {
          const stat = await fs.promises.stat(filePath);
          videos.push({
            name: entry.name,
            path: filePath,
            size: stat.size,
            mtimeMs: stat.mtimeMs,
          });
        } catch {
          // Unreadable entry — skip
        }
      }

      videos.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
      return videos;
    } catch (error) {
      log.error('Failed to list lecture videos:', error);
      throw error;
    }
  });

  /** `slides_*` folders, listed with a session's files and needed to make its slide video. */
  ipcMain.handle('lectures:listSlideFolders', async (): Promise<LectureSlideFolderInfo[]> => {
    const outputDir = expandTilde(configService.getConfig().outputDirectory);
    const entries = await readOutputDir(outputDir);
    const folders = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('slides_'))
        .map(async (entry): Promise<LectureSlideFolderInfo | null> => {
          const folderPath = path.join(outputDir, entry.name);
          try {
            const [stat, names, timeline] = await Promise.all([
              fs.promises.stat(folderPath),
              fs.promises.readdir(folderPath),
              fs.promises.stat(path.join(folderPath, SLIDE_TIMELINE_FILENAME)).catch(() => null),
            ]);
            return {
              name: entry.name,
              path: folderPath,
              imageCount: names.filter((name) => SLIDE_IMAGE_PATTERN.test(name)).length,
              mtimeMs: stat.mtimeMs,
              hasTimeline: Boolean(timeline?.isFile()),
            };
          } catch {
            return null; // unreadable folder
          }
        }),
    );
    return folders.filter((folder): folder is LectureSlideFolderInfo => folder !== null);
  });

  ipcMain.handle(
    'lectures:rename',
    async (
      _event,
      payload: { fromPath: string; toName: string },
    ): Promise<{ path: string; name: string }> => {
      try {
        const { fromPath, toName } = payload;
        if (!fromPath || !toName) {
          throw new Error('fromPath and toName are required');
        }
        assertNoTraversal(fromPath);
        assertNoTraversal(toName);

        // toName must be a bare filename
        if (toName.includes('/') || toName.includes('\\') || toName.includes('..')) {
          throw new Error('Invalid target name: must be a bare filename');
        }

        const outputDir = expandTilde(configService.getConfig().outputDirectory);
        if (!isPathInsideRoot(outputDir, fromPath)) {
          throw new Error('Source path is outside the output directory');
        }

        const fromResolved = path.resolve(fromPath);
        const toPath = path.join(path.dirname(fromResolved), toName);
        if (!isPathInsideRoot(outputDir, toPath)) {
          throw new Error('Target path is outside the output directory');
        }

        if (fromResolved === path.resolve(toPath)) {
          return { path: fromResolved, name: path.basename(fromResolved) };
        }

        if (fs.existsSync(toPath)) {
          throw new Error(`Target already exists: ${toName}`);
        }

        await fs.promises.rename(fromResolved, toPath);
        return { path: toPath, name: toName };
      } catch (error) {
        log.error('Failed to rename lecture video:', error);
        throw error;
      }
    },
  );

  ipcMain.handle('lectures:reveal', async (_event, filePath: string): Promise<void> => {
    try {
      assertNoTraversal(filePath);
      const outputDir = expandTilde(configService.getConfig().outputDirectory);
      if (!isPathInsideRoot(outputDir, filePath) && path.resolve(filePath) !== path.resolve(outputDir)) {
        throw new Error('Path is outside the output directory');
      }
      shell.showItemInFolder(path.resolve(filePath));
    } catch (error) {
      log.error('Failed to reveal lecture video:', error);
      throw error;
    }
  });

  ipcMain.handle('lectures:openOutputDirectory', async (): Promise<void> => {
    try {
      const outputDir = expandTilde(configService.getConfig().outputDirectory);
      const result = await shell.openPath(outputDir);
      if (result) {
        throw new Error(result);
      }
    } catch (error) {
      log.error('Failed to open output directory:', error);
      throw error;
    }
  });

  /** Open a video with the OS default player (codec fallback). */
  ipcMain.handle('lectures:openExternally', async (_event, filePath: string): Promise<void> => {
    try {
      assertNoTraversal(filePath);
      const outputDir = expandTilde(configService.getConfig().outputDirectory);
      if (!isPathInsideRoot(outputDir, filePath)) {
        throw new Error('Path is outside the output directory');
      }
      const result = await shell.openPath(path.resolve(filePath));
      if (result) {
        throw new Error(result);
      }
    } catch (error) {
      log.error('Failed to open lecture video externally:', error);
      throw error;
    }
  });

  /** A lecture's subtitle file as text, for the Lectures player; null when it cannot be read. */
  ipcMain.handle('lectures:readSubtitles', async (_event, filePath: string): Promise<string | null> => {
    try {
      if (typeof filePath !== 'string' || !filePath) return null;
      assertNoTraversal(filePath);
      const outputDir = expandTilde(configService.getConfig().outputDirectory);
      if (!isPathInsideRoot(outputDir, filePath)) {
        throw new Error('Path is outside the output directory');
      }
      const resolved = path.resolve(filePath);
      if (!LECTURE_SUBTITLE_EXTENSIONS.has(path.extname(resolved).toLowerCase())) {
        throw new Error('Not a subtitle file');
      }
      const stat = await fs.promises.stat(resolved);
      if (stat.size > MAX_SUBTITLE_BYTES) throw new Error('Subtitle file is too large');
      return await fs.promises.readFile(resolved, 'utf8');
    } catch (error) {
      log.error('Failed to read lecture subtitles:', error);
      return null;
    }
  });

  /** Lazy JPEG poster (data URL) for Library cards. */
  ipcMain.handle(
    'lectures:getPoster',
    async (
      _event,
      payload: { path: string; seekSeconds?: number },
    ): Promise<string | null> => {
      try {
        if (!payload?.path) return null;
        return await localLecturePosterService.getPoster(payload.path, payload.seekSeconds);
      } catch (error) {
        log.error('Failed to get lecture poster:', error);
        return null;
      }
    },
  );
}
