import { invoke } from './invoke';
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
} from '@common/notesTypes';

/**
 * Yanhekt cloud-notes bridge. All calls round-trip to the main process, which
 * holds the auth token (mirrored from the main window's localStorage into
 * electron-store) and performs the actual API requests — the Tools window has
 * no token of its own.
 */
export const cloudNotes: ElectronAPI['cloudNotes'] = {
  list: (params: NoteListParams = {}): Promise<NotesResult<NoteListResult>> =>
    invoke('cloudNotes:list', params),
  get: (id: number): Promise<NotesResult<NoteDetail>> =>
    invoke('cloudNotes:get', id),
  create: (): Promise<NotesResult<number>> =>
    invoke('cloudNotes:create'),
  updateTitle: (id: number, title: string, groupId?: number): Promise<NotesResult<void>> =>
    invoke('cloudNotes:updateTitle', id, title, groupId),
  updateContent: (id: number, content: string): Promise<NotesResult<void>> =>
    invoke('cloudNotes:updateContent', id, content),
  moveToGroup: (
    id: number,
    groupId: number,
    title: string,
    content?: string,
  ): Promise<NotesResult<number>> =>
    invoke('cloudNotes:moveToGroup', id, groupId, title, content),
  delete: (id: number): Promise<NotesResult<void>> =>
    invoke('cloudNotes:delete', id),
  groupList: (): Promise<NotesResult<NoteGroup[]>> =>
    invoke('cloudNotes:groupList'),
  groupCreate: (name: string): Promise<NotesResult<void>> =>
    invoke('cloudNotes:groupCreate', name),
  groupDelete: (id: number): Promise<NotesResult<void>> =>
    invoke('cloudNotes:groupDelete', id),
  uploadImage: (bytes: ArrayBuffer, filename: string, mime: string): Promise<NotesResult<UploadedImage>> =>
    invoke('cloudNotes:uploadImage', bytes, filename, mime),
  uploadImageFromPath: (filePath: string): Promise<NotesResult<UploadedImage>> =>
    invoke('cloudNotes:uploadImageFromPath', filePath),
  // `identity` must be a plain object — a Vue reactive/ref would throw an
  // opaque DataCloneError on the structured-clone hop (see CLAUDE.md).
  exportFolderStatus: (displayName: string, identity?: LectureIdentity): Promise<NotesResult<ExportFolderInfo>> =>
    invoke('cloudNotes:exportFolderStatus', displayName, identity),
  prepareExportFolder: (displayName: string, mode: 'fresh' | 'create', identity?: LectureIdentity): Promise<NotesResult<ExportFolderInfo>> =>
    invoke('cloudNotes:prepareExportFolder', displayName, mode, identity),
  downloadImageToFolder: (url: string, dir: string, filename: string): Promise<NotesResult<void>> =>
    invoke('cloudNotes:downloadImageToFolder', url, dir, filename),
  shortenShareUrl: (fragment: string): Promise<NotesResult<{ url: string }>> =>
    invoke('cloudNotes:shortenShareUrl', fragment),
  resolveShareLink: (
    link: string,
    opts?: { requireTimeline?: boolean },
  ): Promise<NotesResult<ShareImportResult>> =>
    invoke('cloudNotes:resolveShareLink', link, opts),
};

/**
 * Obsidian watch-notes bridge. Tab id + plain values only; the main process
 * resolves and remembers each tab's note and slides folder.
 */
export const obsidianNotes: ElectronAPI['obsidianNotes'] = {
  probeVault: (dir) => invoke('obsidianNotes:probeVault', dir),
  selectVault: () => invoke('obsidianNotes:selectVault'),
  openAuto: (tabId, title, slidesFolderName) =>
    invoke('obsidianNotes:openAuto', tabId, title, slidesFolderName),
  chooseNote: (tabId, slidesFolderName) => invoke('obsidianNotes:chooseNote', tabId, slidesFolderName),
  append: (tabId, bytes, filename) => invoke('obsidianNotes:append', tabId, bytes, filename),
  close: (tabId) => invoke('obsidianNotes:close', tabId),
  openInObsidian: (tabId) => invoke('obsidianNotes:openInObsidian', tabId),
  reveal: (tabId) => invoke('obsidianNotes:reveal', tabId),
  useFoundVault: (tabId) => invoke('obsidianNotes:useFoundVault', tabId),
};

/**
 * Notion watch-notes bridge. Tab id + plain values only; main keeps the token
 * and each tab's page (Settings can read the token back to show it).
 */
export const notionNotes: ElectronAPI['notionNotes'] = {
  connect: (token) => invoke('notionNotes:connect', token),
  getToken: () => invoke('notionNotes:getToken'),
  disconnect: () => invoke('notionNotes:disconnect'),
  searchPages: (query, cursor) => invoke('notionNotes:searchPages', query, cursor),
  choosePage: (tabId, pageId) => invoke('notionNotes:choosePage', tabId, pageId),
  append: (tabId, bytes, filename) => invoke('notionNotes:append', tabId, bytes, filename),
  close: (tabId) => invoke('notionNotes:close', tabId),
  openPage: (tabId) => invoke('notionNotes:openPage', tabId),
};
