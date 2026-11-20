export interface OnnxModelInfo {
  active: 'builtin' | 'custom';
  builtinVersion: string;
  builtinExists: boolean;
  builtinSizeBytes: number | null;
  customName: string | null;
  customExists: boolean;
  customSizeBytes: number | null;
}

export interface MlClassifierModelInfo extends OnnxModelInfo {
  builtinSource: 'bundled' | 'development' | 'downloaded' | 'missing';
  downloadedSizeBytes: number | null;
  releaseSizeBytes: number;
  canDownload: boolean;
  downloadStatus: 'idle' | 'downloading' | 'failed';
  /** 0–100 while downloadStatus is 'downloading'; null otherwise. */
  downloadPercent: number | null;
}
