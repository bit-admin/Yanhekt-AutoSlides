import type { DetectResult } from '../workers/autoCrop.worker';
import { bytesToImageBitmap } from '@shared/utils/imageDecode';

/**
 * Compose the developer-lab Auto Crop preview: original image, optional Canny
 * edges overlay, optional red detection box. Returns a PNG data URL.
 * Does not write to disk.
 */
export async function composeDetectionPreview(
  bitmap: ImageBitmap,
  result: DetectResult,
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.drawImage(bitmap, 0, 0);

  if (result.edgesPng && result.stripped && result.innerSize) {
    const edgesBitmap = await bytesToImageBitmap(result.edgesPng, 'image/png');
    ctx.globalAlpha = 0.5;
    ctx.drawImage(
      edgesBitmap,
      result.stripped.left,
      result.stripped.top,
      result.innerSize.width,
      result.innerSize.height,
    );
    ctx.globalAlpha = 1.0;
    edgesBitmap.close();
  }

  if (result.bbox) {
    const { x, y, w, h } = result.bbox;
    const lineW = Math.max(2, Math.round(bitmap.width / 600));
    ctx.strokeStyle = 'rgba(255, 40, 40, 1)';
    ctx.lineWidth = lineW;
    ctx.strokeRect(x + lineW / 2, y + lineW / 2, w - lineW, h - lineW);
  }

  return canvas.toDataURL('image/png');
}
