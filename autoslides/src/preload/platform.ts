import { ipcRenderer } from 'electron';

export const auth = {
  login: (username: string, password: string) => ipcRenderer.invoke('auth:login', username, password),
  verifyToken: (token: string) => ipcRenderer.invoke('auth:verifyToken', token),
  clearBrowserData: () => ipcRenderer.invoke('auth:clearBrowserData'),
};

export const config = {
  get: () => ipcRenderer.invoke('config:get'),
  // Subscribe to push updates from the main process. Fires after every setter
  // so the renderer-side configStore can mirror the latest AppConfig snapshot.
  onUpdate: (callback: (cfg: unknown) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, cfg: unknown) => callback(cfg);
    ipcRenderer.on('config:onUpdate', handler);
    return () => ipcRenderer.removeListener('config:onUpdate', handler);
  },
  setOutputDirectory: (directory: string) => ipcRenderer.invoke('config:setOutputDirectory', directory),
  selectOutputDirectory: () => ipcRenderer.invoke('config:selectOutputDirectory'),
  setConnectionMode: (mode: 'internal' | 'external') => ipcRenderer.invoke('config:setConnectionMode', mode),
  setMaxConcurrentDownloads: (count: number) => ipcRenderer.invoke('config:setMaxConcurrentDownloads', count),
  setDownloadMaxWorkers: (count: number) => ipcRenderer.invoke('config:setDownloadMaxWorkers', count),
  setDownloadNumRetries: (count: number) => ipcRenderer.invoke('config:setDownloadNumRetries', count),
  setMuteMode: (mode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded') => ipcRenderer.invoke('config:setMuteMode', mode),
  setVideoRetryCount: (count: number) => ipcRenderer.invoke('config:setVideoRetryCount', count),
  setTaskSpeed: (speed: number) => ipcRenderer.invoke('config:setTaskSpeed', speed),
  setShowMorePlaybackSpeed: (enabled: boolean) => ipcRenderer.invoke('config:setShowMorePlaybackSpeed', enabled),
  setAutoPostProcessing: (enabled: boolean) => ipcRenderer.invoke('config:setAutoPostProcessing', enabled),
  setAutoPostProcessingLive: (enabled: boolean) => ipcRenderer.invoke('config:setAutoPostProcessingLive', enabled),
  getAutoPostProcessingLive: () => ipcRenderer.invoke('config:getAutoPostProcessingLive'),
  setEnableAIFiltering: (enabled: boolean) => ipcRenderer.invoke('config:setEnableAIFiltering', enabled),
  getEnableAIFiltering: () => ipcRenderer.invoke('config:getEnableAIFiltering'),
  setDistinguishMaybeSlide: (enabled: boolean) => ipcRenderer.invoke('config:setDistinguishMaybeSlide', enabled),
  getDistinguishMaybeSlide: () => ipcRenderer.invoke('config:getDistinguishMaybeSlide'),
  setAutoCropParams: (params: {
    aspectTolerance?: number;
    blackThreshold?: number;
    maxBorderFrac?: number;
    cannyLowThreshold?: number;
    cannyHighThreshold?: number;
    areaRatioMin?: number;
    areaRatioMax?: number;
    marginFrac?: number;
    fillRatioMin?: number;
  }) => ipcRenderer.invoke('config:setAutoCropParams', params),
  resetAutoCropParams: () => ipcRenderer.invoke('config:resetAutoCropParams'),
  setAutoCropDetectorMode: (mode: 'canny_then_yolo' | 'canny_only' | 'yolo_only') =>
    ipcRenderer.invoke('config:setAutoCropDetectorMode', mode),
  setAutoCropYoloParams: (params: {
    confidenceThreshold?: number;
    iouThreshold?: number;
    inputSize?: number;
  }) => ipcRenderer.invoke('config:setAutoCropYoloParams', params),
  resetAutoCropYoloParams: () => ipcRenderer.invoke('config:resetAutoCropYoloParams'),
  setThemeMode: (theme: 'system' | 'light' | 'dark') => ipcRenderer.invoke('config:setThemeMode', theme),
  getThemeMode: () => ipcRenderer.invoke('config:getThemeMode'),
  isDarkMode: () => ipcRenderer.invoke('config:isDarkMode'),
  getEffectiveTheme: () => ipcRenderer.invoke('config:getEffectiveTheme'),
  setLanguageMode: (language: 'system' | 'en' | 'zh') => ipcRenderer.invoke('config:setLanguageMode', language),
  getLanguageMode: () => ipcRenderer.invoke('config:getLanguageMode'),
  setPreventSystemSleep: (prevent: boolean) => ipcRenderer.invoke('config:setPreventSystemSleep', prevent),
  setAuthToken: (token: string | null) => ipcRenderer.invoke('config:setAuthToken', token),
  getAuthToken: (): Promise<string | null> => ipcRenderer.invoke('config:getAuthToken'),
  getSkipUpdateCheckUntil: () => ipcRenderer.invoke('config:getSkipUpdateCheckUntil'),
  setSkipUpdateCheckUntil: (timestamp: number) => ipcRenderer.invoke('config:setSkipUpdateCheckUntil', timestamp),
  setUserNames: (original: string, display: string) => ipcRenderer.invoke('config:setUserNames', original, display),
  setLastGreetingId: (id: string) => ipcRenderer.invoke('config:setLastGreetingId', id),
  setSavedSearches: (mode: 'live' | 'recorded', searches: string[]) => ipcRenderer.invoke('config:setSavedSearches', mode, searches),
  getSlideExtractionConfig: () => ipcRenderer.invoke('config:getSlideExtractionConfig'),
  setSlideExtractionConfig: (cfg: { enableDuplicateRemoval?: boolean; enableExclusionList?: boolean }) =>
    ipcRenderer.invoke('config:setSlideExtractionConfig', cfg),
  setSlideCheckInterval: (interval: number) => ipcRenderer.invoke('config:setSlideCheckInterval', interval),
  setSlideDoubleVerification: (enabled: boolean, count?: number) =>
    ipcRenderer.invoke('config:setSlideDoubleVerification', enabled, count),
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
  getPHashExclusionList: () => ipcRenderer.invoke('config:getPHashExclusionList'),
  addPHashExclusionItem: (name: string, pHash: string) => ipcRenderer.invoke('config:addPHashExclusionItem', name, pHash),
  removePHashExclusionItem: (id: string) => ipcRenderer.invoke('config:removePHashExclusionItem', id),
  updatePHashExclusionItemName: (id: string, newName: string) =>
    ipcRenderer.invoke('config:updatePHashExclusionItemName', id, newName),
  clearPHashExclusionList: () => ipcRenderer.invoke('config:clearPHashExclusionList'),
  selectImageForExclusion: () => ipcRenderer.invoke('config:selectImageForExclusion'),
  getAIFilteringConfig: () => ipcRenderer.invoke('config:getAIFilteringConfig'),
  setAIFilteringConfig: (cfg: {
    serviceType?: 'builtin' | 'custom' | 'copilot';
    customApiBaseUrl?: string;
    customApiKey?: string;
    customModelName?: string;
    customModelChain?: string[];
    customProviderId?: 'modelscope' | 'lm_studio' | 'other';
    copilotGhoToken?: string;
    copilotModelName?: string;
    copilotUsername?: string;
    copilotAvatarUrl?: string;
    rateLimit?: number;
    batchSize?: number;
    imageResizeWidth?: number;
    imageResizeHeight?: number;
    maxConcurrent?: number;
    minTime?: number;
  }) => ipcRenderer.invoke('config:setAIFilteringConfig', cfg),
  setAIBatchSize: (batchSize: number) => ipcRenderer.invoke('config:setAIBatchSize', batchSize),
  getAIBatchSize: () => ipcRenderer.invoke('config:getAIBatchSize'),
  setAIClassifierMode: (mode: 'llm' | 'ml') => ipcRenderer.invoke('config:setAIClassifierMode', mode),
  setMlThresholds: (thresholds: { trustLow?: number; trustHigh?: number; slideCheckLow?: number }) =>
    ipcRenderer.invoke('config:setMlThresholds', thresholds),
  getAIPrompts: (variant?: 'simple' | 'distinguish') => ipcRenderer.invoke('config:getAIPrompts', variant),
  getAIPrompt: (type: 'live' | 'recorded', variant?: 'simple' | 'distinguish') =>
    ipcRenderer.invoke('config:getAIPrompt', type, variant),
  setAIPrompt: (type: 'live' | 'recorded', prompt: string, variant?: 'simple' | 'distinguish') =>
    ipcRenderer.invoke('config:setAIPrompt', type, prompt, variant),
  resetAIPrompt: (type: 'live' | 'recorded', variant?: 'simple' | 'distinguish') =>
    ipcRenderer.invoke('config:resetAIPrompt', type, variant),
  getDefaultAIPrompt: (type: 'live' | 'recorded', variant?: 'simple' | 'distinguish') =>
    ipcRenderer.invoke('config:getDefaultAIPrompt', type, variant),
};

export const windowNs = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
};

export const shell = {
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  openPath: (filePath: string) => ipcRenderer.invoke('shell:openPath', filePath),
};

export const menu = {
  openTermsAndConditions: () => ipcRenderer.invoke('menu:openTermsAndConditions'),
  reload: () => ipcRenderer.invoke('menu:reload'),
  forceReload: () => ipcRenderer.invoke('menu:forceReload'),
  toggleDevTools: () => ipcRenderer.invoke('menu:toggleDevTools'),
  resetZoom: () => ipcRenderer.invoke('menu:resetZoom'),
  zoomIn: () => ipcRenderer.invoke('menu:zoomIn'),
  zoomOut: () => ipcRenderer.invoke('menu:zoomOut'),
  toggleFullscreen: () => ipcRenderer.invoke('menu:toggleFullscreen'),
};

export const powerManagement = {
  preventSleep: () => ipcRenderer.invoke('powerManagement:preventSleep'),
  allowSleep: () => ipcRenderer.invoke('powerManagement:allowSleep'),
  isPreventingSleep: () => ipcRenderer.invoke('powerManagement:isPreventingSleep'),
};

export const cache = {
  getStats: () => ipcRenderer.invoke('cache:getStats'),
  clear: () => ipcRenderer.invoke('cache:clear'),
  resetAllData: () => ipcRenderer.invoke('cache:resetAllData'),
};

export const app = {
  restart: () => ipcRenderer.invoke('app:restart'),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
};

export const tour = {
  forceLightTheme: () => ipcRenderer.invoke('tour:forceLightTheme'),
  restoreTheme: (originalTheme: 'system' | 'light' | 'dark') => ipcRenderer.invoke('tour:restoreTheme', originalTheme),
};

export const dialog = {
  showMessageBox: (options: Electron.MessageBoxOptions) => ipcRenderer.invoke('dialog:showMessageBox', options),
  showErrorBox: (title: string, content: string) => ipcRenderer.invoke('dialog:showErrorBox', title, content),
  openImageFile: () => ipcRenderer.invoke('dialog:openImageFile') as Promise<string | null>,
  openImageFiles: () => ipcRenderer.invoke('dialog:openImageFiles') as Promise<string[] | null>,
};
