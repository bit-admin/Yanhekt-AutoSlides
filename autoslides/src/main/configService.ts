import ElectronStore from 'electron-store';
import { dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface AppConfig {
  outputDirectory: string;
  connectionMode: 'internal' | 'external';
  intranetMode?: boolean;
  intranetMappings?: any;
  maxConcurrentDownloads: number;
}

const defaultConfig: AppConfig = {
  outputDirectory: path.join(os.homedir(), 'Downloads', 'AutoSlides'),
  connectionMode: 'external',
  maxConcurrentDownloads: 5
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
      maxConcurrentDownloads: (this.store as any).get('maxConcurrentDownloads') as number
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