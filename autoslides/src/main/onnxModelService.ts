import { app, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface OnnxModelInfo {
  active: 'builtin' | 'custom';
  builtinVersion: string;
  builtinExists: boolean;
  builtinSizeBytes: number | null;
  customName: string | null;
  customExists: boolean;
  customSizeBytes: number | null;
}

export interface OnnxModelServiceParams {
  builtinModelName: string;
  builtinModelVersion: string;
  customModelFilename: string;
  dialogTitle: string;
  notFoundLabel: string;
  maxModelBytes?: number;
  getActiveModel: () => 'builtin' | 'custom';
  getCustomModelName: () => string | null;
  setActiveModel: (value: 'builtin' | 'custom') => void;
  setCustomModelName: (value: string | null) => void;
}

const DEFAULT_MAX_MODEL_BYTES = 200 * 1024 * 1024;

export class OnnxModelService {
  private cache: { key: string; buffer: Buffer } | null = null;
  private readonly maxModelBytes: number;

  constructor(private readonly params: OnnxModelServiceParams) {
    this.maxModelBytes = params.maxModelBytes ?? DEFAULT_MAX_MODEL_BYTES;
  }

  getBuiltinModelPath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'models', this.params.builtinModelName);
    }
    return path.join(app.getAppPath(), 'resources', 'models', this.params.builtinModelName);
  }

  getCustomModelPath(): string {
    return path.join(app.getPath('userData'), 'models', this.params.customModelFilename);
  }

  getActiveModelPath(): string {
    if (this.params.getActiveModel() === 'custom') {
      const customPath = this.getCustomModelPath();
      if (fs.existsSync(customPath)) return customPath;
      // Self-heal: custom file is gone, revert to builtin.
      this.params.setActiveModel('builtin');
      this.params.setCustomModelName(null);
    }
    return this.getBuiltinModelPath();
  }

  private statSafe(p: string): fs.Stats | null {
    try { return fs.statSync(p); } catch { return null; }
  }

  getModelInfo(): OnnxModelInfo {
    const builtinPath = this.getBuiltinModelPath();
    const customPath = this.getCustomModelPath();
    const builtinStat = this.statSafe(builtinPath);
    const customStat = this.statSafe(customPath);
    return {
      active: this.params.getActiveModel(),
      builtinVersion: this.params.builtinModelVersion,
      builtinExists: !!builtinStat,
      builtinSizeBytes: builtinStat ? builtinStat.size : null,
      customName: this.params.getCustomModelName(),
      customExists: !!customStat,
      customSizeBytes: customStat ? customStat.size : null
    };
  }

  async importCustomModel(srcPath: string): Promise<OnnxModelInfo> {
    const ext = path.extname(srcPath).toLowerCase();
    if (ext !== '.onnx') {
      throw new Error('Only .onnx files are supported.');
    }
    const srcStat = this.statSafe(srcPath);
    if (!srcStat || !srcStat.isFile()) {
      throw new Error('Selected file does not exist.');
    }
    if (srcStat.size > this.maxModelBytes) {
      throw new Error(`Model file is too large (max ${this.maxModelBytes / 1024 / 1024} MB).`);
    }
    const destPath = this.getCustomModelPath();
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    await fs.promises.copyFile(srcPath, destPath);
    this.params.setCustomModelName(path.basename(srcPath));
    this.params.setActiveModel('custom');
    this.cache = null;
    return this.getModelInfo();
  }

  async deleteCustomModel(): Promise<OnnxModelInfo> {
    const customPath = this.getCustomModelPath();
    try {
      await fs.promises.unlink(customPath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw err;
    }
    this.params.setCustomModelName(null);
    this.params.setActiveModel('builtin');
    this.cache = null;
    return this.getModelInfo();
  }

  async selectAndImportModel(): Promise<OnnxModelInfo | null> {
    const result = await dialog.showOpenDialog({
      title: this.params.dialogTitle,
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
      throw new Error(`${this.params.notFoundLabel} not found at ${modelPath}`);
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
    const ab = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(ab).set(buffer);
    return ab;
  }
}
