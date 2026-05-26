import { FileDownloadService, DownloadProgress } from './fileDownloadService';

export interface ExtractorAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface ExtractorReleaseInfo {
  tag_name: string;
  name: string;
  body: string;
  body_html?: string;
  html_url: string;
  published_at: string;
  assets: ExtractorAsset[];
}

export type ExtractorDownloadProgress = DownloadProgress;

const EXTRACTOR_PATTERNS = {
  win32:  /^AutoSlides\.Extractor-[\d.]+-Windows-x64-Setup\.exe$/i,
  darwin: /^AutoSlides\.Extractor-[\d.]+-macOS-arm64\.dmg$/i,
};

const VERSION_PATTERN = /[\d]+\.[\d]+\.[\d]+/;

export const EXTRACTOR_REPO_URL = 'https://github.com/bit-admin/AutoSlides-Extractor';

export class ExtractorInstallerService extends FileDownloadService {
  constructor() {
    super({ userAgent: 'AutoSlides-ExtractorInstaller' });
  }

  getAssetsForPlatform(assets: ExtractorAsset[]): ExtractorAsset[] {
    const platform = process.platform;
    const result: ExtractorAsset[] = [];
    for (const asset of assets) {
      if (platform === 'win32' && EXTRACTOR_PATTERNS.win32.test(asset.name)) {
        result.push(asset);
      } else if (platform === 'darwin' && EXTRACTOR_PATTERNS.darwin.test(asset.name)) {
        result.push(asset);
      }
    }
    return result;
  }

  async downloadInstaller(
    url: string,
    filename: string,
    progressCallback: (progress: ExtractorDownloadProgress) => void
  ): Promise<string> {
    return this.downloadFile(url, filename, progressCallback);
  }

  async installInstaller(filename: string): Promise<string> {
    return this.installFile(filename, 'Installer');
  }

  static getRepoUrl(): string {
    return EXTRACTOR_REPO_URL;
  }

  static parseVersionFromFilename(filename: string): string | null {
    const match = filename.match(VERSION_PATTERN);
    return match ? match[0] : null;
  }
}

export const extractorInstallerService = new ExtractorInstallerService();
