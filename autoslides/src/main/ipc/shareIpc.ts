import { ipcMain } from 'electron';
import { ShareAuthError } from '@main/platform/shareService';
import type { LectureIdentity } from '@common/lectureNaming';
import type { NotesResult } from '@common/notesTypes';
import { createLogger } from '@main/infra/logger';
import type { IpcServices } from './types';

const log = createLogger('ShareIpc');

async function run<T>(fn: () => Promise<T>): Promise<NotesResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof ShareAuthError) {
      return { ok: false, error: 'not-signed-in' };
    }
    const message = err instanceof Error ? err.message : String(err);
    log.error('share operation failed:', message);
    return { ok: false, error: message };
  }
}

export function registerShareIpcHandlers({ shareService }: IpcServices): void {
  // Share keeps its existing cloudNotes bridge/channel names.
  ipcMain.handle('cloudNotes:uploadImage', (_e, bytes: ArrayBuffer, filename: string, mime: string) =>
    run(() => shareService.uploadImage(bytes, filename, mime)));

  ipcMain.handle('cloudNotes:uploadImageFromPath', (_e, filePath: string) =>
    run(() => shareService.uploadImageFromPath(filePath)));

  ipcMain.handle('cloudNotes:exportFolderStatus', (_e, displayName: string, identity?: LectureIdentity) =>
    run(() => shareService.exportFolderStatus(displayName, identity)));

  ipcMain.handle('cloudNotes:prepareExportFolder', (_e, displayName: string, mode: 'fresh' | 'create', identity?: LectureIdentity) =>
    run(() => shareService.prepareExportFolder(displayName, mode, identity)));

  ipcMain.handle('cloudNotes:downloadImageToFolder', (_e, url: string, dir: string, filename: string) =>
    run(() => shareService.downloadImageToFolder(url, dir, filename)));

  ipcMain.handle('cloudNotes:shortenShareUrl', (_e, fragment: string) =>
    run(() => shareService.shortenShareUrl(fragment)));

  ipcMain.handle(
    'cloudNotes:resolveShareLink',
    (_e, link: string, opts?: { requireTimeline?: boolean }) =>
      run(() => shareService.resolveShareLink(link, opts)),
  );
}
