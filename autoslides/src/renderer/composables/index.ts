// Composables index - export all composables for easy importing

// PlaybackPage composables
export { useVideoPlayer, type UseVideoPlayerOptions, type UseVideoPlayerReturn } from './useVideoPlayer'
export { useSlideExtraction, type UseSlideExtractionOptions, type UseSlideExtractionReturn } from './useSlideExtraction'
export { usePostProcessing, type UsePostProcessingOptions, type UsePostProcessingReturn } from './usePostProcessing'
export { useTaskQueue, type UseTaskQueueOptions, type UseTaskQueueReturn } from './useTaskQueue'
export { usePerformanceOptimization, type UsePerformanceOptimizationOptions, type UsePerformanceOptimizationReturn } from './usePerformanceOptimization'
export { useSlideGallery, type UseSlideGalleryOptions, type UseSlideGalleryReturn } from './useSlideGallery'

// LeftPanel composables
export { useAuth, type UseAuthReturn } from './useAuth'
export { useSettings, type UseSettingsReturn } from './useSettings'
export { useAdvancedSettings, type UseAdvancedSettingsOptions, type UseAdvancedSettingsReturn, type AdvancedTabId, type DownsamplingPreset, type IntranetMapping } from './useAdvancedSettings'
export { useCacheManagement, type UseCacheManagementReturn, type CacheStats } from './useCacheManagement'
export { useAISettings, type UseAISettingsOptions, type UseAISettingsReturn, type AIServiceType, type ApiUrlPreset, type ModelPreset } from './useAISettings'
export { usePHashExclusion, type UsePHashExclusionReturn, type PHashExclusionItem } from './usePHashExclusion'
