/**
 * Browser PNG-8 palette quantization (128 colors) + indexed-PNG detection.
 *
 * Electron parity for `sharpService.reducePngColors` / `isPngIndexed` /
 * `prepareImageForAI`'s indexed skip-resize branch. Web hardcodes reduction
 * on at write time (no settings toggle); AI prep skips resize when the stored
 * blob is already color-type 3.
 *
 * Uses `@pdf-lib/upng` (photopea UPNG.js) instead of Sharp — Node-only.
 * Quantizer is K-d tree, not libimagequant; contract is the same: 128 colors,
 * indexed PNG, fail-open.
 */

import UPNGImport from '@pdf-lib/upng';
import { createLogger } from './logger';

const log = createLogger('PngColorReduction');

/** Hardcoded to match Electron Sharp `colors: 128`. */
export const PNG_COLOR_REDUCTION_COLORS = 128;

type UpngNs = {
  encode: (imgs: ArrayBuffer[], w: number, h: number, cnum: number) => ArrayBuffer;
};

// Package ships `export default UPNG` (namespace object). Node ESM interop can
// double-wrap it as `{ default: UPNG }`; Vite/browser usually does not. Accept both.
const UPNG: UpngNs = (() => {
  const mod = UPNGImport as unknown as UpngNs & { default?: UpngNs };
  if (typeof mod.encode === 'function') return mod;
  if (mod.default && typeof mod.default.encode === 'function') return mod.default;
  throw new Error('@pdf-lib/upng: encode() not found on default export');
})();

/**
 * True when buffer is a PNG with IHDR color type 3 (indexed/palette).
 * Matches Electron `sharpService.isPngIndexed` (byte 25 of the file).
 */
export function isPngIndexed(bytes: Uint8Array): boolean {
  if (bytes.length < 26) return false;
  // PNG signature starts 0x89 0x50 ('P')
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return false;
  return bytes[25] === 3;
}

/**
 * Build a Blob that owns a private copy of `bytes`.
 * WebKit has been observed to leave empty/unreadable Blobs when constructed
 * from a TypedArray view over an encoder's internal buffer and then stored in
 * IndexedDB / used as `blob:` object URLs (WebKitBlobResource error 1). A
 * fresh ArrayBuffer copy avoids that.
 */
function blobFromPngBytes(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: 'image/png' });
}

/**
 * Confirm the browser can actually decode this PNG. Rejected quantizations
 * fall through to the full-color canvas path so gallery + notes still work.
 */
async function browserCanDecodePng(blob: Blob): Promise<boolean> {
  if (blob.size < 26) return false;
  try {
    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(blob);
      bmp.close();
      return true;
    }
  } catch {
    // fall through to <img> probe
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img.naturalWidth > 0 && img.naturalHeight > 0);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    img.src = url;
  });
}

/**
 * Quantize ImageData to a 128-color indexed PNG Blob.
 * Returns null on failure — caller keeps the full-color canvas PNG (fail-open).
 * Async so we can verify the browser can decode the result before accepting it.
 */
export async function reducePngColorsFromImageData(
  imageData: ImageData,
  colors: number = PNG_COLOR_REDUCTION_COLORS
): Promise<Blob | null> {
  try {
    const { width, height, data } = imageData;
    if (width <= 0 || height <= 0 || data.length < width * height * 4) {
      return null;
    }

    // Copy into a tightly-sized ArrayBuffer — ImageData.data can be a view into
    // a larger backing store, and UPNG expects a full RGBA frame buffer.
    const rgbaCopy = new Uint8Array(data.byteLength);
    rgbaCopy.set(data);

    const encoded = UPNG.encode([rgbaCopy.buffer], width, height, colors);
    if (!encoded || encoded.byteLength === 0) return null;

    const out = new Uint8Array(encoded);
    if (!isPngIndexed(out)) {
      log.warn('PNG color reduction produced a non-indexed PNG; discarding');
      return null;
    }

    const blob = blobFromPngBytes(out);
    if (!(await browserCanDecodePng(blob))) {
      log.warn(
        `PNG color reduction output not decodable by browser (${blob.size} bytes); discarding`
      );
      return null;
    }

    log.debug(
      `PNG color reduction: ${data.byteLength} RGBA bytes -> ${blob.size} PNG ` +
        `(${Math.round((1 - blob.size / Math.max(data.byteLength, 1)) * 100)}% smaller than raw RGBA)`
    );
    return blob;
  } catch (error) {
    log.warn('PNG color reduction failed, caller will keep full-color PNG:', error);
    return null;
  }
}

/** Chunked binary→base64 (avoids call-stack limits on large frames). */
export function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.length);
    binary += String.fromCharCode(...bytes.subarray(i, end));
  }
  return btoa(binary);
}
