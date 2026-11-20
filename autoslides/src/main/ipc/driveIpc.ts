import path from 'path';
import { ipcMain } from 'electron';
import { createLogger } from '@main/infra/logger';
import { expandTilde } from '@main/infra/pathUtils';
import type { DriveResult } from '@common/driveStatus';
import type { SlideMetadataSource } from '@common/sidecars/metadata';
import type { LectureOutputQuery } from '@common/lectureOutputs';
import type { IpcServices } from './types';

const log = createLogger('DriveIpc');

/**
 * Drive calls name a folder by path; accept only a `slides_*` folder directly
 * inside the configured output folder.
 */
export function slidesFolderInside(outputDir: string, folderPath: unknown): string | null {
  if (typeof folderPath !== 'string' || !folderPath) return null;
  const root = path.resolve(expandTilde(outputDir));
  const resolved = path.resolve(expandTilde(folderPath));
  if (path.dirname(resolved) !== root) return null;
  return path.basename(resolved).startsWith('slides_') ? resolved : null;
}

/** The metadata `source` fields a clone may set, as strings (professors as a string list). */
function plainSource(source: Record<string, unknown> | undefined): SlideMetadataSource {
  const out: SlideMetadataSource = {};
  const str = (key: keyof SlideMetadataSource) => {
    const value = source?.[key];
    if (typeof value === 'string' && value) (out as Record<string, unknown>)[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) (out as Record<string, unknown>)[key] = String(value);
  };
  for (const key of ['courseId', 'sessionId', 'liveId', 'courseTitle', 'sessionTitle', 'instructor', 'college', 'schoolYear', 'semester'] as const) str(key);
  if (Array.isArray(source?.professors)) out.professors = source.professors.filter((p): p is string => typeof p === 'string');
  return out;
}

export function registerDriveIpcHandlers(services: IpcServices): void {
  const { configService, driveService, lectureOutputs } = services;
  const outputDir = () => configService.getConfig().outputDirectory;

  const inFolder = async <T>(folderPath: unknown, fn: (folder: string) => Promise<DriveResult<T>>): Promise<DriveResult<T>> => {
    const folder = slidesFolderInside(outputDir(), folderPath);
    if (!folder) return { ok: false, error: 'not-found' };
    try {
      return await fn(folder);
    } catch (error) {
      log.error('Drive call failed', error);
      return { ok: false, error: 'failed', message: error instanceof Error ? error.message : String(error) };
    }
  };

  ipcMain.handle('drive:folders', async () => {
    try {
      return { ok: true, data: await driveService.folderSummaries(outputDir()) };
    } catch (error) {
      log.error('Drive folder list failed', error);
      return { ok: false, error: 'failed', message: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('drive:folder', (_e, folderPath: string) =>
    inFolder(folderPath, async (folder) => ({ ok: true, data: await driveService.folderSummary(folder) })));

  // Progress goes to the window that asked, on `drive:progress`.
  ipcMain.handle('drive:upload', (event, folderPath: string, jobId: string) =>
    inFolder(folderPath, (folder) => driveService.uploadFolder(folder, (progress) => {
      if (!event.sender.isDestroyed()) event.sender.send('drive:progress', progress);
    }, typeof jobId === 'string' && jobId ? jobId : undefined)));

  ipcMain.handle('drive:cancel', (_e, jobId: string) => {
    if (typeof jobId === 'string') driveService.cancel(jobId);
  });

  ipcMain.handle('drive:recordClone', (_e, folderPath: string, input: { source?: Record<string, unknown>; slides?: Array<{ filename?: unknown; url?: unknown }> }) =>
    inFolder(folderPath, (folder) => driveService.recordClone(folder, {
      source: plainSource(input?.source),
      slides: Array.isArray(input?.slides)
        ? input.slides.map((s) => ({ filename: String(s?.filename ?? ''), url: String(s?.url ?? '') }))
        : [],
    })));

  ipcMain.handle('lectureOutputs:probe', async (_e, queries: LectureOutputQuery[]) => {
    if (!Array.isArray(queries)) return [];
    return lectureOutputs.probe(outputDir(), queries.map((q) => ({
      key: String(q?.key ?? ''),
      courseId: q?.courseId != null ? String(q.courseId) : undefined,
      sessionId: q?.sessionId != null ? String(q.sessionId) : undefined,
      videoFile: typeof q?.videoFile === 'string' ? q.videoFile : undefined,
    })));
  });

  ipcMain.handle('lectureOutputs:retire', async (_e, target: { slidesFolders?: string[]; videoFiles?: string[] }) =>
    lectureOutputs.retire(outputDir(), {
      slidesFolders: Array.isArray(target?.slidesFolders) ? target.slidesFolders.map(String) : [],
      videoFiles: Array.isArray(target?.videoFiles) ? target.videoFiles.map(String) : [],
    }));
}
