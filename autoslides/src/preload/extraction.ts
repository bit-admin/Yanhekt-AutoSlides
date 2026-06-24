import { ipcRenderer } from 'electron';

export const slideExtraction = {
  saveSlide: (outputPath: string, filename: string, imageBuffer: Uint8Array) =>
    ipcRenderer.invoke('slideExtraction:saveSlide', outputPath, filename, imageBuffer),
  ensureDirectory: (path: string) => ipcRenderer.invoke('slideExtraction:ensureDirectory', path),
  deleteSlide: (outputPath: string, filename: string) =>
    ipcRenderer.invoke('slideExtraction:deleteSlide', outputPath, filename),
  moveToInAppTrash: (outputPath: string, filename: string, metadata: { reason: 'duplicate' | 'exclusion' | 'ai_filtered' | 'ai_filtered_edit' | 'manual'; reasonDetails?: string }) =>
    ipcRenderer.invoke('slideExtraction:moveToInAppTrash', outputPath, filename, metadata),
  readSlideAsBase64: (outputPath: string, filename: string) =>
    ipcRenderer.invoke('slideExtraction:readSlideAsBase64', outputPath, filename),
  readSlideForAI: (outputPath: string, filename: string, targetWidth: number, targetHeight: number) =>
    ipcRenderer.invoke('slideExtraction:readSlideForAI', outputPath, filename, targetWidth, targetHeight),
  listSlides: (outputPath: string) => ipcRenderer.invoke('slideExtraction:listSlides', outputPath),
};

export const offline = {
  selectInputFolder: () => ipcRenderer.invoke('offline:selectInputFolder'),
  listImages: (folderPath: string) => ipcRenderer.invoke('offline:listImages', folderPath),
  copyAndConvert: (inputPath: string, outputDir: string, outputFilename: string, enableColorReduction: boolean) =>
    ipcRenderer.invoke('offline:copyAndConvert', inputPath, outputDir, outputFilename, enableColorReduction),
  readImageForAI: (filePath: string, targetWidth: number, targetHeight: number) =>
    ipcRenderer.invoke('offline:readImageForAI', filePath, targetWidth, targetHeight),
  readImageBuffer: (filePath: string) => ipcRenderer.invoke('offline:readImageBuffer', filePath),
  savePngBuffer: (outputDir: string, filename: string, buffer: Uint8Array, enableColorReduction: boolean) =>
    ipcRenderer.invoke('offline:savePngBuffer', outputDir, filename, buffer, enableColorReduction),
};

export const trash = {
  getEntries: () => ipcRenderer.invoke('trash:getEntries'),
  restore: (ids: string[]) => ipcRenderer.invoke('trash:restore', ids),
  clear: () => ipcRenderer.invoke('trash:clear'),
  clearEntries: (ids: string[]) => ipcRenderer.invoke('trash:clearEntries', ids),
  removeFolders: (folderNames: string[]) => ipcRenderer.invoke('trash:removeFolders', folderNames),
  getImageAsBase64: (trashPath: string) => ipcRenderer.invoke('trash:getImageAsBase64', trashPath),
};

export const crop = {
  getEntries: () => ipcRenderer.invoke('crop:getEntries'),
  getImageAsBase64: (cropPath: string) => ipcRenderer.invoke('crop:getImageAsBase64', cropPath),
  apply: (imagePath: string, rect: { x: number; y: number; width: number; height: number }, autoCropped?: boolean) =>
    ipcRenderer.invoke('crop:apply', imagePath, rect, autoCropped),
  restore: (imagePath: string) => ipcRenderer.invoke('crop:restore', imagePath),
};

export const autoCrop = {
  getModelInfo: () => ipcRenderer.invoke('autoCrop:getModelInfo'),
  getModelBuffer: () => ipcRenderer.invoke('autoCrop:getModelBuffer') as Promise<ArrayBuffer>,
  selectAndImportModel: () => ipcRenderer.invoke('autoCrop:selectAndImportModel'),
  deleteCustomModel: () => ipcRenderer.invoke('autoCrop:deleteCustomModel'),
};

export const mlClassifier = {
  getModelInfo: () => ipcRenderer.invoke('mlClassifier:getModelInfo'),
  getModelBuffer: () => ipcRenderer.invoke('mlClassifier:getModelBuffer') as Promise<ArrayBuffer>,
  selectAndImportModel: () => ipcRenderer.invoke('mlClassifier:selectAndImportModel'),
  deleteCustomModel: () => ipcRenderer.invoke('mlClassifier:deleteCustomModel'),
};

export const qtExtractor = {
  getStatus: () => ipcRenderer.invoke('qtExtractor:getStatus') as Promise<{ ok: boolean; path: string; resolvedPath: string; version?: string; error?: string }>,
  detect: () => ipcRenderer.invoke('qtExtractor:detect') as Promise<{ ok: boolean; path: string; resolvedPath: string; version?: string; error?: string }>,
  verify: (binaryPath?: string) => ipcRenderer.invoke('qtExtractor:verify', binaryPath) as Promise<{ ok: boolean; path: string; resolvedPath: string; version?: string; error?: string }>,
  selectBinary: () => ipcRenderer.invoke('qtExtractor:selectBinary') as Promise<string | null>,
  setBinaryPath: (binaryPath: string) => ipcRenderer.invoke('qtExtractor:setBinaryPath', binaryPath),
  setAutoRun: (enabled: boolean) => ipcRenderer.invoke('qtExtractor:setAutoRun', enabled),
  setAutoPostProcess: (enabled: boolean) => ipcRenderer.invoke('qtExtractor:setAutoPostProcess', enabled),
  runExtraction: (
    extractionId: string,
    videoPath: string,
    outputDir: string,
    params: {
      ssimThreshold: number;
      enableDownsampling: boolean;
      downsampleWidth: number;
      downsampleHeight: number;
      chunkSize?: number;
    }
  ) => ipcRenderer.invoke('qtExtractor:runExtraction', extractionId, videoPath, outputDir, params),
  cancelExtraction: (extractionId: string) => ipcRenderer.invoke('qtExtractor:cancelExtraction', extractionId),
  applyColorReduction: (slidesDir: string) => ipcRenderer.invoke('qtExtractor:applyColorReduction', slidesDir),
  onProgress: (callback: (extractionId: string, percent: number) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, extractionId: string, percent: number) => callback(extractionId, percent);
    ipcRenderer.on('qtExtractor:progress', handler);
    return () => ipcRenderer.removeListener('qtExtractor:progress', handler);
  },
  onSlidesExtracted: (callback: (extractionId: string, slidesDir: string, count: number) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, extractionId: string, slidesDir: string, count: number) =>
      callback(extractionId, slidesDir, count);
    ipcRenderer.on('qtExtractor:slidesExtracted', handler);
    return () => ipcRenderer.removeListener('qtExtractor:slidesExtracted', handler);
  },
  onCompleted: (callback: (extractionId: string, result: { slideCount: number; slidesDir: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, extractionId: string, result: { slideCount: number; slidesDir: string }) =>
      callback(extractionId, result);
    ipcRenderer.on('qtExtractor:completed', handler);
    return () => ipcRenderer.removeListener('qtExtractor:completed', handler);
  },
  onError: (callback: (extractionId: string, message: string, category?: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, extractionId: string, message: string, category?: string) =>
      callback(extractionId, message, category);
    ipcRenderer.on('qtExtractor:error', handler);
    return () => ipcRenderer.removeListener('qtExtractor:error', handler);
  },
  onCancelled: (callback: (extractionId: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, extractionId: string) => callback(extractionId);
    ipcRenderer.on('qtExtractor:cancelled', handler);
    return () => ipcRenderer.removeListener('qtExtractor:cancelled', handler);
  },
};
