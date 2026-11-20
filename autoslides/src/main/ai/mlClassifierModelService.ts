import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { MlClassifierModelInfo } from '@common/onnxModelInfo';
import { createLogger } from '@main/infra/logger';
import { OnnxModelService } from '@main/infra/onnxModelService';
import type { ConfigService } from '@main/platform/configService';
import { downloadClassifierModel } from './downloadClassifierModel';
import { SLIDE_CLASSIFIER_RELEASE } from './slideClassifierRelease';

const log = createLogger('MlClassifierModel');

export class MlClassifierModelService extends OnnxModelService {
  private download: Promise<void> | null = null;
  private downloadFailed = false;
  /** Whole percent of the pinned size while downloading; null otherwise. */
  private downloadPercent: number | null = null;
  private readonly listeners = new Set<(info: MlClassifierModelInfo) => void>();

  constructor(private readonly config: ConfigService) {
    super({
      builtinModelName: SLIDE_CLASSIFIER_RELEASE.filename,
      builtinModelVersion: SLIDE_CLASSIFIER_RELEASE.version,
      customModelFilename: 'custom-classifier.onnx',
      dialogTitle: 'Select Custom Classifier Model',
      notFoundLabel: 'ML classifier model',
      getActiveModel: () => config.getAIFilteringConfig().mlClassifierActiveModel,
      getCustomModelName: () => config.getAIFilteringConfig().mlClassifierCustomModelName,
      setActiveModel: (value) => config.setMlClassifierActiveModel(value),
      setCustomModelName: (value) => config.setMlClassifierCustomModelName(value),
    });
  }

  private get downloadedPath(): string {
    return path.join(app.getPath('userData'), 'models', SLIDE_CLASSIFIER_RELEASE.filename);
  }

  /** Keep a deliberate removal in effect across launches, until the next ML use or explicit download. */
  private get removedMarker(): string {
    return `${this.downloadedPath}.removed`;
  }

  override getBuiltinModelPath(): string {
    const bundledPath = super.getBuiltinModelPath();
    return !app.isPackaged || this.statSafe(bundledPath) ? bundledPath : this.downloadedPath;
  }

  override getModelInfo(): MlClassifierModelInfo {
    const info = super.getModelInfo();
    const downloadedSizeBytes = this.statSafe(this.downloadedPath)?.size ?? null;
    const bundled = this.statSafe(super.getBuiltinModelPath());
    const builtinSource = bundled ? (app.isPackaged ? 'bundled' : 'development')
      : app.isPackaged && downloadedSizeBytes === SLIDE_CLASSIFIER_RELEASE.bytes ? 'downloaded' : 'missing';
    return {
      ...info,
      builtinSource,
      builtinExists: builtinSource !== 'missing',
      builtinSizeBytes: builtinSource === 'missing' ? null : info.builtinSizeBytes,
      downloadedSizeBytes,
      releaseSizeBytes: SLIDE_CLASSIFIER_RELEASE.bytes,
      canDownload: app.isPackaged && builtinSource === 'missing',
      downloadStatus: this.download ? 'downloading' : this.downloadFailed ? 'failed' : 'idle',
      downloadPercent: this.download ? this.downloadPercent : null,
    };
  }

  subscribe(listener: (info: MlClassifierModelInfo) => void): void {
    this.listeners.add(listener);
  }

  private notify(): void {
    const info = this.getModelInfo();
    for (const listener of this.listeners) listener(info);
  }

  /** Warm the file only, never the inference worker or the in-memory model. */
  prepareConfiguredModel({ afterModeChange = false } = {}): void {
    if (!app.isPackaged || this.config.getAIClassifierMode() !== 'ml') return;
    const info = this.getModelInfo();
    if ((info.active === 'custom' && info.customExists) || !info.canDownload) return;
    if (!afterModeChange && fs.existsSync(this.removedMarker)) return;
    void this.downloadDefaultModel().catch(() => {}); // Failure is reported through model status.
  }

  downloadDefaultModel(): Promise<void> {
    if (this.download) return this.download;
    if (!this.getModelInfo().canDownload) return Promise.resolve();
    this.downloadFailed = false;
    this.downloadPercent = 0;
    // Broadcast only whole-percent steps (at most ~100 messages per download).
    const onProgress = (fraction: number) => {
      const percent = Math.min(100, Math.floor(fraction * 100));
      if (percent === this.downloadPercent) return;
      this.downloadPercent = percent;
      this.notify();
    };
    this.download = downloadClassifierModel(this.downloadedPath, onProgress)
      .then(() => {
        this.clearModelCache();
        // Once the user has used or re-enabled ML, the next launch may warm it again.
        try { fs.rmSync(this.removedMarker, { force: true }); } catch { /* file is already installed */ }
      })
      .catch((error: unknown) => {
        this.downloadFailed = true;
        log.warn('Classifier model download failed:', error instanceof Error ? error.message : String(error));
        throw new Error('Could not download the slide classifier model. Check your connection and try again.');
      })
      .finally(() => {
        this.download = null;
        this.downloadPercent = null;
        this.notify();
      });
    this.notify();
    return this.download;
  }

  deleteDownloadedModel(): MlClassifierModelInfo {
    if (!this.download && this.statSafe(this.downloadedPath)) {
      fs.writeFileSync(this.removedMarker, '');
      fs.rmSync(this.downloadedPath, { force: true });
      this.clearModelCache();
      this.downloadFailed = false;
      this.notify();
    }
    return this.getModelInfo();
  }

  override async readModelBuffer(): Promise<ArrayBuffer> {
    // Capability is independent of the configured mode: the Developer lab can
    // explicitly run ML while production classification uses an LLM.
    if (app.isPackaged && this.getActiveModelPath() === this.downloadedPath) await this.downloadDefaultModel();
    return super.readModelBuffer();
  }
}
