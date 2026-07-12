/**
 * Slide Extraction Pipeline
 * Ported from autoslides/src/renderer/shared/processing/pipeline.ts.
 *
 * Lifecycle orchestrator for SSIM-based slide extraction. Composes the
 * single-responsibility helpers in this folder (frameSource, changeDetection,
 * slideWriter, intervalTable, workerHelpers) and exposes the public
 * SlideExtractionHandle to callers.
 *
 * Web changes vs desktop:
 *   - Config comes from the baked-in EXTRACTION_DEFAULTS (no settings IPC);
 *     the SSIM preset is always "adaptive", resolved per run from the input's
 *     classrooms via `resolveSsimThreshold`.
 *   - `outputPath` is the IndexedDB folder name; slideWriter writes there.
 *   - No window CustomEvents — the web has a single playback, so adapter
 *     callbacks are the only notification channel.
 *   - The `<video>` element always comes from `input.videoElementProvider`
 *     (no DOM-selector fallback).
 *   - `ExtractedSlide.dataUrl` object URLs are revoked on clearSlides/destroy.
 *
 * Callers do not instantiate this class directly — use `slideExtractionManager.run`
 * from `./manager.ts`.
 */

import { EXTRACTION_DEFAULTS, resolveSsimThreshold } from '../extractionDefaults';
import { ChangeDetector } from './changeDetection';
import { captureFrame, isVideoAccessible, validateImageData } from './frameSource';
import { IntervalTable } from './intervalTable';
import { saveSlide } from './slideWriter';
import { slideProcessorService } from './workerHelpers';
import type {
  CourseInfo,
  ExtractedSlide,
  SlideExtractionAdapter,
  SlideExtractionConfig,
  SlideExtractionHandle,
  SlideExtractionInput,
  SlideExtractionMode,
  SlideExtractionStatus,
  SlideSourceMode,
} from './types';
import { createLogger } from '../logger';
const log = createLogger('ProcessingPipeline');

const DEFAULT_CONFIG: SlideExtractionConfig = { ...EXTRACTION_DEFAULTS };

export class SlideExtractionPipeline implements SlideExtractionHandle {
  readonly instanceId: string;
  readonly mode: SlideExtractionMode;

  private adapter: SlideExtractionAdapter = {};
  private signalListener: (() => void) | null = null;

  private isRunning = false;
  private captureInterval: ReturnType<typeof setInterval> | null = null;
  private sourceMode: SlideSourceMode = 'video';
  private videoElementProvider: (() => HTMLVideoElement | null) | null = null;
  private warnedVideoUnavailable = false;

  private isBuffering = false;
  private isPausedDueToBuffering = false;

  private config: SlideExtractionConfig = { ...DEFAULT_CONFIG };
  private currentPlaybackRate = 1;
  private intervalTable = new IntervalTable(DEFAULT_CONFIG.checkInterval);

  private detector = new ChangeDetector(slideProcessorService, {
    enableDoubleVerification: DEFAULT_CONFIG.enableDoubleVerification,
    verificationCount: DEFAULT_CONFIG.verificationCount,
  });

  private outputPath: string | null = null;
  private courseInfo: CourseInfo | null = null;
  private extractedSlides: ExtractedSlide[] = [];

  constructor(mode: SlideExtractionMode, instanceId?: string) {
    this.mode = mode;
    this.instanceId = instanceId ?? `${mode}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Start (or restart) an extraction run.
   *
   * Resolves the classroom-adaptive threshold, applies overrides, syncs the
   * worker, and schedules the capture loop or arms the pushed-frame path.
   * Returns false if extraction is already running or no <video> element is
   * available (for source mode `video`).
   */
  async run(input: SlideExtractionInput, adapter: SlideExtractionAdapter = {}): Promise<boolean> {
    if (this.isRunning) {
      log.warn(`SlideExtractionPipeline ${this.instanceId}: already running`);
      return false;
    }

    this.detachSignal();
    this.adapter = adapter;
    this.attachSignal();

    this.outputPath = input.outputPath;
    this.courseInfo = { ...(input.courseInfo ?? {}), mode: input.courseInfo?.mode ?? this.mode };
    this.sourceMode = input.sourceMode ?? 'video';
    this.videoElementProvider = input.videoElementProvider ?? null;
    this.warnedVideoUnavailable = false;

    this.loadConfig();

    if (input.configOverrides) {
      this.config = { ...this.config, ...input.configOverrides };
    }

    // Resolve the classroom-adaptive threshold for THIS run, purely from the
    // run's own classrooms (the web always uses the adaptive preset). Only
    // applies when no explicit override was supplied.
    if (input.configOverrides?.ssimThreshold === undefined) {
      this.config.ssimThreshold = resolveSsimThreshold(input.classrooms ?? []);
    }

    if (input.initialPlaybackRate !== undefined) {
      this.currentPlaybackRate = input.initialPlaybackRate;
      this.config.checkInterval = this.intervalTable.getIntervalForRate(input.initialPlaybackRate);
    }

    await this.syncWorkerConfig();
    this.detector.setWorkerConfig(this.currentWorkerConfig());
    this.detector.updateConfig({
      enableDoubleVerification: this.config.enableDoubleVerification,
      verificationCount: this.config.verificationCount,
    });
    this.detector.clear();

    if (this.sourceMode === 'video') {
      const video = this.resolveVideoElement();
      if (!video) {
        log.error(`SlideExtractionPipeline ${this.instanceId}: video element not found`);
        this.adapter.onError?.(new Error('Video element not found'));
        return false;
      }
    }

    this.isRunning = true;
    log.debug(`SlideExtractionPipeline ${this.instanceId}: starting (source=${this.sourceMode})`, this.config);

    if (this.sourceMode === 'video') {
      this.scheduleCaptureLoop();
    }

    this.emitStatus();
    return true;
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }

    this.detector.reset();
    this.cleanupMemory();

    const finalSlides = [...this.extractedSlides];
    const onStopped = this.adapter.onStopped;
    this.detachSignal();

    log.debug(`SlideExtractionPipeline ${this.instanceId}: stopped`);
    this.emitStatus();

    if (onStopped) {
      Promise.resolve(onStopped(finalSlides)).catch(err => {
        log.error(`onStopped callback failed for ${this.instanceId}:`, err);
      });
    }
  }

  async pushFrame(imageData: ImageData): Promise<void> {
    if (!this.isRunning || this.sourceMode !== 'pushed') return;
    if (this.isPausedDueToBuffering) return;
    try {
      if (!validateImageData(imageData)) return;
      await this.handleFrame(imageData);
    } catch (err) {
      log.error('Error processing pushed frame:', err);
      this.adapter.onError?.(err);
      if (this.detector.getState().verificationState === 'verifying') {
        this.detector.reset();
        this.emitStatus();
      }
    }
  }

  setPlaybackRate(playbackRate: number): void {
    const oldRate = this.currentPlaybackRate;
    const oldInterval = this.config.checkInterval;
    const newInterval = this.intervalTable.getIntervalForRate(playbackRate);

    this.currentPlaybackRate = playbackRate;
    this.config.checkInterval = newInterval;

    if (oldRate === playbackRate && oldInterval === newInterval) return;

    if (this.isRunning && this.sourceMode === 'video' && oldInterval !== newInterval) {
      this.scheduleCaptureLoop();
    }
    this.emitStatus();
  }

  pauseForBuffering(): void {
    if (this.isRunning && !this.isPausedDueToBuffering) {
      this.isPausedDueToBuffering = true;
      this.isBuffering = true;
      this.emitStatus();
    }
  }

  resumeAfterBuffering(): void {
    if (this.isRunning && this.isPausedDueToBuffering) {
      this.isPausedDueToBuffering = false;
      this.isBuffering = false;
      this.emitStatus();
    }
  }

  isPausedForBuffering(): boolean {
    return this.isPausedDueToBuffering;
  }

  getStatus(): SlideExtractionStatus {
    const detectorState = this.detector.getState();
    return {
      isRunning: this.isRunning,
      slideCount: this.extractedSlides.length,
      verificationState: detectorState.verificationState,
      currentVerification: detectorState.currentVerification,
      playbackRate: this.currentPlaybackRate,
      currentCheckInterval: this.config.checkInterval,
      baseCheckInterval: this.intervalTable.getBaseInterval(),
      isBuffering: this.isBuffering,
      isPausedDueToBuffering: this.isPausedDueToBuffering,
    };
  }

  getExtractedSlides(): ExtractedSlide[] {
    return [...this.extractedSlides];
  }

  clearSlides(): void {
    this.revokeSlideUrls();
    this.extractedSlides = [];
    this.adapter.onSlidesCleared?.();
  }

  getOutputPath(): string | null {
    return this.outputPath;
  }

  async reloadConfig(): Promise<void> {
    this.loadConfig();
    await this.syncWorkerConfig();
    this.detector.setWorkerConfig(this.currentWorkerConfig());
    this.detector.updateConfig({
      enableDoubleVerification: this.config.enableDoubleVerification,
      verificationCount: this.config.verificationCount,
    });
    if (this.isRunning && this.sourceMode === 'video') {
      this.scheduleCaptureLoop();
    }
  }

  destroy(): void {
    this.stop();
    this.revokeSlideUrls();
    this.extractedSlides = [];
    this.detector.clear();
    this.adapter = {};
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  /**
   * Resolve the `<video>` element to capture from — always via the
   * caller-supplied provider on the web (read live on every tick, so it
   * tolerates same-element stream switches).
   */
  private resolveVideoElement(): HTMLVideoElement | null {
    if (!this.videoElementProvider) return null;
    const provided = this.videoElementProvider();
    return provided && isVideoAccessible(provided) ? provided : null;
  }

  private attachSignal(): void {
    const signal = this.adapter.signal;
    if (!signal) return;
    if (signal.aborted) {
      // Defer to next tick so callers see `run` returning true first.
      queueMicrotask(() => this.stop());
      return;
    }
    const listener = () => this.stop();
    signal.addEventListener('abort', listener, { once: true });
    this.signalListener = () => signal.removeEventListener('abort', listener);
  }

  private detachSignal(): void {
    if (this.signalListener) {
      this.signalListener();
      this.signalListener = null;
    }
  }

  private scheduleCaptureLoop(): void {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    this.captureInterval = setInterval(() => {
      this.captureAndCompare();
    }, this.config.checkInterval);
  }

  private async captureAndCompare(): Promise<void> {
    try {
      if (this.isPausedDueToBuffering) {
        return;
      }
      const video = this.resolveVideoElement();
      if (!video) {
        // A transient null is normal while a stream switches or the page tears
        // down; only warn once per run so teardown doesn't spam the console.
        if (!this.warnedVideoUnavailable) {
          log.warn(`SlideExtractionPipeline ${this.instanceId}: video element not available during capture`);
          this.warnedVideoUnavailable = true;
        }
        return;
      }
      this.warnedVideoUnavailable = false;
      const imageData = captureFrame(video);
      if (!imageData) {
        log.warn('Failed to capture frame');
        return;
      }
      await this.handleFrame(imageData);
    } catch (error) {
      log.error('Error in captureAndCompare:', error);
      this.adapter.onError?.(error);
      if (this.detector.getState().verificationState === 'verifying') {
        this.detector.reset();
        this.emitStatus();
      }
    }
  }

  private async handleFrame(imageData: ImageData): Promise<void> {
    if (!this.isRunning) return;

    const decision = await this.detector.process(imageData);
    this.emitStatus();

    if (decision.acceptedImage) {
      await this.persistSlide(decision.acceptedImage);
    }
  }

  private async persistSlide(imageData: ImageData): Promise<void> {
    const result = await saveSlide(imageData, {
      outputPath: this.outputPath,
      courseInfo: this.courseInfo,
    });
    if (!result) return;

    this.extractedSlides.push(result.slide);
    this.adapter.onSlideExtracted?.(result.slide);
    this.emitStatus();
  }

  private loadConfig(): void {
    this.intervalTable.setBaseInterval(EXTRACTION_DEFAULTS.checkInterval);
    this.config = {
      ...EXTRACTION_DEFAULTS,
      checkInterval: this.intervalTable.getIntervalForRate(this.currentPlaybackRate),
    };
  }

  /** The SSIM/downsample slice of this run's config, forwarded per-message. */
  private currentWorkerConfig() {
    return {
      ssimThreshold: this.config.ssimThreshold,
      enableDownsampling: this.config.enableDownsampling,
      downsampleWidth: this.config.downsampleWidth,
      downsampleHeight: this.config.downsampleHeight,
    };
  }

  private async syncWorkerConfig(): Promise<void> {
    try {
      // Sets the worker's default CONFIG as a fallback only; the authoritative
      // per-comparison config is forwarded by the detector on each message.
      await slideProcessorService.updateConfig(this.currentWorkerConfig());
    } catch (error) {
      log.error('Failed to update worker config:', error);
    }
  }

  private emitStatus(): void {
    if (!this.adapter.onStatusChanged) return;
    try {
      this.adapter.onStatusChanged(this.getStatus());
    } catch (err) {
      log.error('onStatusChanged callback threw:', err);
    }
  }

  private revokeSlideUrls(): void {
    this.extractedSlides.forEach(slide => {
      if (slide.dataUrl) {
        URL.revokeObjectURL(slide.dataUrl);
      }
    });
  }

  private cleanupMemory(): void {
    // Drop raw pixel buffers; keep dataUrl object URLs alive so the gallery
    // can still render slides after the run stops.
    this.extractedSlides.forEach(slide => {
      if (slide.imageData) {
        slide.imageData = null;
      }
    });
  }
}
