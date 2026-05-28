// Canonical config types live in @common/types. This module re-exports them so
// existing imports against ./config/types continue to resolve.
export type {
  PHashExclusionItem,
  AutoCropConfig,
  AutoCropDetectorMode,
  AutoCropActiveModel,
  AutoCropYoloConfig,
  SlideExtractionConfig,
  QtExtractorConfig,
  LanguageMode,
  AIServiceType,
  AIClassifierMode,
  CustomProviderId,
  MlClassifierThresholds,
  AIFilteringConfig,
  AppConfig,
  ThemeMode,
  SSIMPresetMode,
  MuteMode,
  ConnectionMode,
} from '@common/types';
