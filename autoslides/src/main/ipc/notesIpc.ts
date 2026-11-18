import { ipcMain } from 'electron';
import { NotesAuthError } from '@main/platform/notesService';
import type { IpcServices } from './types';
import { OWNED_NOTE_METHODS, type NotesResult, type NoteListParams } from '@common/notesTypes';
import { createOwnedNotesDispatch, type OwnedNotesDeps } from './notesOwner';
import type { LectureIdentity } from '@common/lectureNaming';
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
  const { notesService, configService } = services;

  // The calls that can also be made for a named account (`cloudNotes:asOwner`).
  const owned: OwnedNotesDeps['handlers'] = {
    list: (params: NoteListParams) => run(() => notesService.list(params)),
    get: (id: number) => run(() => notesService.get(id)),
    create: () => run(() => notesService.create()),
    updateTitle: (id: number, title: string, groupId?: number) => run(() => notesService.updateTitle(id, title, groupId)),
    updateContent: (id: number, content: string) => run(() => notesService.updateContent(id, content)),
    moveToGroup: (id: number, groupId: number, title: string, content?: string) =>
      run(() => notesService.moveToGroup(id, groupId, title, content)),
    delete: (id: number) => run(() => notesService.remove(id)),
    groupList: () => run(() => notesService.groupList()),
    groupCreate: (name: string) => run(() => notesService.groupCreate(name)),
    groupDelete: (id: number) => run(() => notesService.groupRemove(id)),
    uploadImage: (bytes: ArrayBuffer, filename: string, mime: string) =>
      run(() => notesService.uploadImage(bytes, filename, mime)),
    uploadImageFromPath: (filePath: string) => run(() => notesService.uploadImageFromPath(filePath)),
  };
  for (const method of OWNED_NOTE_METHODS) {
    const handler = owned[method] as (...args: unknown[]) => Promise<NotesResult<unknown>>;
    ipcMain.handle(`cloudNotes:${method}`, (_e, ...args: unknown[]) => handler(...args));
  }

  const asOwner = createOwnedNotesDispatch({
    activeAccount: () => {
      const token = configService.getAuthToken();
      if (!token) return null;
      const badge = configService.getConfig().accounts.find((account) => account.token === token)?.badge;
      return badge ? { token, badge } : null;
    },
    withToken: (token, fn) => notesService.withToken(token, fn),
    handlers: owned,
  });
  ipcMain.handle('cloudNotes:asOwner', (_e, badge: unknown, method: unknown, args: unknown) => asOwner(badge, method, args));

  ipcMain.handle('cloudNotes:exportFolderStatus', (_e, displayName: string, identity?: LectureIdentity) =>
    run(() => notesService.exportFolderStatus(displayName, identity)));

  ipcMain.handle('cloudNotes:prepareExportFolder', (_e, displayName: string, mode: 'fresh' | 'create', identity?: LectureIdentity) =>
    run(() => notesService.prepareExportFolder(displayName, mode, identity)));

  ipcMain.handle('cloudNotes:downloadImageToFolder', (_e, url: string, dir: string, filename: string) =>
    run(() => notesService.downloadImageToFolder(url, dir, filename)));

  ipcMain.handle('cloudNotes:shortenShareUrl', (_e, fragment: string) =>
    run(() => notesService.shortenShareUrl(fragment)));

  ipcMain.handle(
    'cloudNotes:resolveShareLink',
    (_e, link: string, opts?: { requireTimeline?: boolean }) =>
      run(() => notesService.resolveShareLink(link, opts)),
  );
}
