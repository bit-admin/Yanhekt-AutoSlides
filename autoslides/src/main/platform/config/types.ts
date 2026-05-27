import type { ThemeMode } from '../themeService';

export interface PHashExclusionItem {
  id: string;
  name: string;
  pHash: string;
  createdAt: number;
  isPreset?: boolean;
  isEnabled?: boolean;
}

export interface AutoCropConfig {
  aspectTolerance: number;
  blackThreshold: number;
  maxBorderFrac: number;
  cannyLowThreshold: number;
  cannyHighThreshold: number;
  areaRatioMin: number;
  areaRatioMax: number;
  marginFrac: number;
  fillRatioMin: number;
}

export type AutoCropDetectorMode = 'canny_then_yolo' | 'canny_only' | 'yolo_only';
export type AutoCropActiveModel = 'builtin' | 'custom';

export interface AutoCropYoloConfig {
  confidenceThreshold: number;
  iouThreshold: number;
  inputSize: number;
}

export interface SlideExtractionConfig {
  checkInterval: number;
  enableDoubleVerification: boolean;
  verificationCount: number;

  ssimThreshold: number;
  ssimPresetMode?: 'adaptive' | 'strict' | 'normal' | 'loose' | 'custom';
  isAdaptiveMode?: boolean;

  enableDownsampling: boolean;
  downsampleWidth: number;
  downsampleHeight: number;

  pHashThreshold: number;
  pHashExclusionList: PHashExclusionItem[];
  enableDuplicateRemoval: boolean;
  enableExclusionList: boolean;

  enablePngColorReduction: boolean;

  autoCrop: AutoCropConfig;

  autoCropDetectorMode: AutoCropDetectorMode;
  autoCropYolo: AutoCropYoloConfig;
  autoCropActiveModel: AutoCropActiveModel;
  autoCropCustomModelName: string | null;
}

export interface QtExtractorConfig {
  binaryPath: string;
  autoRunAfterDownload: boolean;
  autoPostProcessAfter: boolean;
}

export type LanguageMode = 'system' | 'en' | 'zh' | 'ja' | 'ko';

export type AIServiceType = 'builtin' | 'custom' | 'copilot';

export type AIClassifierMode = 'llm' | 'ml';

export type CustomProviderId = 'modelscope' | 'lm_studio' | 'other';

export interface MlClassifierThresholds {
  trustLow: number;
  trustHigh: number;
  slideCheckLow: number;
}

export interface AIFilteringConfig {
  classifierMode: AIClassifierMode;
  serviceType: AIServiceType;
  customApiBaseUrl: string;
  customApiKey: string;
  customModelName: string;
  customModelChain: string[];
  customProviderId: CustomProviderId;
  copilotGhoToken: string;
  copilotModelName: string;
  copilotUsername: string;
  copilotAvatarUrl: string;
  rateLimit: number;
  batchSize: number;
  imageResizeWidth: number;
  imageResizeHeight: number;
  maxConcurrent: number;
  minTime: number;
  mlThresholds: MlClassifierThresholds;
  mlClassifierActiveModel: 'builtin' | 'custom';
  mlClassifierCustomModelName: string | null;
}

export interface AppConfig {
  outputDirectory: string;
  connectionMode: 'internal' | 'external';
  intranetMode?: boolean;
  intranetMappings?: Record<string, string>;
  intranetInterfaceIp?: string;
  maxConcurrentDownloads: number;
  downloadMaxWorkers: number;
  downloadNumRetries: number;
  muteMode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded';
  videoRetryCount: number;
  taskSpeed: number;
  showMorePlaybackSpeed: boolean;
  autoPostProcessing: boolean;
  autoPostProcessingLive: boolean;
  enableAIFiltering: boolean;
  distinguishMaybeSlide: boolean;
  themeMode: ThemeMode;
  languageMode: LanguageMode;
  preventSystemSleep: boolean;
  slideExtraction: SlideExtractionConfig;
  aiFiltering: AIFilteringConfig;
  qtExtractor: QtExtractorConfig;
  skipUpdateCheckUntil: number;
  userOriginalNickname: string;
  userDisplayName: string;
  lastGreetingId: string;
  savedSearchesLive: string[];
  savedSearchesRecorded: string[];
}
