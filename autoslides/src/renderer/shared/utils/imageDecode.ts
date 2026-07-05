/**
 * Shared image decoding helpers.
 *
 * One canonical implementation of the base64/buffer → Blob → ImageBitmap →
 * OffscreenCanvas → ImageData pipeline that was previously copy-pasted across
 * the crop editor, the ML classifier, the results crop pipelines, and the
 * auto-crop pipeline.
 */

/** Decode a base64 string into raw bytes. */
export function base64ToBytes(base64: string): Uint8Array {
  const byteStr = atob(base64);
  const len = byteStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = byteStr.charCodeAt(i);
  return bytes;
}

/**
 * Decode raw image bytes into an ImageBitmap.
 * The caller owns the bitmap and must call `bitmap.close()` when done.
 */
export async function bytesToImageBitmap(
  buffer: Uint8Array | ArrayBuffer,
  mimeType = 'image/*'
): Promise<ImageBitmap> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  // Copy into a fresh ArrayBuffer so a view over a larger/shared buffer can't
  // leak unrelated bytes into the Blob.
  const blobArrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(blobArrayBuffer).set(bytes);
  const blob = new Blob([blobArrayBuffer], { type: mimeType });
  return createImageBitmap(blob);
}

/** Rasterize an ImageBitmap into ImageData (does NOT close the bitmap). */
export function imageBitmapToImageData(bitmap: ImageBitmap): ImageData {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

/** Decode a base64-encoded image into ImageData. */
export async function decodeBase64ToImageData(base64: string): Promise<ImageData> {
  const bitmap = await bytesToImageBitmap(base64ToBytes(base64), 'image/png');
  try {
    return imageBitmapToImageData(bitmap);
  } finally {
    bitmap.close();
  }
}

/** Decode raw image bytes into ImageData. */
export async function decodeBufferToImageData(buffer: Uint8Array | ArrayBuffer): Promise<ImageData> {
  const bitmap = await bytesToImageBitmap(buffer);
  try {
    return imageBitmapToImageData(bitmap);
  } finally {
    bitmap.close();
  }
}
