/**
 * Offline Processing Service
 * Handles file operations for offline slide processing:
 * listing images, copying/converting to PNG, reading for AI, and deleting.
 */

import { promises as fs } from 'fs'
import path from 'path'
import { sharpService } from './sharpService'

const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.webp']

export class OfflineProcessingService {
  /**
   * List all image files in a folder, sorted alphabetically
   */
  async listImages(folderPath: string): Promise<string[]> {
    const entries = await fs.readdir(folderPath)
    const images = entries.filter(entry => {
      const ext = path.extname(entry).toLowerCase()
      return SUPPORTED_EXTENSIONS.includes(ext)
    })
    images.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    return images
  }

  /**
   * Copy an image to the output directory, converting to PNG.
   * Optionally applies color reduction.
   */
  async copyAndConvertImage(
    inputPath: string,
    outputDir: string,
    outputFilename: string,
    enableColorReduction: boolean
  ): Promise<void> {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true })

    const inputBuffer = await fs.readFile(inputPath)
    const sharp = sharpService.getSharp()

    let outputBuffer: Buffer
    if (sharp) {
      // Convert to PNG via Sharp
      outputBuffer = await sharp(inputBuffer).png().toBuffer()

      // Optionally apply color reduction
      if (enableColorReduction) {
        const reduced = await sharpService.reducePngColors(new Uint8Array(outputBuffer))
        if (reduced) {
          outputBuffer = Buffer.from(reduced)
        }
      }
    } else {
      // Sharp not available, write original (may not be PNG)
      outputBuffer = inputBuffer
    }

    const outputPath = path.join(outputDir, outputFilename)
    await fs.writeFile(outputPath, outputBuffer)
  }

  /**
   * Read an image and prepare it for AI classification (resize + base64)
   */
  async readImageForAI(
    filePath: string,
    targetWidth: number,
    targetHeight: number
  ): Promise<string> {
    const imageBuffer = await fs.readFile(filePath)
    return sharpService.prepareImageForAI(imageBuffer, targetWidth, targetHeight)
  }

  /**
   * Save a PNG buffer to disk, optionally applying color reduction.
   * Used by auto-crop to persist OffscreenCanvas output.
   */
  async savePngBuffer(
    outputDir: string,
    outputFilename: string,
    buffer: Uint8Array,
    enableColorReduction: boolean
  ): Promise<void> {
    await fs.mkdir(outputDir, { recursive: true })

    let finalBuffer: Buffer = Buffer.from(buffer)
    if (enableColorReduction) {
      const reduced = await sharpService.reducePngColors(buffer)
      if (reduced) {
        finalBuffer = Buffer.from(reduced)
      }
    }

    await fs.writeFile(path.join(outputDir, outputFilename), finalBuffer)
  }

  /**
   * Read raw image buffer (for pHash calculation in worker)
   */
  async readImageBuffer(filePath: string): Promise<Uint8Array> {
    const buffer = await fs.readFile(filePath)
    return new Uint8Array(buffer)
  }
}

export const offlineProcessingService = new OfflineProcessingService()
