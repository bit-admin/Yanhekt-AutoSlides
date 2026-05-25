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

import type { SlideProcessorService } from './workerHelpers';
import type { VerificationState } from './types';

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
}

export class ChangeDetector {
  private config: ChangeDetectorConfig;
  private worker: SlideProcessorService;

  private lastImageData: ImageData | null = null;
  private verificationState: VerificationState = 'none';
  private currentVerification = 0;
  private potentialNewImageData: ImageData | null = null;

  constructor(worker: SlideProcessorService, config: ChangeDetectorConfig) {
    this.worker = worker;
    this.config = { ...config };
  }

  updateConfig(config: Partial<ChangeDetectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getState(): { verificationState: VerificationState; currentVerification: number } {
    return { verificationState: this.verificationState, currentVerification: this.currentVerification };
  }

  /**
   * Process a captured frame.
   * Returns an accepted ImageData when the caller should persist it as a slide.
   */
  async process(imageData: ImageData): Promise<ChangeDecision> {
    // First capture — always accept.
    if (!this.lastImageData) {
      this.lastImageData = imageData;
      return this.decision(imageData);
    }

    if (this.config.enableDoubleVerification && this.verificationState !== 'none') {
      return this.handleVerification(imageData);
    }

    return this.handleNewImage(imageData);
  }

  reset(): void {
    this.verificationState = 'none';
    this.currentVerification = 0;
    this.potentialNewImageData = null;
  }

  /**
   * Forget the last saved frame as well as in-flight verification state.
   * Used on full lifecycle stop / cleanup.
   */
  clear(): void {
    this.lastImageData = null;
    this.reset();
  }

  private async handleVerification(imageData: ImageData): Promise<ChangeDecision> {
    if (!this.potentialNewImageData) {
      console.error('potentialNewImageData is null during verification');
      this.reset();
      return this.decision(null);
    }

    const isStable = await this.worker.compareImages(this.potentialNewImageData, imageData);

    if (isStable) {
      // Frame still matches the candidate — but our worker returns `true` when
      // similarity is BELOW threshold (i.e. changed). Preserve original semantics:
      // here `isStable === true` means the verification image differs again, so abort.
      console.log('Verification failed, slide not stable');
      this.reset();
      return this.decision(null);
    }

    this.currentVerification++;
    if (this.currentVerification < this.config.verificationCount) {
      console.log(`Verification ${this.currentVerification}/${this.config.verificationCount} passed`);
      return this.decision(null);
    }

    const accepted = this.potentialNewImageData;
    this.lastImageData = accepted;
    this.reset();
    console.log('All verifications passed, slide saved');
    return this.decision(accepted);
  }

  private async handleNewImage(imageData: ImageData): Promise<ChangeDecision> {
    const hasChanged = await this.worker.compareImages(this.lastImageData!, imageData);
    if (!hasChanged) return this.decision(null);

    if (this.config.enableDoubleVerification) {
      this.verificationState = 'verifying';
      this.currentVerification = 0;
      this.potentialNewImageData = imageData;
      console.log('Change detected, starting verification...');
      return this.decision(null);
    }

    this.lastImageData = imageData;
    console.log('Change detected, slide saved directly');
    return this.decision(imageData);
  }

  private decision(accepted: ImageData | null): ChangeDecision {
    return {
      acceptedImage: accepted,
      verificationState: this.verificationState,
      currentVerification: this.currentVerification,
    };
  }
}
