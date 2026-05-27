/**
 * Slide Extraction Pipeline
 *
 * Lifecycle orchestrator for SSIM-based slide extraction. Composes the
 * single-responsibility helpers in this folder (frameSource, changeDetection,
 * slideWriter, intervalTable, workerHelpers) and exposes the public
 * SlideExtractionHandle to callers.
 *
 * Callers do not instantiate this class directly — use `slideExtractionManager.run`
 * from `./manager.ts`.
 */

import { ssimThresholdService } from '@shared/services/ssimThresholdService';
import { ChangeDetector } from './changeDetection';
import { buildVideoSelector, captureFrame, getVideoElement, validateImageData } from './frameSource';
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

const DEFAULT_CONFIG: SlideExtractionConfig = {
  checkInterval: 2000,
  enableDoubleVerification: true,
  verificationCount: 2,
  ssimThreshold: 0.999,
  enableDownsampling: true,
  downsampleWidth: 480,
  downsampleHeight: 270,
};

export class SlideExtractionPipeline implements SlideExtractionHandle {
  readonly instanceId: string;
  readonly mode: SlideExtractionMode;

  private adapter: SlideExtractionAdapter = {};
  private signalListener: (() => void) | null = null;

  private isRunning = false;
  private captureInterval: ReturnType<typeof setInterval> | null = null;
  private sourceMode: SlideSourceMode = 'video';
  private videoSelector: string;

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
    this.videoSelector = buildVideoSelector(mode);
    console.log(`SlideExtractionPipeline created: ${this.instanceId} (mode: ${mode})`);
  }

  /**
   * Start (or restart) an extraction run.
   *
   * Resolves classroom-based threshold context, loads user config, applies
   * overrides, syncs the worker, and schedules the capture loop or arms the
   * pushed-frame path. Returns false if extraction is already running or no
   * <video> element is available (for source mode `video`).
   */
  async run(input: SlideExtractionInput, adapter: SlideExtractionAdapter = {}): Promise<boolean> {
    if (this.isRunning) {
      console.warn(`SlideExtractionPipeline ${this.instanceId}: already running`);
      return false;
    }

    this.detachSignal();
    this.adapter = adapter;
    this.attachSignal();

    this.outputPath = input.outputPath;
    this.courseInfo = { ...(input.courseInfo ?? {}), mode: input.courseInfo?.mode ?? this.mode };
    this.sourceMode = input.sourceMode ?? 'video';

    if (input.classrooms !== undefined) {
      ssimThresholdService.setCurrentClassrooms(input.classrooms);
    }

    await this.loadConfigFromService();

    if (input.configOverrides) {
      this.config = { ...this.config, ...input.configOverrides };
    }

    if (input.initialPlaybackRate !== undefined) {
      this.currentPlaybackRate = input.initialPlaybackRate;
      this.config.checkInterval = this.intervalTable.getIntervalForRate(input.initialPlaybackRate);
    }

    await this.syncWorkerConfig();
    this.detector.updateConfig({
      enableDoubleVerification: this.config.enableDoubleVerification,
      verificationCount: this.config.verificationCount,
    });
    this.detector.clear();

    if (this.sourceMode === 'video') {
      const video = getVideoElement(this.videoSelector, this.instanceId);
      if (!video) {
        console.error(`SlideExtractionPipeline ${this.instanceId}: video element not found`);
        this.adapter.onError?.(new Error('Video element not found'));
        return false;
      }
    }

    this.isRunning = true;
    console.log(`SlideExtractionPipeline ${this.instanceId}: starting (source=${this.sourceMode})`, this.config);

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

    console.log(`SlideExtractionPipeline ${this.instanceId}: stopped`);
    this.emitStatus();

    if (onStopped) {
      Promise.resolve(onStopped(finalSlides)).catch(err => {
        console.error(`onStopped callback failed for ${this.instanceId}:`, err);
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
      console.error('Error processing pushed frame:', err);
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

    console.log(`Playback rate changed: ${oldRate}x -> ${playbackRate}x, interval: ${oldInterval}ms -> ${newInterval}ms`);

    if (this.isRunning && this.sourceMode === 'video' && oldInterval !== newInterval) {
      this.scheduleCaptureLoop();
    }
    this.emitStatus();
  }

  pauseForBuffering(): void {
    if (this.isRunning && !this.isPausedDueToBuffering) {
      this.isPausedDueToBuffering = true;
      this.isBuffering = true;
      console.log(`SlideExtractionPipeline ${this.instanceId}: Paused verification due to buffering`);
      this.emitStatus();
    }
  }

  resumeAfterBuffering(): void {
    if (this.isRunning && this.isPausedDueToBuffering) {
      this.isPausedDueToBuffering = false;
      this.isBuffering = false;
      console.log(`SlideExtractionPipeline ${this.instanceId}: Resumed verification after buffering`);
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
    this.extractedSlides = [];
    console.log(`All slides cleared for instance ${this.instanceId}`);

    const event = new CustomEvent('slidesCleared', {
      detail: { instanceId: this.instanceId, mode: this.mode },
    });
    window.dispatchEvent(event);
    this.adapter.onSlidesCleared?.();
  }

  getOutputPath(): string | null {
    return this.outputPath;
  }

  async reloadConfig(): Promise<void> {
    await this.loadConfigFromService();
    await this.syncWorkerConfig();
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
    this.extractedSlides = [];
    this.detector.clear();
    this.adapter = {};
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

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
    console.log(`SlideExtractionPipeline ${this.instanceId}: interval scheduled at ${this.config.checkInterval}ms`);
  }

  private async captureAndCompare(): Promise<void> {
    try {
      if (this.isPausedDueToBuffering) {
        console.log('Skipping capture due to buffering');
        return;
      }
      const video = getVideoElement(this.videoSelector, this.instanceId);
      if (!video) {
        console.warn('Video element not available during capture');
        return;
      }
      const imageData = captureFrame(video);
      if (!imageData) {
        console.warn('Failed to capture frame');
        return;
      }
      await this.handleFrame(imageData);
    } catch (error) {
      console.error('Error in captureAndCompare:', error);
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

    console.log(`Slide #${this.extractedSlides.length} recorded for ${this.instanceId}`);

    const event = new CustomEvent('slideExtracted', {
      detail: {
        slide: result.slide,
        totalCount: this.extractedSlides.length,
        instanceId: this.instanceId,
        mode: this.mode,
      },
    });
    window.dispatchEvent(event);
    this.adapter.onSlideExtracted?.(result.slide);
    this.emitStatus();
  }

  private async loadConfigFromService(): Promise<void> {
    try {
      const slideConfig = await (window as { electronAPI?: { config?: { getSlideExtractionConfig?: () => Promise<Partial<SlideExtractionConfig>> } } })
        .electronAPI?.config?.getSlideExtractionConfig?.();
      if (!slideConfig) return;

      const newBaseInterval = slideConfig.checkInterval ?? DEFAULT_CONFIG.checkInterval;
      this.intervalTable.setBaseInterval(newBaseInterval);

      const correctInterval = this.intervalTable.getIntervalForRate(this.currentPlaybackRate);

      this.config = {
        checkInterval: correctInterval,
        enableDoubleVerification: slideConfig.enableDoubleVerification !== false,
        verificationCount: slideConfig.verificationCount ?? DEFAULT_CONFIG.verificationCount,
        ssimThreshold: slideConfig.ssimThreshold ?? DEFAULT_CONFIG.ssimThreshold,
        enableDownsampling:
          slideConfig.enableDownsampling !== undefined ? slideConfig.enableDownsampling : DEFAULT_CONFIG.enableDownsampling,
        downsampleWidth: slideConfig.downsampleWidth ?? DEFAULT_CONFIG.downsampleWidth,
        downsampleHeight: slideConfig.downsampleHeight ?? DEFAULT_CONFIG.downsampleHeight,
      };

      console.log(`Pipeline ${this.instanceId} config loaded (playbackRate=${this.currentPlaybackRate}x):`, this.config);
    } catch (error) {
      console.error('Failed to load slide extraction config:', error);
    }
  }

  private async syncWorkerConfig(): Promise<void> {
    try {
      await slideProcessorService.updateConfig({
        ssimThreshold: this.config.ssimThreshold,
        enableDownsampling: this.config.enableDownsampling,
        downsampleWidth: this.config.downsampleWidth,
        downsampleHeight: this.config.downsampleHeight,
      });
    } catch (error) {
      console.error('Failed to update worker config:', error);
    }
  }

  private emitStatus(): void {
    if (!this.adapter.onStatusChanged) return;
    try {
      this.adapter.onStatusChanged(this.getStatus());
    } catch (err) {
      console.error('onStatusChanged callback threw:', err);
    }
  }

  private cleanupMemory(): void {
    this.extractedSlides.forEach(slide => {
      if (slide.imageData) {
        (slide as { imageData?: ImageData | null }).imageData = null;
      }
    });

    if (typeof window !== 'undefined' && (window as { gc?: () => void }).gc) {
      try {
        (window as { gc?: () => void }).gc?.();
        console.log('Manual garbage collection triggered');
      } catch {
        // ignore — gc only available in some debug builds
      }
    }

    console.log(`Memory cleanup completed for instance ${this.instanceId}`);
  }
}
