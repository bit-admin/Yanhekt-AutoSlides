/// <reference types="vite/client" />
/// <reference types="electron" />

import type {
  AppConfig,
  CampusProbeResult,
  AIFilteringConfig,
  MlClassifierThresholds,
  PHashExclusionItem,
  SlideExtractionConfig,
  TrashEntry,
  TrashMetadata,
  CropRect,
  CropEntry,
  PinnedCourse,
  StoredAccount,
} from './shared/types';
import type {
  SlideMetadata,
  SlideMetadataKind,
  SlideMetadataSource,
  SlideExtractionMeta,
  SlidePostProcessingMeta,
} from './shared/slideMetadataTypes';

declare const _MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const _MAIN_WINDOW_VITE_NAME: string;

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

interface AutoCropModelInfo {
  active: 'builtin' | 'custom';
  builtinVersion: string;
  builtinExists: boolean;
  builtinSizeBytes: number | null;
  customName: string | null;
  customExists: boolean;
  customSizeBytes: number | null;
}

interface MlClassifierModelInfo {
  active: 'builtin' | 'custom';
  builtinVersion: string;
  builtinExists: boolean;
  builtinSizeBytes: number | null;
  customName: string | null;
  customExists: boolean;
  customSizeBytes: number | null;
}

interface SlideImageProcessingParams {
  hammingThresholdLow?: number;
  hammingThresholdUp?: number;
  ssimThreshold?: number;
  ssimPresetMode?: 'adaptive' | 'strict' | 'normal' | 'loose' | 'custom';
  pHashThreshold?: number;
  enableDownsampling?: boolean;
  downsampleWidth?: number;
  downsampleHeight?: number;
  enablePngColorReduction?: boolean;
}

interface MlClassifierThresholds {
  trustLow: number;
  trustHigh: number;
  slideCheckLow: number;
}

interface AIFilteringConfig {
  classifierMode: 'llm' | 'ml';
  serviceType: 'builtin' | 'custom' | 'copilot';
  customApiBaseUrl: string;
  customApiKey: string;
  customModelName: string;
  customModelChain: string[];
  customProviderId: 'modelscope' | 'lm_studio' | 'nvidia' | 'agnes' | 'other';
  copilotGhoToken: string;
  copilotModelName: string;
  copilotUsername: string;
  copilotAvatarUrl: string;
  rateLimit: number; // requests per minute, default 10
  batchSize: number; // number of images per batch for recorded mode, default 5
  imageResizeWidth: number; // width to resize images before sending to AI, default 768
  imageResizeHeight: number; // height to resize images before sending to AI, default 432
  maxConcurrent: number; // max concurrent requests, default 1
  minTime: number; // minimum time between requests in ms, default 6000
  mlThresholds: MlClassifierThresholds;
  mlClassifierActiveModel: 'builtin' | 'custom';
  mlClassifierCustomModelName: string | null;
}

interface AIPrompts {
  live: string;
  recorded: string;
}

interface AIClassificationResult {
  classification: 'slide' | 'not_slide' | 'may_be_slide_edit';
}

interface AIBatchClassificationResult {
  [key: string]: 'slide' | 'not_slide' | 'may_be_slide_edit';
}

interface AIFilteringResult {
  success: boolean;
  result?: AIClassificationResult | AIBatchClassificationResult;
  error?: string;
  errorKind?: 'rate_limited' | 'upstream_rate_limited' | 'quota_exceeded' | 'auth_failed' | 'cloudflare_blocked' | 'timeout' | 'network' | 'service_unavailable' | 'server_error' | 'bad_request' | 'parse_failed' | 'unknown';
  modelUsed?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

// API Request Options
interface CourseListOptions {
  semesters?: number[];
  page?: number;
  pageSize?: number;
}

interface PersonalCourseListOptions {
  page?: number;
  pageSize?: number;
}

// Video Proxy Input Types
interface LiveStreamInput {
  id?: string;
  live_id?: string;
  title: string;
  target?: string;
  target_vga?: string;
}

interface RecordedSessionInput {
  session_id?: string;
  video_id?: string;
  title: string;
  duration?: string | number;
  main_url?: string;
  vga_url?: string;
}

interface AuthResponse {
  success: boolean;
  token?: string;
  error?: string;
}

interface TokenVerificationResponse {
  valid: boolean;
  userData: {
    badge: string;
    nickname: string;
    gender?: number;
    phone?: string;
  } | null;
  networkError?: boolean;
}

interface CourseData {
  id: string;
  name_zh: string;
  professors: string[];
  classrooms: { name: string }[];
  school_year: string;
  semester: string;
  college_name: string;
  participant_count: number;
}

interface LiveStreamData {
  id: string;
  live_id?: string;
  title: string;
  subtitle?: string;
  status: number;
  schedule_started_at: string;
  schedule_ended_at: string;
  participant_count?: number;
  session?: {
    professor?: {
      name: string;
    };
    section_group_title?: string;
  };
  target?: string;
  target_vga?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

interface VideoInfo {
  id: string;
  session_id: string;
  video_id: string;
  title: string;
  duration: number;
  week_number: number;
  day: number;
  started_at: string;
  ended_at: string;
  main_url?: string;
  vga_url?: string;
}

interface CourseInfoResponse {
  course_id: string;
  title: string;
  professor: string;
  professors?: string[];
  college_name?: string;
  school_year?: string;
  semester?: number | string;
  videos: VideoInfo[];
}

interface SemesterInfo {
  id: number;
  label: string;
  labelEn: string;
  schoolYear: number;
  semester: number;
}

interface StreamInfo {
  type: 'camera' | 'screen';
  name: string;
  url: string;
  original_url: string;
}

interface VideoStreamResponse {
  stream_id?: string;
  session_id?: string;
  video_id?: string;
  title: string;
  duration?: string;
  streams: {
    [key: string]: StreamInfo;
  };
}

interface IntranetMapping {
  type: 'single' | 'loadbalance';
  ip?: string;
  ips?: string[];
  strategy?: 'round_robin' | 'random' | 'first_available';
  currentIndex?: number;
}

interface IntranetStatus {
  mode: string;
  enabled: boolean;
  mappingCount: number;
  interfaceIp: string | null;
}

interface NetworkInterfaceInfo {
  name: string;
  address: string;
  family: 'IPv4' | 'IPv6';
  internal: boolean;
  mac?: string;
  cidr: string | null;
}

interface SetInterfaceIpResponse {
  status: IntranetStatus;
  warning?: 'interface-not-found';
}

interface LocalRelayStatus {
  enabled: boolean;
  running: boolean;
  port: number;
  bindAddresses: string[];
  error: string | null;
}

interface PowerManagementResponse {
  success: boolean;
  error?: string;
}

interface PowerManagementStatus {
  isPreventing: boolean;
  error?: string;
}

interface FFmpegInfo {
  platform: string;
  ffmpegPath: string | null;
  isPackaged: boolean;
}

interface DownloadProgress {
  current: number;
  total: number;
  phase: number;
}

interface CompressLectureOptions {
  inputPath: string;
  outputPath?: string;
  preset?: 'tiny' | 'small' | 'readable';
  audioPreset?: 'low' | 'mid' | 'high' | 'max';
  audioFilterPreset?: 'none' | 'clean' | 'speech' | 'strong' | 'loudnorm';
  cropMode?: 'none' | '4:3' | 'auto';
  filterMode?: 'none' | 'denoise' | 'sharpen' | 'both';
  scaler?: 'lanczos' | 'bicubic';
  container?: 'mp4' | 'mkv';
  opusVbr?: 'on' | 'constrained' | 'off';
  opusFrameDuration?: 20 | 40 | 60;
  keepAac?: boolean;
  x265Params?: string;
}

interface CompressLectureProgress {
  phase: 'preparing' | 'cropdetect' | 'encoding' | 'completed';
  current: number;
  total: number;
  message?: string;
}

interface CompressLecturePreviewResult {
  command: string;
  outputPath: string;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  contentAspect: '4:3' | '16:9' | 'cropped' | 'source';
  videoFiltergraph: string;
  audioFiltergraph: string;
}

interface DialogOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  buttons?: string[];
  defaultId?: number;
  title?: string;
  message?: string;
  detail?: string;
  checkboxLabel?: string;
  checkboxChecked?: boolean;
  icon?: string;
  cancelId?: number;
  noLink?: boolean;
  normalizeAccessKeys?: boolean;
}

interface DialogResponse {
  response: number;
  checkboxChecked?: boolean;
}

interface SlideOperationResponse {
  success: boolean;
}

// ============================================================================
// Electron API Interface
// ============================================================================

interface ElectronAPI {
  isDemoMode: boolean;
  auth: {
    login: (username: string, password: string) => Promise<AuthResponse>;
    verifyToken: (token: string) => Promise<TokenVerificationResponse>;
    clearBrowserData: () => Promise<{ success: boolean; error?: string }>;
  };

  config: {
    get: () => Promise<AppConfig>;
    onUpdate: (callback: (cfg: AppConfig) => void) => () => void;
    setOutputDirectory: (directory: string) => Promise<AppConfig>;
    selectOutputDirectory: () => Promise<AppConfig | null>;
    setConnectionMode: (mode: 'internal' | 'external') => Promise<AppConfig>;
    setMaxConcurrentDownloads: (count: number) => Promise<AppConfig>;
    setDownloadMaxWorkers: (count: number) => Promise<AppConfig>;
    setDownloadNumRetries: (count: number) => Promise<AppConfig>;
    setMuteMode: (mode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded') => Promise<AppConfig>;
    setVideoRetryCount: (count: number) => Promise<AppConfig>;
    setVideoTokenRefreshSeconds: (seconds: number) => Promise<AppConfig>;
    setTaskSpeed: (speed: number) => Promise<AppConfig>;
    setParallelTasks: (count: number) => Promise<AppConfig>;
    setMaxManualTabs: (count: number) => Promise<AppConfig>;
    setPreviewFromVideo: (enabled: boolean) => Promise<AppConfig>;
    setPreviewSeekSeconds: (seconds: number) => Promise<AppConfig>;
    setShowMorePlaybackSpeed: (enabled: boolean) => Promise<AppConfig>;
    setAutoPostProcessing: (enabled: boolean) => Promise<AppConfig>;
    setAutoPostProcessingLive: (enabled: boolean) => Promise<AppConfig>;
    getAutoPostProcessingLive: () => Promise<boolean>;
    setEnableAIFiltering: (enabled: boolean) => Promise<AppConfig>;
    getEnableAIFiltering: () => Promise<boolean>;
    setPreventSystemSleep: (prevent: boolean) => Promise<AppConfig>;
    getSkipUpdateCheckUntil: () => Promise<number>;
    setSkipUpdateCheckUntil: (timestamp: number) => Promise<void>;
    // Auth token mirror for cross-window access (add-ons windows have separate localStorage)
    setAuthToken: (token: string | null) => Promise<void>;
    getAuthToken: () => Promise<string | null>;

    // Theme configuration
    setThemeMode: (theme: 'system' | 'light' | 'dark') => Promise<AppConfig>;
    getThemeMode: () => Promise<'system' | 'light' | 'dark'>;
    isDarkMode: () => Promise<boolean>;
    getEffectiveTheme: () => Promise<'light' | 'dark'>;

    // Language configuration
    setLanguageMode: (language: 'system' | 'en' | 'zh' | 'ja' | 'ko') => Promise<AppConfig>;
    getLanguageMode: () => Promise<'system' | 'en' | 'zh' | 'ja' | 'ko'>;
    setUserNames: (original: string, display: string) => Promise<void>;
    setLastGreetingId: (id: string) => Promise<void>;
    setOnboardingCompleted: (completed: boolean) => Promise<void>;
    setCloudStorageInitialized: (badge: string, initialized: boolean) => Promise<void>;
    setCloudAutoSyncMode: (mode: 'disabled' | 'edited' | 'reviewed') => Promise<AppConfig>;
    setCloudAutoPublishAfterSync: (enabled: boolean) => Promise<AppConfig>;
    setCloudAutoResyncMode: (mode: 'disabled' | 'edited') => Promise<AppConfig>;
    setCloudAutoRepublishAfterResync: (enabled: boolean) => Promise<AppConfig>;
    setCloudWatchSyncEnabled: (enabled: boolean) => Promise<AppConfig>;
    setLocalRelayConfig: (patch: {
      enabled?: boolean;
      port?: number;
      whitelistEnabled?: boolean;
      includeCurrentToken?: boolean;
      tokenWhitelist?: string[];
    }) => Promise<{ config: AppConfig; status: LocalRelayStatus }>;
    upsertAccount: (account: StoredAccount) => Promise<void>;
    removeAccount: (badge: string) => Promise<void>;
    setSavedSearches: (mode: 'live' | 'recorded', searches: string[]) => Promise<void>;
    setPinnedRecordedCourses: (courses: PinnedCourse[]) => Promise<void>;

    // Slide extraction configuration
    getSlideExtractionConfig: () => Promise<SlideExtractionConfig>;
    setSlideExtractionConfig: (config: {
      enableDuplicateRemoval?: boolean;
      enableExclusionList?: boolean;
    }) => Promise<SlideExtractionConfig>;
    setSlideCheckInterval: (interval: number) => Promise<SlideExtractionConfig>;
    setSlideDoubleVerification: (enabled: boolean, count?: number) => Promise<SlideExtractionConfig>;
    setSlideImageProcessingParams: (params: SlideImageProcessingParams) => Promise<SlideExtractionConfig>;

    // Auto-crop params
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
    }) => Promise<SlideExtractionConfig>;
    resetAutoCropParams: () => Promise<SlideExtractionConfig>;

    // Auto-crop detector mode + YOLO params
    setAutoCropDetectorMode: (mode: 'canny_then_yolo' | 'canny_only' | 'yolo_only') => Promise<SlideExtractionConfig>;
    setAutoCropYoloParams: (params: {
      confidenceThreshold?: number;
      iouThreshold?: number;
      inputSize?: number;
    }) => Promise<SlideExtractionConfig>;
    resetAutoCropYoloParams: () => Promise<{
      confidenceThreshold: number;
      iouThreshold: number;
      inputSize: number;
    }>;

    // distinguish may_be_slide flag
    getDistinguishMaybeSlide: () => Promise<boolean>;
    setDistinguishMaybeSlide: (enabled: boolean) => Promise<AppConfig>;

    // pHash exclusion list management
    getPHashExclusionList: () => Promise<PHashExclusionItem[]>;
    addPHashExclusionItem: (name: string, pHash: string) => Promise<PHashExclusionItem>;
    removePHashExclusionItem: (id: string) => Promise<boolean>;
    updatePHashExclusionItemName: (id: string, newName: string) => Promise<boolean>;
    clearPHashExclusionList: () => Promise<PHashExclusionItem[]>;
    selectImageForExclusion: () => Promise<{
      success: boolean;
      canceled?: boolean;
      error?: string;
      imagePath?: string;
      imageBuffer?: number[];
      fileName?: string;
    }>;

    // AI filtering configuration
    getAIFilteringConfig: () => Promise<AIFilteringConfig>;
    setAIFilteringConfig: (config: Partial<AIFilteringConfig>) => Promise<AIFilteringConfig>;
    setAIBatchSize: (batchSize: number) => Promise<AIFilteringConfig>;
    getAIBatchSize: () => Promise<number>;
    setAIClassifierMode: (mode: 'llm' | 'ml') => Promise<AIFilteringConfig>;
    setMlThresholds: (thresholds: {
      trustLow?: number;
      trustHigh?: number;
      slideCheckLow?: number;
    }) => Promise<AIFilteringConfig>;

    // AI prompts management
    getAIPrompts: (variant?: 'simple' | 'distinguish') => Promise<AIPrompts>;
    getAIPrompt: (type: 'live' | 'recorded', variant?: 'simple' | 'distinguish') => Promise<string>;
    setAIPrompt: (type: 'live' | 'recorded', prompt: string, variant?: 'simple' | 'distinguish') => Promise<AIPrompts>;
    resetAIPrompt: (type: 'live' | 'recorded', variant?: 'simple' | 'distinguish') => Promise<string>;
    getDefaultAIPrompt: (type: 'live' | 'recorded', variant?: 'simple' | 'distinguish') => Promise<string>;
  };
  api: {
    getPersonalLiveList: (token: string, page?: number, pageSize?: number) => Promise<PaginatedResponse<LiveStreamData>>;
    searchLiveList: (token: string, keyword: string, page?: number, pageSize?: number) => Promise<PaginatedResponse<LiveStreamData>>;
    getCourseList: (token: string, options: CourseListOptions) => Promise<PaginatedResponse<CourseData>>;
    getPersonalCourseList: (token: string, options: PersonalCourseListOptions) => Promise<PaginatedResponse<CourseData>>;
    getCourseInfo: (courseId: string, token: string) => Promise<CourseInfoResponse>;
    getAvailableSemesters: () => Promise<SemesterInfo[]>;
  };
  intranet: {
    setEnabled: (enabled: boolean) => Promise<IntranetStatus>;
    getStatus: () => Promise<IntranetStatus>;
    getMappings: () => Promise<{ [domain: string]: IntranetMapping }>;
    getNetworkInterfaces: () => Promise<NetworkInterfaceInfo[]>;
    getInterfaceIp: () => Promise<string | null>;
    setInterfaceIp: (ip: string | null) => Promise<SetInterfaceIpResponse>;
    checkCampusConnection: () => Promise<CampusProbeResult>;
  };

  localRelay: {
    getStatus: () => Promise<LocalRelayStatus>;
  };

  video: {
    getLiveStreamUrls: (stream: LiveStreamInput, token: string) => Promise<VideoStreamResponse>;
    getVideoPlaybackUrls: (session: RecordedSessionInput, token: string) => Promise<VideoStreamResponse>;
    getScreenThumbnail: (req: {
      kind: 'live' | 'recorded';
      screenUrl: string;
      seekSeconds: number;
      cacheKey: string;
      token: string;
    }) => Promise<string | null>;
    registerClient: () => Promise<string>;
    unregisterClient: (clientId: string) => Promise<void>;
    stopProxy: () => Promise<void>;
    stopSignatureLoop: () => Promise<void>;
  };

  ffmpeg: {
    getPath: () => Promise<string | null>;
    isAvailable: () => Promise<boolean>;
    getPlatformInfo: () => Promise<FFmpegInfo>;
    warmUp: () => Promise<void>;
  };

  compressLecture: {
    selectInput: () => Promise<string | null>;
    selectOutput: (defaultPath?: string) => Promise<string | null>;
    preview: (options: CompressLectureOptions) => Promise<CompressLecturePreviewResult>;
    start: (options: CompressLectureOptions) => Promise<{ outputPath: string }>;
    cancel: () => Promise<boolean>;
    isActive: () => Promise<boolean>;
    onProgress: (callback: (progress: CompressLectureProgress) => void) => () => void;
    onCompleted: (callback: (result: { outputPath: string }) => void) => () => void;
    onError: (callback: (error: string) => void) => () => void;
  };

  download: {
    start: (downloadId: string, m3u8Url: string, outputName: string) => Promise<void>;
    cancel: (downloadId: string) => Promise<void>;
    isActive: (downloadId: string) => Promise<boolean>;
    cleanupTempFiles: (outputName: string) => Promise<void>;
    onProgress: (callback: (downloadId: string, progress: DownloadProgress) => void) => () => void;
    onCompleted: (callback: (downloadId: string) => void) => () => void;
    onError: (callback: (downloadId: string, error: string) => void) => () => void;
  };

  qtExtractor: {
    getStatus: () => Promise<{ ok: boolean; path: string; resolvedPath: string; version?: string; error?: string }>;
    detect: () => Promise<{ ok: boolean; path: string; resolvedPath: string; version?: string; error?: string }>;
    verify: (binaryPath?: string) => Promise<{ ok: boolean; path: string; resolvedPath: string; version?: string; error?: string }>;
    selectBinary: () => Promise<string | null>;
    setBinaryPath: (binaryPath: string) => Promise<void>;
    setAutoRun: (enabled: boolean) => Promise<void>;
    setAutoPostProcess: (enabled: boolean) => Promise<void>;
    runExtraction: (
      extractionId: string,
      videoPath: string,
      outputDir: string,
      params: {
        ssimThreshold: number;
        enableDownsampling: boolean;
        downsampleWidth: number;
        downsampleHeight: number;
        chunkSize?: number;
      }
    ) => Promise<{ slideCount: number; slidesDir: string }>;
    cancelExtraction: (extractionId: string) => Promise<boolean>;
    applyColorReduction: (slidesDir: string) => Promise<{ processed: number }>;
    onProgress: (callback: (extractionId: string, percent: number) => void) => () => void;
    onSlidesExtracted: (callback: (extractionId: string, slidesDir: string, count: number) => void) => () => void;
    onCompleted: (callback: (extractionId: string, result: { slideCount: number; slidesDir: string }) => void) => () => void;
    onError: (callback: (extractionId: string, message: string, category?: string) => void) => () => void;
    onCancelled: (callback: (extractionId: string) => void) => () => void;
  };

  update: {
    checkForUpdates: () => Promise<
      | {
          success: true;
          hasUpdate: boolean;
          currentVersion: string;
          latestVersion: string;
          releaseUrl: string;
          releaseBody: string;
          publishedAt: string;
          assets: Array<{ name: string; url: string; size: number; formattedSize: string; proxyUrl: string }>;
        }
      | { success: false; error: string }
    >;
    onCheckForUpdates: (callback: () => void) => () => void;
    onAutoCheckForUpdates: (callback: () => void) => () => void;
    getReleaseInfo: () => Promise<{
      success: boolean;
      tagName?: string;
      name?: string;
      body?: string;
      bodyHtml?: string;
      htmlUrl?: string;
      publishedAt?: string;
      assets?: Array<{ name: string; url: string; size: number; formattedSize: string; proxyUrl: string }>;
      error?: string;
    }>;
    downloadUpdate: (url: string, filename: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    cancelDownload: () => Promise<{ success: boolean }>;
    isDownloading: () => Promise<{ isDownloading: boolean }>;
    onDownloadProgress: (callback: (progress: { downloaded: number; total: number; percent: number }) => void) => () => void;
    onDownloadComplete: (callback: (filename: string) => void) => () => void;
    onDownloadError: (callback: (error: string) => void) => () => void;
    onPromptQuit: (callback: (filename: string) => void) => () => void;
    openDownloadFolder: () => Promise<{ success: boolean; error?: string }>;
    getDownloadFolder: () => Promise<{ success: boolean; path?: string }>;
    installUpdate: (filename: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    listDownloadedUpdates: () => Promise<{ success: boolean; updates?: string[]; error?: string }>;
    findOldUpdates: () => Promise<{ success: boolean; files?: string[]; currentVersion?: string; error?: string }>;
    deleteOldUpdates: (filenames: string[]) => Promise<{ success: boolean; errors?: string[] }>;
  };

  extractorInstaller: {
    checkLatest: () => Promise<{
      success: boolean;
      tagName?: string;
      name?: string;
      body?: string;
      bodyHtml?: string;
      htmlUrl?: string;
      publishedAt?: string;
      assets?: Array<{ name: string; url: string; size: number; formattedSize: string; proxyUrl: string }>;
      repoUrl?: string;
      error?: string;
    }>;
    download: (url: string, filename: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    cancel: () => Promise<{ success: boolean }>;
    isDownloading: () => Promise<{ isDownloading: boolean }>;
    install: (filename: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    openDownloadFolder: () => Promise<{ success: boolean; error?: string }>;
    openRepo: () => Promise<void>;
    onProgress: (callback: (progress: { downloaded: number; total: number; percent: number }) => void) => () => void;
    onComplete: (callback: (filename: string) => void) => () => void;
    onError: (callback: (error: string) => void) => () => void;
  };

  slideExtraction: {
    saveSlide: (outputPath: string, filename: string, imageBuffer: Uint8Array) => Promise<SlideOperationResponse>;
    ensureDirectory: (path: string) => Promise<SlideOperationResponse>;
    deleteSlide: (outputPath: string, filename: string) => Promise<SlideOperationResponse>;
    moveToInAppTrash: (outputPath: string, filename: string, metadata: TrashMetadata) => Promise<SlideOperationResponse>;
    readSlideAsBase64: (outputPath: string, filename: string) => Promise<string>;
    readSlideForAI: (outputPath: string, filename: string, targetWidth: number, targetHeight: number) => Promise<string>;
    listSlides: (outputPath: string) => Promise<string[]>;
  };

  dialog?: {
    showMessageBox?: (options: DialogOptions) => Promise<DialogResponse>;
    showErrorBox?: (title: string, content: string) => Promise<void>;
    openImageFile?: () => Promise<string | null>;
    openImageFiles?: () => Promise<string[] | null>;
  };

  powerManagement: {
    preventSleep: () => Promise<PowerManagementResponse>;
    allowSleep: () => Promise<PowerManagementResponse>;
    isPreventingSleep: () => Promise<PowerManagementStatus>;
  };

  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<{ success: true; isMaximized: boolean } | { success: false; error: string }>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    setBusyState: (busy: boolean) => Promise<{ success: boolean }>;
  };

  shell: {
    openExternal: (url: string) => Promise<void>;
    openPath: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  };

  menu: {
    openSettings: () => Promise<{ success: boolean; error?: string }>;
    onOpenSettings: (callback: () => void) => () => void;
    openTermsAndConditions: () => Promise<void>;
    reload: () => Promise<void>;
    forceReload: () => Promise<void>;
    toggleDevTools: () => Promise<void>;
    resetZoom: () => Promise<void>;
    zoomIn: () => Promise<void>;
    zoomOut: () => Promise<void>;
    toggleFullscreen: () => Promise<void>;
  };

  cache?: {
    getStats: () => Promise<{
      totalSize: number;
      tempFiles: number;
    }>;
    clear: () => Promise<{
      success: boolean;
      error?: string;
    }>;
    resetAllData: () => Promise<{
      success: boolean;
      error?: string;
    }>;
  };

  app?: {
    restart: () => Promise<void>;
    getVersion: () => Promise<string>;
  };

  ai: {
    classifySingleImage: (
      base64Image: string,
      type: 'live' | 'recorded',
      token?: string,
      modelOverride?: string
    ) => Promise<AIFilteringResult>;
    classifyMultipleImages: (
      base64Images: string[],
      type: 'live' | 'recorded',
      token?: string,
      modelOverride?: string
    ) => Promise<AIFilteringResult>;
    getBuiltinModelName: (token: string) => Promise<string>;
    isConfigured: (token?: string) => Promise<boolean>;
    getServiceType: () => Promise<'builtin' | 'custom' | 'copilot'>;
    getExhaustedModels: () => Promise<string[]>;
  };

  copilot: {
    requestDeviceCode: () => Promise<{
      device_code: string;
      user_code: string;
      verification_uri: string;
      expires_in: number;
      interval: number;
    }>;
    pollForAccessToken: (deviceCode: string, interval: number) => Promise<string>;
    getUserInfo: (ghoToken: string) => Promise<{
      login: string;
      avatar_url: string;
      name?: string;
    }>;
    validateToken: (ghoToken: string) => Promise<boolean>;
    exchangeToken: (ghoToken: string) => Promise<{
      token: string;
      expires_at: number;
    }>;
    clearCache: () => Promise<void>;
  };

  trash: {
    getEntries: () => Promise<TrashEntry[]>;
    restore: (ids: string[]) => Promise<{ restored: number; failed: number }>;
    clear: () => Promise<{ cleared: number; failed: number }>;
    clearEntries: (ids: string[]) => Promise<{ cleared: number; failed: number }>;
    removeFolders: (folderNames: string[]) => Promise<{ removed: number; failed: number }>;
    getImageAsBase64: (trashPath: string) => Promise<string>;
  };

  crop: {
    getEntries: () => Promise<CropEntry[]>;
    getImageAsBase64: (cropPath: string) => Promise<string>;
    apply: (imagePath: string, rect: CropRect, autoCropped?: boolean) => Promise<{ success: boolean }>;
    restore: (imagePath: string) => Promise<{ success: boolean }>;
  };

  slideMetadata: {
    get: (folderPath: string) => Promise<SlideMetadata | null>;
    writeExtraction: (
      folderPath: string,
      data: { source: SlideMetadataSource; extraction: SlideExtractionMeta; kind?: SlideMetadataKind }
    ) => Promise<{ success: boolean }>;
    updatePostProcessing: (
      folderPath: string,
      pp: SlidePostProcessingMeta
    ) => Promise<{ success: boolean }>;
    write: (folderPath: string, metadata: SlideMetadata) => Promise<{ success: boolean }>;
    markReviewed: (folderPath: string) => Promise<{ success: boolean }>;
    commitEdited: (folderPath: string) => Promise<{ success: boolean; result: { cropped?: boolean } | null }>;
  };

  pdfmaker: {
    getFolders: () => Promise<{ name: string; path: string; imageCount: number }[]>;
    getImages: (folderPath: string) => Promise<{ name: string; path: string }[]>;
    getImageAsBase64: (imagePath: string) => Promise<string>;
    deleteImage: (imagePath: string) => Promise<{ success: boolean }>;
    makePdf: (
      folders: { name: string; path: string; images: string[] }[],
      options: {
        reduceEnabled: boolean;
        aspectRatio?: '16:9' | '4:3';
        effort: 'standard' | 'compact' | 'minimal' | 'custom';
        customColors?: number | null;
        customWidth?: number | null;
        customHeight?: number | null;
        outputMode?: 'single' | 'batch';
        outputFormat?: 'pdf' | 'pptx';
        includeCover?: boolean;
        copyrightText?: string;
      }
    ) => Promise<
      | { success: true; mode: 'single'; format: 'pdf' | 'pptx'; path: string }
      | { success: true; mode: 'batch'; format: 'pdf' | 'pptx'; outputDir: string; paths: string[] }
      | { success: false; error?: string }
    >;
    onProgress: (callback: (progress: { current: number; total: number }) => void) => () => void;
  };

  noteExport: {
    export: (payload: { title: string; content: string; format: 'pdf' | 'markdown' | 'docx' }) => Promise<{
      ok: boolean;
      path?: string;
      canceled?: boolean;
      error?: string;
    }>;
  };

  tools: {
    openWindow: (tab?: string) => Promise<{ success: boolean }>;
    onSwitchTab: (callback: (tab: string) => void) => () => void;
  };

  webCapture: {
    getGuestPreloadPath: () => Promise<string>;
  };

  yuketang: {
    exportLesson: (payload: { lessonId?: string; format: 'pdf' | 'images' }) => Promise<{
      lessonId: string;
      lessonTitle: string;
      lessonDir: string;
      presentationCount: number;
      format: string;
      pdfPath?: string;
      cancelled?: boolean;
    }>;
    getClassCapture: () => Promise<{ presentationId: string; hasAuthorization: boolean }>;
    openFolder: (folderPath: string) => Promise<void>;
    onExportProgress: (callback: (message: string) => void) => () => void;
    onClassCaptureUpdate: (callback: (data: { presentationId: string; hasAuthorization: boolean }) => void) => () => void;
  };

  autoCrop: {
    getModelInfo: () => Promise<AutoCropModelInfo>;
    getModelBuffer: () => Promise<ArrayBuffer>;
    selectAndImportModel: () => Promise<AutoCropModelInfo | null>;
    deleteCustomModel: () => Promise<AutoCropModelInfo>;
  };

  mlClassifier: {
    getModelInfo: () => Promise<MlClassifierModelInfo>;
    getModelBuffer: () => Promise<ArrayBuffer>;
    selectAndImportModel: () => Promise<MlClassifierModelInfo | null>;
    deleteCustomModel: () => Promise<MlClassifierModelInfo>;
  };

  offline: {
    selectInputFolder: () => Promise<string | null>;
    listImages: (folderPath: string) => Promise<string[]>;
    copyAndConvert: (inputPath: string, outputDir: string, outputFilename: string, enableColorReduction: boolean) => Promise<void>;
    readImageForAI: (filePath: string, targetWidth: number, targetHeight: number) => Promise<string>;
    readImageBuffer: (filePath: string) => Promise<Uint8Array>;
    savePngBuffer: (outputDir: string, filename: string, buffer: Uint8Array, enableColorReduction: boolean) => Promise<void>;
  };

  cloudNotes: {
    list: (params?: import('@common/notesTypes').NoteListParams) => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').NoteListResult>>;
    get: (id: number) => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').NoteDetail>>;
    create: () => Promise<import('@common/notesTypes').NotesResult<number>>;
    updateTitle: (id: number, title: string, groupId?: number) => Promise<import('@common/notesTypes').NotesResult<void>>;
    updateContent: (id: number, content: string) => Promise<import('@common/notesTypes').NotesResult<void>>;
    moveToGroup: (id: number, groupId: number) => Promise<import('@common/notesTypes').NotesResult<void>>;
    delete: (id: number) => Promise<import('@common/notesTypes').NotesResult<void>>;
    groupList: () => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').NoteGroup[]>>;
    groupCreate: (name: string) => Promise<import('@common/notesTypes').NotesResult<void>>;
    groupDelete: (id: number) => Promise<import('@common/notesTypes').NotesResult<void>>;
    uploadImage: (bytes: ArrayBuffer, filename: string, mime: string) => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').UploadedImage>>;
    uploadImageFromPath: (filePath: string) => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').UploadedImage>>;
    exportFolderStatus: (displayName: string) => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').ExportFolderInfo>>;
    prepareExportFolder: (displayName: string, mode: 'fresh' | 'create') => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').ExportFolderInfo>>;
    downloadImageToFolder: (url: string, dir: string, filename: string) => Promise<import('@common/notesTypes').NotesResult<void>>;
    shortenShareUrl: (fragment: string) => Promise<import('@common/notesTypes').NotesResult<{ url: string }>>;
    publishToIndex: (
      fragment: string,
      source: import('@common/slideMetadataTypes').SlideMetadataSource,
      review: { reviewed: boolean; edited: boolean },
    ) => Promise<import('@common/notesTypes').NotesResult<{ shareId: string; indexUrl: string; duplicate: boolean }>>;
    resolveShareLink: (link: string) => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').ShareImportResult>>;
    indexStats: () => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').IndexStats>>;
    indexSearch: (q: string) => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').IndexLecture[]>>;
    indexLecture: (courseId: string, sessionId: string) => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').IndexLectureDetail>>;
    requestIndexRemoval: (courseId: string, sessionId: string) => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').IndexRemovalResult>>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    __liveProxyWarmedUp?: boolean;
  }
}

export {};
