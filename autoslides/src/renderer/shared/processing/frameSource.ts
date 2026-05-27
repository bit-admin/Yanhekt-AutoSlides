/**
 * Frame Source Helpers
 *
 * Pure helpers for acquiring frames from a DOM <video> element. The pushed-frame
 * source mode (used by useWebCapture) does not call these — it feeds ImageData
 * directly to the pipeline. Both source modes share `validateImageData`.
 */

import type { SlideExtractionMode } from './types';

const FALLBACK_SELECTORS = [
  'video',
  '#videoPlayer video',
  '.video-container video',
  '[data-video] video',
];

export function buildVideoSelector(mode: SlideExtractionMode): string {
  return `[data-playback-mode="${mode}"] video`;
}

export function getVideoElement(primarySelector: string, instanceId: string): HTMLVideoElement | null {
  let video = document.querySelector(primarySelector) as HTMLVideoElement | null;
  if (video && isVideoAccessible(video)) return video;

  for (const selector of FALLBACK_SELECTORS) {
    video = document.querySelector(selector) as HTMLVideoElement | null;
    if (video && isVideoAccessible(video)) {
      console.warn(`SlideExtractor ${instanceId}: Using fallback selector ${selector}`);
      return video;
    }
  }

  return null;
}

export function isVideoAccessible(video: HTMLVideoElement | null): boolean {
  try {
    if (!video) return false;
    if (video.readyState < 2) return false;
    if (video.videoWidth < 100) return false;
    if (video.videoHeight < 100) return false;
    return true;
  } catch {
    return false;
  }
}

export function captureFrame(video: HTMLVideoElement): ImageData | null {
  try {
    if (!video || video.readyState < 1) return null;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (!validateImageData(imageData)) return null;
    return imageData;
  } catch (error) {
    console.error('Error capturing frame:', error);
    return null;
  }
}

/**
 * Validate image data — rejects empty buffers and fully-black frames.
 *
 * Samples the center region only (most likely to contain content) and bails
 * early once enough non-zero pixels have been seen.
 */
export function validateImageData(imageData: ImageData): boolean {
  if (!imageData || !imageData.data || imageData.data.length === 0) return false;
  if (imageData.width === 0 || imageData.height === 0) return false;

  let nonZeroPixels = 0;
  const centerX = Math.floor(imageData.width / 2);
  const centerY = Math.floor(imageData.height / 2);
  const sampleRadius = Math.min(50, Math.floor(Math.min(imageData.width, imageData.height) / 4));

  let sampleCount = 0;
  const maxSamples = 100;

  for (let dy = -sampleRadius; dy <= sampleRadius && sampleCount < maxSamples; dy += 10) {
    for (let dx = -sampleRadius; dx <= sampleRadius && sampleCount < maxSamples; dx += 10) {
      const x = centerX + dx;
      const y = centerY + dy;

      if (x >= 0 && x < imageData.width && y >= 0 && y < imageData.height) {
        const index = (y * imageData.width + x) * 4;
        const r = imageData.data[index];
        const g = imageData.data[index + 1];
        const b = imageData.data[index + 2];

        sampleCount++;

        if (r > 0 || g > 0 || b > 0) {
          nonZeroPixels++;
          if (nonZeroPixels > 5) break;
        }
      }
    }
  }

  return nonZeroPixels > 0;
}
