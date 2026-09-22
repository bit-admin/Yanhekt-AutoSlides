import { ipcRenderer } from 'electron';
import type { ElectronAPI } from './electronApi';
import type { LectureIdentity } from '@common/lectureNaming';
import type {
  NotesResult,
  NoteListParams,
  NoteListResult,
  NoteDetail,
  NoteGroup,
  UploadedImage,
  ExportFolderInfo,
  ShareImportResult,
  IndexStats,
  IndexLecture,
  IndexLectureDetail,
  IndexRemovalResult,
} from '@common/notesTypes';
import type { SlideMetadataSource } from '@common/slideMetadataTypes';

/**
 * Yanhekt cloud-notes bridge. All calls round-trip to the main process, which
 * holds the auth token (mirrored from the main window's localStorage into
 * electron-store) and performs the actual API requests — the Tools window has
 * no token of its own.
 */
export const cloudNotes: ElectronAPI['cloudNotes'] = {
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
  moveToGroup: (
    id: number,
    groupId: number,
    title: string,
    content?: string,
  ): Promise<NotesResult<number>> =>
    ipcRenderer.invoke('cloudNotes:moveToGroup', id, groupId, title, content),
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
  // `identity` must be a plain object — a Vue reactive/ref would throw an
  // opaque DataCloneError on the structured-clone hop (see CLAUDE.md).
  exportFolderStatus: (displayName: string, identity?: LectureIdentity): Promise<NotesResult<ExportFolderInfo>> =>
    ipcRenderer.invoke('cloudNotes:exportFolderStatus', displayName, identity),
  prepareExportFolder: (displayName: string, mode: 'fresh' | 'create', identity?: LectureIdentity): Promise<NotesResult<ExportFolderInfo>> =>
    ipcRenderer.invoke('cloudNotes:prepareExportFolder', displayName, mode, identity),
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
  resolveShareLink: (
    link: string,
    opts?: { requireTimeline?: boolean },
  ): Promise<NotesResult<ShareImportResult>> =>
    ipcRenderer.invoke('cloudNotes:resolveShareLink', link, opts),
  indexStats: (): Promise<NotesResult<IndexStats>> =>
    ipcRenderer.invoke('cloudNotes:indexStats'),
  indexSearch: (q: string, semesterIds?: number[]): Promise<NotesResult<IndexLecture[]>> =>
    ipcRenderer.invoke('cloudNotes:indexSearch', q, semesterIds),
  indexLecture: (courseId: string, sessionId: string): Promise<NotesResult<IndexLectureDetail>> =>
    ipcRenderer.invoke('cloudNotes:indexLecture', courseId, sessionId),
  requestIndexRemoval: (courseId: string, sessionId: string): Promise<NotesResult<IndexRemovalResult>> =>
    ipcRenderer.invoke('cloudNotes:requestIndexRemoval', courseId, sessionId),
};

/**
 * Obsidian watch-notes bridge. Tab id + plain values only; the main process
 * resolves and remembers each tab's note and slides folder.
 */
export const obsidianNotes: ElectronAPI['obsidianNotes'] = {
  probeVault: (dir) => ipcRenderer.invoke('obsidianNotes:probeVault', dir),
  selectVault: () => ipcRenderer.invoke('obsidianNotes:selectVault'),
  openAuto: (tabId, title, slidesFolderName) =>
    ipcRenderer.invoke('obsidianNotes:openAuto', tabId, title, slidesFolderName),
  chooseNote: (tabId, slidesFolderName) => ipcRenderer.invoke('obsidianNotes:chooseNote', tabId, slidesFolderName),
  append: (tabId, bytes, filename) => ipcRenderer.invoke('obsidianNotes:append', tabId, bytes, filename),
  close: (tabId) => ipcRenderer.invoke('obsidianNotes:close', tabId),
  openInObsidian: (tabId) => ipcRenderer.invoke('obsidianNotes:openInObsidian', tabId),
  reveal: (tabId) => ipcRenderer.invoke('obsidianNotes:reveal', tabId),
  useFoundVault: (tabId) => ipcRenderer.invoke('obsidianNotes:useFoundVault', tabId),
};
