import * as path from 'path';
import * as os from 'os';
import type {
  AppConfig,
  AutoCropConfig,
  AutoCropYoloConfig,
  AIFilteringConfig,
  MlClassifierThresholds,
  QtExtractorConfig,
  SlideExtractionConfig,
  CustomProviderId
} from './types';

export const AUTO_CROP_YOLO_INPUT_SIZES = [320, 480, 640, 960, 1280] as const;

export const DEFAULT_AUTO_CROP_CONFIG: AutoCropConfig = {
  aspectTolerance: 0.05,
  blackThreshold: 20,
  maxBorderFrac: 0.10,
  cannyLowThreshold: 20,
  cannyHighThreshold: 60,
  areaRatioMin: 0.08,
  areaRatioMax: 0.95,
  marginFrac: 0.02,
  fillRatioMin: 0.85
};

export const DEFAULT_AUTO_CROP_YOLO_CONFIG: AutoCropYoloConfig = {
  confidenceThreshold: 0.25,
  iouThreshold: 0.45,
  inputSize: 640
};

export const DEFAULT_QT_EXTRACTOR_CONFIG: QtExtractorConfig = {
  binaryPath: '',
  autoRunAfterDownload: false,
  autoPostProcessAfter: true
};

export const MODELSCOPE_API_BASE_URL = 'https://api-inference.modelscope.cn/v1';

// Canonical ModelScope preset model list. The renderer owns the display labels;
// this list is used for migration and default-chain seeding in the main process.
export const DEFAULT_MODELSCOPE_MODELS: string[] = [
  'Qwen/Qwen3.5-397B-A17B',
  'Qwen/Qwen3.5-122B-A10B',
  'Qwen/Qwen3.5-35B-A3B',
  'Qwen/Qwen3.5-27B',
  'moonshotai/Kimi-K2.5'
];

export function detectCustomProviderFromUrl(url: string): CustomProviderId {
  if (!url) return 'other';
  if (url.includes('api-inference.modelscope.cn')) return 'modelscope';
  if (/localhost:1234|127\.0\.0\.1:1234/.test(url)) return 'lm_studio';
  if (url.includes('integrate.api.nvidia.com')) return 'nvidia';
  if (url.includes('apihub.agnes-ai.com')) return 'agnes';
  return 'other';
}

export const DEFAULT_ML_THRESHOLDS: MlClassifierThresholds = {
  trustLow: 0.75,
  trustHigh: 0.9,
  slideCheckLow: 0.25
};

export const defaultSlideExtractionConfig: SlideExtractionConfig = {
  checkInterval: 2000,
  enableDoubleVerification: true,
  verificationCount: 2,

  ssimThreshold: 0.9987,
  ssimPresetMode: 'adaptive',
  isAdaptiveMode: true,

  enableDownsampling: true,
  downsampleWidth: 480,
  downsampleHeight: 270,

  pHashThreshold: 10,
  pHashExclusionList: [
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
  enableDuplicateRemoval: true,
  enableExclusionList: true,

  enablePngColorReduction: true,

  autoCrop: { ...DEFAULT_AUTO_CROP_CONFIG },
  autoCropDetectorMode: 'canny_then_yolo',
  autoCropYolo: { ...DEFAULT_AUTO_CROP_YOLO_CONFIG },
  autoCropActiveModel: 'builtin',
  autoCropCustomModelName: null
};

export const defaultAIFilteringConfig: AIFilteringConfig = {
  classifierMode: 'llm',
  serviceType: 'builtin',
  customApiBaseUrl: '',
  customApiKey: '',
  customModelName: '',
  customModelChain: [],
  customProviderId: 'other',
  copilotGhoToken: '',
  copilotModelName: 'gpt-5-mini',
  copilotUsername: '',
  copilotAvatarUrl: '',
  rateLimit: 10,
  batchSize: 5,
  imageResizeWidth: 768,
  imageResizeHeight: 432,
  maxConcurrent: 1,
  minTime: 6000,
  mlThresholds: { ...DEFAULT_ML_THRESHOLDS },
  mlClassifierActiveModel: 'builtin',
  mlClassifierCustomModelName: null
};

export const defaultConfig: AppConfig = {
  outputDirectory: path.join(os.homedir(), 'Downloads', 'AutoSlides'),
  connectionMode: 'external',
  maxConcurrentDownloads: 5,
  downloadMaxWorkers: 32,
  downloadNumRetries: 15,
  muteMode: 'normal',
  videoRetryCount: 5,
  taskSpeed: 10,
  showMorePlaybackSpeed: false,
  autoPostProcessing: true,
  autoPostProcessingLive: true,
  enableAIFiltering: true,
  distinguishMaybeSlide: true,
  themeMode: 'system',
  languageMode: 'system',
  preventSystemSleep: true,
  slideExtraction: defaultSlideExtractionConfig,
  aiFiltering: defaultAIFilteringConfig,
  qtExtractor: { ...DEFAULT_QT_EXTRACTOR_CONFIG },
  skipUpdateCheckUntil: 0,
  userOriginalNickname: '',
  userDisplayName: '',
  lastGreetingId: '',
  savedSearchesLive: [],
  savedSearchesRecorded: []
};
