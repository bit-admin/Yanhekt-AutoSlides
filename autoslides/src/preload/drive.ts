import { ipcRenderer } from 'electron';
import { invoke } from './invoke';
import type { ElectronAPI } from './electronApi';
import type { DriveUploadProgress } from '@common/driveStatus';

/**
 * Drive (2026-11-20): folder uploads and their records. Folders are named by
 * path (main accepts only `slides_*` folders directly in the output folder);
 * pass plain strings, never Vue state (Recurring #1).
 */
export const drive: ElectronAPI['drive'] = {
  folders: () => invoke('drive:folders'),
  folder: (folderPath) => invoke('drive:folder', folderPath),
  upload: (folderPath, jobId) => invoke('drive:upload', folderPath, jobId),
  cancel: (jobId) => invoke('drive:cancel', jobId),
  recordClone: (folderPath, input) => invoke('drive:recordClone', folderPath, JSON.parse(JSON.stringify(input))),
  onProgress: (callback) => {
    const handler = (_e: Electron.IpcRendererEvent, progress: DriveUploadProgress) => callback(progress);
    ipcRenderer.on('drive:progress', handler);
    return () => ipcRenderer.removeListener('drive:progress', handler);
  },
};

/** What a lecture already has in the output folder (issue #45). */
export const lectureOutputs: ElectronAPI['lectureOutputs'] = {
  probe: (queries) => invoke('lectureOutputs:probe', queries.map((q) => ({
    key: q.key, courseId: q.courseId, sessionId: q.sessionId, videoFile: q.videoFile,
  }))),
  retire: (target) => invoke('lectureOutputs:retire', {
    slidesFolders: [...(target.slidesFolders ?? [])],
    videoFiles: [...(target.videoFiles ?? [])],
  }),
};
