import type {
  DetectConfig,
  DetectorMode,
  WorkerResponse,
} from '../workers/autoCrop.worker';
import { createWorkerClient } from '../workers/workerClientFactory';

export interface AutoCropWorkerClient {
  detectBbox(
    imageData: ImageData,
    debug: boolean,
    config?: Partial<DetectConfig>,
  ): Promise<WorkerResponse>;
  ensureYoloReady(mode: DetectorMode): Promise<void>;
  resetYoloInit(): void;
  destroy(): void;
}

const modeNeedsYolo = (mode: DetectorMode | undefined): boolean =>
  mode === 'yolo_only' || mode === 'canny_then_yolo';

export function createAutoCropWorkerClient(): AutoCropWorkerClient {
  const client = createWorkerClient<WorkerResponse>({
    workerUrl: new URL('../workers/autoCrop.worker.ts', import.meta.url),
    workerName: 'autoCrop',
  });

  let ensureYoloInitPromise: Promise<void> | null = null;
  let yoloInitialized = false;

  const ensureYoloReady = async (mode: DetectorMode): Promise<void> => {
    if (!modeNeedsYolo(mode)) return;
    if (yoloInitialized) return;
    if (ensureYoloInitPromise) {
      await ensureYoloInitPromise;
      return;
    }
    ensureYoloInitPromise = (async () => {
      const modelBuffer = await window.electronAPI.autoCrop.getModelBuffer();
      const response = await client.request(
        { type: 'init', modelBuffer },
        [modelBuffer],
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to initialize YOLO backend');
      }
      yoloInitialized = true;
    })();
    try {
      await ensureYoloInitPromise;
    } catch (err) {
      ensureYoloInitPromise = null;
      throw err;
    }
  };

  const resetYoloInit = (): void => {
    yoloInitialized = false;
    ensureYoloInitPromise = null;
  };

  const detectBbox = async (
    imageData: ImageData,
    debug: boolean,
    config?: Partial<DetectConfig>,
  ): Promise<WorkerResponse> => {
    if (config?.mode) {
      await ensureYoloReady(config.mode);
    }
    // config comes from the reactive configStore; its nested proxies can't be structured-cloned to the worker.
    const plainConfig = config
      ? (JSON.parse(JSON.stringify(config)) as Partial<DetectConfig>)
      : config;
    return client.request({ type: 'detect', imageData, debug, config: plainConfig });
  };

  const destroy = (): void => {
    client.destroy();
    resetYoloInit();
  };

  return { detectBbox, ensureYoloReady, resetYoloInit, destroy };
}
