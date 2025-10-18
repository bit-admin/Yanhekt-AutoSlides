/**
 * Slide Processor Service
 * Main thread interface for communicating with the slide processing Web Worker
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

export class SlideProcessorService {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>();
  private requestIdCounter = 0;

  constructor() {
    this.initializeWorker();
  }

  /**
   * Initialize the Web Worker
   */
  private initializeWorker(): void {
    try {
      // Create worker from the TypeScript file
      // Vite will handle the worker compilation
      this.worker = new Worker(
        new URL('../workers/slideProcessor.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);

      console.log('Slide processor worker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize slide processor worker:', error);
    }
  }

  /**
   * Handle messages from the worker
   */
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

  /**
   * Handle worker errors
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error('Slide processor worker error:', error);

    // Reject all pending requests
    this.pendingRequests.forEach((request) => {
      request.reject(new Error('Worker error occurred'));
    });
    this.pendingRequests.clear();

    // Try to reinitialize the worker
    this.terminate();
    setTimeout(() => {
      this.initializeWorker();
    }, 1000);
  }

  /**
   * Send a message to the worker and return a promise
   */
  private sendMessage<T>(type: string, data: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = `req_${++this.requestIdCounter}`;
      this.pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject });

      const message: WorkerMessage = { id, type: type as WorkerMessage['type'], data };
      this.worker.postMessage(message);

      // Set timeout for the request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Worker request timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Compare two images for significant changes
   */
  async compareImages(img1Data: ImageData, img2Data: ImageData): Promise<boolean> {
    try {
      return await this.sendMessage<boolean>('compareImages', {
        img1Data,
        img2Data
      });
    } catch (error) {
      console.error('Error comparing images:', error);
      return false;
    }
  }


  /**
   * Calculate SSIM between two images
   */
  async calculateSSIM(img1Data: ImageData, img2Data: ImageData): Promise<number> {
    try {
      return await this.sendMessage<number>('calculateSSIM', {
        img1: img1Data,
        img2: img2Data
      });
    } catch (error) {
      console.error('Error calculating SSIM:', error);
      return 0;
    }
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // Reject all pending requests
    this.pendingRequests.forEach((request) => {
      request.reject(new Error('Worker terminated'));
    });
    this.pendingRequests.clear();
  }

  /**
   * Update worker configuration
   */
  async updateConfig(config: {
    ssimThreshold?: number;
    enableDownsampling?: boolean;
    downsampleWidth?: number;
    downsampleHeight?: number;
  }): Promise<boolean> {
    try {
      return await this.sendMessage<boolean>('updateConfig', { config });
    } catch (error) {
      console.error('Error updating worker config:', error);
      throw error;
    }
  }

  /**
   * Check if the worker is ready
   */
  isReady(): boolean {
    return this.worker !== null;
  }
}

// Create a singleton instance
export const slideProcessorService = new SlideProcessorService();