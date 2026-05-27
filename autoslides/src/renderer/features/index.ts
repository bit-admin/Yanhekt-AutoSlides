// Features barrel - re-exports composables from each domain.

// video
export { useVideoPlayer, type UseVideoPlayerOptions, type UseVideoPlayerReturn, type VideoStream, type PlaybackData } from './video/useVideoPlayer'
export { useSlideExtraction, type UseSlideExtractionOptions, type UseSlideExtractionReturn, type SlideExtractionStatus, type Course as PlaybackCourse, type Session as PlaybackSession } from './video/useSlideExtraction'
export { usePerformanceOptimization, type UsePerformanceOptimizationOptions, type UsePerformanceOptimizationReturn } from './video/usePerformanceOptimization'
export { useSlideGallery, type UseSlideGalleryOptions, type UseSlideGalleryReturn } from './video/useSlideGallery'

// download
export { usePostProcessing, type UsePostProcessingOptions, type UsePostProcessingReturn, type AIFilteringError, type PostProcessStatus } from './download/usePostProcessing'
export { useTaskQueue, type UseTaskQueueOptions, type UseTaskQueueReturn } from './download/useTaskQueue'

// platform
export { useAuth, type UseAuthReturn } from './platform/useAuth'
export { useCacheManagement, type UseCacheManagementReturn, type CacheStats } from './platform/useCacheManagement'

// settings
export { useSettings, type UseSettingsReturn } from './settings/useSettings'
export { useAdvancedSettings, type UseAdvancedSettingsOptions, type UseAdvancedSettingsReturn, type AdvancedTabId, type DownsamplingPreset, type IntranetMapping } from './settings/useAdvancedSettings'

// ai
export { useAISettings, type UseAISettingsOptions, type UseAISettingsReturn, type AIServiceType, type ApiUrlPreset, type ModelPreset } from './ai/useAISettings'
export { usePHashExclusion, type UsePHashExclusionReturn, type PHashExclusionItem } from './ai/usePHashExclusion'

// course
export { useCourseList, type UseCourseListOptions, type UseCourseListReturn, type Course } from './course/useCourseList'
export { useSessionPage, type UseSessionPageOptions, type UseSessionPageReturn, type SessionCourse, type Session } from './course/useSessionPage'
