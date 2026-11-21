// Results View crop pipelines. Two flavors:
//   - runResultsAutoCropPipeline: detect + crop in place (uses an injected
//     autoCropClient).
//   - runBaselineCropPipeline: apply a fixed CropRect to every target, no
//     detection. Used after "Set as Baseline Crop".
//
// Both call `io.applyCrop` (electronAPI.crop.apply) — the in-place crop path
// that preserves the trash/restore lineage.

import type { DetectConfig } from '@shared/workers/autoCrop.worker';
import type { AutoCropWorkerClient } from '@shared/autoCrop';
import { bytesToImageBitmap, decodeBufferToImageData } from '@shared/utils/imageDecode';
import type { AutoCropTarget, CropRect } from './resultsTypes';
import { createLogger } from '@shared/utils/logger';
const log = createLogger('ResultsCropPipeline');

export interface ResultsCropIO {
  restoreFromTrash(ids: string[]): Promise<{ restoredIds: string[] }>;
  readImageBuffer(path: string): Promise<Uint8Array>;
  applyCrop(path: string, rect: CropRect, autoCropped: boolean): Promise<unknown>;
}

export function createResultsCropIO(): ResultsCropIO {
  return {
    restoreFromTrash: (ids) => window.electronAPI.trash.restore(ids),
    readImageBuffer: (path) => window.electronAPI.slideExtraction.readImageBuffer(path),
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
  restoreFailed: number;
  croppedItems: CroppedItem[];
}

export interface BaselineCropPipelineResult {
  cropped: number;
  outOfBounds: number;
  failed: number;
  restoreFailed: number;
  croppedItems: CroppedItem[];
}

async function restorePending(io: ResultsCropIO, targets: AutoCropTarget[]): Promise<AutoCropTarget[]> {
  const restoreIds = targets.flatMap((target) => target.needsRestore && target.id ? [target.id] : []);
  let restored = new Set<string>();
  if (restoreIds.length > 0) {
    try {
      restored = new Set((await io.restoreFromTrash(restoreIds)).restoredIds);
    } catch (error) {
      log.error('Failed to restore slides before cropping:', error);
    }
  }
  // A failed restore may mean a different file already occupies originalPath.
  return targets.filter((target) => !target.needsRestore || (target.id != null && restored.has(target.id)));
}

async function readImageData(io: ResultsCropIO, path: string): Promise<ImageData> {
  const buffer = await io.readImageBuffer(path);
  return decodeBufferToImageData(buffer);
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
    restoreFailed: 0,
    croppedItems: [],
  };

  const ready = await restorePending(io, targets);
  result.restoreFailed = targets.length - ready.length;
  result.failed = result.restoreFailed;

  for (const target of ready) {
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
      log.error(`Failed to autocrop ${target.originalPath}:`, err);
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
    restoreFailed: 0,
    croppedItems: [],
  };

  const ready = await restorePending(io, targets);
  result.restoreFailed = targets.length - ready.length;
  result.failed = result.restoreFailed;

  for (const target of ready) {
    if (!target.originalPath) {
      result.failed++;
      continue;
    }
    try {
      const buffer = await io.readImageBuffer(target.originalPath);
      const bitmap = await bytesToImageBitmap(buffer);
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
      log.error(`Failed to apply baseline crop to ${target.originalPath}:`, err);
      result.failed++;
    }
  }

  return result;
}
