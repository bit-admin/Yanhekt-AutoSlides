import type {
  DetectConfig,
  DetectorMode,
  WorkerResponse,
} from '../workers/autoCrop.worker';
import AutoCropWorker from '../workers/autoCrop.worker?worker';
import { createWorkerClient, WORKER_INIT_TIMEOUT_MS } from '../workers/workerClientFactory';

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
    createWorker: () => new AutoCropWorker(),
    workerName: 'autoCrop',
  });

  let ensureYoloInitPromise: Promise<void> | null = null;
  let yoloInitialized = false;
  // Bumped by a reset: a start begun before it must not mark the backend ready
  // nor clear the start that replaced it.
  let generation = 0;

  const ensureYoloReady = async (mode: DetectorMode): Promise<void> => {
    if (!modeNeedsYolo(mode)) return;
    if (yoloInitialized) return;
    if (ensureYoloInitPromise) {
      await ensureYoloInitPromise;
      return;
    }
    const mine = generation;
    const init = (async () => {
      const modelBuffer = await window.electronAPI.autoCrop.getModelBuffer();
      if (mine !== generation) throw new Error('The YOLO backend was reset while it was starting');
      const response = await client.request(
        { type: 'init', modelBuffer },
        [modelBuffer],
        { timeoutMs: WORKER_INIT_TIMEOUT_MS },
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to initialize YOLO backend');
      }
      if (mine !== generation) throw new Error('The YOLO backend was reset while it was starting');
      yoloInitialized = true;
    })();
    ensureYoloInitPromise = init;
    try {
      await init;
    } catch (err) {
      if (ensureYoloInitPromise === init) ensureYoloInitPromise = null;
      throw err;
    }
  };

  const resetYoloInit = (): void => {
    generation += 1;
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
