// Ported from autoslides/src/renderer/shared/workers/pHashWorkerClient.ts.
// Consolidated client for the postProcessor worker (pHash + Hamming-distance).
// Web addition: `blobToImageData` — IndexedDB hands back Blobs directly, so
// the Uint8Array round-trip of `bufferToImageData` is unnecessary there.

import PostProcessorWorker from './postProcessor.worker?worker';

export interface PHashWorkerClient {
  calculatePHash: (imageData: ImageData) => Promise<string>;
  calculateHammingDistance: (hash1: string, hash2: string) => Promise<number>;
  bufferToImageData: (buffer: Uint8Array) => Promise<ImageData>;
  blobToImageData: (blob: Blob) => Promise<ImageData>;
  destroy: () => void;
}

function decodeBlobToImageData(blob: Blob): Promise<ImageData> {
  return new Promise((resolve, reject) => {
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
        if (success) resolve(result as T);
        else reject(new Error(error || `${type} failed`));
      };
      worker.addEventListener('message', handler);
      worker.postMessage({ id: messageId, type, data });
    });
  };

  const calculatePHash = (imageData: ImageData) =>
    request<string>('calculatePHash', { imageData });

  const calculateHammingDistance = (hash1: string, hash2: string) =>
    request<number>('calculateHammingDistance', { hash1, hash2 });

  const bufferToImageData = (buffer: Uint8Array): Promise<ImageData> =>
    decodeBlobToImageData(new Blob([buffer as BlobPart]));

  return {
    calculatePHash,
    calculateHammingDistance,
    bufferToImageData,
    blobToImageData: decodeBlobToImageData,
    destroy: () => worker.terminate(),
  };
}
