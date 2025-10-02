/**
 * Slide Processing Web Worker
 * Handles image processing algorithms for slide extraction
 */

// Worker message types
interface WorkerMessage {
  id: string;
  type: 'compareImages' | 'calculateHash' | 'calculateSSIM' | 'updateConfig';
  data: any;
}

interface WorkerResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
}

interface ImageProcessingConfig {
  hammingThresholdLow: number;
  hammingThresholdUp: number;
  ssimThreshold: number;
}

// Configuration for image comparison (can be updated via updateConfig message)
let CONFIG: ImageProcessingConfig = {
  hammingThresholdLow: 0,      // Hamming distance lower bound
  hammingThresholdUp: 5,       // Hamming distance upper bound
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
 * Apply 32x32 DCT transform
 */
function applyDCT32x32(pixels: Uint8ClampedArray): number[] {
  const size = 32;
  const coeffs: number[] = [];

  for (let u = 0; u < size; u++) {
    for (let v = 0; v < size; v++) {
      let sum = 0;
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          const pixel = pixels[(y * size + x) * 4]; // Take R component (grayscale)
          sum += pixel *
                 Math.cos((2 * x + 1) * u * Math.PI / (2 * size)) *
                 Math.cos((2 * y + 1) * v * Math.PI / (2 * size));
        }
      }

      const c_u = u === 0 ? 1 / Math.sqrt(2) : 1;
      const c_v = v === 0 ? 1 / Math.sqrt(2) : 1;
      coeffs.push((1 / (size / 2)) * c_u * c_v * sum);
    }
  }

  return coeffs;
}

/**
 * Extract low frequency coefficients from 32x32 DCT result (8x8 top-left region)
 */
function extractLowFrequencyCoeffs(dctCoeffs: number[]): number[] {
  const lowFreqCoeffs: number[] = [];

  // Extract top-left 8x8 region from 32x32 DCT coefficient matrix
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      const index = u * 32 + v; // Index in 32x32 matrix
      lowFreqCoeffs.push(dctCoeffs[index]);
    }
  }

  return lowFreqCoeffs;
}

/**
 * Calculate median of array
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * Calculate perceptual hash (standard pHash method)
 */
function calculatePerceptualHash(imageData: ImageData): bigint {
  if (!imageData) {
    console.warn('calculatePerceptualHash: imageData is null');
    return 0n;
  }

  // 1. Convert to grayscale first
  const grayscale = convertToGrayscale(imageData);

  // 2. Resize to 32x32
  const resized = resizeImageData(grayscale, 32, 32);

  // 3. Apply DCT transform to 32x32 grayscale image
  const dctCoeffs = applyDCT32x32(resized.data);

  // 4. Extract top-left 8x8 low frequency region from 32x32 DCT result
  const lowFreqCoeffs = extractLowFrequencyCoeffs(dctCoeffs);

  // 5. Exclude DC component, calculate median of remaining 63 coefficients
  const acCoeffs = lowFreqCoeffs.slice(1); // Exclude DC component
  const median = calculateMedian(acCoeffs);

  // 6. Generate 63-bit hash using BigInt for precision
  let hash = 0n;
  for (let i = 0; i < acCoeffs.length; i++) {
    hash = hash * 2n + (acCoeffs[i] >= median ? 1n : 0n);
  }

  return hash;
}

/**
 * Calculate Hamming distance between two hashes
 */
function calculateHammingDistance(hash1: bigint, hash2: bigint): number {
  let xor = hash1 ^ hash2;
  let distance = 0;

  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }

  return distance;
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
 * Compare two images for significant changes (using two-level comparison: pHash + SSIM)
 */
function compareImages(img1Data: ImageData, img2Data: ImageData): boolean {
  try {
    // Check if input parameters are valid
    if (!img1Data || !img2Data) {
      console.warn('compareImages: One or both images are null/undefined');
      return false; // If there are null values, consider no change
    }

    // Level 1: Calculate perceptual hash
    const hash1 = calculatePerceptualHash(img1Data);
    const hash2 = calculatePerceptualHash(img2Data);

    // Calculate Hamming distance
    const hammingDistance = calculateHammingDistance(hash1, hash2);

    if (hammingDistance > CONFIG.hammingThresholdUp) {
      // Hash detected significant change
      return true;
    } else if (hammingDistance <= CONFIG.hammingThresholdLow) {
      // Hash completely identical
      return false;
    } else {
      // Boundary case, use SSIM for precise comparison
      const ssim = calculateSSIM(img1Data, img2Data);
      return ssim < CONFIG.ssimThreshold;
    }

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

      case 'calculateHash': {
        const { imageData } = data;
        const hash = calculatePerceptualHash(imageData);
        result = hash.toString(); // Convert BigInt to string for serialization
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