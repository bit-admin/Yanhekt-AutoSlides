import { ipcRenderer } from 'electron';
import { invoke } from './invoke';
import type { ElectronAPI } from './electronApi';

export const update: ElectronAPI['update'] = {
  checkForUpdates: () => invoke('update:checkForUpdates'),
  onCheckForUpdates: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('menu:checkForUpdates', handler);
    return () => ipcRenderer.removeListener('menu:checkForUpdates', handler);
  },
  onAutoCheckForUpdates: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('update:autoCheck', handler);
    return () => ipcRenderer.removeListener('update:autoCheck', handler);
  },
  getReleaseInfo: () => invoke('update:getReleaseInfo'),
  downloadUpdate: (url: string, filename: string) => invoke('update:downloadUpdate', url, filename),
  cancelDownload: () => invoke('update:cancelDownload'),
  isDownloading: () => invoke('update:isDownloading'),
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
  openDownloadFolder: () => invoke('update:openDownloadFolder'),
  getDownloadFolder: () => invoke('update:getDownloadFolder'),
  installUpdate: (filename: string) => invoke('update:installUpdate', filename),
  listDownloadedUpdates: () => invoke('update:listDownloadedUpdates'),
  findOldUpdates: () => invoke('update:findOldUpdates'),
  deleteOldUpdates: (filenames: string[]) => invoke('update:deleteOldUpdates', filenames),
};

export const extractorInstaller: ElectronAPI['extractorInstaller'] = {
  checkLatest: () => invoke('extractorInstaller:checkLatest'),
  download: (url: string, filename: string) => invoke('extractorInstaller:download', url, filename),
  cancel: () => invoke('extractorInstaller:cancel'),
  isDownloading: () => invoke('extractorInstaller:isDownloading'),
  install: (filename: string) => invoke('extractorInstaller:install', filename),
  openDownloadFolder: () => invoke('extractorInstaller:openDownloadFolder'),
  openRepo: () => invoke('extractorInstaller:openRepo'),
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
