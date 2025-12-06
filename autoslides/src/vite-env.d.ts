/// <reference types="vite/client" />
/// <reference types="electron" />

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

// ============================================================================
// Configuration Types
// ============================================================================

interface AppConfig {
  outputDirectory: string;
  connectionMode: 'internal' | 'external';
  maxConcurrentDownloads: number;
  muteMode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded';
  videoRetryCount: number;
  taskSpeed: number;
  autoPostProcessing: boolean;
  autoPostProcessingLive: boolean;
  enableAIFiltering: boolean;
  themeMode: 'system' | 'light' | 'dark';
  languageMode: 'system' | 'en' | 'zh' | 'ja' | 'ko';
  preventSystemSleep: boolean;
}

interface PHashExclusionItem {
  id: string;
  name: string;
  pHash: string;
  createdAt: number;
  isPreset?: boolean;
  isEnabled?: boolean;
}

interface SlideExtractionConfig {
  checkInterval: number;
  enableDoubleVerification: boolean;
  verificationCount: number;
  hammingThresholdLow: number;
  hammingThresholdUp: number;
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
}

interface AIFilteringConfig {
  serviceType: 'builtin' | 'custom';
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

interface AIPrompts {
  live: string;
  recorded: string;
}

interface AIClassificationResult {
  classification: 'slide' | 'not_slide';
}

interface AIBatchClassificationResult {
  [key: string]: 'slide' | 'not_slide';
}

interface AIFilteringResult {
  success: boolean;
  result?: AIClassificationResult | AIBatchClassificationResult;
  error?: string;
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

// Post-processing result data structure
interface PostProcessingResultData {
  originalCount: number;
  filteredCount: number;
  removedCount: number;
  slides: Array<{
    id: string;
    filename: string;
    timestamp: string;
  }>;
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
  auth: {
    login: (username: string, password: string) => Promise<AuthResponse>;
    verifyToken: (token: string) => Promise<TokenVerificationResponse>;
  };

  config: {
    get: () => Promise<AppConfig>;
    setOutputDirectory: (directory: string) => Promise<AppConfig>;
    selectOutputDirectory: () => Promise<AppConfig | null>;
    setConnectionMode: (mode: 'internal' | 'external') => Promise<AppConfig>;
    setMaxConcurrentDownloads: (count: number) => Promise<AppConfig>;
    setMuteMode: (mode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded') => Promise<AppConfig>;
    setVideoRetryCount: (count: number) => Promise<AppConfig>;
    setTaskSpeed: (speed: number) => Promise<AppConfig>;
    setAutoPostProcessing: (enabled: boolean) => Promise<AppConfig>;
    setAutoPostProcessingLive: (enabled: boolean) => Promise<AppConfig>;
    getAutoPostProcessingLive: () => Promise<boolean>;
    setEnableAIFiltering: (enabled: boolean) => Promise<AppConfig>;
    getEnableAIFiltering: () => Promise<boolean>;
    setPreventSystemSleep: (prevent: boolean) => Promise<AppConfig>;

    // Theme configuration
    setThemeMode: (theme: 'system' | 'light' | 'dark') => Promise<AppConfig>;
    getThemeMode: () => Promise<'system' | 'light' | 'dark'>;
    isDarkMode: () => Promise<boolean>;
    getEffectiveTheme: () => Promise<'light' | 'dark'>;

    // Language configuration
    setLanguageMode: (language: 'system' | 'en' | 'zh' | 'ja' | 'ko') => Promise<AppConfig>;
    getLanguageMode: () => Promise<'system' | 'en' | 'zh' | 'ja' | 'ko'>;

    // Slide extraction configuration
    getSlideExtractionConfig: () => Promise<SlideExtractionConfig>;
    setSlideExtractionConfig: (config: {
      enableDuplicateRemoval?: boolean;
      enableExclusionList?: boolean;
    }) => Promise<SlideExtractionConfig>;
    setSlideCheckInterval: (interval: number) => Promise<SlideExtractionConfig>;
    setSlideDoubleVerification: (enabled: boolean, count?: number) => Promise<SlideExtractionConfig>;
    setSlideImageProcessingParams: (params: SlideImageProcessingParams) => Promise<SlideExtractionConfig>;

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

    // AI prompts management
    getAIPrompts: () => Promise<AIPrompts>;
    getAIPrompt: (type: 'live' | 'recorded') => Promise<string>;
    setAIPrompt: (type: 'live' | 'recorded', prompt: string) => Promise<string>;
    resetAIPrompt: (type: 'live' | 'recorded') => Promise<string>;
    getDefaultAIPrompt: (type: 'live' | 'recorded') => Promise<string>;
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
  };

  video: {
    getLiveStreamUrls: (stream: LiveStreamInput, token: string) => Promise<VideoStreamResponse>;
    getVideoPlaybackUrls: (session: RecordedSessionInput, token: string) => Promise<VideoStreamResponse>;
    registerClient: () => Promise<string>;
    unregisterClient: (clientId: string) => Promise<void>;
    stopProxy: () => Promise<void>;
    stopSignatureLoop: () => Promise<void>;
  };

  ffmpeg: {
    getPath: () => Promise<string | null>;
    isAvailable: () => Promise<boolean>;
    getPlatformInfo: () => Promise<FFmpegInfo>;
  };

  download: {
    start: (downloadId: string, m3u8Url: string, outputName: string) => Promise<void>;
    cancel: (downloadId: string) => Promise<void>;
    isActive: (downloadId: string) => Promise<boolean>;
    onProgress: (callback: (downloadId: string, progress: DownloadProgress) => void) => void;
    onCompleted: (callback: (downloadId: string) => void) => void;
    onError: (callback: (downloadId: string, error: string) => void) => void;
  };

  slideExtraction: {
    saveSlide: (outputPath: string, filename: string, imageBuffer: Uint8Array) => Promise<SlideOperationResponse>;
    ensureDirectory: (path: string) => Promise<SlideOperationResponse>;
    deleteSlide: (outputPath: string, filename: string) => Promise<SlideOperationResponse>;
    readSlideAsBase64: (outputPath: string, filename: string) => Promise<string>;
    listSlides: (outputPath: string) => Promise<string[]>;
    loadSlideImage: (filePath: string) => Promise<Uint8Array>;
    savePostProcessingResults: (filePath: string, data: PostProcessingResultData) => Promise<void>;
  };

  dialog?: {
    showMessageBox?: (options: DialogOptions) => Promise<DialogResponse>;
    showErrorBox?: (title: string, content: string) => Promise<void>;
  };

  powerManagement: {
    preventSleep: () => Promise<PowerManagementResponse>;
    allowSleep: () => Promise<PowerManagementResponse>;
    isPreventingSleep: () => Promise<PowerManagementStatus>;
  };

  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };

  shell: {
    openExternal: (url: string) => Promise<void>;
  };

  menu: {
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
  };

  tour?: {
    forceLightTheme: () => Promise<void>;
    restoreTheme: (originalTheme: 'system' | 'light' | 'dark') => Promise<void>;
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
    getServiceType: () => Promise<'builtin' | 'custom'>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    __liveProxyWarmedUp?: boolean;
  }
}

export {};