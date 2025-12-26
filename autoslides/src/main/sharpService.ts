/**
 * Sharp Service
 * Handles sharp module loading for both development and packaged app environments
 */

import path from 'path';
import fs from 'fs';

// Sharp module type
type SharpStatic = typeof import('sharp');

export class SharpService {
  private sharp: SharpStatic | null = null;
  private initialized = false;

  constructor() {
    this.initializeSharp();
  }

  private initializeSharp(): void {
    try {
      // In packaged app, check extraResource first
      if (process.resourcesPath) {
        const sharpPath = path.join(process.resourcesPath, 'sharp');
        console.log('Checking sharp extraResource path:', sharpPath);

        if (fs.existsSync(sharpPath)) {
          // Set up module resolution for sharp's dependencies in extraResource
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const Module = require('module');
          const originalResolveFilename = Module._resolveFilename;
          const resourcesPath = process.resourcesPath;

          Module._resolveFilename = function(request: string, ...args: unknown[]) {
            // Handle @img packages (sharp native bindings)
            if (request.startsWith('@img/')) {
              const imgPath = path.join(resourcesPath, '@img');
              const requestPath = request.substring(5); // e.g., 'sharp-darwin-arm64' or 'sharp-darwin-arm64/sharp.node'

              // Check if this is a subpath request (e.g., '@img/sharp-darwin-arm64/sharp.node')
              const slashIndex = requestPath.indexOf('/');
              let moduleName: string;
              let subPath: string | null = null;

              if (slashIndex !== -1) {
                moduleName = requestPath.substring(0, slashIndex);
                subPath = requestPath.substring(slashIndex + 1);
              } else {
                moduleName = requestPath;
              }

              const packageDir = path.join(imgPath, moduleName);

              if (fs.existsSync(packageDir)) {
                // If a subpath is specified (e.g., 'sharp.node'), resolve via exports
                if (subPath) {
                  const pkgJsonPath = path.join(packageDir, 'package.json');
                  if (fs.existsSync(pkgJsonPath)) {
                    try {
                      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
                      // Check exports field for the subpath (e.g., './sharp.node')
                      const exportKey = './' + subPath;
                      if (pkgJson.exports && pkgJson.exports[exportKey]) {
                        const resolvedPath = path.join(packageDir, pkgJson.exports[exportKey]);
                        console.log('Resolved @img subpath via exports:', request, '->', resolvedPath);
                        return resolvedPath;
                      }
                    } catch (e) {
                      console.error('Error reading @img package.json for subpath:', e);
                    }
                  }
                  // Direct subpath resolution fallback
                  const directPath = path.join(packageDir, subPath);
                  if (fs.existsSync(directPath)) {
                    console.log('Resolved @img subpath directly:', request, '->', directPath);
                    return directPath;
                  }
                }

                // No subpath - resolve the package itself
                const pkgJsonPath = path.join(packageDir, 'package.json');
                if (fs.existsSync(pkgJsonPath)) {
                  try {
                    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
                    // Check exports field for ./sharp.node (used by @img/sharp-*)
                    if (pkgJson.exports && pkgJson.exports['./sharp.node']) {
                      const nodeFile = path.join(packageDir, pkgJson.exports['./sharp.node']);
                      console.log('Resolved @img module via exports:', request, '->', nodeFile);
                      return nodeFile;
                    }
                    // Fallback to main field
                    if (pkgJson.main) {
                      const mainPath = path.join(packageDir, pkgJson.main);
                      console.log('Resolved @img module via main:', request, '->', mainPath);
                      return mainPath;
                    }
                  } catch (e) {
                    console.error('Error reading @img package.json:', e);
                  }
                }
                // Last fallback: look for .node file directly in lib
                const libDir = path.join(packageDir, 'lib');
                if (fs.existsSync(libDir)) {
                  const files = fs.readdirSync(libDir);
                  const nodeFile = files.find((f: string) => f.endsWith('.node'));
                  if (nodeFile) {
                    const nodePath = path.join(libDir, nodeFile);
                    console.log('Resolved @img module via lib scan:', request, '->', nodePath);
                    return nodePath;
                  }
                }
                // Return package directory for packages without .node files (like libvips)
                console.log('Resolved @img module as package:', request, '->', packageDir);
                return packageDir;
              }
            }

            // Handle detect-libc dependency
            if (request === 'detect-libc') {
              const detectLibcPath = path.join(resourcesPath, 'detect-libc', 'lib', 'detect-libc.js');
              if (fs.existsSync(detectLibcPath)) {
                console.log('Resolved detect-libc:', detectLibcPath);
                return detectLibcPath;
              }
            }

            // Handle semver dependency (including subpath imports like semver/functions/coerce)
            if (request === 'semver' || request.startsWith('semver/')) {
              let semverPath: string;
              if (request === 'semver') {
                semverPath = path.join(resourcesPath, 'semver', 'index.js');
              } else {
                // Handle subpath like 'semver/functions/coerce'
                const subpath = request.substring(7); // Remove 'semver/'
                semverPath = path.join(resourcesPath, 'semver', subpath + '.js');
              }
              if (fs.existsSync(semverPath)) {
                console.log('Resolved semver:', request, '->', semverPath);
                return semverPath;
              }
            }

            return originalResolveFilename.call(this, request, ...args);
          };

          // eslint-disable-next-line @typescript-eslint/no-require-imports
          this.sharp = require(sharpPath);
          this.initialized = true;
          console.log('Sharp loaded from extraResource:', sharpPath);
          return;
        }
      }

      // Fallback to sharp npm package (development)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.sharp = require('sharp');
      this.initialized = true;
      console.log('Sharp loaded from npm package');
    } catch (error) {
      console.error('Sharp not available:', error);
      this.sharp = null;
      this.initialized = false;
    }
  }

  /**
   * Check if sharp is available
   */
  isAvailable(): boolean {
    return this.sharp !== null && this.initialized;
  }

  /**
   * Get the sharp module
   */
  getSharp(): SharpStatic | null {
    return this.sharp;
  }

  /**
   * Reduce PNG colors to 128 using palette quantization
   * @param imageBuffer Original PNG image buffer
   * @returns Optimized PNG buffer with reduced colors, or null if failed
   */
  async reducePngColors(imageBuffer: Uint8Array): Promise<Uint8Array | null> {
    if (!this.sharp) {
      console.warn('Sharp not available, skipping color reduction');
      return null;
    }

    try {
      const optimizedBuffer = await this.sharp(Buffer.from(imageBuffer))
        .png({
          palette: true,
          colors: 128,
          effort: 9,
          dither: 0
        })
        .toBuffer();

      return new Uint8Array(optimizedBuffer);
    } catch (error) {
      console.error('Sharp color reduction failed:', error);
      return null;
    }
  }

  /**
   * Resize image to specified dimensions
   * @param imageBuffer Original image buffer
   * @param width Target width
   * @param height Target height
   * @returns Resized image buffer, or null if failed
   */
  async resize(imageBuffer: Uint8Array, width: number, height: number): Promise<Uint8Array | null> {
    if (!this.sharp) {
      console.warn('Sharp not available, skipping resize');
      return null;
    }

    try {
      const resizedBuffer = await this.sharp(Buffer.from(imageBuffer))
        .resize(width, height, { fit: 'inside' })
        .toBuffer();

      return new Uint8Array(resizedBuffer);
    } catch (error) {
      console.error('Sharp resize failed:', error);
      return null;
    }
  }

  /**
   * Process image for PDF with configurable options
   * Applies resize and/or color reduction based on options
   * @param imageBuffer Original PNG image buffer
   * @param options Processing options
   * @returns Processed image buffer, or original if processing fails
   */
  async processImageForPdf(imageBuffer: Uint8Array, options: {
    colors?: number | null;  // null = keep original colors, otherwise 16/32/64/128/256
    width?: number | null;   // null = keep original width
    height?: number | null;  // null = keep original height
  }): Promise<Uint8Array> {
    if (!this.sharp) {
      console.warn('Sharp not available, returning original image');
      return imageBuffer;
    }

    try {
      let pipeline = this.sharp(Buffer.from(imageBuffer));

      // Apply resize if dimensions specified
      if (options.width && options.height) {
        pipeline = pipeline.resize(options.width, options.height, { fit: 'fill' });
      }

      // Apply color reduction if colors specified
      if (options.colors) {
        pipeline = pipeline.png({
          palette: true,
          colors: options.colors,
          effort: 9,
          dither: 0
        });
      } else {
        // Keep as PNG without palette reduction
        pipeline = pipeline.png();
      }

      const processedBuffer = await pipeline.toBuffer();
      return new Uint8Array(processedBuffer);
    } catch (error) {
      console.error('Sharp processImageForPdf failed:', error);
      return imageBuffer;
    }
  }
}

// Create singleton instance
export const sharpService = new SharpService();
