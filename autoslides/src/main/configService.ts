import ElectronStore from 'electron-store';
import { dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ThemeService, ThemeMode } from './themeService';

export interface PHashExclusionItem {
  id: string;                      // Unique identifier for the exclusion item
  name: string;                    // User-defined name for the exclusion item
  pHash: string;                   // 256-bit pHash value as hex string
  createdAt: number;               // Timestamp when the item was created
  isPreset?: boolean;              // Whether this is a preset item (cannot be deleted)
  isEnabled?: boolean;             // Whether this preset item is enabled (only for presets)
}

export interface SlideExtractionConfig {
  // User configurable parameters
  checkInterval: number;           // Detection interval in milliseconds
  enableDoubleVerification: boolean; // Enable dual verification
  verificationCount: number;       // Number of verification attempts

  // Advanced image processing parameters
  ssimThreshold: number;           // SSIM similarity threshold
  ssimPresetMode?: 'adaptive' | 'strict' | 'normal' | 'loose' | 'custom'; // SSIM preset mode
  isAdaptiveMode?: boolean;        // Whether currently in adaptive mode

  // Downsampling parameters for SSIM
  enableDownsampling: boolean;     // Enable downsampling before SSIM calculation
  downsampleWidth: number;         // Target width for downsampling
  downsampleHeight: number;        // Target height for downsampling

  // Post-processing parameters
  pHashThreshold: number;          // pHash Hamming distance threshold for post-processing
  pHashExclusionList: PHashExclusionItem[]; // List of images to exclude from post-processing
  enableDuplicateRemoval: boolean; // Enable duplicate removal phase in post-processing
  enableExclusionList: boolean;    // Enable exclusion list phase in post-processing
}

export type LanguageMode = 'system' | 'en' | 'zh' | 'ja' | 'ko';

export type AIServiceType = 'builtin' | 'custom';

export interface AIFilteringConfig {
  serviceType: AIServiceType;
  customApiBaseUrl: string;
  customApiKey: string;
  customModelName: string;
  rateLimit: number; // requests per minute, default 10
  batchSize: number; // number of images per batch for recorded mode, default 5
  imageResizeWidth: number; // width to resize images before sending to AI, default 768
  imageResizeHeight: number; // height to resize images before sending to AI, default 432
  maxConcurrent: number; // max concurrent requests, default 1
  minTime: number; // minimum time between requests in ms, default 6000
}

export interface AppConfig {
  outputDirectory: string;
  connectionMode: 'internal' | 'external';
  intranetMode?: boolean;
  intranetMappings?: Record<string, string>;
  maxConcurrentDownloads: number;
  muteMode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded';
  videoRetryCount: number;
  taskSpeed: number;
  autoPostProcessing: boolean;
  autoPostProcessingLive: boolean;
  enableAIFiltering: boolean;
  themeMode: ThemeMode;
  languageMode: LanguageMode;
  preventSystemSleep: boolean;
  slideExtraction: SlideExtractionConfig;
  aiFiltering: AIFilteringConfig;
}

const defaultSlideExtractionConfig: SlideExtractionConfig = {
  // User configurable parameters (from UI)
  checkInterval: 2000,              // 2 seconds
  enableDoubleVerification: true,   // Enable dual verification
  verificationCount: 2,             // 2 verification attempts

  // Advanced image processing parameters
  ssimThreshold: 0.9987,           // SSIM similarity threshold (default to normal)
  ssimPresetMode: 'adaptive',      // Default to adaptive mode
  isAdaptiveMode: true,            // Start in adaptive mode

  // Downsampling parameters
  enableDownsampling: true,        // Enable downsampling by default
  downsampleWidth: 480,            // Default downsample width
  downsampleHeight: 270,           // Default downsample height

  // Post-processing parameters
  pHashThreshold: 10,              // pHash Hamming distance threshold (default: 10)
  pHashExclusionList: [            // Default preset exclusion items
    {
      id: 'preset_no_signal',
      name: 'No Signal',
      pHash: '4ccccccc33333333cccccccc33333333cccccccccccc333333336666ccccdccc',
      createdAt: 0,
      isPreset: true,
      isEnabled: true
    },
    {
      id: 'preset_no_input',
      name: 'No Input',
      pHash: '4ccc33333333ccc933338ccccc73666399cc9999ce633333cccccccc3333999c',
      createdAt: 0,
      isPreset: true,
      isEnabled: true
    },
    {
      id: 'preset_black_screen',
      name: 'Black Screen',
      pHash: '4118adfc4b08ba71510bbf680718b166c99a96d6d718cee474f3fcb52a1c7d4a',
      createdAt: 0,
      isPreset: true,
      isEnabled: true
    },
    {
      id: 'preset_desktop',
      name: 'Desktop',
      pHash: '5555f4f43d0a1f0b3b8ec4f1c2e43f070932f0fcc07c3c093d0bcf07c3969b93',
      createdAt: 0,
      isPreset: true,
      isEnabled: true
    }
  ],
  enableDuplicateRemoval: true,    // Enable duplicate removal phase by default
  enableExclusionList: true        // Enable exclusion list phase by default
};

const defaultAIFilteringConfig: AIFilteringConfig = {
  serviceType: 'builtin',
  customApiBaseUrl: '',
  customApiKey: '',
  customModelName: '',
  rateLimit: 10, // default 10 requests per minute
  batchSize: 5, // default 5 images per batch for recorded mode
  imageResizeWidth: 768, // default 768px width (40% of 1920)
  imageResizeHeight: 432, // default 432px height (40% of 1080)
  maxConcurrent: 1, // default 1 concurrent request
  minTime: 6000 // default 6000ms between requests
};

const defaultConfig: AppConfig = {
  outputDirectory: path.join(os.homedir(), 'Downloads', 'AutoSlides'),
  connectionMode: 'external',
  maxConcurrentDownloads: 5,
  muteMode: 'normal',
  videoRetryCount: 5,
  taskSpeed: 10,
  autoPostProcessing: true,
  autoPostProcessingLive: true,
  enableAIFiltering: true,
  themeMode: 'system',
  languageMode: 'system',
  preventSystemSleep: true,
  slideExtraction: defaultSlideExtractionConfig,
  aiFiltering: defaultAIFilteringConfig
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
  }

  getConfig(): AppConfig {
    return {
      outputDirectory: this.store.get('outputDirectory'),
      connectionMode: this.store.get('connectionMode'),
      maxConcurrentDownloads: this.store.get('maxConcurrentDownloads'),
      muteMode: this.store.get('muteMode'),
      videoRetryCount: this.store.get('videoRetryCount'),
      taskSpeed: this.store.get('taskSpeed'),
      autoPostProcessing: this.store.get('autoPostProcessing'),
      autoPostProcessingLive: this.store.get('autoPostProcessingLive') ?? true,
      enableAIFiltering: this.store.get('enableAIFiltering') ?? true,
      themeMode: this.store.get('themeMode'),
      languageMode: this.store.get('languageMode'),
      preventSystemSleep: this.store.get('preventSystemSleep'),
      slideExtraction: this.store.get('slideExtraction'),
      aiFiltering: this.store.get('aiFiltering') || defaultAIFilteringConfig
    };
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

  setMuteMode(mode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded'): void {
    this.store.set('muteMode', mode);
  }

  setVideoRetryCount(count: number): void {
    const validCount = Math.max(5, Math.min(10, count));
    this.store.set('videoRetryCount', validCount);
  }

  setTaskSpeed(speed: number): void {
    const validSpeed = Math.max(1, Math.min(10, speed));
    this.store.set('taskSpeed', validSpeed);
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

  // Slide extraction configuration methods
  getSlideExtractionConfig(): SlideExtractionConfig {
    return this.store.get('slideExtraction');
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

    this.setSlideExtractionConfig(config);
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
    return this.store.get('aiFiltering') || defaultAIFilteringConfig;
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
    this.setAIFilteringConfig({ customApiBaseUrl: url.trim() });
  }

  setAICustomApiKey(apiKey: string): void {
    this.setAIFilteringConfig({ customApiKey: apiKey });
  }

  setAICustomModelName(modelName: string): void {
    this.setAIFilteringConfig({ customModelName: modelName.trim() });
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
      console.error('Failed to create output directory:', error);
    }
  }

  private initializeTheme(): void {
    const savedTheme = this.getThemeMode();
    this.themeService.setTheme(savedTheme);
  }
}