import { ipcRenderer } from 'electron';
import { invoke } from './invoke';
import type {
  ElectronAPI,
  LiveStreamInput,
  RecordedSessionInput,
  SlideVideoProgress,
  SlideVideoRequest,
  SlideVideoResult,
} from './electronApi';

export const video: ElectronAPI['video'] = {
  getLiveStreamUrls: (stream: LiveStreamInput) =>
    invoke('video:getLiveStreamUrls', stream),
  getVideoPlaybackUrls: (session: RecordedSessionInput, token: string) =>
    invoke('video:getVideoPlaybackUrls', session, token),
  prepareDevPlayback: (url, account) => invoke('video:prepareDevPlayback', url, account),
  getScreenThumbnail: (req: {
    kind: 'live' | 'recorded';
    screenUrl: string;
    liveTarget?: string;
    liveRoomUrl?: string;
    seekSeconds: number;
    cacheKey: string;
    token: string;
  }) => invoke('video:getScreenThumbnail', req) as Promise<string | null>,
  registerClient: () => invoke('video:registerClient'),
  unregisterClient: (clientId: string) => invoke('video:unregisterClient', clientId),
  stopSignatureLoop: () => invoke('video:stopSignatureLoop'),
};

export const slideVideo: ElectronAPI['slideVideo'] = {
  make: (request: SlideVideoRequest) => invoke('slideVideo:make', request) as Promise<SlideVideoResult>,
  cancel: () => invoke('slideVideo:cancel') as Promise<boolean>,
  isActive: () => invoke('slideVideo:isActive') as Promise<boolean>,
  onProgress: (callback: (progress: SlideVideoProgress) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, progress: SlideVideoProgress) => callback(progress);
    ipcRenderer.on('slideVideo:progress', handler);
    return () => ipcRenderer.removeListener('slideVideo:progress', handler);
  },
};

export const download: ElectronAPI['download'] = {
  start: (downloadId: string, m3u8Url: string, outputName: string) =>
    invoke('download:start', downloadId, m3u8Url, outputName),
  startAudio: (downloadId: string, audioUrl: string, outputName: string) =>
    invoke('download:startAudio', downloadId, audioUrl, outputName),
  startYanhe2: (downloadId, account, query, kind, outputName) =>
    invoke('download:startYanhe2', downloadId, account, query, kind, outputName),
  prepareDev: (url, account) => invoke('download:prepareDev', url, account),
  startDev: (downloadId, url, account, outputName) => invoke('download:startDev', downloadId, url, account, outputName),
  cancel: (downloadId: string) => invoke('download:cancel', downloadId),
  cleanupTempFiles: (outputName: string) => invoke('download:cleanupTempFiles', outputName),
  onProgress: (callback: (downloadId: string, progress: { current: number; total: number; phase: number }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, downloadId: string, progress: { current: number; total: number; phase: number }) => callback(downloadId, progress);
    ipcRenderer.on('download:progress', handler);
    return () => ipcRenderer.removeListener('download:progress', handler);
  },
  onCompleted: (callback: (downloadId: string, filePath?: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, downloadId: string, filePath?: string) =>
      callback(downloadId, typeof filePath === 'string' ? filePath : undefined);
    ipcRenderer.on('download:completed', handler);
    return () => ipcRenderer.removeListener('download:completed', handler);
  },
  onError: (callback: (downloadId: string, error: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, downloadId: string, error: string) => callback(downloadId, error);
    ipcRenderer.on('download:error', handler);
    return () => ipcRenderer.removeListener('download:error', handler);
  },
};
