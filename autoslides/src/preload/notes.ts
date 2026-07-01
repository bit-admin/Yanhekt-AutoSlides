import { ipcRenderer } from 'electron';
import type {
  NotesResult,
  NoteListParams,
  NoteListResult,
  NoteDetail,
  NoteGroup,
  UploadedImage,
  ExportFolderInfo,
  ShareImportResult,
} from '@common/notesTypes';
import type { SlideMetadataSource } from '@common/slideMetadataTypes';

/**
 * Yanhekt cloud-notes bridge. All calls round-trip to the main process, which
 * holds the auth token (mirrored from the main window's localStorage into
 * electron-store) and performs the actual API requests — the Tools window has
 * no token of its own.
 */
export const cloudNotes = {
  list: (params: NoteListParams = {}): Promise<NotesResult<NoteListResult>> =>
    ipcRenderer.invoke('cloudNotes:list', params),
  get: (id: number): Promise<NotesResult<NoteDetail>> =>
    ipcRenderer.invoke('cloudNotes:get', id),
  create: (): Promise<NotesResult<number>> =>
    ipcRenderer.invoke('cloudNotes:create'),
  updateTitle: (id: number, title: string, groupId?: number): Promise<NotesResult<void>> =>
    ipcRenderer.invoke('cloudNotes:updateTitle', id, title, groupId),
  updateContent: (id: number, content: string): Promise<NotesResult<void>> =>
    ipcRenderer.invoke('cloudNotes:updateContent', id, content),
  moveToGroup: (id: number, groupId: number): Promise<NotesResult<void>> =>
    ipcRenderer.invoke('cloudNotes:moveToGroup', id, groupId),
  delete: (id: number): Promise<NotesResult<void>> =>
    ipcRenderer.invoke('cloudNotes:delete', id),
  groupList: (): Promise<NotesResult<NoteGroup[]>> =>
    ipcRenderer.invoke('cloudNotes:groupList'),
  groupCreate: (name: string): Promise<NotesResult<void>> =>
    ipcRenderer.invoke('cloudNotes:groupCreate', name),
  groupDelete: (id: number): Promise<NotesResult<void>> =>
    ipcRenderer.invoke('cloudNotes:groupDelete', id),
  uploadImage: (bytes: ArrayBuffer, filename: string, mime: string): Promise<NotesResult<UploadedImage>> =>
    ipcRenderer.invoke('cloudNotes:uploadImage', bytes, filename, mime),
  uploadImageFromPath: (filePath: string): Promise<NotesResult<UploadedImage>> =>
    ipcRenderer.invoke('cloudNotes:uploadImageFromPath', filePath),
  exportFolderStatus: (displayName: string): Promise<NotesResult<ExportFolderInfo>> =>
    ipcRenderer.invoke('cloudNotes:exportFolderStatus', displayName),
  prepareExportFolder: (displayName: string, mode: 'fresh' | 'create'): Promise<NotesResult<ExportFolderInfo>> =>
    ipcRenderer.invoke('cloudNotes:prepareExportFolder', displayName, mode),
  downloadImageToFolder: (url: string, dir: string, filename: string): Promise<NotesResult<void>> =>
    ipcRenderer.invoke('cloudNotes:downloadImageToFolder', url, dir, filename),
  shortenShareUrl: (fragment: string): Promise<NotesResult<{ url: string }>> =>
    ipcRenderer.invoke('cloudNotes:shortenShareUrl', fragment),
  publishToIndex: (
    fragment: string,
    source: SlideMetadataSource,
    review: { reviewed: boolean; edited: boolean },
  ): Promise<NotesResult<{ shareId: string; indexUrl: string; duplicate: boolean }>> =>
    ipcRenderer.invoke('cloudNotes:publishToIndex', fragment, source, review),
  resolveShareLink: (link: string): Promise<NotesResult<ShareImportResult>> =>
    ipcRenderer.invoke('cloudNotes:resolveShareLink', link),
};
