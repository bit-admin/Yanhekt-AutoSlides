/**
 * Slide Processor Worker Helpers
 *
 * Wraps the SSIM Web Worker (workers/slideProcessor.worker.ts) with a request/
 * response promise interface. Mirrors the role of postProcessing/workerHelpers.ts
 * for the SSIM-only worker used by the extraction pipeline.
 *
 * Moved here from services/slideProcessorService.ts.
 */

interface WorkerMessage {
  id: string;
  type: 'compareImages' | 'calculateSSIM' | 'updateConfig';
  data: unknown;
}

interface WorkerResponse {
  id: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface SlideWorkerConfig {
  ssimThreshold?: number;
  enableDownsampling?: boolean;
  downsampleWidth?: number;
  downsampleHeight?: number;
}

export class SlideProcessorService {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>();
  private requestIdCounter = 0;

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker(): void {
    try {
      this.worker = new Worker(
        new URL('../workers/slideProcessor.worker.ts', import.meta.url),
        { type: 'module' },
      );

      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);

      console.log('Slide processor worker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize slide processor worker:', error);
    }
  }

  private handleWorkerMessage(event: MessageEvent<WorkerResponse>): void {
    const { id, success, result, error } = event.data;
    const request = this.pendingRequests.get(id);

    if (request) {
      this.pendingRequests.delete(id);
      if (success) {
        request.resolve(result);
      } else {
        request.reject(new Error(error || 'Worker processing failed'));
      }
    }
  }

  private handleWorkerError(error: ErrorEvent): void {
    console.error('Slide processor worker error:', error);

    this.pendingRequests.forEach(request => request.reject(new Error('Worker error occurred')));
    this.pendingRequests.clear();

    this.terminate();
    setTimeout(() => this.initializeWorker(), 1000);
  }

  private sendMessage<T>(type: WorkerMessage['type'], data: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = `req_${++this.requestIdCounter}`;
      this.pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject });

      this.worker.postMessage({ id, type, data });

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Worker request timeout'));
        }
      }, 30000);
    });
  }

  async compareImages(img1Data: ImageData, img2Data: ImageData): Promise<boolean> {
    try {
      return await this.sendMessage<boolean>('compareImages', { img1Data, img2Data });
    } catch (error) {
      console.error('Error comparing images:', error);
      return false;
    }
  }

  async calculateSSIM(img1Data: ImageData, img2Data: ImageData): Promise<number> {
    try {
      return await this.sendMessage<number>('calculateSSIM', { img1: img1Data, img2: img2Data });
    } catch (error) {
      console.error('Error calculating SSIM:', error);
      return 0;
    }
  }

  async updateConfig(config: SlideWorkerConfig): Promise<boolean> {
    try {
      return await this.sendMessage<boolean>('updateConfig', { config });
    } catch (error) {
      console.error('Error updating worker config:', error);
      throw error;
    }
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.forEach(request => request.reject(new Error('Worker terminated')));
    this.pendingRequests.clear();
  }

  isReady(): boolean {
    return this.worker !== null;
  }
}

export const slideProcessorService = new SlideProcessorService();
