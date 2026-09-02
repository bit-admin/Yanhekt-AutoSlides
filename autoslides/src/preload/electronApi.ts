/**
 * The renderer-facing `window.electronAPI` contract.
 *
 * Every preload namespace object (`src/preload/*.ts`) is annotated with
 * `ElectronAPI['<namespace>']`, and `preload/index.ts` exposes an object typed
 * `ElectronAPI`, so a method added on one side without the other fails `tsc`
 * on the preload side — the interface can no longer drift from what preload
 * actually exposes. `src/vite-env.d.ts` only maps it onto `Window`.
 *
 * Payload shapes that also exist in main come from `@common/*` (config,
 * metadata, sidecars, Yanhekt API models); only bridge-specific shapes are
 * declared here.
 */
import type {
  AppConfig,
  CampusProbeResult,
  AIFilteringConfig,
  PHashExclusionItem,
  SlideExtractionConfig,
  TrashEntry,
  TrashMetadata,
  CropRect,
  CropEntry,
  PinnedCourse,
  StoredAccount,
} from '../shared/types';
import type {
  SlideMetadata,
  SlideMetadataKind,
  SlideMetadataSource,
  SlideExtractionMeta,
  SlidePostProcessingMeta,
} from '../shared/slideMetadataTypes';
import type {
  SlideTimeline,
  RecordCaptureConfirmedPayload,
  RecordGapBoundaryPayload,
  RelinkDuplicatePayload,
  UnlinkToGapPayload,
  RestoreCanonicalPayload,
} from '../shared/sidecars';
import type {
  TokenVerificationResult,
  LiveStream,
  CourseData,
  SubscriptionListResponse,
  CourseInfoResponse,
  SemesterOption,
} from '../shared/apiTypes';

export interface AutoCropModelInfo {
  active: 'builtin' | 'custom';
  builtinVersion: string;
  builtinExists: boolean;
  builtinSizeBytes: number | null;
  customName: string | null;
  customExists: boolean;
  customSizeBytes: number | null;
}

export interface MlClassifierModelInfo {
  active: 'builtin' | 'custom';
  builtinVersion: string;
  builtinExists: boolean;
  builtinSizeBytes: number | null;
  customName: string | null;
  customExists: boolean;
  customSizeBytes: number | null;
}

export interface SlideImageProcessingParams {
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

export type ThinkingParamKey = 'enable_thinking' | 'thinking';

/** null = omit key from the chat-completion request JSON. */
export interface AIRequestBodySettings {
  maxTokens: number | null;
  temperature: number | null;
  topP: number | null;
  stream: boolean | null;
  enableThinking: boolean | null;
  thinkingKey: ThinkingParamKey;
}

export interface AIPrompts {
  live: string;
  recorded: string;
}

export interface AIClassificationResult {
  classification: 'slide' | 'not_slide' | 'may_be_slide_edit';
}

export interface AIBatchClassificationResult {
  [key: string]: 'slide' | 'not_slide' | 'may_be_slide_edit';
}

export interface AIFilteringResult {
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
export interface CourseListOptions {
  semesters?: number[];
  page?: number;
  pageSize?: number;
}

export interface PersonalCourseListOptions {
  page?: number;
  pageSize?: number;
}

// Video Proxy Input Types
export interface LiveStreamInput {
  id?: string;
  live_id?: string;
  title: string;
  target?: string;
  target_vga?: string;
}

export interface RecordedSessionInput {
  session_id?: string;
  video_id?: string;
  title: string;
  duration?: string | number;
  main_url?: string;
  vga_url?: string;
}

/** Why a campus SSO sign-in did not produce a token. Mirrors SignInReason in main. */
export type SignInFailureReason =
  | 'bad_credentials'
  | 'account_locked'
  | 'account_inactive'
  | 'account_dormant'
  | 'code_rejected'
  | 'captcha_required'
  | 'risk_rejected'
  | 'challenge_expired'
  | 'sms_send_failed'
  | 'unsupported_page'
  | 'network'
  | 'unknown';

export interface AuthResponse {
  success: boolean;
  token?: string;
  error?: string;
  reason?: SignInFailureReason;
  /**
   * Present instead of token/error when CAS demands an SMS code. Answer it with
   * auth.submitSmsCode(challengeId, code); the flow itself lives in main and
   * expires after `expiresInSeconds`.
   */
  smsChallenge?: {
    challengeId: string;
    /** Masked number as CAS supplied it; '' when it supplied none. */
    phoneHint: string;
    expiresInSeconds: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface StreamInfo {
  type: 'camera' | 'screen';
  name: string;
  url: string;
  original_url: string;
}

export interface VideoStreamResponse {
  stream_id?: string;
  session_id?: string;
  video_id?: string;
  title: string;
  duration?: string;
  streams: {
    [key: string]: StreamInfo;
  };
}

export interface IntranetMapping {
  type: 'single' | 'loadbalance';
  ip?: string;
  ips?: string[];
  strategy?: 'round_robin' | 'random' | 'first_available';
  currentIndex?: number;
}

export interface IntranetStatus {
  mode: string;
  enabled: boolean;
  mappingCount: number;
  interfaceIp: string | null;
}

export interface NetworkInterfaceInfo {
  name: string;
  address: string;
  family: 'IPv4' | 'IPv6';
  internal: boolean;
  mac?: string;
  cidr: string | null;
}

export interface SetInterfaceIpResponse {
  status: IntranetStatus;
  warning?: 'interface-not-found';
}

export interface LocalRelayStatus {
  enabled: boolean;
  running: boolean;
  port: number;
  bindAddresses: string[];
  error: string | null;
}

export interface PowerManagementResponse {
  success: boolean;
  error?: string;
}

export interface PowerManagementStatus {
  isPreventing: boolean;
  error?: string;
}

export interface DownloadProgress {
  current: number;
  total: number;
  phase: number;
}

export interface CompressLectureOptions {
  inputPath: string;
  outputPath?: string;
  replaceSource?: boolean;
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

export interface CompressLectureProgress {
  phase: 'preparing' | 'cropdetect' | 'encoding' | 'validating' | 'completed';
  current: number;
  total: number;
  message?: string;
}

export interface LectureVideoFileInfo {
  name: string;
  path: string;
  size: number;
  mtimeMs: number;
}

export interface CompressLecturePreviewResult {
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

export interface DialogOptions {
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

export interface DialogResponse {
  response: number;
  checkboxChecked?: boolean;
}

export interface SlideOperationResponse {
  success: boolean;
}

// ============================================================================
// Electron API Interface
// ============================================================================

export interface ElectronAPI {
  isDemoMode: boolean;
  auth: {
    login: (username: string, password: string) => Promise<AuthResponse>;
    submitSmsCode: (challengeId: string, code: string) => Promise<AuthResponse>;
    cancelSmsChallenge: (challengeId: string) => Promise<{ success: boolean }>;
    verifyToken: (token: string) => Promise<TokenVerificationResult>;
    revokeToken: (token: string) => Promise<void>;
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
    setDeveloperMode: (enabled: boolean) => Promise<AppConfig>;
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
    isDarkMode: () => Promise<boolean>;

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
    setCloudShareEmbedTimeline: (enabled: boolean) => Promise<AppConfig>;
    setPreferAnonymousApiRequests: (enabled: boolean) => Promise<AppConfig>;
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

    // auto-crop may_be_slide_edit frames during post-processing
    getAutoCropAIFilteredEdit: () => Promise<boolean>;
    setAutoCropAIFilteredEdit: (enabled: boolean) => Promise<AppConfig>;
    // re-run pHash after those auto-crops (Results-style candidate dedup)
    getDedupAfterAutoCropAIFilteredEdit: () => Promise<boolean>;
    setDedupAfterAutoCropAIFilteredEdit: (enabled: boolean) => Promise<AppConfig>;

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
    setAIClassifierMode: (mode: 'llm' | 'ml') => Promise<AIFilteringConfig>;
    setMlThresholds: (thresholds: {
      trustLow?: number;
      trustHigh?: number;
      slideCheckLow?: number;
    }) => Promise<AIFilteringConfig>;

    // AI prompts management
    getAIPrompts: (variant?: 'simple' | 'distinguish') => Promise<AIPrompts>;
    setAIPrompt: (type: 'live' | 'recorded', prompt: string, variant?: 'simple' | 'distinguish') => Promise<AIPrompts>;
    resetAIPrompt: (type: 'live' | 'recorded', variant?: 'simple' | 'distinguish') => Promise<string>;
  };
  api: {
    getPersonalLiveList: (token: string, page?: number, pageSize?: number) => Promise<PaginatedResponse<LiveStream>>;
    searchLiveList: (token: string, keyword: string, page?: number, pageSize?: number) => Promise<PaginatedResponse<LiveStream>>;
    getCourseList: (token: string, options: CourseListOptions) => Promise<PaginatedResponse<CourseData>>;
    getPersonalCourseList: (token: string, options: PersonalCourseListOptions) => Promise<PaginatedResponse<CourseData>>;
    getSubscriptionList: (token: string, options?: { page?: number; pageSize?: number }) => Promise<SubscriptionListResponse>;
    subscribeCourse: (token: string, courseId: string) => Promise<void>;
    unsubscribeCourse: (token: string, courseId: string) => Promise<void>;
    getCourseInfo: (courseId: string, token: string) => Promise<CourseInfoResponse>;
    getAvailableSemesters: () => Promise<SemesterOption[]>;
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
    stopSignatureLoop: () => Promise<void>;
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

  lectures: {
    listVideos: () => Promise<LectureVideoFileInfo[]>;
    rename: (fromPath: string, toName: string) => Promise<{ path: string; name: string }>;
    reveal: (filePath: string) => Promise<void>;
    openOutputDirectory: () => Promise<void>;
    openExternally: (filePath: string) => Promise<void>;
    getPoster: (filePath: string, seekSeconds?: number) => Promise<string | null>;
  };

  download: {
    start: (downloadId: string, m3u8Url: string, outputName: string) => Promise<void>;
    cancel: (downloadId: string) => Promise<void>;
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
    readImageBuffer: (filePath: string) => Promise<Uint8Array>;
  };

  dialog: {
    showMessageBox: (options: DialogOptions) => Promise<DialogResponse>;
    showErrorBox: (title: string, content: string) => Promise<void>;
    openImageFile: () => Promise<string | null>;
    openImageFiles: () => Promise<string[] | null>;
  };

  powerManagement: {
    preventSleep: (holderId: string) => Promise<PowerManagementResponse>;
    allowSleep: (holderId: string) => Promise<PowerManagementResponse>;
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

  cache: {
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

  app: {
    restart: () => Promise<void>;
    getVersion: () => Promise<string>;
  };

  ai: {
    classifySingleImage: (
      base64Image: string,
      token?: string,
      modelOverride?: string
    ) => Promise<AIFilteringResult>;
    classifyMultipleImages: (
      base64Images: string[],
      token?: string,
      modelOverride?: string
    ) => Promise<AIFilteringResult>;
    getBuiltinModelName: (token: string) => Promise<string>;
    getBuiltinModelInfo: (token: string) => Promise<{
      model: string;
      rateLimit: number;
      maxConcurrent: number;
      minTime: number;
      batchSize: number;
      requestBody: {
        maxTokens: number | null;
        temperature: number | null;
        topP: number | null;
        stream: boolean | null;
        enableThinking: boolean | null;
        thinkingKey: 'enable_thinking' | 'thinking';
      };
    }>;
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
    apply: (
      imagePath: string,
      rect: CropRect,
      autoCropped?: boolean,
      isAutomated?: boolean,
    ) => Promise<{ success: boolean }>;
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

  slideTimeline: {
    get: (folderPath: string) => Promise<SlideTimeline | null>;
    write: (folderPath: string, timeline: SlideTimeline) => Promise<{ success: boolean }>;
    recordCaptureConfirmed: (
      folderPath: string,
      payload: RecordCaptureConfirmedPayload
    ) => Promise<{ success: boolean }>;
    recordGapBoundary: (
      folderPath: string,
      payload: RecordGapBoundaryPayload
    ) => Promise<{ success: boolean }>;
    relinkDuplicate: (
      folderPath: string,
      payload: RelinkDuplicatePayload
    ) => Promise<{ success: boolean }>;
    unlinkToGap: (folderPath: string, payload: UnlinkToGapPayload) => Promise<{ success: boolean }>;
    restoreCanonical: (
      folderPath: string,
      payload: RestoreCanonicalPayload
    ) => Promise<{ success: boolean }>;
    clear: (folderPath: string) => Promise<{ success: boolean }>;
    ensureRecordedHostFields: (folderPath: string) => Promise<{ success: boolean }>;
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

  cloudNotes: {
    list: (params?: import('@common/notesTypes').NoteListParams) => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').NoteListResult>>;
    get: (id: number) => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').NoteDetail>>;
    create: () => Promise<import('@common/notesTypes').NotesResult<number>>;
    updateTitle: (id: number, title: string, groupId?: number) => Promise<import('@common/notesTypes').NotesResult<void>>;
    updateContent: (id: number, content: string) => Promise<import('@common/notesTypes').NotesResult<void>>;
    moveToGroup: (
      id: number,
      groupId: number,
      title: string,
      content?: string,
    ) => Promise<import('@common/notesTypes').NotesResult<number>>;
    delete: (id: number) => Promise<import('@common/notesTypes').NotesResult<void>>;
    groupList: () => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').NoteGroup[]>>;
    groupCreate: (name: string) => Promise<import('@common/notesTypes').NotesResult<void>>;
    groupDelete: (id: number) => Promise<import('@common/notesTypes').NotesResult<void>>;
    uploadImage: (bytes: ArrayBuffer, filename: string, mime: string) => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').UploadedImage>>;
    uploadImageFromPath: (filePath: string) => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').UploadedImage>>;
    exportFolderStatus: (displayName: string, identity?: import('@common/lectureNaming').LectureIdentity) => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').ExportFolderInfo>>;
    prepareExportFolder: (displayName: string, mode: 'fresh' | 'create', identity?: import('@common/lectureNaming').LectureIdentity) => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').ExportFolderInfo>>;
    downloadImageToFolder: (url: string, dir: string, filename: string) => Promise<import('@common/notesTypes').NotesResult<void>>;
    shortenShareUrl: (fragment: string) => Promise<import('@common/notesTypes').NotesResult<{ url: string }>>;
    publishToIndex: (
      fragment: string,
      source: import('@common/slideMetadataTypes').SlideMetadataSource,
      review: { reviewed: boolean; edited: boolean },
    ) => Promise<import('@common/notesTypes').NotesResult<{ shareId: string; indexUrl: string; duplicate: boolean }>>;
    resolveShareLink: (link: string, opts?: { requireTimeline?: boolean }) => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').ShareImportResult>>;
    indexStats: () => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').IndexStats>>;
    indexSearch: (q: string, semesterIds?: number[]) => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').IndexLecture[]>>;
    indexLecture: (courseId: string, sessionId: string) => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').IndexLectureDetail>>;
    requestIndexRemoval: (courseId: string, sessionId: string) => Promise<import('@common/notesTypes').NotesResult<import('@common/notesTypes').IndexRemovalResult>>;
  };
}
