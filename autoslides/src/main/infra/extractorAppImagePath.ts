import * as os from 'os';
import * as path from 'path';

/**
 * Where the Extractor installer puts the Linux AppImage, and where detection
 * looks for it. One fixed name, so an update replaces the file the configured
 * path already points at. `~/Applications` is where AppImageLauncher and most
 * AppImage guides put them.
 */
export function linuxAppImageInstallPath(): string {
  return path.join(os.homedir(), 'Applications', 'AutoSlides-Extractor.AppImage');
}
