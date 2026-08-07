/**
 * Change Detection State Machine
 *
 * Owns the per-instance verification state for slide change detection.
 *   - First image is always reported as a new slide.
 *   - Subsequent frames go through SSIM comparison against the last saved frame.
 *   - When double verification is enabled, a candidate must remain stable for
 *     `verificationCount` consecutive ticks before it is accepted.
 *
 * The detector reports back to the pipeline via the `ChangeDecision` return
 * value rather than reaching into IPC / file I/O itself.
 */

import type { SlideProcessorService, SlideWorkerConfig } from './workerHelpers';
import type { VerificationState } from './types';
import { createLogger } from '@shared/utils/logger';
const log = createLogger('ChangeDetection');

export interface ChangeDetectorConfig {
  enableDoubleVerification: boolean;
  verificationCount: number;
}

export interface ChangeDecision {
  /** When set, the pipeline should save this image as a new slide. */
  acceptedImage: ImageData | null;
  /** Reflects the new internal state after processing. */
  verificationState: VerificationState;
  currentVerification: number;
  /**
   * Media time (video.currentTime seconds) when the candidate change was first
   * detected (true T1). Present when a slide is accepted after verification, or
   * when verification aborts into an unstable gap. Callers pass wall-clock-free
   * media time into the decision via process(..., mediaTime).
   */
  changeAt?: number;
  /**
   * Media time at decision time (confirm save or verify abort). Used with
   * changeAt for timeline.confirmedAt.
   */
  confirmedAt?: number;
  /** True when double-verify aborted because the candidate became unstable. */
  unstableAbort?: boolean;
}

export class ChangeDetector {
  private config: ChangeDetectorConfig;
  private worker: SlideProcessorService;

  // Per-run SSIM/downsample config forwarded on every compare so the shared
  // worker stays stateless across concurrent extractions. undefined = let the
  // worker fall back to its default CONFIG.
  private workerConfig: SlideWorkerConfig | undefined;

  private lastImageData: ImageData | null = null;
  private verificationState: VerificationState = 'none';
  private currentVerification = 0;
  private potentialNewImageData: ImageData | null = null;
  /** Media time when the current candidate first differed from last saved frame. */
  private candidateChangeAt: number | null = null;

  constructor(worker: SlideProcessorService, config: ChangeDetectorConfig) {
    this.worker = worker;
    this.config = { ...config };
  }

  updateConfig(config: Partial<ChangeDetectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Set the SSIM/downsample config used for this run's comparisons. */
  setWorkerConfig(config: SlideWorkerConfig): void {
    this.workerConfig = { ...config };
  }

  getState(): { verificationState: VerificationState; currentVerification: number } {
    return { verificationState: this.verificationState, currentVerification: this.currentVerification };
  }

  /**
   * Process a captured frame.
   * Returns an accepted ImageData when the caller should persist it as a slide.
   * @param mediaTime optional video.currentTime (seconds) at this capture tick.
   */
  async process(imageData: ImageData, mediaTime?: number): Promise<ChangeDecision> {
    // First capture — always accept.
    if (!this.lastImageData) {
      this.lastImageData = imageData;
      this.candidateChangeAt = typeof mediaTime === 'number' ? mediaTime : null;
      return this.decision(imageData, mediaTime);
    }

    if (this.config.enableDoubleVerification && this.verificationState !== 'none') {
      return this.handleVerification(imageData, mediaTime);
    }

    return this.handleNewImage(imageData, mediaTime);
  }

  reset(): void {
    this.verificationState = 'none';
    this.currentVerification = 0;
    this.potentialNewImageData = null;
    this.candidateChangeAt = null;
  }

  /**
   * Forget the last saved frame as well as in-flight verification state.
   * Used on full lifecycle stop / cleanup.
   */
  clear(): void {
    this.lastImageData = null;
    this.reset();
  }

  private async handleVerification(imageData: ImageData, mediaTime?: number): Promise<ChangeDecision> {
    if (!this.potentialNewImageData) {
      log.error('potentialNewImageData is null during verification');
      this.reset();
      return this.decision(null, mediaTime);
    }

    const isStable = await this.worker.compareImages(this.potentialNewImageData, imageData, this.workerConfig);

    if (isStable) {
      // Frame still matches the candidate — but our worker returns `true` when
      // similarity is BELOW threshold (i.e. changed). Preserve original semantics:
      // here `isStable === true` means the verification image differs again, so abort.
      const changeAt = this.candidateChangeAt ?? mediaTime;
      this.reset();
      return this.decision(null, mediaTime, {
        changeAt: typeof changeAt === 'number' ? changeAt : undefined,
        unstableAbort: true,
      });
    }

    this.currentVerification++;
    if (this.currentVerification < this.config.verificationCount) {
      return this.decision(null, mediaTime);
    }

    const accepted = this.potentialNewImageData;
    const changeAt = this.candidateChangeAt ?? mediaTime;
    this.lastImageData = accepted;
    this.reset();
    return this.decision(accepted, mediaTime, {
      changeAt: typeof changeAt === 'number' ? changeAt : undefined,
    });
  }

  private async handleNewImage(imageData: ImageData, mediaTime?: number): Promise<ChangeDecision> {
    const hasChanged = await this.worker.compareImages(this.lastImageData!, imageData, this.workerConfig);
    if (!hasChanged) return this.decision(null, mediaTime);

    if (this.config.enableDoubleVerification) {
      this.verificationState = 'verifying';
      this.currentVerification = 0;
      this.potentialNewImageData = imageData;
      this.candidateChangeAt = typeof mediaTime === 'number' ? mediaTime : null;
      return this.decision(null, mediaTime);
    }

    this.lastImageData = imageData;
    this.candidateChangeAt = typeof mediaTime === 'number' ? mediaTime : null;
    return this.decision(imageData, mediaTime, {
      changeAt: typeof mediaTime === 'number' ? mediaTime : undefined,
    });
  }

  private decision(
    accepted: ImageData | null,
    mediaTime?: number,
    extra?: { changeAt?: number; unstableAbort?: boolean }
  ): ChangeDecision {
    const confirmedAt = typeof mediaTime === 'number' ? mediaTime : undefined;
    const changeAt =
      extra?.changeAt ??
      (accepted && typeof this.candidateChangeAt === 'number'
        ? this.candidateChangeAt
        : confirmedAt);
    return {
      acceptedImage: accepted,
      verificationState: this.verificationState,
      currentVerification: this.currentVerification,
      changeAt,
      confirmedAt,
      unstableAbort: extra?.unstableAbort,
    };
  }
}
