import { ipcRenderer } from 'electron';

export const video = {
  getLiveStreamUrls: (stream: Record<string, unknown>, token: string) =>
    ipcRenderer.invoke('video:getLiveStreamUrls', stream, token),
  getVideoPlaybackUrls: (session: Record<string, unknown>, token: string) =>
    ipcRenderer.invoke('video:getVideoPlaybackUrls', session, token),
  getScreenThumbnail: (req: {
    kind: 'live' | 'recorded';
    screenUrl: string;
    seekSeconds: number;
    cacheKey: string;
    token: string;
  }) => ipcRenderer.invoke('video:getScreenThumbnail', req) as Promise<string | null>,
  registerClient: () => ipcRenderer.invoke('video:registerClient'),
  unregisterClient: (clientId: string) => ipcRenderer.invoke('video:unregisterClient', clientId),
  stopProxy: () => ipcRenderer.invoke('video:stopProxy'),
  stopSignatureLoop: () => ipcRenderer.invoke('video:stopSignatureLoop'),
};

export const ffmpeg = {
  getPath: () => ipcRenderer.invoke('ffmpeg:getPath'),
  isAvailable: () => ipcRenderer.invoke('ffmpeg:isAvailable'),
  getPlatformInfo: () => ipcRenderer.invoke('ffmpeg:getPlatformInfo'),
  warmUp: () => ipcRenderer.invoke('ffmpeg:warmUp'),
};

type CompressLectureOptions = {
  inputPath: string;
  outputPath?: string;
  preset?: 'tiny' | 'small' | 'readable';
  audioPreset?: 'low' | 'mid' | 'high' | 'max';
  audioFilterPreset?: 'none' | 'clean' | 'speech' | 'strong' | 'loudnorm';
  cropMode?: 'none' | '4:3' | 'auto';
  filterMode?: 'none' | 'denoise' | 'sharpen' | 'both';
  scaler?: 'lanczos' | 'bicubic';
  container?: 'mp4' | 'mkv';
  opusVbr?: 'on' | 'constrained' | 'off';
  opusFrameDuration?: 20 | 40 | 60;
  keepAac?: boolean;
  x265Params?: string;
};

type CompressLectureProgress = {
  phase: 'preparing' | 'cropdetect' | 'encoding' | 'completed';
  current: number;
  total: number;
  message?: string;
};

export const compressLecture = {
  selectInput: () => ipcRenderer.invoke('compressLecture:selectInput') as Promise<string | null>,
  selectOutput: (defaultPath?: string) => ipcRenderer.invoke('compressLecture:selectOutput', defaultPath) as Promise<string | null>,
  preview: (options: CompressLectureOptions) => ipcRenderer.invoke('compressLecture:preview', options),
  start: (options: CompressLectureOptions) => ipcRenderer.invoke('compressLecture:start', options) as Promise<{ outputPath: string }>,
  cancel: () => ipcRenderer.invoke('compressLecture:cancel') as Promise<boolean>,
  isActive: () => ipcRenderer.invoke('compressLecture:isActive') as Promise<boolean>,
  onProgress: (callback: (progress: CompressLectureProgress) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, progress: CompressLectureProgress) => callback(progress);
    ipcRenderer.on('compressLecture:progress', handler);
    return () => ipcRenderer.removeListener('compressLecture:progress', handler);
  },
  onCompleted: (callback: (result: { outputPath: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, result: { outputPath: string }) => callback(result);
    ipcRenderer.on('compressLecture:completed', handler);
    return () => ipcRenderer.removeListener('compressLecture:completed', handler);
  },
  onError: (callback: (error: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, error: string) => callback(error);
    ipcRenderer.on('compressLecture:error', handler);
    return () => ipcRenderer.removeListener('compressLecture:error', handler);
  },
};

export const download = {
  start: (downloadId: string, m3u8Url: string, outputName: string) =>
    ipcRenderer.invoke('download:start', downloadId, m3u8Url, outputName),
  cancel: (downloadId: string) => ipcRenderer.invoke('download:cancel', downloadId),
  isActive: (downloadId: string) => ipcRenderer.invoke('download:isActive', downloadId),
  onProgress: (callback: (downloadId: string, progress: { current: number; total: number; phase: number }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, downloadId: string, progress: { current: number; total: number; phase: number }) => callback(downloadId, progress);
    ipcRenderer.on('download:progress', handler);
    return () => ipcRenderer.removeListener('download:progress', handler);
  },
  onCompleted: (callback: (downloadId: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, downloadId: string) => callback(downloadId);
    ipcRenderer.on('download:completed', handler);
    return () => ipcRenderer.removeListener('download:completed', handler);
  },
  onError: (callback: (downloadId: string, error: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, downloadId: string, error: string) => callback(downloadId, error);
    ipcRenderer.on('download:error', handler);
    return () => ipcRenderer.removeListener('download:error', handler);
  },
};
