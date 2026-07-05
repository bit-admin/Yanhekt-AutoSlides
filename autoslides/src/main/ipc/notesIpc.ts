import { ipcMain } from 'electron';
import { NotesAuthError } from '@main/platform/notesService';
import type { IpcServices } from './types';
import type { NotesResult, NoteListParams } from '@common/notesTypes';
import type { SlideMetadataSource } from '@common/slideMetadataTypes';
import { createLogger } from '@main/infra/logger';

const log = createLogger('NotesIpc');

/**
 * Wrap a service call in the uniform `{ ok, data } | { ok:false, error }` envelope
 * so the renderer can cleanly surface auth/network failures (the Tools window has
 * no token of its own — it relies on the main-window-mirrored electron-store token).
 */
async function run<T>(fn: () => Promise<T>): Promise<NotesResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof NotesAuthError) {
      return { ok: false, error: 'not-signed-in' };
    }
    const message = err instanceof Error ? err.message : String(err);
    log.error('note operation failed:', message);
    return { ok: false, error: message };
  }
}

export function registerNotesIpcHandlers(services: IpcServices): void {
  const { notesService } = services;

  ipcMain.handle('cloudNotes:list', (_e, params: NoteListParams) =>
    run(() => notesService.list(params)));

  ipcMain.handle('cloudNotes:get', (_e, id: number) =>
    run(() => notesService.get(id)));

  ipcMain.handle('cloudNotes:create', () =>
    run(() => notesService.create()));

  ipcMain.handle('cloudNotes:updateTitle', (_e, id: number, title: string, groupId?: number) =>
    run(() => notesService.updateTitle(id, title, groupId)));

  ipcMain.handle('cloudNotes:updateContent', (_e, id: number, content: string) =>
    run(() => notesService.updateContent(id, content)));

  ipcMain.handle('cloudNotes:moveToGroup', (_e, id: number, groupId: number) =>
    run(() => notesService.moveToGroup(id, groupId)));

  ipcMain.handle('cloudNotes:delete', (_e, id: number) =>
    run(() => notesService.remove(id)));

  ipcMain.handle('cloudNotes:groupList', () =>
    run(() => notesService.groupList()));

  ipcMain.handle('cloudNotes:groupCreate', (_e, name: string) =>
    run(() => notesService.groupCreate(name)));

  ipcMain.handle('cloudNotes:groupDelete', (_e, id: number) =>
    run(() => notesService.groupRemove(id)));

  ipcMain.handle('cloudNotes:uploadImage', (_e, bytes: ArrayBuffer, filename: string, mime: string) =>
    run(() => notesService.uploadImage(bytes, filename, mime)));

  ipcMain.handle('cloudNotes:uploadImageFromPath', (_e, filePath: string) =>
    run(() => notesService.uploadImageFromPath(filePath)));

  ipcMain.handle('cloudNotes:exportFolderStatus', (_e, displayName: string) =>
    run(() => notesService.exportFolderStatus(displayName)));

  ipcMain.handle('cloudNotes:prepareExportFolder', (_e, displayName: string, mode: 'fresh' | 'create') =>
    run(() => notesService.prepareExportFolder(displayName, mode)));

  ipcMain.handle('cloudNotes:downloadImageToFolder', (_e, url: string, dir: string, filename: string) =>
    run(() => notesService.downloadImageToFolder(url, dir, filename)));

  ipcMain.handle('cloudNotes:shortenShareUrl', (_e, fragment: string) =>
    run(() => notesService.shortenShareUrl(fragment)));

  ipcMain.handle(
    'cloudNotes:publishToIndex',
    (_e, fragment: string, source: SlideMetadataSource, review: { reviewed: boolean; edited: boolean }) =>
      run(() => notesService.publishToIndex(fragment, source, review)),
  );

  ipcMain.handle('cloudNotes:resolveShareLink', (_e, link: string) =>
    run(() => notesService.resolveShareLink(link)));

  ipcMain.handle('cloudNotes:indexStats', () =>
    run(() => notesService.indexStats()));

  ipcMain.handle('cloudNotes:indexSearch', (_e, q: string) =>
    run(() => notesService.indexSearch(q)));

  ipcMain.handle('cloudNotes:indexLecture', (_e, courseId: string, sessionId: string) =>
    run(() => notesService.indexLecture(courseId, sessionId)));

  ipcMain.handle('cloudNotes:requestIndexRemoval', (_e, courseId: string, sessionId: string) =>
    run(() => notesService.requestIndexRemoval(courseId, sessionId)));
}
