// Thin wrapper that adapts the consolidated pHashWorkerClient to the
// WorkerHelpers / createPostProcessorWorker surface used by the pipeline.
// Ported from autoslides/src/renderer/shared/postProcessing/workerHelpers.ts
// (only the import path changed).

import { createPHashWorkerClient, type PHashWorkerClient } from '../../workers/pHashWorkerClient';

export interface WorkerHelpers {
  calculatePHash: (imageData: ImageData) => Promise<string>;
  calculateHammingDistance: (hash1: string, hash2: string) => Promise<number>;
}

export interface PostProcessorWorker {
  helpers: WorkerHelpers;
  terminate: () => void;
}

export function createPostProcessorWorker(): PostProcessorWorker {
  const client: PHashWorkerClient = createPHashWorkerClient();
  return {
    helpers: {
      calculatePHash: client.calculatePHash,
      calculateHammingDistance: client.calculateHammingDistance,
    },
    terminate: () => client.destroy(),
  };
}

// Backwards-compatible shim: the pipeline used to instantiate a raw Worker
// and feed it to createWorkerHelpers. Now both come pre-bundled.
export function createWorkerHelpers(worker: PostProcessorWorker): WorkerHelpers {
  return worker.helpers;
}
