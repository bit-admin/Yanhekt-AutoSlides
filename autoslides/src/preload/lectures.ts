import { ipcRenderer } from 'electron';
import type { ElectronAPI } from './electronApi';

export type LectureVideoFileInfo = {
  name: string;
  path: string;
  size: number;
  mtimeMs: number;
};

export const lectures: ElectronAPI['lectures'] = {
  listVideos: () =>
    ipcRenderer.invoke('lectures:listVideos') as Promise<LectureVideoFileInfo[]>,
  rename: (fromPath: string, toName: string) =>
    ipcRenderer.invoke('lectures:rename', { fromPath, toName }) as Promise<{
      path: string;
      name: string;
    }>,
  reveal: (filePath: string) =>
    ipcRenderer.invoke('lectures:reveal', filePath) as Promise<void>,
  openOutputDirectory: () =>
    ipcRenderer.invoke('lectures:openOutputDirectory') as Promise<void>,
  openExternally: (filePath: string) =>
    ipcRenderer.invoke('lectures:openExternally', filePath) as Promise<void>,
  getPoster: (filePath: string, seekSeconds?: number) =>
    ipcRenderer.invoke('lectures:getPoster', {
      path: filePath,
      seekSeconds,
    }) as Promise<string | null>,
};
