import Store from 'electron-store';
import { dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface AppConfig {
  outputDirectory: string;
  connectionMode: 'internal' | 'external';
}

const defaultConfig: AppConfig = {
  outputDirectory: path.join(os.homedir(), 'Downloads', 'AutoSlides'),
  connectionMode: 'external'
};

export class ConfigService {
  private store: Store<AppConfig>;

  constructor() {
    this.store = new Store<AppConfig>({
      defaults: defaultConfig,
      name: 'autoslides-config'
    });

    this.ensureOutputDirectoryExists();
  }

  getConfig(): AppConfig {
    return {
      outputDirectory: this.store.get('outputDirectory'),
      connectionMode: this.store.get('connectionMode')
    };
  }

  setOutputDirectory(directory: string): void {
    this.store.set('outputDirectory', directory);
    this.ensureOutputDirectoryExists();
  }

  setConnectionMode(mode: 'internal' | 'external'): void {
    this.store.set('connectionMode', mode);
  }

  async selectOutputDirectory(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: this.store.get('outputDirectory')
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0];
      this.setOutputDirectory(selectedPath);
      return selectedPath;
    }

    return null;
  }

  private ensureOutputDirectoryExists(): void {
    const outputDir = this.store.get('outputDirectory');
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create output directory:', error);
    }
  }
}