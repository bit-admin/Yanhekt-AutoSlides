import { invoke } from './invoke';
import type { ElectronAPI } from './electronApi';
import type { LectureIdentity } from '@common/lectureNaming';
import type {
  NotesResult,
  UploadedImage,
  ExportFolderInfo,
  ShareImportResult,
} from '@common/notesTypes';

/** Share keeps the historical cloudNotes name; the Yanhekt token stays in main. */
export const cloudNotes: ElectronAPI['cloudNotes'] = {
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
  resolveShareLink: (link: string): Promise<NotesResult<ShareImportResult>> =>
    invoke('cloudNotes:resolveShareLink', link),
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
