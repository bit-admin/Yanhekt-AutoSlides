import { ipcRenderer } from 'electron';
import { invoke } from './invoke';
import type { ElectronAPI, DialogOptions } from './electronApi';
import type { AppConfig, ConnectionMode, CustomProviderId, LanguageMode, PinnedCourse, StoredAccount } from '@common/types';
import type { WatchNotesProviderId } from '@common/watchNotesProviders';
import type { Yanhe2SlideSaveProgress } from '@common/yanhe2SlideSave';

export const auth: ElectronAPI['auth'] = {
  login: (username: string, password: string) => invoke('auth:login', username, password),
  submitSmsCode: (challengeId: string, code: string) =>
    invoke('auth:submitSmsCode', challengeId, code),
  cancelSmsChallenge: (challengeId: string) =>
    invoke('auth:cancelSmsChallenge', challengeId),
  verifyToken: (token: string) => invoke('auth:verifyToken', token),
  revokeToken: (token: string) => invoke('auth:revokeToken', token),
  clearBrowserData: () => invoke('auth:clearBrowserData'),
  listSavedLogins: () => invoke('auth:listSavedLogins'),
  getSavedLogin: (badge: string) => invoke('auth:getSavedLogin', badge),
  saveSavedLogin: (badge: string, username: string, password: string) =>
    invoke('auth:saveSavedLogin', badge, username, password),
  forgetSavedLogin: (badge: string) => invoke('auth:forgetSavedLogin', badge),
  getBrowserLoginPreloadPath: () => invoke('auth:getBrowserLoginPreloadPath'),
};

export const yanhe2: ElectronAPI['yanhe2'] = {
  login: (account: string, username: string, password: string) =>
    invoke('yanhe2:login', account, username, password),
  submitSmsCode: (account: string, challengeId: string, code: string) =>
    invoke('yanhe2:submitSmsCode', account, challengeId, code),
  cancelSmsChallenge: (challengeId: string) => invoke('yanhe2:cancelSmsChallenge', challengeId),
  autoSignIn: (account: string) => invoke('yanhe2:autoSignIn', account),
  check: (account: string) => invoke('yanhe2:check', account),
  signOut: (account: string) => invoke('yanhe2:signOut', account),
  getJwt: (account: string) => invoke('yanhe2:getJwt', account),
  getProfile: (account: string) => invoke('yanhe2:getProfile', account),
  adoptCookies: (account: string, text: string) => invoke('yanhe2:adoptCookies', account, text),
  calendarDay: (account, query) => invoke('yanhe2:calendarDay', account, query),
  calendarWeek: (account, query) => invoke('yanhe2:calendarWeek', account, query),
  myCourses: (account) => invoke('yanhe2:myCourses', account),
  courseDetail: (account, query) => invoke('yanhe2:courseDetail', account, query),
  terms: (account) => invoke('yanhe2:terms', account),
  searchCourses: (account, query) => invoke('yanhe2:searchCourses', account, query),
  findYanhektCourse: (account, query) => invoke('yanhe2:findYanhektCourse', account, query),
  findYanhe2Course: (account, query) => invoke('yanhe2:findYanhe2Course', account, query),
  playback: (account, query) => invoke('yanhe2:playback', account, query),
  slides: (account, query) => invoke('yanhe2:slides', account, query),
  prepareSlideSave: (account, query) => invoke('yanhe2:prepareSlideSave', account, query),
  saveSlides: (account, query) => invoke('yanhe2:saveSlides', account, query),
  onSlideSaveProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: Yanhe2SlideSaveProgress) => callback(progress);
    ipcRenderer.on('yanhe2:slideSaveProgress', listener);
    return () => {
      ipcRenderer.removeListener('yanhe2:slideSaveProgress', listener);
    };
  },
  prepareSubtitles: (account, query) => invoke('yanhe2:prepareSubtitles', account, query),
  saveSubtitles: (account, query, shift) => invoke('yanhe2:saveSubtitles', account, query, shift),
  prepareDownload: (account, query) => invoke('yanhe2:prepareDownload', account, query),
  prepareExtraction: (account, query) => invoke('yanhe2:prepareExtraction', account, query),
  transcript: (account, subId) => invoke('yanhe2:transcript', account, subId),
  captionSync: (account, query) => invoke('yanhe2:captionSync', account, query),
  prepareBrowserSignIn: () => invoke('yanhe2:prepareBrowserSignIn'),
  adoptBrowserSession: (account: string) => invoke('yanhe2:adoptBrowserSession', account),
};

export const config: ElectronAPI['config'] = {
  get: () => invoke('config:get'),
  // Subscribe to push updates from the main process. Fires after every setter
  // so the renderer-side configStore can mirror the latest AppConfig snapshot.
  onUpdate: (callback: (cfg: AppConfig) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, cfg: AppConfig) => callback(cfg);
    ipcRenderer.on('config:onUpdate', listener);
    return () => {
      ipcRenderer.removeListener('config:onUpdate', listener);
    };
  },
  setOutputDirectory: (directory: string) => invoke('config:setOutputDirectory', directory),
  selectOutputDirectory: () => invoke('config:selectOutputDirectory'),
  probeOutputDirectory: () => invoke('config:probeOutputDirectory'),
  recreateOutputDirectory: () => invoke('config:recreateOutputDirectory'),
  setConnectionMode: (mode: ConnectionMode) => invoke('config:setConnectionMode', mode),
  setMaxConcurrentDownloads: (count: number) => invoke('config:setMaxConcurrentDownloads', count),
  setDownloadMaxWorkers: (count: number) => invoke('config:setDownloadMaxWorkers', count),
  setDownloadNumRetries: (count: number) => invoke('config:setDownloadNumRetries', count),
  setMuteMode: (mode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded') => invoke('config:setMuteMode', mode),
  setVideoRetryCount: (count: number) => invoke('config:setVideoRetryCount', count),
  setVideoTokenRefreshSeconds: (seconds: number) => invoke('config:setVideoTokenRefreshSeconds', seconds),
  setTaskSpeed: (speed: number) => invoke('config:setTaskSpeed', speed),
  setParallelTasks: (count: number) => invoke('config:setParallelTasks', count),
  setMaxManualTabs: (count: number) => invoke('config:setMaxManualTabs', count),
  setPreviewFromVideo: (enabled: boolean) => invoke('config:setPreviewFromVideo', enabled),
  setPreviewSeekSeconds: (seconds: number) => invoke('config:setPreviewSeekSeconds', seconds),
  setShowMorePlaybackSpeed: (enabled: boolean) => invoke('config:setShowMorePlaybackSpeed', enabled),
  setPreferMicAudioByDefault: (enabled: boolean) => invoke('config:setPreferMicAudioByDefault', enabled),
  setCheckMicAudioBeforeOffering: (enabled: boolean) => invoke('config:setCheckMicAudioBeforeOffering', enabled),
  setYanhe2Captions: (mode, offsetSeconds) => invoke('config:setYanhe2Captions', mode, offsetSeconds),
  setResumeFromServerProgress: (enabled: boolean) => invoke('config:setResumeFromServerProgress', enabled),
  setResumeFromServerProgressLectures: (enabled: boolean) =>
    invoke('config:setResumeFromServerProgressLectures', enabled),
  setDeveloperMode: (enabled: boolean) => invoke('config:setDeveloperMode', enabled),
  setLogYanhektCatalog: (enabled: boolean) => invoke('config:setLogYanhektCatalog', enabled),
  setYanhektLiveWorkaround: (value) => invoke('config:setYanhektLiveWorkaround', value),
  setYanhektCourseSnapshotSearch: (enabled: boolean) => invoke('config:setYanhektCourseSnapshotSearch', enabled),
  setCourseSnapshotPickerTerms: (terms: string[]) => invoke('config:setCourseSnapshotPickerTerms', terms),
  setAutoPostProcessing: (enabled: boolean) => invoke('config:setAutoPostProcessing', enabled),
  setAutoPostProcessingLive: (enabled: boolean) => invoke('config:setAutoPostProcessingLive', enabled),
  getAutoPostProcessingLive: () => invoke('config:getAutoPostProcessingLive'),
  setEnableAIFiltering: (enabled: boolean) => invoke('config:setEnableAIFiltering', enabled),
  getEnableAIFiltering: () => invoke('config:getEnableAIFiltering'),
  setDistinguishMaybeSlide: (enabled: boolean) => invoke('config:setDistinguishMaybeSlide', enabled),
  getDistinguishMaybeSlide: () => invoke('config:getDistinguishMaybeSlide'),
  setAutoCropAIFilteredEdit: (enabled: boolean) => invoke('config:setAutoCropAIFilteredEdit', enabled),
  getAutoCropAIFilteredEdit: () => invoke('config:getAutoCropAIFilteredEdit'),
  setDedupAfterAutoCropAIFilteredEdit: (enabled: boolean) =>
    invoke('config:setDedupAfterAutoCropAIFilteredEdit', enabled),
  getDedupAfterAutoCropAIFilteredEdit: () =>
    invoke('config:getDedupAfterAutoCropAIFilteredEdit'),
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
  }) => invoke('config:setAutoCropParams', params),
  resetAutoCropParams: () => invoke('config:resetAutoCropParams'),
  setAutoCropDetectorMode: (mode: 'canny_then_yolo' | 'canny_only' | 'yolo_only') =>
    invoke('config:setAutoCropDetectorMode', mode),
  setAutoCropYoloParams: (params: {
    confidenceThreshold?: number;
    iouThreshold?: number;
    inputSize?: number;
  }) => invoke('config:setAutoCropYoloParams', params),
  resetAutoCropYoloParams: () => invoke('config:resetAutoCropYoloParams'),
  setThemeMode: (theme: 'system' | 'light' | 'dark') => invoke('config:setThemeMode', theme),
  isDarkMode: () => invoke('config:isDarkMode'),
  setLanguageMode: (language: LanguageMode) => invoke('config:setLanguageMode', language),
  getLanguageMode: () => invoke('config:getLanguageMode'),
  setPreventSystemSleep: (prevent: boolean) => invoke('config:setPreventSystemSleep', prevent),
  setAuthToken: (token: string | null) => invoke('config:setAuthToken', token),
  getAuthToken: (): Promise<string | null> => invoke('config:getAuthToken'),
  getSkipUpdateCheckUntil: () => invoke('config:getSkipUpdateCheckUntil'),
  setSkipUpdateCheckUntil: (timestamp: number) => invoke('config:setSkipUpdateCheckUntil', timestamp),
  setUserNames: (original: string, display: string) => invoke('config:setUserNames', original, display),
  setLastGreetingId: (id: string) => invoke('config:setLastGreetingId', id),
  setOnboardingCompleted: (completed: boolean) => invoke('config:setOnboardingCompleted', completed),
  setCloudStorageInitialized: (badge: string, initialized: boolean) => invoke('config:setCloudStorageInitialized', badge, initialized),
  setCloudAutoSyncMode: (mode: 'disabled' | 'edited' | 'reviewed') => invoke('config:setCloudAutoSyncMode', mode),
  setCloudAutoResyncMode: (mode: 'disabled' | 'edited') => invoke('config:setCloudAutoResyncMode', mode),
  setObsidian: (patch: { vaultPath?: string; subfolder?: string; autoCreateNote?: boolean }) => invoke('config:setObsidian', patch),
  setWatchNotes: (patch: { enabled?: boolean; provider?: WatchNotesProviderId }) => invoke('config:setWatchNotes', patch),
  setCloudShareEmbedTimeline: (enabled: boolean) => invoke('config:setCloudShareEmbedTimeline', enabled),
  setShowToolsButton: (enabled: boolean) => invoke('config:setShowToolsButton', enabled),
  setAllowCliControl: (enabled: boolean) => invoke('config:setAllowCliControl', enabled),
  setPreferAnonymousApiRequests: (enabled: boolean) => invoke('config:setPreferAnonymousApiRequests', enabled),
  setRememberPassword: (enabled: boolean) => invoke('config:setRememberPassword', enabled),
  setAutoSignIn: (enabled: boolean) => invoke('config:setAutoSignIn', enabled),
  setYanhe2SignInWithMain: (enabled: boolean) => invoke('config:setYanhe2SignInWithMain', enabled),
  setLocalRelayConfig: (patch: {
    enabled?: boolean;
    port?: number;
    whitelistEnabled?: boolean;
    includeCurrentToken?: boolean;
    tokenWhitelist?: string[];
  }) => invoke('config:setLocalRelayConfig', patch),
  upsertAccount: (account: StoredAccount) => invoke('config:upsertAccount', account),
  removeAccount: (badge: string) => invoke('config:removeAccount', badge),
  setSavedSearches: (mode: 'live' | 'recorded', searches: string[]) => invoke('config:setSavedSearches', mode, searches),
  setPinnedRecordedCourses: (courses: PinnedCourse[]) => invoke('config:setPinnedRecordedCourses', courses),
  getSlideExtractionConfig: () => invoke('config:getSlideExtractionConfig'),
  setSlideExtractionConfig: (cfg: { enableDuplicateRemoval?: boolean; enableExclusionList?: boolean }) =>
    invoke('config:setSlideExtractionConfig', cfg),
  setSlideCheckInterval: (interval: number) => invoke('config:setSlideCheckInterval', interval),
  setSlideDoubleVerification: (enabled: boolean, count?: number) =>
    invoke('config:setSlideDoubleVerification', enabled, count),
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
  }) => invoke('config:setSlideImageProcessingParams', params),
  getPHashExclusionList: () => invoke('config:getPHashExclusionList'),
  addPHashExclusionItem: (name: string, pHash: string) => invoke('config:addPHashExclusionItem', name, pHash),
  removePHashExclusionItem: (id: string) => invoke('config:removePHashExclusionItem', id),
  updatePHashExclusionItemName: (id: string, newName: string) =>
    invoke('config:updatePHashExclusionItemName', id, newName),
  clearPHashExclusionList: () => invoke('config:clearPHashExclusionList'),
  selectImageForExclusion: () => invoke('config:selectImageForExclusion'),
  getAIFilteringConfig: () => invoke('config:getAIFilteringConfig'),
  setAIFilteringConfig: (cfg: {
    serviceType?: 'builtin' | 'custom' | 'copilot';
    customApiBaseUrl?: string;
    customApiKey?: string;
    customModelName?: string;
    customModelChain?: string[];
    customProviderId?: CustomProviderId;
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
    requestBody?: {
      maxTokens?: number | null;
      temperature?: number | null;
      topP?: number | null;
      stream?: boolean | null;
      enableThinking?: boolean | null;
      thinkingKey?: 'enable_thinking' | 'thinking';
    };
  }) => invoke('config:setAIFilteringConfig', cfg),
  setAIClassifierMode: (mode: 'llm' | 'ml') => invoke('config:setAIClassifierMode', mode),
  setMlThresholds: (thresholds: { trustLow?: number; trustHigh?: number; slideCheckLow?: number }) =>
    invoke('config:setMlThresholds', thresholds),
  getAIPrompts: (variant?: 'simple' | 'distinguish') => invoke('config:getAIPrompts', variant),
  setAIPrompt: (type: 'live' | 'recorded', prompt: string, variant?: 'simple' | 'distinguish') =>
    invoke('config:setAIPrompt', type, prompt, variant),
  resetAIPrompt: (type: 'live' | 'recorded', variant?: 'simple' | 'distinguish') =>
    invoke('config:resetAIPrompt', type, variant),
};

export const windowNs: ElectronAPI['window'] = {
  minimize: () => invoke('window:minimize'),
  maximize: () => invoke('window:maximize'),
  close: () => invoke('window:close'),
  isMaximized: () => invoke('window:isMaximized'),
  // Report whether tasks/downloads are running so the main process can warn
  // before the window is closed or the app quits.
  setBusyState: (busy: boolean) => invoke('window:setBusyState', busy),
};

export const shell: ElectronAPI['shell'] = {
  openExternal: (url: string) => invoke('shell:openExternal', url),
  openPath: (filePath: string) => invoke('shell:openPath', filePath),
  openPrivacySettings: () => invoke('shell:openPrivacySettings'),
};

export const menu: ElectronAPI['menu'] = {
  openSettings: () => invoke('menu:requestOpenSettings'),
  onOpenSettings: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('menu:openSettings', handler);
    return () => ipcRenderer.removeListener('menu:openSettings', handler);
  },
  openTermsAndConditions: () => invoke('menu:openTermsAndConditions'),
  reload: () => invoke('menu:reload'),
  forceReload: () => invoke('menu:forceReload'),
  toggleDevTools: () => invoke('menu:toggleDevTools'),
  resetZoom: () => invoke('menu:resetZoom'),
  zoomIn: () => invoke('menu:zoomIn'),
  zoomOut: () => invoke('menu:zoomOut'),
  toggleFullscreen: () => invoke('menu:toggleFullscreen'),
};

export const powerManagement: ElectronAPI['powerManagement'] = {
  /** `holderId` names the consumer (tab, Web Capture, settings); the blocker stops when the last holder releases. */
  preventSleep: (holderId: string) => invoke('powerManagement:preventSleep', holderId),
  allowSleep: (holderId: string) => invoke('powerManagement:allowSleep', holderId),
  isPreventingSleep: () => invoke('powerManagement:isPreventingSleep'),
};

export const cache: ElectronAPI['cache'] = {
  getStats: () => invoke('cache:getStats'),
  clear: () => invoke('cache:clear'),
  resetAllData: () => invoke('cache:resetAllData'),
};

export const app: ElectronAPI['app'] = {
  restart: () => invoke('app:restart'),
  quit: () => invoke('app:quit'),
  getVersion: () => invoke('app:getVersion'),
  getLogDir: () => invoke('app:getLogDir'),
  openLogFolder: () => invoke('app:openLogFolder'),
};

export const log: ElectronAPI['log'] = {
  write: (level, source, namespace, message) => ipcRenderer.send('log:write', level, source, namespace, message),
};

export const dialog: ElectronAPI['dialog'] = {
  showMessageBox: (options: DialogOptions) => invoke('dialog:showMessageBox', options),
  showErrorBox: (title: string, content: string) => invoke('dialog:showErrorBox', title, content),
  openImageFile: () => invoke('dialog:openImageFile') as Promise<string | null>,
  openImageFiles: () => invoke('dialog:openImageFiles') as Promise<string[] | null>,
};
