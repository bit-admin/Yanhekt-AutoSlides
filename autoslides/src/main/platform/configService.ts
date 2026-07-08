import ElectronStore from 'electron-store';
import { dialog } from 'electron';
import * as fs from 'fs';
import { ThemeService, ThemeMode } from './themeService';
import {
  AUTO_CROP_YOLO_INPUT_SIZES,
  DEFAULT_AUTO_CROP_CONFIG,
  DEFAULT_AUTO_CROP_YOLO_CONFIG,
  DEFAULT_QT_EXTRACTOR_CONFIG,
  DEFAULT_ML_THRESHOLDS,
  DEFAULT_MODELSCOPE_MODELS,
  MODELSCOPE_API_BASE_URL,
  defaultAIFilteringConfig,
  defaultConfig,
  defaultSlideExtractionConfig,
  detectCustomProviderFromUrl
} from './config/defaults';
import type {
  AIClassifierMode,
  AIFilteringConfig,
  AIServiceType,
  AppConfig,
  AutoCropActiveModel,
  AutoCropConfig,
  AutoCropDetectorMode,
  AutoCropYoloConfig,
  CustomProviderId,
  LanguageMode,
  MlClassifierThresholds,
  PHashExclusionItem,
  PinnedCourse,
  QtExtractorConfig,
  SlideExtractionConfig,
  StoredAccount
} from './config/types';
import { createLogger } from '@main/infra/logger';
const log = createLogger('Config');

export type {
  AIClassifierMode,
  AIFilteringConfig,
  AIServiceType,
  AppConfig,
  AutoCropActiveModel,
  AutoCropConfig,
  AutoCropDetectorMode,
  AutoCropYoloConfig,
  CustomProviderId,
  LanguageMode,
  MlClassifierThresholds,
  PHashExclusionItem,
  QtExtractorConfig,
  SlideExtractionConfig,
  StoredAccount
};

export {
  AUTO_CROP_YOLO_INPUT_SIZES,
  DEFAULT_AUTO_CROP_CONFIG,
  DEFAULT_AUTO_CROP_YOLO_CONFIG,
  DEFAULT_QT_EXTRACTOR_CONFIG,
  DEFAULT_ML_THRESHOLDS,
  DEFAULT_MODELSCOPE_MODELS,
  MODELSCOPE_API_BASE_URL,
  detectCustomProviderFromUrl
};

export class ConfigService {
  private store: any; // Using any to bypass incorrect type definitions in electron-store v10+
  private themeService: ThemeService;

  constructor() {
    this.store = new ElectronStore({
      defaults: defaultConfig,
      name: 'autoslides-config'
    });

    this.themeService = new ThemeService();
    this.ensureOutputDirectoryExists();
    this.initializeTheme();
    this.migrateOnboardingFlag();
    this.migrateAccounts();
  }

  // One-time migration: existing installs (which have already shown a greeting)
  // should not be interrupted by the first-run onboarding wizard. Brand-new
  // installs have neither key set, so they keep onboardingCompleted = false.
  private migrateOnboardingFlag(): void {
    if (!this.store.has('onboardingCompleted')) {
      const isExistingInstall = !!this.store.get('lastGreetingId');
      this.store.set('onboardingCompleted', isExistingInstall);
    }
  }

  // One-time migration: bring the legacy single-account state (the standalone
  // `authToken` key + userOriginalNickname/userDisplayName) into the new `accounts`
  // list. Seeds a placeholder with badge '' because the badge is not persisted;
  // it is reconciled to a real record (matched by token) on the next verifyToken.
  private migrateAccounts(): void {
    const existing = (this.store.get('accounts') ?? []) as StoredAccount[];
    if (existing.length > 0) return;
    const token = this.store.get('authToken');
    if (!token) return;
    const now = Date.now();
    this.store.set('accounts', [{
      badge: '',
      nickname: this.store.get('userOriginalNickname') ?? '',
      displayName: this.store.get('userDisplayName') ?? '',
      token,
      addedAt: now,
      lastUsedAt: now
    }]);
  }

  // Insert or update an account, keyed by badge. Also drops any placeholder
  // (badge === '') whose token matches, reconciling a migrated legacy account.
  upsertAccount(account: StoredAccount): void {
    const accounts = (this.store.get('accounts') ?? []) as StoredAccount[];
    const filtered = accounts.filter((a) =>
      a.badge !== account.badge && !(a.badge === '' && a.token === account.token)
    );
    filtered.push(account);
    this.store.set('accounts', filtered);
  }

  removeAccount(badge: string): void {
    const accounts = (this.store.get('accounts') ?? []) as StoredAccount[];
    this.store.set('accounts', accounts.filter((a) => a.badge !== badge));
  }

  getConfig(): AppConfig {
    return {
      outputDirectory: this.store.get('outputDirectory'),
      connectionMode: this.store.get('connectionMode'),
      campusPortalHost: this.store.get('campusPortalHost') ?? '10.0.0.55',
      campusPortalUseHttps: this.store.get('campusPortalUseHttps') ?? false,
      maxConcurrentDownloads: this.store.get('maxConcurrentDownloads'),
      downloadMaxWorkers: this.store.get('downloadMaxWorkers'),
      downloadNumRetries: this.store.get('downloadNumRetries'),
      muteMode: this.store.get('muteMode'),
      videoRetryCount: this.store.get('videoRetryCount'),
      videoTokenRefreshSeconds: this.store.get('videoTokenRefreshSeconds') ?? 300,
      previewFromVideo: this.store.get('previewFromVideo') ?? true,
      previewSeekSeconds: this.store.get('previewSeekSeconds') ?? 150,
      taskSpeed: this.store.get('taskSpeed'),
      parallelTasks: this.store.get('parallelTasks') ?? 2,
      maxManualTabs: this.store.get('maxManualTabs') ?? 3,
      showMorePlaybackSpeed: this.store.get('showMorePlaybackSpeed') ?? false,
      autoPostProcessing: this.store.get('autoPostProcessing'),
      autoPostProcessingLive: this.store.get('autoPostProcessingLive') ?? true,
      enableAIFiltering: this.store.get('enableAIFiltering') ?? true,
      distinguishMaybeSlide: this.store.get('distinguishMaybeSlide') ?? true,
      themeMode: this.store.get('themeMode'),
      languageMode: this.store.get('languageMode'),
      preventSystemSleep: this.store.get('preventSystemSleep'),
      slideExtraction: this.store.get('slideExtraction'),
      aiFiltering: this.store.get('aiFiltering') ?? defaultAIFilteringConfig,
      qtExtractor: this.getQtExtractorConfig(),
      skipUpdateCheckUntil: this.store.get('skipUpdateCheckUntil') ?? 0,
      userOriginalNickname: this.store.get('userOriginalNickname') ?? '',
      userDisplayName: this.store.get('userDisplayName') ?? '',
      lastGreetingId: this.store.get('lastGreetingId') ?? '',
      savedSearchesLive: this.store.get('savedSearchesLive') ?? [],
      savedSearchesRecorded: this.store.get('savedSearchesRecorded') ?? [],
      pinnedRecordedCourses: this.store.get('pinnedRecordedCourses') ?? [],
      onboardingCompleted: this.store.get('onboardingCompleted') ?? false,
      cloudStorageInitializedUsers: this.store.get('cloudStorageInitializedUsers') ?? [],
      cloudAutoSyncMode: this.store.get('cloudAutoSyncMode') ?? 'disabled',
      cloudAutoPublishAfterSync: this.store.get('cloudAutoPublishAfterSync') ?? false,
      cloudAutoResyncMode: this.store.get('cloudAutoResyncMode') ?? 'disabled',
      cloudAutoRepublishAfterResync: this.store.get('cloudAutoRepublishAfterResync') ?? false,
      accounts: this.store.get('accounts') ?? []
    };
  }

  setUserNames(original: string, display: string): void {
    this.store.set('userOriginalNickname', original);
    this.store.set('userDisplayName', display);
  }

  setLastGreetingId(id: string): void {
    this.store.set('lastGreetingId', id);
  }

  setOnboardingCompleted(completed: boolean): void {
    this.store.set('onboardingCompleted', completed);
  }

  setCloudStorageInitialized(badge: string, initialized: boolean): void {
    const users = new Set(this.store.get('cloudStorageInitializedUsers') ?? []);
    if (initialized) users.add(badge);
    else users.delete(badge);
    this.store.set('cloudStorageInitializedUsers', [...users]);
  }

  setCloudAutoSyncMode(mode: 'disabled' | 'edited' | 'reviewed'): void {
    this.store.set('cloudAutoSyncMode', mode);
  }

  setCloudAutoPublishAfterSync(enabled: boolean): void {
    this.store.set('cloudAutoPublishAfterSync', enabled);
  }

  setCloudAutoResyncMode(mode: 'disabled' | 'edited'): void {
    this.store.set('cloudAutoResyncMode', mode);
  }

  setCloudAutoRepublishAfterResync(enabled: boolean): void {
    this.store.set('cloudAutoRepublishAfterResync', enabled);
  }

  setSavedSearches(mode: 'live' | 'recorded', searches: string[]): void {
    this.store.set(mode === 'live' ? 'savedSearchesLive' : 'savedSearchesRecorded', searches);
  }

  setPinnedRecordedCourses(courses: PinnedCourse[]): void {
    this.store.set('pinnedRecordedCourses', courses);
  }

  setOutputDirectory(directory: string): void {
    this.store.set('outputDirectory', directory);
    this.ensureOutputDirectoryExists();
  }

  setConnectionMode(mode: 'internal' | 'external'): void {
    this.store.set('connectionMode', mode);
  }

  setMaxConcurrentDownloads(count: number): void {
    const validCount = Math.max(1, Math.min(10, count));
    this.store.set('maxConcurrentDownloads', validCount);
  }

  setParallelTasks(count: number): void {
    // UI exposes 1–5; clamp to 1–10 so a hand-edited config.json works for devs.
    const validCount = Math.max(1, Math.min(10, count));
    this.store.set('parallelTasks', validCount);
  }

  setMaxManualTabs(count: number): void {
    const validCount = Math.max(1, Math.min(10, count));
    this.store.set('maxManualTabs', validCount);
  }

  getVideoTokenRefreshSeconds(): number {
    return this.store.get('videoTokenRefreshSeconds') ?? 300;
  }

  setVideoTokenRefreshSeconds(seconds: number): void {
    // UI exposes 10s–10min; clamp so a hand-edited config.json stays sane.
    const valid = Math.max(10, Math.min(600, Math.round(seconds)));
    this.store.set('videoTokenRefreshSeconds', valid);
  }

  setDownloadMaxWorkers(count: number): void {
    const validCount = Math.max(1, Math.min(32, count));
    this.store.set('downloadMaxWorkers', validCount);
  }

  setDownloadNumRetries(count: number): void {
    const validCount = Math.max(1, Math.min(30, count));
    this.store.set('downloadNumRetries', validCount);
  }

  setMuteMode(mode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded'): void {
    this.store.set('muteMode', mode);
  }

  setVideoRetryCount(count: number): void {
    const validCount = Math.max(5, Math.min(10, count));
    this.store.set('videoRetryCount', validCount);
  }

  setTaskSpeed(speed: number): void {
    const validSpeed = Math.max(1, Math.min(16, speed));
    this.store.set('taskSpeed', validSpeed);
  }

  setPreviewFromVideo(enabled: boolean): void {
    this.store.set('previewFromVideo', enabled);
  }

  setPreviewSeekSeconds(seconds: number): void {
    const validSeconds = Math.max(0, Math.min(3600, Math.round(seconds)));
    this.store.set('previewSeekSeconds', validSeconds);
  }

  setShowMorePlaybackSpeed(enabled: boolean): void {
    this.store.set('showMorePlaybackSpeed', enabled);
  }

  setAutoPostProcessing(enabled: boolean): void {
    this.store.set('autoPostProcessing', enabled);
  }

  setAutoPostProcessingLive(enabled: boolean): void {
    this.store.set('autoPostProcessingLive', enabled);
  }

  getAutoPostProcessingLive(): boolean {
    return this.store.get('autoPostProcessingLive') ?? true;
  }

  setEnableAIFiltering(enabled: boolean): void {
    this.store.set('enableAIFiltering', enabled);
  }

  getEnableAIFiltering(): boolean {
    return this.store.get('enableAIFiltering') ?? true;
  }

  setThemeMode(theme: ThemeMode): void {
    this.store.set('themeMode', theme);
    this.themeService.setTheme(theme);
  }

  getThemeMode(): ThemeMode {
    return this.store.get('themeMode');
  }

  isDarkMode(): boolean {
    return this.themeService.isDarkMode();
  }

  getEffectiveTheme(): 'light' | 'dark' {
    return this.themeService.getEffectiveTheme();
  }

  setLanguageMode(language: LanguageMode): void {
    this.store.set('languageMode', language);
  }

  getLanguageMode(): LanguageMode {
    return this.store.get('languageMode');
  }

  setPreventSystemSleep(prevent: boolean): void {
    this.store.set('preventSystemSleep', prevent);
  }

  getPreventSystemSleep(): boolean {
    return this.store.get('preventSystemSleep');
  }

  // Auth token mirror — stored here so add-ons windows (which have separate
  // localStorage) can read the token via IPC. The main renderer's TokenManager
  // remains the primary write path; it calls setAuthToken on save/clear.
  setAuthToken(token: string | null): void {
    if (token) {
      this.store.set('authToken', token);
    } else {
      this.store.delete('authToken');
    }
  }

  getAuthToken(): string | null {
    return this.store.get('authToken') ?? null;
  }

  setSkipUpdateCheckUntil(timestamp: number): void {
    this.store.set('skipUpdateCheckUntil', timestamp);
  }

  getSkipUpdateCheckUntil(): number {
    return this.store.get('skipUpdateCheckUntil') ?? 0;
  }

  // Slide extraction configuration methods
  getSlideExtractionConfig(): SlideExtractionConfig {
    const stored = this.store.get('slideExtraction') as SlideExtractionConfig | undefined;
    if (!stored) return defaultSlideExtractionConfig;
    let dirty = false;
    // Backfill nested autoCrop block for stores written before auto-crop was configurable.
    if (!stored.autoCrop) {
      stored.autoCrop = { ...DEFAULT_AUTO_CROP_CONFIG };
      dirty = true;
    } else {
      const merged = { ...DEFAULT_AUTO_CROP_CONFIG, ...stored.autoCrop };
      if (JSON.stringify(merged) !== JSON.stringify(stored.autoCrop)) {
        stored.autoCrop = merged;
        dirty = true;
      }
    }
    // Backfill YOLO detector fields introduced with the hybrid auto-crop.
    if (!stored.autoCropDetectorMode) {
      stored.autoCropDetectorMode = 'canny_then_yolo';
      dirty = true;
    }
    if (!stored.autoCropYolo) {
      stored.autoCropYolo = { ...DEFAULT_AUTO_CROP_YOLO_CONFIG };
      dirty = true;
    } else {
      const mergedYolo = { ...DEFAULT_AUTO_CROP_YOLO_CONFIG, ...stored.autoCropYolo };
      if (JSON.stringify(mergedYolo) !== JSON.stringify(stored.autoCropYolo)) {
        stored.autoCropYolo = mergedYolo;
        dirty = true;
      }
    }
    if (!stored.autoCropActiveModel) {
      stored.autoCropActiveModel = 'builtin';
      dirty = true;
    }
    if (stored.autoCropCustomModelName === undefined) {
      stored.autoCropCustomModelName = null;
      dirty = true;
    }
    if (dirty) this.store.set('slideExtraction', stored);
    return stored;
  }

  setSlideExtractionConfig(config: Partial<SlideExtractionConfig>): void {
    const currentConfig = this.getSlideExtractionConfig();
    const updatedConfig = { ...currentConfig, ...config };
    this.store.set('slideExtraction', updatedConfig);
  }

  setSlideCheckInterval(interval: number): void {
    const validInterval = Math.max(500, Math.min(10000, interval));
    this.setSlideExtractionConfig({ checkInterval: validInterval });
  }

  setSlideDoubleVerification(enabled: boolean, count?: number): void {
    const config: Partial<SlideExtractionConfig> = { enableDoubleVerification: enabled };
    if (count !== undefined) {
      config.verificationCount = Math.max(1, Math.min(5, count));
    }
    this.setSlideExtractionConfig(config);
  }

  setSlideImageProcessingParams(params: {
    ssimThreshold?: number;
    ssimPresetMode?: 'adaptive' | 'strict' | 'normal' | 'loose' | 'custom';
    pHashThreshold?: number;
    enableDownsampling?: boolean;
    downsampleWidth?: number;
    downsampleHeight?: number;
    enablePngColorReduction?: boolean;
  }): void {
    const config: Partial<SlideExtractionConfig> = {};

    if (params.ssimThreshold !== undefined) {
      config.ssimThreshold = Math.max(0.9, Math.min(1.0, params.ssimThreshold));
    }

    if (params.ssimPresetMode !== undefined) {
      config.ssimPresetMode = params.ssimPresetMode;
      config.isAdaptiveMode = params.ssimPresetMode === 'adaptive';
    }

    if (params.pHashThreshold !== undefined) {
      config.pHashThreshold = Math.max(0, Math.min(256, Math.round(params.pHashThreshold)));
    }

    if (params.enableDownsampling !== undefined) {
      config.enableDownsampling = params.enableDownsampling;
    }

    if (params.downsampleWidth !== undefined) {
      config.downsampleWidth = Math.max(160, Math.min(1920, Math.round(params.downsampleWidth)));
    }

    if (params.downsampleHeight !== undefined) {
      config.downsampleHeight = Math.max(90, Math.min(1080, Math.round(params.downsampleHeight)));
    }

    if (params.enablePngColorReduction !== undefined) {
      config.enablePngColorReduction = params.enablePngColorReduction;
    }

    this.setSlideExtractionConfig(config);
  }

  setAutoCropParams(params: Partial<AutoCropConfig>): void {
    const current = this.getSlideExtractionConfig().autoCrop ?? { ...DEFAULT_AUTO_CROP_CONFIG };
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    const next: AutoCropConfig = { ...current };

    if (params.aspectTolerance !== undefined) {
      next.aspectTolerance = clamp(params.aspectTolerance, 0.001, 1);
    }
    if (params.blackThreshold !== undefined) {
      next.blackThreshold = clamp(Math.round(params.blackThreshold), 0, 255);
    }
    if (params.maxBorderFrac !== undefined) {
      next.maxBorderFrac = clamp(params.maxBorderFrac, 0, 0.49);
    }
    if (params.cannyLowThreshold !== undefined) {
      next.cannyLowThreshold = clamp(Math.round(params.cannyLowThreshold), 0, 255);
    }
    if (params.cannyHighThreshold !== undefined) {
      next.cannyHighThreshold = clamp(Math.round(params.cannyHighThreshold), 0, 255);
    }
    if (params.areaRatioMin !== undefined) {
      next.areaRatioMin = clamp(params.areaRatioMin, 0, 1);
    }
    if (params.areaRatioMax !== undefined) {
      next.areaRatioMax = clamp(params.areaRatioMax, 0, 1);
    }
    if (params.marginFrac !== undefined) {
      next.marginFrac = clamp(params.marginFrac, 0, 0.49);
    }
    if (params.fillRatioMin !== undefined) {
      next.fillRatioMin = clamp(params.fillRatioMin, 0, 1);
    }

    this.setSlideExtractionConfig({ autoCrop: next });
  }

  resetAutoCropParams(): AutoCropConfig {
    const defaults = { ...DEFAULT_AUTO_CROP_CONFIG };
    this.setSlideExtractionConfig({ autoCrop: defaults });
    return defaults;
  }

  setAutoCropDetectorMode(mode: AutoCropDetectorMode): void {
    const valid: AutoCropDetectorMode[] = ['canny_then_yolo', 'canny_only', 'yolo_only'];
    const next: AutoCropDetectorMode = valid.includes(mode) ? mode : 'canny_then_yolo';
    this.setSlideExtractionConfig({ autoCropDetectorMode: next });
  }

  setAutoCropYoloParams(params: Partial<AutoCropYoloConfig>): void {
    const current = this.getSlideExtractionConfig().autoCropYolo ?? { ...DEFAULT_AUTO_CROP_YOLO_CONFIG };
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    const next: AutoCropYoloConfig = { ...current };

    if (params.confidenceThreshold !== undefined) {
      next.confidenceThreshold = clamp(params.confidenceThreshold, 0.05, 0.95);
    }
    if (params.iouThreshold !== undefined) {
      next.iouThreshold = clamp(params.iouThreshold, 0.1, 0.9);
    }
    if (params.inputSize !== undefined) {
      const rounded = Math.round(params.inputSize);
      next.inputSize = AUTO_CROP_YOLO_INPUT_SIZES.includes(rounded as typeof AUTO_CROP_YOLO_INPUT_SIZES[number])
        ? rounded
        : 640;
    }

    this.setSlideExtractionConfig({ autoCropYolo: next });
  }

  resetAutoCropYoloParams(): AutoCropYoloConfig {
    const defaults = { ...DEFAULT_AUTO_CROP_YOLO_CONFIG };
    this.setSlideExtractionConfig({ autoCropYolo: defaults });
    return defaults;
  }

  setAutoCropActiveModel(active: AutoCropActiveModel): void {
    const next: AutoCropActiveModel = active === 'custom' ? 'custom' : 'builtin';
    this.setSlideExtractionConfig({ autoCropActiveModel: next });
  }

  setAutoCropCustomModelName(name: string | null): void {
    this.setSlideExtractionConfig({ autoCropCustomModelName: name });
  }

  setDistinguishMaybeSlide(enabled: boolean): void {
    this.store.set('distinguishMaybeSlide', enabled);
  }

  getDistinguishMaybeSlide(): boolean {
    return this.store.get('distinguishMaybeSlide') ?? true;
  }

  // SSIM Adaptive Mode Management
  setSsimPresetMode(mode: 'adaptive' | 'strict' | 'normal' | 'loose' | 'custom'): void {
    const config: Partial<SlideExtractionConfig> = {
      ssimPresetMode: mode,
      isAdaptiveMode: mode === 'adaptive'
    };
    this.setSlideExtractionConfig(config);
  }

  getSsimPresetMode(): 'adaptive' | 'strict' | 'normal' | 'loose' | 'custom' {
    const config = this.getSlideExtractionConfig();
    return config.ssimPresetMode || 'adaptive';
  }

  isInAdaptiveMode(): boolean {
    const config = this.getSlideExtractionConfig();
    return config.isAdaptiveMode === true;
  }

  setAdaptiveMode(enabled: boolean): void {
    const config: Partial<SlideExtractionConfig> = {
      isAdaptiveMode: enabled
    };

    // If enabling adaptive mode, also set the preset mode
    if (enabled) {
      config.ssimPresetMode = 'adaptive';
    }

    this.setSlideExtractionConfig(config);
  }

  // pHash threshold management
  setPHashThreshold(threshold: number): void {
    const validThreshold = Math.max(0, Math.min(256, Math.round(threshold)));
    this.setSlideExtractionConfig({ pHashThreshold: validThreshold });
  }

  getPHashThreshold(): number {
    const config = this.getSlideExtractionConfig();
    return config.pHashThreshold || 10;
  }

  // pHash exclusion list management
  getPHashExclusionList(): PHashExclusionItem[] {
    const config = this.getSlideExtractionConfig();
    const userList = config.pHashExclusionList || [];

    // Get default presets
    const defaultPresets = defaultSlideExtractionConfig.pHashExclusionList;

    // Merge presets with user items, preserving user's preset enable/disable state
    const presets = defaultPresets.map(preset => {
      const existingPreset = userList.find(item => item.id === preset.id);
      return existingPreset || preset;
    });

    // Add user-created items (non-presets)
    const userItems = userList.filter(item => !item.isPreset);

    return [...presets, ...userItems];
  }

  addPHashExclusionItem(name: string, pHash: string): PHashExclusionItem {
    const exclusionList = this.getPHashExclusionList();
    const newItem: PHashExclusionItem = {
      id: `exclusion_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      name: name.trim(),
      pHash: pHash,
      createdAt: Date.now()
    };

    const updatedList = [...exclusionList, newItem];
    this.setSlideExtractionConfig({ pHashExclusionList: updatedList });

    return newItem;
  }

  removePHashExclusionItem(id: string): boolean {
    const config = this.getSlideExtractionConfig();
    const userList = config.pHashExclusionList || [];

    // Find the item to remove/disable
    const item = this.getPHashExclusionList().find(item => item.id === id);
    if (!item) return false;

    if (item.isPreset) {
      // For preset items, toggle the enabled state
      const existingPresetIndex = userList.findIndex(item => item.id === id);
      const updatedList = [...userList];

      if (existingPresetIndex >= 0) {
        // Update existing preset state
        updatedList[existingPresetIndex] = { ...item, isEnabled: !item.isEnabled };
      } else {
        // Add preset with disabled state
        updatedList.push({ ...item, isEnabled: false });
      }

      this.setSlideExtractionConfig({ pHashExclusionList: updatedList });
      return true;
    } else {
      // For user items, actually remove them
      const updatedList = userList.filter(item => item.id !== id);
      this.setSlideExtractionConfig({ pHashExclusionList: updatedList });
      return true;
    }
  }

  updatePHashExclusionItemName(id: string, newName: string): boolean {
    const exclusionList = this.getPHashExclusionList();
    const itemIndex = exclusionList.findIndex(item => item.id === id);

    if (itemIndex !== -1) {
      const updatedList = [...exclusionList];
      updatedList[itemIndex] = { ...updatedList[itemIndex], name: newName.trim() };
      this.setSlideExtractionConfig({ pHashExclusionList: updatedList });
      return true;
    }

    return false;
  }

  clearPHashExclusionList(): void {
    this.setSlideExtractionConfig({ pHashExclusionList: [] });
  }

  // AI Filtering configuration methods
  getAIFilteringConfig(): AIFilteringConfig {
    const stored = this.store.get('aiFiltering') as Partial<AIFilteringConfig> | undefined;
    const base: AIFilteringConfig = stored
      ? {
          ...defaultAIFilteringConfig,
          ...stored,
          mlThresholds: { ...DEFAULT_ML_THRESHOLDS, ...(stored.mlThresholds || {}) }
        }
      : { ...defaultAIFilteringConfig };

    // Migration: ensure customProviderId and customModelChain are populated for installs
    // that predate these fields. Only seed the chain for ModelScope (the only provider
    // with a built-in preset model list).
    const providerId = stored?.customProviderId ?? detectCustomProviderFromUrl(base.customApiBaseUrl);
    base.customProviderId = providerId;

    if (!Array.isArray(base.customModelChain) || base.customModelChain.length === 0) {
      if (providerId === 'modelscope') {
        const chain = [...DEFAULT_MODELSCOPE_MODELS];
        if (base.customModelName && !chain.includes(base.customModelName)) {
          chain.unshift(base.customModelName);
        }
        base.customModelChain = chain;
      } else if (base.customModelName) {
        base.customModelChain = [base.customModelName];
      } else {
        base.customModelChain = [];
      }
    }

    return base;
  }

  setAIFilteringConfig(config: Partial<AIFilteringConfig>): void {
    const currentConfig = this.getAIFilteringConfig();
    const updatedConfig = { ...currentConfig, ...config };
    this.store.set('aiFiltering', updatedConfig);
  }

  setAIServiceType(serviceType: AIServiceType): void {
    this.setAIFilteringConfig({ serviceType });
  }

  setAICustomApiBaseUrl(url: string): void {
    const trimmed = url.trim();
    this.setAIFilteringConfig({
      customApiBaseUrl: trimmed,
      customProviderId: detectCustomProviderFromUrl(trimmed)
    });
  }

  setAICustomApiKey(apiKey: string): void {
    this.setAIFilteringConfig({ customApiKey: apiKey });
  }

  setAICustomModelName(modelName: string): void {
    this.setAIFilteringConfig({ customModelName: modelName.trim() });
  }

  setAICustomModelChain(chain: string[]): void {
    const cleaned = Array.from(new Set(chain.map(m => m.trim()).filter(m => m.length > 0)));
    const patch: Partial<AIFilteringConfig> = { customModelChain: cleaned };
    // Keep customModelName in sync with the primary (first) entry for back-compat
    if (cleaned.length > 0) patch.customModelName = cleaned[0];
    this.setAIFilteringConfig(patch);
  }

  getAICustomModelChain(): string[] {
    return [...this.getAIFilteringConfig().customModelChain];
  }

  setAIRateLimit(rateLimit: number): void {
    // For built-in service, cap at 10 requests per minute
    const config = this.getAIFilteringConfig();
    const maxLimit = config.serviceType === 'builtin' ? 10 : 60;
    const validRateLimit = Math.max(1, Math.min(maxLimit, Math.round(rateLimit)));
    this.setAIFilteringConfig({ rateLimit: validRateLimit });
  }

  getAIRateLimit(): number {
    const config = this.getAIFilteringConfig();
    return config.rateLimit || 10;
  }

  setAIBatchSize(batchSize: number): void {
    // Batch size must be between 1 and 10
    const validBatchSize = Math.max(1, Math.min(10, Math.round(batchSize)));
    this.setAIFilteringConfig({ batchSize: validBatchSize });
  }

  getAIBatchSize(): number {
    const config = this.getAIFilteringConfig();
    return config.batchSize || 5;
  }

  setAIClassifierMode(mode: AIClassifierMode): void {
    this.setAIFilteringConfig({ classifierMode: mode });
  }

  getAIClassifierMode(): AIClassifierMode {
    return this.getAIFilteringConfig().classifierMode || 'llm';
  }

  getMlThresholds(): MlClassifierThresholds {
    return { ...this.getAIFilteringConfig().mlThresholds };
  }

  setMlThresholds(thresholds: Partial<MlClassifierThresholds>): void {
    const current = this.getMlThresholds();
    const clamp = (v: number): number => Math.max(0, Math.min(1, v));
    const next: MlClassifierThresholds = {
      trustLow: thresholds.trustLow != null ? clamp(thresholds.trustLow) : current.trustLow,
      trustHigh: thresholds.trustHigh != null ? clamp(thresholds.trustHigh) : current.trustHigh,
      slideCheckLow:
        thresholds.slideCheckLow != null ? clamp(thresholds.slideCheckLow) : current.slideCheckLow
    };
    if (next.trustLow > next.trustHigh) next.trustLow = next.trustHigh;
    this.setAIFilteringConfig({ mlThresholds: next });
  }

  setMlClassifierActiveModel(active: 'builtin' | 'custom'): void {
    this.setAIFilteringConfig({ mlClassifierActiveModel: active });
  }

  setMlClassifierCustomModelName(name: string | null): void {
    this.setAIFilteringConfig({ mlClassifierCustomModelName: name });
  }

  // Qt Extractor configuration methods
  getQtExtractorConfig(): QtExtractorConfig {
    const stored = this.store.get('qtExtractor') as Partial<QtExtractorConfig> | undefined;
    if (!stored) return { ...DEFAULT_QT_EXTRACTOR_CONFIG };
    return {
      ...DEFAULT_QT_EXTRACTOR_CONFIG,
      ...stored
    };
  }

  setQtExtractorConfig(config: Partial<QtExtractorConfig>): void {
    const current = this.getQtExtractorConfig();
    const next: QtExtractorConfig = { ...current, ...config };
    this.store.set('qtExtractor', next);
  }

  setQtExtractorBinaryPath(binaryPath: string): void {
    this.setQtExtractorConfig({ binaryPath: binaryPath || '' });
  }

  setQtExtractorAutoRun(enabled: boolean): void {
    this.setQtExtractorConfig({ autoRunAfterDownload: enabled });
  }

  setQtExtractorAutoPostProcess(enabled: boolean): void {
    this.setQtExtractorConfig({ autoPostProcessAfter: enabled });
  }

  getEnablePngColorReduction(): boolean {
    return this.getSlideExtractionConfig().enablePngColorReduction !== false;
  }

  async selectOutputDirectory(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: this.store.get('outputDirectory')
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0];
      this.setOutputDirectory(selectedPath);
      return selectedPath;
    }

    return null;
  }

  get<K extends keyof AppConfig>(key: K, defaultValue?: AppConfig[K]): AppConfig[K] {
    return this.store.get(key, defaultValue);
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.store.set(key, value);
  }

  private ensureOutputDirectoryExists(): void {
    const outputDir = this.store.get('outputDirectory');
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    } catch (error) {
      log.error('Failed to create output directory:', error);
    }
  }

  private initializeTheme(): void {
    const savedTheme = this.getThemeMode();
    this.themeService.setTheme(savedTheme);
  }
}