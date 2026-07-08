// Cross-process shared types. Single source of truth for:
//  - AppConfig and its sub-types (consumed by main, renderer, preload)
//  - Trash and Crop manifest entries (consumed by main, renderer)

// Result of probing the campus authentication portal's online-status endpoint.
export interface CampusProbeResult {
  reachable: boolean;
  online: boolean | null;
  ip: string | null;
  error?: string;
}

export type ThemeMode = 'system' | 'light' | 'dark';
export type LanguageMode = 'system' | 'en' | 'zh' | 'ja' | 'ko';

export type AIServiceType = 'builtin' | 'custom' | 'copilot';
export type AIClassifierMode = 'llm' | 'ml';
export type CustomProviderId = 'modelscope' | 'lm_studio' | 'nvidia' | 'agnes' | 'other';

export type AutoCropDetectorMode = 'canny_then_yolo' | 'canny_only' | 'yolo_only';
export type AutoCropActiveModel = 'builtin' | 'custom';

export type SSIMPresetMode = 'adaptive' | 'strict' | 'normal' | 'loose' | 'custom';

export type MuteMode = 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded';
export type ConnectionMode = 'internal' | 'external';

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
  ssimPresetMode?: SSIMPresetMode;
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

// A signed-in account remembered for quick account switching. Keyed by `badge`
// (the Yanhekt user id from verifyToken). `badge === ''` marks a pre-migration
// placeholder seeded from the legacy single `authToken`; it is reconciled to a
// real record (matched by `token`) on the next successful verifyToken.
export interface StoredAccount {
  badge: string;
  nickname: string;
  displayName: string;
  token: string;
  addedAt: number;
  lastUsedAt: number;
}

export interface AppConfig {
  outputDirectory: string;
  connectionMode: ConnectionMode;
  intranetMode?: boolean;
  intranetMappings?: Record<string, string>;
  intranetInterfaceIp?: string;
  campusPortalHost: string;
  campusPortalUseHttps: boolean;
  maxConcurrentDownloads: number;
  downloadMaxWorkers: number;
  downloadNumRetries: number;
  muteMode: MuteMode;
  videoRetryCount: number;
  // How often (seconds) the video proxy re-fetches the anti-hotlink video token.
  // The token is valid ~10 min server-side. Default 300; UI exposes 10–600.
  videoTokenRefreshSeconds: number;
  previewFromVideo: boolean;
  previewSeekSeconds: number;
  taskSpeed: number;
  // How many task-queue tasks may play + extract concurrently (default 2).
  // UI selector caps at 5; validation clamps to 1–10.
  parallelTasks: number;
  // How many playback tabs the user may open manually (default 3). Same caps.
  maxManualTabs: number;
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
  pinnedRecordedCourses: PinnedCourse[];
  onboardingCompleted: boolean;
  // Badges of accounts that have explicitly initialized AutoSlides cloud storage
  // (the managed note group + README). The server is the authority on whether the
  // group exists; this flag only distinguishes "never initialized" (features gated
  // until the user inits) from "initialized but deleted server-side" (auto re-init).
  cloudStorageInitializedUsers: string[];
  // Auto-sync: when a slide folder transitions to reviewed/edited on the Slides
  // page, auto-import it to Cloud Notes (skipping folders already imported).
  // 'disabled' (default) turns it off. Only meaningful once cloud storage is ready.
  cloudAutoSyncMode: 'disabled' | 'edited' | 'reviewed';
  // When auto-sync imports a folder, also publish it to the Cloud Index. Applies
  // to auto-sync only (never the manual Slides-page buttons). Default off.
  cloudAutoPublishAfterSync: boolean;
  // Auto-resync: when an already-imported folder is edited again, re-import
  // (replace) its managed note with the freshly-edited slides. Only 'edited'
  // (re-review is meaningless). 'disabled' (default) turns it off.
  cloudAutoResyncMode: 'disabled' | 'edited';
  // When auto-resync replaces a note, also re-publish it to the Cloud Index
  // (remove-then-publish). Applies to auto-resync only. Default off.
  cloudAutoRepublishAfterResync: boolean;
  // Accounts remembered for quick account switching (each with its own token).
  // The active account is the one whose `token` equals the standalone `authToken`
  // electron-store key. Migrated from the legacy single-account fields.
  accounts: StoredAccount[];
}

// A recorded course pinned to the sidebar. `id` drives navigation/session loading;
// `title` is the sidebar label. The remaining fields are captured at pin time so
// opening a pinned course restores the full context — notably `classrooms` and
// `participant_count`, which only appear in the course list/search and are NOT
// returned by getCourseInfo. Optional: legacy pins (id+title only) stay valid.
export interface PinnedCourse {
  id: string;
  title: string;
  instructor?: string;
  time?: string;
  classrooms?: { name: string }[];
  participant_count?: number;
  college_name?: string;
  professors?: string[];
  school_year?: string;
  semester?: string;
}

// Trash and crop manifest entries — written by main process, read by renderer.

export type TrashReason = 'duplicate' | 'exclusion' | 'ai_filtered' | 'ai_filtered_edit' | 'manual';

export interface TrashMetadata {
  reason: TrashReason;
  reasonDetails?: string;
}

export interface TrashEntry {
  id: string;
  filename: string;
  originalPath: string;
  originalParentFolder: string;
  trashPath: string;
  reason: TrashReason;
  reasonDetails?: string;
  trashedAt: string;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropEntry {
  filename: string;
  originalPath: string;
  originalParentFolder: string;
  cropPath: string;
  rect: CropRect;
  croppedAt: string;
  autoCropped?: boolean;
}
