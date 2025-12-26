import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  auth: {
    login: (username: string, password: string) => ipcRenderer.invoke('auth:login', username, password),
    verifyToken: (token: string) => ipcRenderer.invoke('auth:verifyToken', token),
    clearBrowserData: () => ipcRenderer.invoke('auth:clearBrowserData'),
  },
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    setOutputDirectory: (directory: string) => ipcRenderer.invoke('config:setOutputDirectory', directory),
    selectOutputDirectory: () => ipcRenderer.invoke('config:selectOutputDirectory'),
    setConnectionMode: (mode: 'internal' | 'external') => ipcRenderer.invoke('config:setConnectionMode', mode),
    setMaxConcurrentDownloads: (count: number) => ipcRenderer.invoke('config:setMaxConcurrentDownloads', count),
    setMuteMode: (mode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded') => ipcRenderer.invoke('config:setMuteMode', mode),
    setVideoRetryCount: (count: number) => ipcRenderer.invoke('config:setVideoRetryCount', count),
    setTaskSpeed: (speed: number) => ipcRenderer.invoke('config:setTaskSpeed', speed),
    setAutoPostProcessing: (enabled: boolean) => ipcRenderer.invoke('config:setAutoPostProcessing', enabled),
    setAutoPostProcessingLive: (enabled: boolean) => ipcRenderer.invoke('config:setAutoPostProcessingLive', enabled),
    getAutoPostProcessingLive: () => ipcRenderer.invoke('config:getAutoPostProcessingLive'),
    setEnableAIFiltering: (enabled: boolean) => ipcRenderer.invoke('config:setEnableAIFiltering', enabled),
    getEnableAIFiltering: () => ipcRenderer.invoke('config:getEnableAIFiltering'),
    // Theme configuration
    setThemeMode: (theme: 'system' | 'light' | 'dark') => ipcRenderer.invoke('config:setThemeMode', theme),
    getThemeMode: () => ipcRenderer.invoke('config:getThemeMode'),
    isDarkMode: () => ipcRenderer.invoke('config:isDarkMode'),
    getEffectiveTheme: () => ipcRenderer.invoke('config:getEffectiveTheme'),
    // Language configuration
    setLanguageMode: (language: 'system' | 'en' | 'zh') => ipcRenderer.invoke('config:setLanguageMode', language),
    getLanguageMode: () => ipcRenderer.invoke('config:getLanguageMode'),
    // Power management configuration
    setPreventSystemSleep: (prevent: boolean) => ipcRenderer.invoke('config:setPreventSystemSleep', prevent),
    // Slide extraction configuration
    getSlideExtractionConfig: () => ipcRenderer.invoke('config:getSlideExtractionConfig'),
    setSlideExtractionConfig: (config: {
      enableDuplicateRemoval?: boolean;
      enableExclusionList?: boolean;
    }) => ipcRenderer.invoke('config:setSlideExtractionConfig', config),
    setSlideCheckInterval: (interval: number) => ipcRenderer.invoke('config:setSlideCheckInterval', interval),
    setSlideDoubleVerification: (enabled: boolean, count?: number) => ipcRenderer.invoke('config:setSlideDoubleVerification', enabled, count),
    setSlideImageProcessingParams: (params: {
      hammingThresholdLow?: number;
      hammingThresholdUp?: number;
      ssimThreshold?: number;
      ssimPresetMode?: 'adaptive' | 'strict' | 'normal' | 'loose' | 'custom';
      pHashThreshold?: number;
      enableDownsampling?: boolean;
      downsampleWidth?: number;
      downsampleHeight?: number;
      enablePngColorReduction?: boolean;
    }) => ipcRenderer.invoke('config:setSlideImageProcessingParams', params),
    // pHash exclusion list management
    getPHashExclusionList: () => ipcRenderer.invoke('config:getPHashExclusionList'),
    addPHashExclusionItem: (name: string, pHash: string) => ipcRenderer.invoke('config:addPHashExclusionItem', name, pHash),
    removePHashExclusionItem: (id: string) => ipcRenderer.invoke('config:removePHashExclusionItem', id),
    updatePHashExclusionItemName: (id: string, newName: string) => ipcRenderer.invoke('config:updatePHashExclusionItemName', id, newName),
    clearPHashExclusionList: () => ipcRenderer.invoke('config:clearPHashExclusionList'),
    selectImageForExclusion: () => ipcRenderer.invoke('config:selectImageForExclusion'),
    // AI filtering configuration
    getAIFilteringConfig: () => ipcRenderer.invoke('config:getAIFilteringConfig'),
    setAIFilteringConfig: (config: {
      serviceType?: 'builtin' | 'custom';
      customApiBaseUrl?: string;
      customApiKey?: string;
      customModelName?: string;
      batchSize?: number;
      maxConcurrent?: number;
      minTime?: number;
    }) => ipcRenderer.invoke('config:setAIFilteringConfig', config),
    setAIBatchSize: (batchSize: number) => ipcRenderer.invoke('config:setAIBatchSize', batchSize),
    getAIBatchSize: () => ipcRenderer.invoke('config:getAIBatchSize'),
    // AI prompts management
    getAIPrompts: () => ipcRenderer.invoke('config:getAIPrompts'),
    getAIPrompt: (type: 'live' | 'recorded') => ipcRenderer.invoke('config:getAIPrompt', type),
    setAIPrompt: (type: 'live' | 'recorded', prompt: string) => ipcRenderer.invoke('config:setAIPrompt', type, prompt),
    resetAIPrompt: (type: 'live' | 'recorded') => ipcRenderer.invoke('config:resetAIPrompt', type),
    getDefaultAIPrompt: (type: 'live' | 'recorded') => ipcRenderer.invoke('config:getDefaultAIPrompt', type),
  },
  api: {
    getPersonalLiveList: (token: string, page?: number, pageSize?: number) =>
      ipcRenderer.invoke('api:getPersonalLiveList', token, page, pageSize),
    searchLiveList: (token: string, keyword: string, page?: number, pageSize?: number) =>
      ipcRenderer.invoke('api:searchLiveList', token, keyword, page, pageSize),
    getCourseList: (token: string, options: Record<string, unknown>) =>
      ipcRenderer.invoke('api:getCourseList', token, options),
    getPersonalCourseList: (token: string, options: Record<string, unknown>) =>
      ipcRenderer.invoke('api:getPersonalCourseList', token, options),
    getCourseInfo: (courseId: string, token: string) =>
      ipcRenderer.invoke('api:getCourseInfo', courseId, token),
    getAvailableSemesters: () =>
      ipcRenderer.invoke('api:getAvailableSemesters'),
  },
  intranet: {
    setEnabled: (enabled: boolean) => ipcRenderer.invoke('intranet:setEnabled', enabled),
    getStatus: () => ipcRenderer.invoke('intranet:getStatus'),
    getMappings: () => ipcRenderer.invoke('intranet:getMappings'),
  },
  video: {
    getLiveStreamUrls: (stream: Record<string, unknown>, token: string) =>
      ipcRenderer.invoke('video:getLiveStreamUrls', stream, token),
    getVideoPlaybackUrls: (session: Record<string, unknown>, token: string) =>
      ipcRenderer.invoke('video:getVideoPlaybackUrls', session, token),
    registerClient: () => ipcRenderer.invoke('video:registerClient'),
    unregisterClient: (clientId: string) => ipcRenderer.invoke('video:unregisterClient', clientId),
    stopProxy: () => ipcRenderer.invoke('video:stopProxy'),
    stopSignatureLoop: () => ipcRenderer.invoke('video:stopSignatureLoop'),
  },
  ffmpeg: {
    getPath: () => ipcRenderer.invoke('ffmpeg:getPath'),
    isAvailable: () => ipcRenderer.invoke('ffmpeg:isAvailable'),
    getPlatformInfo: () => ipcRenderer.invoke('ffmpeg:getPlatformInfo'),
  },
  download: {
    start: (downloadId: string, m3u8Url: string, outputName: string) =>
      ipcRenderer.invoke('download:start', downloadId, m3u8Url, outputName),
    cancel: (downloadId: string) => ipcRenderer.invoke('download:cancel', downloadId),
    isActive: (downloadId: string) => ipcRenderer.invoke('download:isActive', downloadId),
    onProgress: (callback: (downloadId: string, progress: { current: number; total: number; phase: number }) => void) =>
      ipcRenderer.on('download:progress', (_, downloadId, progress) => callback(downloadId, progress)),
    onCompleted: (callback: (downloadId: string) => void) =>
      ipcRenderer.on('download:completed', (_, downloadId) => callback(downloadId)),
    onError: (callback: (downloadId: string, error: string) => void) =>
      ipcRenderer.on('download:error', (_, downloadId, error) => callback(downloadId, error)),
  },
  slideExtraction: {
    saveSlide: (outputPath: string, filename: string, imageBuffer: Uint8Array) =>
      ipcRenderer.invoke('slideExtraction:saveSlide', outputPath, filename, imageBuffer),
    ensureDirectory: (path: string) => ipcRenderer.invoke('slideExtraction:ensureDirectory', path),
    deleteSlide: (outputPath: string, filename: string) =>
      ipcRenderer.invoke('slideExtraction:deleteSlide', outputPath, filename),
    moveToInAppTrash: (outputPath: string, filename: string, metadata: { reason: 'duplicate' | 'exclusion' | 'ai_filtered' | 'manual'; reasonDetails?: string }) =>
      ipcRenderer.invoke('slideExtraction:moveToInAppTrash', outputPath, filename, metadata),
    readSlideAsBase64: (outputPath: string, filename: string) =>
      ipcRenderer.invoke('slideExtraction:readSlideAsBase64', outputPath, filename),
    listSlides: (outputPath: string) =>
      ipcRenderer.invoke('slideExtraction:listSlides', outputPath),
  },
  dialog: {
    showMessageBox: (options: Electron.MessageBoxOptions) => ipcRenderer.invoke('dialog:showMessageBox', options),
    showErrorBox: (title: string, content: string) => ipcRenderer.invoke('dialog:showErrorBox', title, content),
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
    openPath: (filePath: string) => ipcRenderer.invoke('shell:openPath', filePath),
  },
  menu: {
    openTermsAndConditions: () => ipcRenderer.invoke('menu:openTermsAndConditions'),
    reload: () => ipcRenderer.invoke('menu:reload'),
    forceReload: () => ipcRenderer.invoke('menu:forceReload'),
    toggleDevTools: () => ipcRenderer.invoke('menu:toggleDevTools'),
    resetZoom: () => ipcRenderer.invoke('menu:resetZoom'),
    zoomIn: () => ipcRenderer.invoke('menu:zoomIn'),
    zoomOut: () => ipcRenderer.invoke('menu:zoomOut'),
    toggleFullscreen: () => ipcRenderer.invoke('menu:toggleFullscreen'),
  },
  powerManagement: {
    preventSleep: () => ipcRenderer.invoke('powerManagement:preventSleep'),
    allowSleep: () => ipcRenderer.invoke('powerManagement:allowSleep'),
    isPreventingSleep: () => ipcRenderer.invoke('powerManagement:isPreventingSleep'),
  },
  cache: {
    getStats: () => ipcRenderer.invoke('cache:getStats'),
    clear: () => ipcRenderer.invoke('cache:clear'),
    resetAllData: () => ipcRenderer.invoke('cache:resetAllData'),
  },
  app: {
    restart: () => ipcRenderer.invoke('app:restart'),
  },
  tour: {
    forceLightTheme: () => ipcRenderer.invoke('tour:forceLightTheme'),
    restoreTheme: (originalTheme: 'system' | 'light' | 'dark') => ipcRenderer.invoke('tour:restoreTheme', originalTheme),
  },
  ai: {
    classifySingleImage: (base64Image: string, type: 'live' | 'recorded', token?: string, modelOverride?: string) =>
      ipcRenderer.invoke('ai:classifySingleImage', base64Image, type, token, modelOverride),
    classifyMultipleImages: (base64Images: string[], type: 'live' | 'recorded', token?: string, modelOverride?: string) =>
      ipcRenderer.invoke('ai:classifyMultipleImages', base64Images, type, token, modelOverride),
    getBuiltinModelName: (token: string) => ipcRenderer.invoke('ai:getBuiltinModelName', token),
    isConfigured: (token?: string) => ipcRenderer.invoke('ai:isConfigured', token),
    getServiceType: () => ipcRenderer.invoke('ai:getServiceType'),
  },
  trash: {
    openWindow: () => ipcRenderer.invoke('trash:openWindow'),
    getEntries: () => ipcRenderer.invoke('trash:getEntries'),
    restore: (ids: string[]) => ipcRenderer.invoke('trash:restore', ids),
    clear: () => ipcRenderer.invoke('trash:clear'),
    getImageAsBase64: (trashPath: string) => ipcRenderer.invoke('trash:getImageAsBase64', trashPath),
  },
  pdfmaker: {
    openWindow: () => ipcRenderer.invoke('pdfmaker:openWindow'),
    getFolders: () => ipcRenderer.invoke('pdfmaker:getFolders'),
    getImages: (folderPath: string) => ipcRenderer.invoke('pdfmaker:getImages', folderPath),
    getImageAsBase64: (imagePath: string) => ipcRenderer.invoke('pdfmaker:getImageAsBase64', imagePath),
    deleteImage: (imagePath: string) => ipcRenderer.invoke('pdfmaker:deleteImage', imagePath),
    makePdf: (folders: { name: string; path: string; images: string[] }[], options: {
      reduceEnabled: boolean;
      effort: 'standard' | 'compact' | 'minimal' | 'custom';
      customColors?: number | null;
      customWidth?: number | null;
      customHeight?: number | null;
    }) => ipcRenderer.invoke('pdfmaker:makePdf', folders, options),
    onProgress: (callback: (progress: { current: number; total: number }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: { current: number; total: number }) => callback(progress);
      ipcRenderer.on('pdfmaker:progress', handler);
      return () => ipcRenderer.removeListener('pdfmaker:progress', handler);
    },
  },
  update: {
    checkForUpdates: () => ipcRenderer.invoke('update:checkForUpdates'),
    onCheckForUpdates: (callback: () => void) =>
      ipcRenderer.on('menu:checkForUpdates', () => callback()),
  },
});
