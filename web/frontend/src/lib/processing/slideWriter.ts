/**
 * Slide Writer
 * Ported from autoslides/src/renderer/shared/processing/slideWriter.ts.
 *
 * Web changes: the saveSlide IPC sink is replaced with an IndexedDB blob
 * write (`slideStore.saveSlideBlob`; `outputPath` is the folder name), and
 * `dataUrl` is an object URL for the PNG blob instead of a base64 data URL —
 * owned by the pipeline, revoked on clearSlides/destroy.
 *
 * Filename generation is unchanged and intentionally differs by mode:
 *   - live    → human-readable CST timestamp
 *   - recorded → Unix-ms timestamp
 */

import { saveSlideBlob } from '../slideStore';
import type { CourseInfo, ExtractedSlide } from './types';
import { createLogger } from '../logger';
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

    const blob = await canvasToBlob(canvas);
    if (!blob) return null;

    const filename = buildFilename(options.courseInfo?.mode);
    const slide: ExtractedSlide = {
      id: `slide_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      title: filename,
      timestamp: new Date().toISOString(),
      imageData,
      dataUrl: URL.createObjectURL(blob),
    };

    let fileWritten = false;
    if (options.outputPath) {
      fileWritten = await saveSlideBlob(options.outputPath, `${filename}.png`, blob);
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

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise(resolve => {
    try {
      canvas.toBlob(blob => resolve(blob), 'image/png');
    } catch (error) {
      log.error('Error converting canvas to blob:', error);
      resolve(null);
    }
  });
}
