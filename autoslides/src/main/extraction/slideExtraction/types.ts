// Canonical trash/crop types live in @common/types. This module re-exports them so
// existing imports against ./slideExtraction/types continue to resolve.
export type {
  TrashReason,
  TrashEntry,
  TrashMetadata,
  CropRect,
  CropEntry,
} from '@common/types';
