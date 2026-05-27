export type TrashReason = 'duplicate' | 'exclusion' | 'ai_filtered' | 'ai_filtered_edit' | 'manual';

export interface TrashEntry {
  id: string;
  filename: string;
  originalPath: string;
  originalParentFolder: string;
  trashPath: string;
  reason: TrashReason;
  reasonDetails?: string;
  trashedAt: string;
}

export interface TrashMetadata {
  reason: TrashReason;
  reasonDetails?: string;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropEntry {
  filename: string;
  originalPath: string;
  originalParentFolder: string;
  cropPath: string;
  rect: CropRect;
  croppedAt: string;
  autoCropped?: boolean;
}
