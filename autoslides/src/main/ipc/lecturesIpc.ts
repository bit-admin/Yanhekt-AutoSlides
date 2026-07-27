import { ipcMain, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { expandTilde, hasTraversalSegment, isPathInsideRoot } from '@main/infra/pathUtils';
import type { IpcServices } from './types';
import { createLogger } from '@main/infra/logger';

const log = createLogger('LecturesIpc');

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv']);

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

export function registerLecturesIpcHandlers(services: IpcServices): void {
  const { configService, localLecturePosterService } = services;

  ipcMain.handle('lectures:listVideos', async (): Promise<LectureVideoFileInfo[]> => {
    try {
      const outputDir = expandTilde(configService.getConfig().outputDirectory);
      const entries = await fs.promises.readdir(outputDir, { withFileTypes: true });
      const videos: LectureVideoFileInfo[] = [];

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (!VIDEO_EXTENSIONS.has(ext)) continue;
        // Skip in-progress compress temps
        if (entry.name.includes('.compressing.tmp')) continue;

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
