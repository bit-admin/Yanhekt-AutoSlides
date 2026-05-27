// pHash-based deduplication of newly-cropped results against the folder's
// existing slides. Owns its own PHashWorkerClient lifecycle (one client per
// invocation; destroyed in `finally`). Pure async — no Vue refs.

import { createPHashWorkerClient } from '@shared/workers/pHashWorkerClient';
import type { DedupCandidate, ResultsFolder } from './resultsTypes';

export interface ResultsDedupIO {
  getImages(folderPath: string): Promise<Array<{ name: string; path: string }>>;
  readImageBuffer(path: string): Promise<Uint8Array>;
  moveToInAppTrash(
    folderPath: string,
    filename: string,
    metadata: { reason: 'duplicate'; reasonDetails: string },
  ): Promise<unknown>;
}

export function createResultsDedupIO(): ResultsDedupIO {
  return {
    getImages: (folderPath) => window.electronAPI.pdfmaker.getImages(folderPath),
    readImageBuffer: (path) => window.electronAPI.offline.readImageBuffer(path),
    moveToInAppTrash: (folderPath, filename, metadata) =>
      window.electronAPI.slideExtraction.moveToInAppTrash(folderPath, filename, metadata),
  };
}

export interface ResultsDedupOptions {
  pHashThreshold: number;
  activeFolderPath: string | undefined;
  io: ResultsDedupIO;
}

export interface ResultsDedupResult {
  deduped: number;
  failed: number;
  /** How many entries to subtract from a caller's running `cropped` total */
  croppedDelta: number;
}

export async function runPHashDedup(
  folder: ResultsFolder,
  candidates: DedupCandidate[],
  options: ResultsDedupOptions,
): Promise<ResultsDedupResult> {
  const result: ResultsDedupResult = { deduped: 0, failed: 0, croppedDelta: 0 };
  if (candidates.length === 0) return result;

  const { calculatePHash, calculateHammingDistance, bufferToImageData, destroy } =
    createPHashWorkerClient();

  try {
    const seen: Array<{ filename: string; pHash: string }> = [];
    const candidateSet = new Set(candidates.map((c) => c.originalPath));

    // Pre-hash every existing slide in the active folder so we dedup
    // candidates against the folder, not just against each other.
    if (options.activeFolderPath) {
      try {
        const existingImages = await options.io.getImages(options.activeFolderPath);
        for (const img of existingImages) {
          if (candidateSet.has(img.path)) continue;
          try {
            const buffer = await options.io.readImageBuffer(img.path);
            const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
            const imageData = await bufferToImageData(bytes);
            const pHash = await calculatePHash(imageData);
            seen.push({ filename: img.name, pHash });
          } catch (err) {
            console.warn(`Failed to compute pHash for existing ${img.path}:`, err);
          }
        }
      } catch (err) {
        console.warn('Failed to list existing images for dedup:', err);
      }
    }

    const folderPath = options.activeFolderPath;
    for (const item of candidates) {
      try {
        const buffer = await options.io.readImageBuffer(item.originalPath);
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        const imageData = await bufferToImageData(bytes);
        const pHash = await calculatePHash(imageData);

        let duplicateOf = '';
        for (const s of seen) {
          if (!s.pHash) continue;
          const distance = await calculateHammingDistance(pHash, s.pHash);
          if (distance <= options.pHashThreshold) {
            duplicateOf = s.filename;
            break;
          }
        }

        if (duplicateOf && folderPath) {
          await options.io.moveToInAppTrash(folderPath, item.filename, {
            reason: 'duplicate',
            reasonDetails: `Duplicate of ${duplicateOf}`,
          });
          result.deduped++;
          result.croppedDelta--;
        } else {
          seen.push({ filename: item.filename, pHash });
        }
      } catch (err) {
        console.warn(`Failed to dedup ${item.filename}:`, err);
        result.failed++;
      }
    }
  } finally {
    destroy();
  }

  // Silence the unused-arg warning for `folder` — kept in the signature so the
  // caller can pass the folder it just operated on for future logging hooks.
  void folder;

  return result;
}
