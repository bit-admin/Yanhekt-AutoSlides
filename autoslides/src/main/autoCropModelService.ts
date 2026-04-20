import { app, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

import { ConfigService } from './configService';

export interface AutoCropModelInfo {
  active: 'builtin' | 'custom';
  builtinVersion: string;
  builtinExists: boolean;
  builtinSizeBytes: number | null;
  customName: string | null;
  customExists: boolean;
  customSizeBytes: number | null;
}

const BUILTIN_MODEL_NAME = 'slide-detect-v1.onnx';
const BUILTIN_MODEL_VERSION = 'slide-detect-v1';
const CUSTOM_MODEL_FILENAME = 'custom-model.onnx';
const MAX_MODEL_BYTES = 200 * 1024 * 1024;

export class AutoCropModelService {
  private cache: { key: string; buffer: Buffer } | null = null;

  constructor(private config: ConfigService) {}

  getBuiltinModelPath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'models', BUILTIN_MODEL_NAME);
    }
    // Dev: resolve from the project root. Forge runs the main process from
    // .vite/build/, so step up to the autoslides folder where `resources/`
    // lives.
    return path.join(app.getAppPath(), 'resources', 'models', BUILTIN_MODEL_NAME);
  }

  getCustomModelPath(): string {
    return path.join(app.getPath('userData'), 'models', CUSTOM_MODEL_FILENAME);
  }

  getActiveModelPath(): string {
    const cfg = this.config.getSlideExtractionConfig();
    if (cfg.autoCropActiveModel === 'custom') {
      const customPath = this.getCustomModelPath();
      if (fs.existsSync(customPath)) return customPath;
      // Self-heal: custom file is gone, revert to builtin.
      this.config.setAutoCropActiveModel('builtin');
      this.config.setAutoCropCustomModelName(null);
    }
    return this.getBuiltinModelPath();
  }

  private statSafe(p: string): fs.Stats | null {
    try { return fs.statSync(p); } catch { return null; }
  }

  getModelInfo(): AutoCropModelInfo {
    const cfg = this.config.getSlideExtractionConfig();
    const builtinPath = this.getBuiltinModelPath();
    const customPath = this.getCustomModelPath();
    const builtinStat = this.statSafe(builtinPath);
    const customStat = this.statSafe(customPath);
    return {
      active: cfg.autoCropActiveModel,
      builtinVersion: BUILTIN_MODEL_VERSION,
      builtinExists: !!builtinStat,
      builtinSizeBytes: builtinStat ? builtinStat.size : null,
      customName: cfg.autoCropCustomModelName,
      customExists: !!customStat,
      customSizeBytes: customStat ? customStat.size : null
    };
  }

  async importCustomModel(srcPath: string): Promise<AutoCropModelInfo> {
    const ext = path.extname(srcPath).toLowerCase();
    if (ext !== '.onnx') {
      throw new Error('Only .onnx files are supported.');
    }
    const srcStat = this.statSafe(srcPath);
    if (!srcStat || !srcStat.isFile()) {
      throw new Error('Selected file does not exist.');
    }
    if (srcStat.size > MAX_MODEL_BYTES) {
      throw new Error(`Model file is too large (max ${MAX_MODEL_BYTES / 1024 / 1024} MB).`);
    }
    const destPath = this.getCustomModelPath();
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    await fs.promises.copyFile(srcPath, destPath);
    this.config.setAutoCropCustomModelName(path.basename(srcPath));
    this.config.setAutoCropActiveModel('custom');
    this.cache = null;
    return this.getModelInfo();
  }

  async deleteCustomModel(): Promise<AutoCropModelInfo> {
    const customPath = this.getCustomModelPath();
    try {
      await fs.promises.unlink(customPath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw err;
    }
    this.config.setAutoCropCustomModelName(null);
    this.config.setAutoCropActiveModel('builtin');
    this.cache = null;
    return this.getModelInfo();
  }

  async selectAndImportModel(): Promise<AutoCropModelInfo | null> {
    const result = await dialog.showOpenDialog({
      title: 'Select Custom YOLO Model',
      properties: ['openFile'],
      filters: [{ name: 'ONNX Model', extensions: ['onnx'] }]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return this.importCustomModel(result.filePaths[0]);
  }

  async readModelBuffer(): Promise<ArrayBuffer> {
    const modelPath = this.getActiveModelPath();
    const stat = this.statSafe(modelPath);
    if (!stat) {
      throw new Error(`Auto-crop model not found at ${modelPath}`);
    }
    const key = `${modelPath}|${stat.mtimeMs}|${stat.size}`;
    if (this.cache && this.cache.key === key) {
      return this.toArrayBuffer(this.cache.buffer);
    }
    const buffer = await fs.promises.readFile(modelPath);
    this.cache = { key, buffer };
    return this.toArrayBuffer(buffer);
  }

  private toArrayBuffer(buffer: Buffer): ArrayBuffer {
    // Return a fresh ArrayBuffer slice so the renderer can transfer it.
    const ab = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(ab).set(buffer);
    return ab;
  }
}
