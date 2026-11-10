// Consolidated client for the postProcessor worker (pHash + Hamming-distance).
// Replaces three near-identical copies that previously lived in
// features/results/pHashWorker.ts, features/ai/usePHashExclusion.ts, and
// shared/postProcessing/workerHelpers.ts.

import PostProcessorWorker from './postProcessor.worker?worker';
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

export function createPHashWorkerClient(): PHashWorkerClient {
  const worker = new PostProcessorWorker();

  const request = <T>(type: string, data: Record<string, unknown>): Promise<T> => {
    return new Promise((resolve, reject) => {
      const messageId = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      const handler = (event: MessageEvent) => {
        const { id, success, result, error } = event.data;
        if (id !== messageId) return;
        worker.removeEventListener('message', handler);
        success ? resolve(result as T) : reject(new Error(error || `${type} failed`));
      };
      worker.addEventListener('message', handler);
      worker.postMessage({ id: messageId, type, data });
    });
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
    destroy: () => worker.terminate(),
  };
}
