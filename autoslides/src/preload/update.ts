import { ipcRenderer } from 'electron';

export const update = {
  checkForUpdates: () => ipcRenderer.invoke('update:checkForUpdates'),
  onCheckForUpdates: (callback: () => void) => ipcRenderer.on('menu:checkForUpdates', () => callback()),
  onAutoCheckForUpdates: (callback: () => void) => ipcRenderer.on('update:autoCheck', () => callback()),
  getReleaseInfo: () => ipcRenderer.invoke('update:getReleaseInfo'),
  downloadUpdate: (url: string, filename: string) => ipcRenderer.invoke('update:downloadUpdate', url, filename),
  cancelDownload: () => ipcRenderer.invoke('update:cancelDownload'),
  isDownloading: () => ipcRenderer.invoke('update:isDownloading'),
  onDownloadProgress: (callback: (progress: { downloaded: number; total: number; percent: number }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, progress: { downloaded: number; total: number; percent: number }) => callback(progress);
    ipcRenderer.on('update:downloadProgress', handler);
    return () => ipcRenderer.removeListener('update:downloadProgress', handler);
  },
  onDownloadComplete: (callback: (filename: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, filename: string) => callback(filename);
    ipcRenderer.on('update:downloadComplete', handler);
    return () => ipcRenderer.removeListener('update:downloadComplete', handler);
  },
  onDownloadError: (callback: (error: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, error: string) => callback(error);
    ipcRenderer.on('update:downloadError', handler);
    return () => ipcRenderer.removeListener('update:downloadError', handler);
  },
  onPromptQuit: (callback: (filename: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, filename: string) => callback(filename);
    ipcRenderer.on('update:promptQuit', handler);
    return () => ipcRenderer.removeListener('update:promptQuit', handler);
  },
  openDownloadFolder: () => ipcRenderer.invoke('update:openDownloadFolder'),
  getDownloadFolder: () => ipcRenderer.invoke('update:getDownloadFolder'),
  installUpdate: (filename: string) => ipcRenderer.invoke('update:installUpdate', filename),
  listDownloadedUpdates: () => ipcRenderer.invoke('update:listDownloadedUpdates'),
  findOldUpdates: () => ipcRenderer.invoke('update:findOldUpdates'),
  deleteOldUpdates: (filenames: string[]) => ipcRenderer.invoke('update:deleteOldUpdates', filenames),
};

export const extractorInstaller = {
  checkLatest: () => ipcRenderer.invoke('extractorInstaller:checkLatest'),
  download: (url: string, filename: string) => ipcRenderer.invoke('extractorInstaller:download', url, filename),
  cancel: () => ipcRenderer.invoke('extractorInstaller:cancel'),
  isDownloading: () => ipcRenderer.invoke('extractorInstaller:isDownloading'),
  install: (filename: string) => ipcRenderer.invoke('extractorInstaller:install', filename),
  openDownloadFolder: () => ipcRenderer.invoke('extractorInstaller:openDownloadFolder'),
  openRepo: () => ipcRenderer.invoke('extractorInstaller:openRepo'),
  onProgress: (callback: (progress: { downloaded: number; total: number; percent: number }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, progress: { downloaded: number; total: number; percent: number }) => callback(progress);
    ipcRenderer.on('extractorInstaller:progress', handler);
    return () => ipcRenderer.removeListener('extractorInstaller:progress', handler);
  },
  onComplete: (callback: (filename: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, filename: string) => callback(filename);
    ipcRenderer.on('extractorInstaller:complete', handler);
    return () => ipcRenderer.removeListener('extractorInstaller:complete', handler);
  },
  onError: (callback: (error: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, error: string) => callback(error);
    ipcRenderer.on('extractorInstaller:error', handler);
    return () => ipcRenderer.removeListener('extractorInstaller:error', handler);
  },
};
