import ElectronStore from 'electron-store';
import { dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface SlideExtractionConfig {
  // User configurable parameters
  checkInterval: number;           // Detection interval in milliseconds
  enableDoubleVerification: boolean; // Enable dual verification
  verificationCount: number;       // Number of verification attempts

  // Advanced image processing parameters
  ssimThreshold: number;           // SSIM similarity threshold
}

export interface AppConfig {
  outputDirectory: string;
  connectionMode: 'internal' | 'external';
  intranetMode?: boolean;
  intranetMappings?: any;
  maxConcurrentDownloads: number;
  muteMode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded';
  videoRetryCount: number;
  taskSpeed: number;
  slideExtraction: SlideExtractionConfig;
}

const defaultSlideExtractionConfig: SlideExtractionConfig = {
  // User configurable parameters (from UI)
  checkInterval: 2000,              // 2 seconds
  enableDoubleVerification: true,   // Enable dual verification
  verificationCount: 2,             // 2 verification attempts

  // Advanced image processing parameters
  ssimThreshold: 0.999             // SSIM similarity threshold
};

const defaultConfig: AppConfig = {
  outputDirectory: path.join(os.homedir(), 'Downloads', 'AutoSlides'),
  connectionMode: 'external',
  maxConcurrentDownloads: 5,
  muteMode: 'normal',
  videoRetryCount: 5,
  taskSpeed: 10,
  slideExtraction: defaultSlideExtractionConfig
};

export class ConfigService {
  private store: ElectronStore<AppConfig>;

  constructor() {
    this.store = new ElectronStore<AppConfig>({
      defaults: defaultConfig,
      name: 'autoslides-config'
    });

    this.ensureOutputDirectoryExists();
  }

  getConfig(): AppConfig {
    return {
      outputDirectory: (this.store as any).get('outputDirectory') as string,
      connectionMode: (this.store as any).get('connectionMode') as 'internal' | 'external',
      maxConcurrentDownloads: (this.store as any).get('maxConcurrentDownloads') as number,
      muteMode: (this.store as any).get('muteMode') as 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded',
      videoRetryCount: (this.store as any).get('videoRetryCount') as number,
      taskSpeed: (this.store as any).get('taskSpeed') as number,
      slideExtraction: (this.store as any).get('slideExtraction') as SlideExtractionConfig
    };
  }

  setOutputDirectory(directory: string): void {
    (this.store as any).set('outputDirectory', directory);
    this.ensureOutputDirectoryExists();
  }

  setConnectionMode(mode: 'internal' | 'external'): void {
    (this.store as any).set('connectionMode', mode);
  }

  setMaxConcurrentDownloads(count: number): void {
    const validCount = Math.max(1, Math.min(10, count));
    (this.store as any).set('maxConcurrentDownloads', validCount);
  }

  setMuteMode(mode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded'): void {
    (this.store as any).set('muteMode', mode);
  }

  setVideoRetryCount(count: number): void {
    const validCount = Math.max(5, Math.min(10, count));
    (this.store as any).set('videoRetryCount', validCount);
  }

  setTaskSpeed(speed: number): void {
    const validSpeed = Math.max(1, Math.min(10, speed));
    (this.store as any).set('taskSpeed', validSpeed);
  }

  // Slide extraction configuration methods
  getSlideExtractionConfig(): SlideExtractionConfig {
    return (this.store as any).get('slideExtraction') as SlideExtractionConfig;
  }

  setSlideExtractionConfig(config: Partial<SlideExtractionConfig>): void {
    const currentConfig = this.getSlideExtractionConfig();
    const updatedConfig = { ...currentConfig, ...config };
    (this.store as any).set('slideExtraction', updatedConfig);
  }

  setSlideCheckInterval(interval: number): void {
    const validInterval = Math.max(500, Math.min(10000, interval));
    this.setSlideExtractionConfig({ checkInterval: validInterval });
  }

  setSlideDoubleVerification(enabled: boolean, count?: number): void {
    const config: Partial<SlideExtractionConfig> = { enableDoubleVerification: enabled };
    if (count !== undefined) {
      config.verificationCount = Math.max(1, Math.min(5, count));
    }
    this.setSlideExtractionConfig(config);
  }

  setSlideImageProcessingParams(params: {
    ssimThreshold?: number;
  }): void {
    const config: Partial<SlideExtractionConfig> = {};

    if (params.ssimThreshold !== undefined) {
      config.ssimThreshold = Math.max(0.9, Math.min(1.0, params.ssimThreshold));
    }

    this.setSlideExtractionConfig(config);
  }

  async selectOutputDirectory(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: (this.store as any).get('outputDirectory') as string
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0];
      this.setOutputDirectory(selectedPath);
      return selectedPath;
    }

    return null;
  }

  get<K extends keyof AppConfig>(key: K, defaultValue?: AppConfig[K]): AppConfig[K] {
    return (this.store as any).get(key, defaultValue);
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    (this.store as any).set(key, value);
  }

  private ensureOutputDirectoryExists(): void {
    const outputDir = (this.store as any).get('outputDirectory') as string;
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create output directory:', error);
    }
  }
}