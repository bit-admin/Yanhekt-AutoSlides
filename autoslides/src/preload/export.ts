import { ipcRenderer } from 'electron';

export const pdfmaker = {
  getFolders: () => ipcRenderer.invoke('pdfmaker:getFolders'),
  getImages: (folderPath: string) => ipcRenderer.invoke('pdfmaker:getImages', folderPath),
  getImageAsBase64: (imagePath: string) => ipcRenderer.invoke('pdfmaker:getImageAsBase64', imagePath),
  deleteImage: (imagePath: string) => ipcRenderer.invoke('pdfmaker:deleteImage', imagePath),
  makePdf: (folders: { name: string; path: string; images: string[] }[], options: {
    reduceEnabled: boolean;
    aspectRatio?: '16:9' | '4:3';
    effort: 'standard' | 'compact' | 'minimal' | 'custom';
    customColors?: number | null;
    customWidth?: number | null;
    customHeight?: number | null;
    outputMode?: 'single' | 'batch';
    outputFormat?: 'pdf' | 'pptx';
    includeCover?: boolean;
    copyrightText?: string;
  }) => ipcRenderer.invoke('pdfmaker:makePdf', folders, options),
  onProgress: (callback: (progress: { current: number; total: number }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, progress: { current: number; total: number }) => callback(progress);
    ipcRenderer.on('pdfmaker:progress', handler);
    return () => ipcRenderer.removeListener('pdfmaker:progress', handler);
  },
};

export const noteExport = {
  export: (payload: { title: string; content: string; format: 'pdf' | 'markdown' | 'docx' }) =>
    ipcRenderer.invoke('noteExport:export', payload) as Promise<{
      ok: boolean;
      path?: string;
      canceled?: boolean;
      error?: string;
    }>,
};

export const yuketang = {
  exportLesson: (payload: { lessonId?: string; format: 'pdf' | 'images' }) =>
    ipcRenderer.invoke('yuketang:export', payload),
  getClassCapture: () => ipcRenderer.invoke('yuketang:getClassCapture'),
  openFolder: (folderPath: string) => ipcRenderer.invoke('yuketang:openFolder', folderPath),
  onExportProgress: (callback: (message: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, message: string) => callback(message);
    ipcRenderer.on('yuketang:exportProgress', handler);
    return () => ipcRenderer.removeListener('yuketang:exportProgress', handler);
  },
  onClassCaptureUpdate: (callback: (data: { presentationId: string; hasAuthorization: boolean }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { presentationId: string; hasAuthorization: boolean }) => callback(data);
    ipcRenderer.on('yuketang:classCaptureUpdated', handler);
    return () => ipcRenderer.removeListener('yuketang:classCaptureUpdated', handler);
  },
};
