// Browser canvas crop — web stand-in for Electron sharpService.crop.
// Always encodes PNG to match slideStore / pdf-lib embedPng.

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

const MIN_CROP_SIZE = 1

/**
 * Crop `source` (PNG bytes) to `rect` (pixel coords in the source image).
 * Clamps the rect into image bounds. Rejects empty / out-of-range rects.
 */
export async function cropImageBuffer(
  source: ArrayBuffer,
  rect: CropRect,
): Promise<ArrayBuffer> {
  const blob = new Blob([source], { type: 'image/png' })
  const bitmap = await createImageBitmap(blob)

  try {
    const x = Math.max(0, Math.round(rect.x))
    const y = Math.max(0, Math.round(rect.y))
    const width = Math.min(Math.round(rect.width), bitmap.width - x)
    const height = Math.min(Math.round(rect.height), bitmap.height - y)

    if (width < MIN_CROP_SIZE || height < MIN_CROP_SIZE) {
      throw new Error(`Invalid crop rect: ${width}×${height}`)
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get 2D canvas context')

    ctx.drawImage(bitmap, x, y, width, height, 0, 0, width, height)

    const croppedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png')
    })
    if (!croppedBlob) throw new Error('Failed to encode cropped PNG')
    return await croppedBlob.arrayBuffer()
  } finally {
    bitmap.close()
  }
}

/** Natural pixel size of an image buffer. */
export async function getImageBufferSize(
  source: ArrayBuffer,
): Promise<{ width: number; height: number }> {
  const blob = new Blob([source], { type: 'image/png' })
  const bitmap = await createImageBitmap(blob)
  const size = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return size
}
