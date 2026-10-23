import { invoke } from './invoke';
import type { ElectronAPI } from './electronApi';

export type LectureVideoFileInfo = {
  name: string;
  path: string;
  size: number;
  mtimeMs: number;
};

export const lectures: ElectronAPI['lectures'] = {
  listVideos: () =>
    invoke('lectures:listVideos') as Promise<LectureVideoFileInfo[]>,
  rename: (fromPath: string, toName: string) =>
    invoke('lectures:rename', { fromPath, toName }) as Promise<{
      path: string;
      name: string;
    }>,
  reveal: (filePath: string) =>
    invoke('lectures:reveal', filePath) as Promise<void>,
  openOutputDirectory: () =>
    invoke('lectures:openOutputDirectory') as Promise<void>,
  openExternally: (filePath: string) =>
    invoke('lectures:openExternally', filePath) as Promise<void>,
  readSubtitles: (filePath: string) =>
    invoke('lectures:readSubtitles', filePath) as Promise<string | null>,
  getPoster: (filePath: string, seekSeconds?: number) =>
    invoke('lectures:getPoster', {
      path: filePath,
      seekSeconds,
    }) as Promise<string | null>,
};
