import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  auth: {
    login: (username: string, password: string) => ipcRenderer.invoke('auth:login', username, password),
    verifyToken: (token: string) => ipcRenderer.invoke('auth:verifyToken', token),
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
    setSlideCheckInterval: (interval: number) => ipcRenderer.invoke('config:setSlideCheckInterval', interval),
    setSlideDoubleVerification: (enabled: boolean, count?: number) => ipcRenderer.invoke('config:setSlideDoubleVerification', enabled, count),
    setSlideImageProcessingParams: (params: {
      hammingThresholdLow?: number;
      hammingThresholdUp?: number;
      ssimThreshold?: number;
      ssimPresetMode?: 'adaptive' | 'strict' | 'normal' | 'loose' | 'custom';
      pHashThreshold?: number;
    }) => ipcRenderer.invoke('config:setSlideImageProcessingParams', params),
    // pHash exclusion list management
    getPHashExclusionList: () => ipcRenderer.invoke('config:getPHashExclusionList'),
    addPHashExclusionItem: (name: string, pHash: string) => ipcRenderer.invoke('config:addPHashExclusionItem', name, pHash),
    removePHashExclusionItem: (id: string) => ipcRenderer.invoke('config:removePHashExclusionItem', id),
    updatePHashExclusionItemName: (id: string, newName: string) => ipcRenderer.invoke('config:updatePHashExclusionItemName', id, newName),
    clearPHashExclusionList: () => ipcRenderer.invoke('config:clearPHashExclusionList'),
    selectImageForExclusion: () => ipcRenderer.invoke('config:selectImageForExclusion'),
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
});
