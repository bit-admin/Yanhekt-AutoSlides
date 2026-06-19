/**
 * Slide Writer
 *
 * Centralizes filename/timestamp generation and the saveSlide IPC call.
 * Live and recorded modes intentionally differ:
 *   - live    → human-readable CST timestamp
 *   - recorded → Unix-ms timestamp
 */

import type { CourseInfo, ExtractedSlide } from './types';
import { createLogger } from '@shared/utils/logger';
const log = createLogger('SlideWriter');

export interface SaveSlideOptions {
  outputPath: string | null;
  courseInfo: CourseInfo | null;
}

export interface SaveSlideResult {
  slide: ExtractedSlide;
  fileWritten: boolean;
}

export async function saveSlide(imageData: ImageData, options: SaveSlideOptions): Promise<SaveSlideResult | null> {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);

    const filename = buildFilename(options.courseInfo?.mode);
    const dataUrl = canvas.toDataURL('image/png');
    const slide: ExtractedSlide = {
      id: `slide_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      title: filename,
      timestamp: new Date().toISOString(),
      imageData,
      dataUrl,
    };

    let fileWritten = false;
    if (options.outputPath) {
      fileWritten = await writeToDisk(canvas, options.outputPath, filename);
    }

    log.debug(`Slide saved: ${filename}`);
    return { slide, fileWritten };
  } catch (error) {
    log.error('Error saving slide:', error);
    return null;
  }
}

function buildFilename(mode: CourseInfo['mode'] | undefined): string {
  if (mode === 'live') {
    const now = new Date();
    const cstTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const stamp = cstTime.toISOString().replace('T', '_').replace(/:/g, '-').split('.')[0];
    return `Slide_${stamp}`;
  }
  return `Slide_${Date.now()}`;
}

function writeToDisk(canvas: HTMLCanvasElement, outputPath: string, filename: string): Promise<boolean> {
  return new Promise(resolve => {
    try {
      canvas.toBlob(async blob => {
        if (!blob) {
          resolve(false);
          return;
        }
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const buffer = new Uint8Array(arrayBuffer);
          await (window as { electronAPI?: { slideExtraction?: { saveSlide?: (p: string, n: string, b: Uint8Array) => Promise<unknown> } } })
            .electronAPI?.slideExtraction?.saveSlide?.(outputPath, `${filename}.png`, buffer);
          log.debug(`Slide saved to file: ${outputPath}/${filename}.png`);
          resolve(true);
        } catch (fileError) {
          log.error('Failed to save slide to file:', fileError);
          resolve(false);
        }
      }, 'image/png');
    } catch (error) {
      log.error('Error converting canvas to blob:', error);
      resolve(false);
    }
  });
}
