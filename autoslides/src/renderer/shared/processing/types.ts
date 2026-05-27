/**
 * Slide Extraction Pipeline — Shared Types
 *
 * Mirrors the shape of `postProcessing/types.ts`:
 *   - Input describes the run parameters.
 *   - Adapter describes the callbacks the caller wants to receive.
 *   - Handle is the live object the caller drives during a run.
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
  imageData: ImageData;
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
