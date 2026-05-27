// Results View crop pipelines. Two flavors:
//   - runResultsAutoCropPipeline: detect + crop in place (uses an injected
//     autoCropClient).
//   - runBaselineCropPipeline: apply a fixed CropRect to every target, no
//     detection. Used after "Set as Baseline Crop".
//
// Both call `io.applyCrop` (electronAPI.crop.apply) — the in-place crop path
// that preserves the trash/restore lineage. The Offline Processing pipeline
// (@shared/autoCrop) writes to a separate output dir instead and is therefore
// a different primitive.

import type { DetectConfig } from '@shared/workers/autoCrop.worker';
import type { AutoCropWorkerClient } from '@shared/autoCrop';
import type { AutoCropTarget, CropRect } from './resultsTypes';

export interface ResultsCropIO {
  restoreFromTrash(ids: string[]): Promise<unknown>;
  readImageBuffer(path: string): Promise<Uint8Array>;
  applyCrop(path: string, rect: CropRect, autoCropped: boolean): Promise<unknown>;
}

export function createResultsCropIO(): ResultsCropIO {
  return {
    restoreFromTrash: (ids) => window.electronAPI.trash.restore(ids),
    readImageBuffer: (path) => window.electronAPI.offline.readImageBuffer(path),
    applyCrop: (path, rect, autoCropped) => window.electronAPI.crop.apply(path, rect, autoCropped),
  };
}

export interface CroppedItem {
  originalPath: string;
  filename: string;
}

export interface AutoCropPipelineResult {
  cropped: number;
  noDetection: number;
  failed: number;
  croppedItems: CroppedItem[];
}

export interface BaselineCropPipelineResult {
  cropped: number;
  outOfBounds: number;
  failed: number;
  croppedItems: CroppedItem[];
}

async function restorePending(io: ResultsCropIO, targets: AutoCropTarget[]): Promise<void> {
  const restoreIds = targets.filter((t) => t.needsRestore && t.id).map((t) => t.id as string);
  if (restoreIds.length > 0) {
    await io.restoreFromTrash(restoreIds);
  }
}

async function readImageData(io: ResultsCropIO, path: string): Promise<ImageData> {
  const buffer = await io.readImageBuffer(path);
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const blobArrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(blobArrayBuffer).set(bytes);
  const blob = new Blob([blobArrayBuffer], { type: 'image/*' });
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Failed to get 2d context');
  }
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();
  return imageData;
}

export async function runResultsAutoCropPipeline(
  targets: AutoCropTarget[],
  autoCropClient: AutoCropWorkerClient,
  detectConfig: Partial<DetectConfig>,
  io: ResultsCropIO,
): Promise<AutoCropPipelineResult> {
  const result: AutoCropPipelineResult = {
    cropped: 0,
    noDetection: 0,
    failed: 0,
    croppedItems: [],
  };

  await restorePending(io, targets);

  for (const target of targets) {
    if (!target.originalPath) {
      result.failed++;
      continue;
    }
    try {
      const imageData = await readImageData(io, target.originalPath);
      const response = await autoCropClient.detectBbox(imageData, false, detectConfig);
      if (!response.success || !response.result?.bbox) {
        if (!response.success) result.failed++;
        else result.noDetection++;
        continue;
      }

      const { x, y, w, h } = response.result.bbox;
      await io.applyCrop(target.originalPath, { x, y, width: w, height: h }, true);
      result.cropped++;
      result.croppedItems.push({ originalPath: target.originalPath, filename: target.filename });
    } catch (err) {
      console.error(`Failed to autocrop ${target.originalPath}:`, err);
      result.failed++;
    }
  }

  return result;
}

export async function runBaselineCropPipeline(
  targets: AutoCropTarget[],
  baselineRect: CropRect,
  io: ResultsCropIO,
): Promise<BaselineCropPipelineResult> {
  const result: BaselineCropPipelineResult = {
    cropped: 0,
    outOfBounds: 0,
    failed: 0,
    croppedItems: [],
  };

  await restorePending(io, targets);

  for (const target of targets) {
    if (!target.originalPath) {
      result.failed++;
      continue;
    }
    try {
      const buffer = await io.readImageBuffer(target.originalPath);
      const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      const blobArrayBuffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(blobArrayBuffer).set(bytes);
      const blob = new Blob([blobArrayBuffer], { type: 'image/*' });
      const bitmap = await createImageBitmap(blob);
      const width = bitmap.width;
      const height = bitmap.height;
      bitmap.close();

      if (
        baselineRect.x < 0 ||
        baselineRect.y < 0 ||
        baselineRect.width <= 0 ||
        baselineRect.height <= 0 ||
        baselineRect.x + baselineRect.width > width ||
        baselineRect.y + baselineRect.height > height
      ) {
        result.outOfBounds++;
        continue;
      }

      await io.applyCrop(
        target.originalPath,
        {
          x: baselineRect.x,
          y: baselineRect.y,
          width: baselineRect.width,
          height: baselineRect.height,
        },
        false,
      );
      result.cropped++;
      result.croppedItems.push({ originalPath: target.originalPath, filename: target.filename });
    } catch (err) {
      console.error(`Failed to apply baseline crop to ${target.originalPath}:`, err);
      result.failed++;
    }
  }

  return result;
}
