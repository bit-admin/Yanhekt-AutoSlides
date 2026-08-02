/**
 * Self-contained image comparison algorithms for the lab Image Comparison page.
 * Ported from the former root test-image-comparison.html — intentionally independent
 * of the production extraction / post-processing pipeline.
 */

export type SsimMap = { width: number; height: number; data?: Float32Array | number[] };

export type StandardSsimResult = {
  mssim: number;
  ssim_map?: SsimMap;
};

declare global {
  interface Window {
    ssim?: {
      default: (a: ImageData, b: ImageData) => StandardSsimResult;
    };
  }
}

const SSIM_CDN = "https://unpkg.com/ssim.js/dist/ssim.web.js";
const SSIM_SCRIPT_ID = "lab-ssim-js-cdn";

/** Load ssim.js from CDN once; resolves when window.ssim is available. */
export function ensureSsimLoaded(): Promise<void> {
  if (typeof window.ssim?.default === "function") {
    return Promise.resolve();
  }

  const existing = document.getElementById(SSIM_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      if (typeof window.ssim?.default === "function") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => {
        if (typeof window.ssim?.default === "function") resolve();
        else reject(new Error("ssim.js loaded but ssim.default is missing"));
      });
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load ssim.js from CDN")),
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SSIM_SCRIPT_ID;
    script.src = SSIM_CDN;
    script.async = true;
    script.onload = () => {
      if (typeof window.ssim?.default === "function") resolve();
      else reject(new Error("ssim.js loaded but ssim.default is missing"));
    };
    script.onerror = () => reject(new Error("Failed to load ssim.js from CDN"));
    document.head.appendChild(script);
  });
}

export function convertToGrayscale(imageData: ImageData): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
  return new ImageData(data, imageData.width, imageData.height);
}

export function resizeImageData(
  imageData: ImageData,
  newWidth: number,
  newHeight: number,
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas context unavailable");

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = imageData.width;
  tempCanvas.height = imageData.height;
  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) throw new Error("2d canvas context unavailable");
  tempCtx.putImageData(imageData, 0, 0);
  ctx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);
  return ctx.getImageData(0, 0, newWidth, newHeight);
}

/** Global (single-window) SSIM — same formula as the old HTML tool. */
export function calculateGlobalSSIM(img1Data: ImageData, img2Data: ImageData): number {
  const gray1 = convertToGrayscale(img1Data);
  const gray2 = convertToGrayscale(img2Data);
  let m1 = 0;
  let m2 = 0;
  const pc = gray1.width * gray1.height;
  for (let i = 0; i < gray1.data.length; i += 4) {
    m1 += gray1.data[i];
    m2 += gray2.data[i];
  }
  m1 /= pc;
  m2 /= pc;
  let v1 = 0;
  let v2 = 0;
  let cov = 0;
  for (let i = 0; i < gray1.data.length; i += 4) {
    const d1 = gray1.data[i] - m1;
    const d2 = gray2.data[i] - m2;
    v1 += d1 * d1;
    v2 += d2 * d2;
    cov += d1 * d2;
  }
  v1 /= pc;
  v2 /= pc;
  cov /= pc;
  const C1 = 6.5025;
  const C2 = 58.5225;
  const num = (2 * m1 * m2 + C1) * (2 * cov + C2);
  const den = (m1 * m1 + m2 * m2 + C1) * (v1 + v2 + C2);
  return num / den;
}

/** Windowed SSIM via CDN ssim.js (`window.ssim.default`). */
export function calculateStandardSSIM(
  img1Data: ImageData,
  img2Data: ImageData,
): StandardSsimResult {
  const ssim = window.ssim;
  if (typeof ssim?.default !== "function") {
    throw new Error(
      "ssim.js library not loaded correctly. Please check your internet connection and refresh.",
    );
  }
  let b = img2Data;
  if (img1Data.width !== img2Data.width || img1Data.height !== img2Data.height) {
    b = resizeImageData(img2Data, img1Data.width, img1Data.height);
  }
  return ssim.default(img1Data, b);
}

function applyDCT(pixels: Uint8ClampedArray, size: number): number[] {
  const coeffs: number[] = [];
  const piDiv2s = Math.PI / (2 * size);
  for (let u = 0; u < size; u++) {
    for (let v = 0; v < size; v++) {
      let sum = 0;
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          sum +=
            pixels[(y * size + x) * 4] *
            Math.cos((2 * x + 1) * u * piDiv2s) *
            Math.cos((2 * y + 1) * v * piDiv2s);
        }
      }
      const cU = u === 0 ? 1 / Math.sqrt(2) : 1;
      const cV = v === 0 ? 1 / Math.sqrt(2) : 1;
      coeffs.push((2 / size) * cU * cV * sum);
    }
  }
  return coeffs;
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** DCT-based perceptual hash; `hashSideDim` 8/16/32 → 64/256/1024 bits. */
export function calculateStandardPerceptualHash(
  imageData: ImageData,
  hashSideDim: number,
): bigint {
  const dctSideDim = hashSideDim * 4;
  const grayscale = convertToGrayscale(imageData);
  const resized = resizeImageData(grayscale, dctSideDim, dctSideDim);
  const dctCoeffs = applyDCT(resized.data, dctSideDim);
  const lowFreqCoeffs: number[] = [];
  for (let u = 0; u < hashSideDim; u++) {
    for (let v = 0; v < hashSideDim; v++) {
      lowFreqCoeffs.push(dctCoeffs[u * dctSideDim + v]);
    }
  }
  const acCoeffs = lowFreqCoeffs.slice(1);
  const median = calculateMedian(acCoeffs);
  let hash = 0n;
  for (const coeff of acCoeffs) {
    hash = (hash << 1n) | (coeff >= median ? 1n : 0n);
  }
  return hash;
}

export function calculateHammingDistance(hash1: bigint, hash2: bigint): number {
  let xor = hash1 ^ hash2;
  let distance = 0;
  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }
  return distance;
}

export function calculateVarianceOfLaplacian(imageData: ImageData): number {
  const grayscale = convertToGrayscale(imageData);
  const width = grayscale.width;
  const height = grayscale.height;
  const data = grayscale.data;
  const laplacianValues: number[] = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const center = (y * width + x) * 4;
      const top = ((y - 1) * width + x) * 4;
      const bottom = ((y + 1) * width + x) * 4;
      const left = (y * width + (x - 1)) * 4;
      const right = (y * width + (x + 1)) * 4;
      const laplacian =
        4 * data[center] - data[top] - data[bottom] - data[left] - data[right];
      laplacianValues.push(laplacian);
    }
  }

  if (laplacianValues.length === 0) return 0;
  const mean =
    laplacianValues.reduce((sum, val) => sum + val, 0) / laplacianValues.length;
  const variance =
    laplacianValues.reduce((sum, val) => sum + (val - mean) ** 2, 0) /
    laplacianValues.length;
  return variance;
}

export function calculateGrayscaleHistogramEntropy(imageData: ImageData): number {
  const grayscale = convertToGrayscale(imageData);
  const data = grayscale.data;
  const histogram = new Array(256).fill(0);
  const totalPixels = grayscale.width * grayscale.height;

  for (let i = 0; i < data.length; i += 4) {
    const grayValue = Math.round(data[i]);
    histogram[grayValue]++;
  }

  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (histogram[i] > 0) {
      const probability = histogram[i] / totalPixels;
      entropy -= probability * Math.log2(probability);
    }
  }
  return entropy;
}

export function calculateHighPassNoiseLevel(imageData: ImageData): number {
  const grayscale = convertToGrayscale(imageData);
  const width = grayscale.width;
  const height = grayscale.height;
  const data = grayscale.data;
  const highPassValues: number[] = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const center = (y * width + x) * 4;
      const neighbors = [
        ((y - 1) * width + (x - 1)) * 4,
        ((y - 1) * width + x) * 4,
        ((y - 1) * width + (x + 1)) * 4,
        (y * width + (x - 1)) * 4,
        (y * width + (x + 1)) * 4,
        ((y + 1) * width + (x - 1)) * 4,
        ((y + 1) * width + x) * 4,
        ((y + 1) * width + (x + 1)) * 4,
      ];
      let neighborSum = 0;
      for (const neighborIdx of neighbors) {
        neighborSum += data[neighborIdx];
      }
      highPassValues.push(Math.abs(8 * data[center] - neighborSum));
    }
  }

  if (highPassValues.length === 0) return 0;
  const mean =
    highPassValues.reduce((sum, val) => sum + val, 0) / highPassValues.length;
  const variance =
    highPassValues.reduce((sum, val) => sum + (val - mean) ** 2, 0) /
    highPassValues.length;
  const stdDev = Math.sqrt(variance);
  return mean + stdDev * 0.5;
}

export function loadImageAsImageData(img: HTMLImageElement): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const processImage = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("2d canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    if (img.complete && img.naturalWidth > 0) processImage();
    else {
      img.onload = processImage;
      img.onerror = () => reject(new Error("Failed to load image"));
    }
  });
}
