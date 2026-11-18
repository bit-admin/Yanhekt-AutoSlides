// Consolidated client for the postProcessor worker (pHash + Hamming-distance).
// Replaces three near-identical copies that previously lived in
// features/results/pHashWorker.ts, features/ai/usePHashExclusion.ts, and
// shared/postProcessing/workerHelpers.ts.

import PostProcessorWorker from './postProcessor.worker?worker';
import { createWorkerClient, type WorkerResponseBase } from './workerClientFactory';
import type { GrayImage, SSIMPrepareOptions } from './postProcessor.worker';

export type { GrayImage, SSIMPrepareOptions };

export interface PHashWorkerClient {
  calculatePHash: (imageData: ImageData) => Promise<string>;
  calculateHammingDistance: (hash1: string, hash2: string) => Promise<number>;
  prepareForSSIM: (imageData: ImageData, options: SSIMPrepareOptions) => Promise<GrayImage>;
  ssimFromGray: (a: GrayImage, b: GrayImage) => Promise<number>;
  bufferToImageData: (buffer: Uint8Array) => Promise<ImageData>;
  destroy: () => void;
}

interface PHashResponse extends WorkerResponseBase {
  result?: unknown;
}

export function createPHashWorkerClient(): PHashWorkerClient {
  // Every request ends (see `workerRequests.ts`): a crashed or stopped worker
  // rejects what was waiting on it instead of leaving it pending.
  const client = createWorkerClient<PHashResponse>({
    createWorker: () => new PostProcessorWorker(),
    workerName: 'postProcessor',
    // Hashes are requested in bulk (a whole folder at once): no per-request limit.
    timeoutMs: null,
  });

  const request = async <T>(type: string, data: Record<string, unknown>): Promise<T> => {
    const response = await client.request({ type, data });
    if (!response.success) throw new Error(response.error || `${type} failed`);
    return response.result as T;
  };

  const calculatePHash = (imageData: ImageData) =>
    request<string>('calculatePHash', { imageData });

  const calculateHammingDistance = (hash1: string, hash2: string) =>
    request<number>('calculateHammingDistance', { hash1, hash2 });

  const prepareForSSIM = (imageData: ImageData, options: SSIMPrepareOptions) =>
    request<GrayImage>('prepareForSSIM', { imageData, options });

  const ssimFromGray = (a: GrayImage, b: GrayImage) =>
    request<number>('ssimFromGray', { a, b });

  const bufferToImageData = (buffer: Uint8Array): Promise<ImageData> => {
    return new Promise((resolve, reject) => {
      const blob = new Blob([buffer as BlobPart]);
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        URL.revokeObjectURL(url);
        resolve(imageData);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      img.src = url;
    });
  };

  return {
    calculatePHash,
    calculateHammingDistance,
    prepareForSSIM,
    ssimFromGray,
    bufferToImageData,
    destroy: () => client.destroy(),
  };
}
