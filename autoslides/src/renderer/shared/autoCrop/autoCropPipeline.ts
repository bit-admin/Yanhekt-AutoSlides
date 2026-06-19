import type { DetectConfig, DetectorMode, DetectResult } from '../workers/autoCrop.worker';
import type { AutoCropWorkerClient } from './autoCropWorkerClient';
import { createLogger } from '@shared/utils/logger';
const log = createLogger('AutoCropPipeline');

export interface AutoCropImageSource {
  readImageBuffer(imagePath: string): Promise<Uint8Array>;
  savePngBuffer(
    outDir: string,
    filename: string,
    buffer: Uint8Array,
    enableColorReduction: boolean,
  ): Promise<void>;
}

export interface AutoCropOptions {
  outputDir: string;
  detectConfig: Partial<DetectConfig>;
  redBoxMode: boolean;
  showEdges: boolean;
  enablePngColorReduction: boolean;
}

export interface AutoCropBatchProgress {
  current: number;
  total: number;
  processed: number;
  failed: number;
  noDetection: number;
  fallbackUsed: number;
}

export interface AutoCropCallbacks {
  onProgress?: (progress: AutoCropBatchProgress) => void;
  shouldCancel?: () => boolean;
}

function basename(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p;
}

export async function processBatch(
  client: AutoCropWorkerClient,
  source: AutoCropImageSource,
  imagePaths: string[],
  options: AutoCropOptions,
  callbacks: AutoCropCallbacks = {},
): Promise<AutoCropBatchProgress> {
  const progress: AutoCropBatchProgress = {
    current: 0,
    total: imagePaths.length,
    processed: 0,
    failed: 0,
    noDetection: 0,
    fallbackUsed: 0,
  };
  const mode: DetectorMode = options.detectConfig.mode ?? 'canny_then_yolo';
  const canShowEdges = mode !== 'yolo_only';

  for (const imagePath of imagePaths) {
    if (callbacks.shouldCancel?.()) break;
    progress.current++;
    callbacks.onProgress?.(progress);

    try {
      const buffer = await source.readImageBuffer(imagePath);
      const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      const blobArrayBuffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(blobArrayBuffer).set(bytes);
      const blob = new Blob([blobArrayBuffer], { type: 'image/*' });
      const bitmap = await createImageBitmap(blob);

      const srcCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const srcCtx = srcCanvas.getContext('2d')!;
      srcCtx.drawImage(bitmap, 0, 0);
      const imageData = srcCtx.getImageData(0, 0, bitmap.width, bitmap.height);

      const useDebug = options.redBoxMode && options.showEdges && canShowEdges;
      const response = await client.detectBbox(imageData, useDebug, options.detectConfig);

      if (!response.success || !response.result) {
        log.warn(`Auto-crop failed for ${basename(imagePath)}:`, response.error);
        progress.failed++;
        bitmap.close();
        callbacks.onProgress?.(progress);
        continue;
      }

      const result: DetectResult = response.result;
      if (!result.bbox) {
        progress.noDetection++;
        bitmap.close();
        callbacks.onProgress?.(progress);
        continue;
      }

      if (mode === 'canny_then_yolo' && result.backend === 'yolo') {
        progress.fallbackUsed++;
      }

      const { x, y, w, h } = result.bbox;
      let outCanvas: OffscreenCanvas;
      let outCtx: OffscreenCanvasRenderingContext2D;

      if (options.redBoxMode) {
        outCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        outCtx = outCanvas.getContext('2d')!;
        outCtx.drawImage(bitmap, 0, 0);

        if (
          options.showEdges &&
          canShowEdges &&
          result.edgesPng &&
          result.stripped &&
          result.innerSize
        ) {
          const edgesBlob = new Blob([result.edgesPng], { type: 'image/png' });
          const edgesBitmap = await createImageBitmap(edgesBlob);
          outCtx.globalAlpha = 0.5;
          outCtx.drawImage(
            edgesBitmap,
            result.stripped.left,
            result.stripped.top,
            result.innerSize.width,
            result.innerSize.height,
          );
          outCtx.globalAlpha = 1.0;
          edgesBitmap.close();
        }

        const lineW = Math.max(2, Math.round(bitmap.width / 600));
        outCtx.strokeStyle = 'rgba(255, 40, 40, 1)';
        outCtx.lineWidth = lineW;
        outCtx.strokeRect(x + lineW / 2, y + lineW / 2, w - lineW, h - lineW);
      } else {
        outCanvas = new OffscreenCanvas(w, h);
        outCtx = outCanvas.getContext('2d')!;
        outCtx.drawImage(bitmap, x, y, w, h, 0, 0, w, h);
      }

      bitmap.close();

      const outBlob = await outCanvas.convertToBlob({ type: 'image/png' });
      const outBuffer = new Uint8Array(await outBlob.arrayBuffer());
      const filename = basename(imagePath).replace(/\.[^.]+$/, '.png');
      await source.savePngBuffer(options.outputDir, filename, outBuffer, options.enablePngColorReduction);

      progress.processed++;
      callbacks.onProgress?.(progress);
    } catch (err) {
      log.error(`Failed to auto-crop ${imagePath}:`, err);
      progress.failed++;
      callbacks.onProgress?.(progress);
    }
  }

  return progress;
}
