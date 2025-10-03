/**
 * Slide Processing Web Worker
 * Handles image processing algorithms for slide extraction
 */

// Worker message types
interface WorkerMessage {
  id: string;
  type: 'compareImages' | 'calculateSSIM' | 'updateConfig';
  data: any;
}

interface WorkerResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
}

interface ImageProcessingConfig {
  ssimThreshold: number;
}

// Configuration for image comparison (can be updated via updateConfig message)
let CONFIG: ImageProcessingConfig = {
  ssimThreshold: 0.999         // SSIM similarity threshold
};

/**
 * Convert ImageData to grayscale
 */
function convertToGrayscale(imageData: ImageData): ImageData {
  const data = new Uint8ClampedArray(imageData.data);

  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    data[i] = gray;     // R
    data[i + 1] = gray; // G
    data[i + 2] = gray; // B
    // Alpha remains unchanged
  }

  return new ImageData(data, imageData.width, imageData.height);
}

/**
 * Resize ImageData to specified dimensions
 */
function resizeImageData(imageData: ImageData, newWidth: number, newHeight: number): ImageData {
  // Create off-screen canvas for resizing
  const canvas = new OffscreenCanvas(newWidth, newHeight);
  const ctx = canvas.getContext('2d')!;

  // Create temporary canvas for original image
  const tempCanvas = new OffscreenCanvas(imageData.width, imageData.height);
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(imageData, 0, 0);

  // Resize and draw
  ctx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);

  return ctx.getImageData(0, 0, newWidth, newHeight);
}


/**
 * Calculate SSIM (Structural Similarity Index)
 */
function calculateSSIM(img1Data: ImageData, img2Data: ImageData): number {
  // Convert to grayscale
  const gray1 = convertToGrayscale(img1Data);
  const gray2 = convertToGrayscale(img2Data);

  // Calculate means
  let mean1 = 0, mean2 = 0;
  const pixelCount = gray1.width * gray1.height;

  for (let i = 0; i < gray1.data.length; i += 4) {
    mean1 += gray1.data[i];
    mean2 += gray2.data[i];
  }
  mean1 /= pixelCount;
  mean2 /= pixelCount;

  // Calculate variance and covariance
  let var1 = 0, var2 = 0, covar = 0;
  for (let i = 0; i < gray1.data.length; i += 4) {
    const diff1 = gray1.data[i] - mean1;
    const diff2 = gray2.data[i] - mean2;
    var1 += diff1 * diff1;
    var2 += diff2 * diff2;
    covar += diff1 * diff2;
  }
  var1 /= pixelCount;
  var2 /= pixelCount;
  covar /= pixelCount;

  // Stability constants
  const C1 = 0.01 * 255 * 0.01 * 255;
  const C2 = 0.03 * 255 * 0.03 * 255;

  // Calculate SSIM
  const numerator = (2 * mean1 * mean2 + C1) * (2 * covar + C2);
  const denominator = (mean1 * mean1 + mean2 * mean2 + C1) * (var1 + var2 + C2);

  return numerator / denominator;
}

/**
 * Compare two images for significant changes (using SSIM-only comparison)
 */
function compareImages(img1Data: ImageData, img2Data: ImageData): boolean {
  try {
    // Check if input parameters are valid
    if (!img1Data || !img2Data) {
      console.warn('compareImages: One or both images are null/undefined');
      return false; // If there are null values, consider no change
    }

    // Use SSIM for precise comparison
    const ssim = calculateSSIM(img1Data, img2Data);
    return ssim < CONFIG.ssimThreshold;

  } catch (error) {
    console.error('Error in compareImages:', error);
    return false;
  }
}

// Message handler
self.onmessage = function(e: MessageEvent<WorkerMessage>) {
  const { id, type, data } = e.data;

  try {
    let result: any;

    switch (type) {
      case 'compareImages': {
        const { img1Data, img2Data } = data;
        result = compareImages(img1Data, img2Data);
        break;
      }

      case 'calculateSSIM': {
        const { img1, img2 } = data;
        result = calculateSSIM(img1, img2);
        break;
      }

      case 'updateConfig': {
        const { config } = data;
        CONFIG = { ...CONFIG, ...config };
        result = CONFIG;
        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    const response: WorkerResponse = {
      id,
      success: true,
      result
    };

    self.postMessage(response);

  } catch (error) {
    const response: WorkerResponse = {
      id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };

    self.postMessage(response);
  }
};

// Export for TypeScript (won't be used in worker context but helps with typing)
export {};