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

/** The run a frame was taken for; a frame finishes against this, not against whatever runs now. */
interface FrameRun {
  generation: number;
  adapter: SlideExtractionAdapter;
  outputPath: string | null;
  courseInfo: CourseInfo | null;
}

export class SlideExtractionPipeline implements SlideExtractionHandle {
  readonly instanceId: string;
  readonly mode: SlideExtractionMode;

  private adapter: SlideExtractionAdapter = {};
  private signalListener: (() => void) | null = null;

  // Lifecycle. `generation` moves on every start, stop and destroy; work begun
  // under an older value is not allowed to start timers or change this run.
  private phase: 'idle' | 'starting' | 'running' = 'idle';
  private generation = 0;
  // The one frame being compared or saved (at most one at a time), and the
  // generation whose frame may still be finished after its run stopped: a
  // slide whose file is already being written is kept, anything earlier in
  // the frame's life is dropped.
  private inFlight: Promise<void> | null = null;
  private drainingGeneration = -1;
  private skippedFrames = 0;
  // Resolves once a stopped run has nothing left in flight and `onStopped` ran.
  private settling: Promise<void> = Promise.resolve();

  private get isRunning(): boolean {
    return this.phase === 'running';
  }
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
    if (this.phase !== 'idle') {
      log.warn(`SlideExtractionPipeline ${this.instanceId}: already ${this.phase}`);
      return false;
    }
    if (adapter.signal?.aborted) return false;

    this.phase = 'starting';
    const generation = (this.generation += 1);
    // After every await below: a stop, destroy or abort that arrived meanwhile
    // moved the generation on, and this start must not go further.
    const superseded = (): boolean => this.generation !== generation;

    this.detachSignal();
    this.attachSignal(adapter.signal);

    // The previous run on this pipeline may still be finishing its last frame;
    // it does so with its own folder and callbacks before this one takes over.
    await this.settling;
    if (superseded()) return false;

    this.adapter = adapter;
    this.skippedFrames = 0;

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
    if (superseded()) return false;
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
        this.phase = 'idle';
        this.detachSignal();
        this.adapter.onError?.(new Error('Video element not found'));
        return false;
      }
    }

    this.phase = 'running';
    log.debug(`SlideExtractionPipeline ${this.instanceId}: starting (source=${this.sourceMode})`, this.config);

    if (this.sourceMode === 'video') {
      this.scheduleCaptureLoop();
    }

    this.emitStatus();
    return true;
  }

  /**
   * Stop the run. Capturing ends at once. A frame still being compared is
   * dropped; a slide whose file is already being written is kept and reported
   * as usual. `onStopped` is called after that, with the final list, so the
   * list it receives is complete. `settled()` resolves when all of it is done.
   *
   * Stopping a run that is still starting cancels the start (`run` resolves
   * false; no `onStopped`, since nothing ran).
   */
  stop(): void {
    this.halt(true);
  }

  /** Resolves once a stopped run has finished its last frame and `onStopped`. */
  settled(): Promise<void> {
    return this.settling;
  }

  private halt(keepLastSlide: boolean): void {
    if (this.phase === 'idle') return;
    const wasRunning = this.phase === 'running';
    const stopped = this.generation;
    this.generation += 1;
    this.phase = 'idle';
    this.detachSignal();

    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    if (!wasRunning) return;

    const onStopped = this.adapter.onStopped;
    const finish = (): void => {
      if (this.drainingGeneration === stopped) this.drainingGeneration = -1;
      this.detector.reset();
      this.cleanupMemory();
      if (this.skippedFrames > 0) {
        log.debug(`SlideExtractionPipeline ${this.instanceId}: skipped ${this.skippedFrames} frames while busy`);
      }
      const finalSlides = [...this.extractedSlides];
      if (onStopped) {
        const failed = (err: unknown): void => {
          log.error(`onStopped callback failed for ${this.instanceId}:`, err);
        };
        try {
          Promise.resolve(onStopped(finalSlides)).catch(failed);
        } catch (err) {
          failed(err);
        }
      }
    };

    log.debug(`SlideExtractionPipeline ${this.instanceId}: stopped`);
    this.emitStatus();

    const last = this.inFlight;
    if (keepLastSlide && last) {
      this.drainingGeneration = stopped;
      this.settling = last.then(finish, finish);
    } else {
      // Nothing in flight, or the pipeline is being destroyed: the frame in
      // flight (if any) is abandoned and `settled()` only waits for it to end.
      finish();
      this.settling = last ? last.then(() => undefined, () => undefined) : Promise.resolve();
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
      if (!this.isRunning) return;
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
    this.halt(false);
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

  private attachSignal(signal: AbortSignal | undefined): void {
    if (!signal) return;
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
      void this.captureAndCompare();
    }, this.config.checkInterval);
  }

  private async captureAndCompare(): Promise<void> {
    try {
      if (this.isPausedDueToBuffering) {
        return;
      }
      // One frame at a time: while the last one is still being compared or
      // saved, this tick is skipped before a frame is even captured, so slow
      // comparisons cannot pile frames up or reach the detector out of order.
      if (this.inFlight) {
        this.skippedFrames += 1;
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
      if (!this.isRunning) return;
      this.adapter.onError?.(error);
      if (this.detector.getState().verificationState === 'verifying') {
        this.detector.reset();
        this.emitStatus();
      }
    }
  }

  /**
   * Hand one frame to the detector, unless one is already in flight (the new
   * frame is then dropped; pushed frames follow the same rule as sampled ones).
   */
  private handleFrame(imageData: ImageData): Promise<void> {
    if (!this.isRunning) return Promise.resolve();
    if (this.inFlight) {
      this.skippedFrames += 1;
      return Promise.resolve();
    }
    const work = this.processFrame(imageData);
    const tracked = work.then(
      () => undefined,
      () => undefined,
    ).then(() => {
      if (this.inFlight === tracked) this.inFlight = null;
    });
    this.inFlight = tracked;
    return work;
  }

  private async processFrame(imageData: ImageData): Promise<void> {
    // What this frame belongs to, fixed now: a later run on this pipeline has
    // another folder and other callbacks.
    const run = {
      generation: this.generation,
      adapter: this.adapter,
      outputPath: this.outputPath,
      courseInfo: this.courseInfo,
    };

    const decision = await this.detector.process(imageData);
    // Stopped while the frame was being compared: the frame is dropped.
    if (this.generation !== run.generation) return;
    this.emitStatus();

    if (decision.acceptedImage) {
      await this.persistSlide(run, decision.acceptedImage);
    }
  }

  private async persistSlide(run: FrameRun, imageData: ImageData): Promise<void> {
    const result = await saveSlide(imageData, {
      outputPath: run.outputPath,
      courseInfo: run.courseInfo,
    });
    if (!result) return;
    // The file is written. It belongs to its run if that run is still going or
    // stopped while this slide was being saved; after a destroy (or once the
    // run has been handed off) it stays on disk and is announced to nobody.
    if (this.generation !== run.generation && this.drainingGeneration !== run.generation) return;

    this.extractedSlides.push(result.slide);
    run.adapter.onSlideExtracted?.(result.slide);
    if (this.generation === run.generation) this.emitStatus();
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
