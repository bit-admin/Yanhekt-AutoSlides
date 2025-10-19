/**
 * Post-Processing Web Worker
 * Handles post-processing tasks for slide images including pHash calculation
 */

// Worker message types
interface WorkerMessage {
  id?: string;
  type: 'calculatePHash' | 'calculateHammingDistance';
  data: any;
}

interface WorkerResponse {
  id?: string;
  success: boolean;
  result?: any;
  error?: string;
}

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
  const canvas = new OffscreenCanvas(newWidth, newHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context');

  const tempCanvas = new OffscreenCanvas(imageData.width, imageData.height);
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) throw new Error('Failed to get temporary 2D context');

  tempCtx.putImageData(imageData, 0, 0);
  ctx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);

  return ctx.getImageData(0, 0, newWidth, newHeight);
}

/**
 * Apply Discrete Cosine Transform (DCT)
 */
function applyDCT(pixels: Uint8ClampedArray, size: number): number[] {
  const coeffs: number[] = [];
  const pi_div_2s = Math.PI / (2 * size);

  for (let u = 0; u < size; u++) {
    for (let v = 0; v < size; v++) {
      let sum = 0;
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          sum += pixels[(y * size + x) * 4] * Math.cos((2 * x + 1) * u * pi_div_2s) * Math.cos((2 * y + 1) * v * pi_div_2s);
        }
      }
      const c_u = u === 0 ? 1 / Math.sqrt(2) : 1;
      const c_v = v === 0 ? 1 / Math.sqrt(2) : 1;
      coeffs.push((2 / size) * c_u * c_v * sum);
    }
  }

  return coeffs;
}

/**
 * Calculate median of an array
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Calculate 256-bit perceptual hash (pHash) for an image
 * Based on the algorithm from test-image-comparison.html
 */
function calculatePerceptualHash256(imageData: ImageData): bigint {
  const hashSideDim = 16; // 16x16 = 256 bits
  const dctSideDim = hashSideDim * 4; // 64x64 DCT (standard practice: DCT size is 4x the hash dimension)

  // Convert to grayscale
  const grayscale = convertToGrayscale(imageData);

  // Resize to DCT dimensions
  const resized = resizeImageData(grayscale, dctSideDim, dctSideDim);

  // Apply DCT
  const dctCoeffs = applyDCT(resized.data, dctSideDim);

  // Extract low-frequency coefficients (top-left hashSideDim x hashSideDim)
  const lowFreqCoeffs: number[] = [];
  for (let u = 0; u < hashSideDim; u++) {
    for (let v = 0; v < hashSideDim; v++) {
      lowFreqCoeffs.push(dctCoeffs[u * dctSideDim + v]);
    }
  }

  // Remove DC component (first coefficient)
  const acCoeffs = lowFreqCoeffs.slice(1);

  // Calculate median of AC coefficients
  const median = calculateMedian(acCoeffs);

  // Generate hash: 1 if coefficient >= median, 0 otherwise
  let hash = 0n;
  for (const coeff of acCoeffs) {
    hash = (hash << 1n) | (coeff >= median ? 1n : 0n);
  }

  return hash;
}

/**
 * Calculate pHash for a single image (main function used by renderer)
 */
function calculatePHashForImage(imageData: ImageData): string {
  const pHash = calculatePerceptualHash256(imageData);
  return pHash.toString(16).padStart(64, '0'); // 256 bits = 64 hex chars
}

/**
 * Calculate Hamming distance between two 256-bit pHash values
 * @param hash1 First pHash as hex string (64 characters)
 * @param hash2 Second pHash as hex string (64 characters)
 * @returns Hamming distance (number of different bits)
 */
function calculateHammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== 64 || hash2.length !== 64) {
    throw new Error('pHash strings must be exactly 64 characters (256 bits)');
  }

  let distance = 0;

  // Compare each hex character (4 bits at a time)
  for (let i = 0; i < 64; i++) {
    const char1 = parseInt(hash1[i], 16);
    const char2 = parseInt(hash2[i], 16);

    // XOR the 4-bit values and count set bits
    let xor = char1 ^ char2;
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }

  return distance;
}

// Message handler
self.onmessage = async function(e: MessageEvent<WorkerMessage>) {
  const { id, type, data } = e.data;

  try {
    let result: any;

    switch (type) {
      case 'calculatePHash': {
        const { imageData } = data;
        result = calculatePHashForImage(imageData);
        break;
      }

      case 'calculateHammingDistance': {
        const { hash1, hash2 } = data;
        result = calculateHammingDistance(hash1, hash2);
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