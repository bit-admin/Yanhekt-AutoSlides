/**
 * Slide Extraction Pipeline — Shared Types
 * Ported from autoslides/src/renderer/shared/processing/types.ts.
 *
 * Web reinterpretations (shapes unchanged):
 *   - `outputPath` is the IndexedDB folder name (`slides_*`), not a disk path.
 *   - `ExtractedSlide.dataUrl` is an object URL owned by the pipeline —
 *     revoked on clearSlides/destroy, or by the caller when it splices a
 *     slide out after post-processing.
 */

export type SlideExtractionMode = 'live' | 'recorded';
export type SlideSourceMode = 'video' | 'pushed';
export type VerificationState = 'none' | 'verifying';

export interface SlideExtractionConfig {
  checkInterval: number;
  enableDoubleVerification: boolean;
  verificationCount: number;
  ssimThreshold: number;
  enableDownsampling: boolean;
  downsampleWidth: number;
  downsampleHeight: number;
}

export interface ExtractedSlide {
  id: string;
  title: string;
  timestamp: string;
  imageData: ImageData | null;
  dataUrl: string;
  aiDecision?: 'slide' | 'not_slide' | 'may_be_slide_edit' | null;
}

export interface SlideExtractionStatus {
  isRunning: boolean;
  slideCount: number;
  verificationState: VerificationState;
  currentVerification: number;
  playbackRate: number;
  currentCheckInterval: number;
  baseCheckInterval: number;
  isBuffering: boolean;
  isPausedDueToBuffering: boolean;
}

export interface CourseInfo {
  courseName?: string;
  sessionTitle?: string;
  mode?: SlideExtractionMode;
}

export interface SlideExtractionInput {
  mode: SlideExtractionMode;
  instanceId?: string;
  sourceMode?: SlideSourceMode;
  outputPath: string | null;
  courseInfo?: CourseInfo;
  initialPlaybackRate?: number;
  classrooms?: { name: string }[] | null;
  configOverrides?: Partial<SlideExtractionConfig>;
  /**
   * Direct accessor for the `<video>` element to capture from (sourceMode
   * `video` only). The web app always supplies this — there is no DOM-selector
   * fallback here (single playback at a time, and the playback page owns its
   * own element refs). The provider is read live on every capture tick, so it
   * tolerates same-element stream switches.
   */
  videoElementProvider?: () => HTMLVideoElement | null;
}

export interface SlideExtractionAdapter {
  signal?: AbortSignal;
  onSlideExtracted?: (slide: ExtractedSlide) => void;
  onSlidesCleared?: () => void;
  onStatusChanged?: (status: SlideExtractionStatus) => void;
  onError?: (error: unknown) => void;
  onStopped?: (slides: ExtractedSlide[]) => Promise<void> | void;
}

export interface SlideExtractionHandle {
  readonly instanceId: string;
  readonly mode: SlideExtractionMode;
  stop(): void;
  pushFrame(imageData: ImageData): Promise<void>;
  setPlaybackRate(rate: number): void;
  pauseForBuffering(): void;
  resumeAfterBuffering(): void;
  isPausedForBuffering(): boolean;
  getStatus(): SlideExtractionStatus;
  getExtractedSlides(): ExtractedSlide[];
  clearSlides(): void;
  getOutputPath(): string | null;
  reloadConfig(): Promise<void>;
  destroy(): void;
}
