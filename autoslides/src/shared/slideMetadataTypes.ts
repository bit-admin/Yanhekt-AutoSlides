// Per-folder slide metadata. Written by the main process as `metadata.json`
// INSIDE each recorded `slides_*` folder (colocated so it travels when the
// folder is copied — unlike the root crop/trash manifests). Folder-level only:
// no per-slide records. Only recorded extractions write this file; a missing
// file means "no metadata" and all consumers degrade gracefully.
import type { AIClassifierMode } from './types';

export const SLIDE_METADATA_VERSION = 1;
export const SLIDE_METADATA_FILENAME = 'metadata.json';

// Discriminator for future kinds (live/offline). Only 'recorded' is written now.
export type SlideMetadataKind = 'recorded';

// Identifying context for a group of slides (a folder). All fields optional —
// filled best-effort from the Course/Session data available at the caller.
//
// Type normalization (version 1): the Yanhekt API delivers these inconsistently
// at runtime — `courseId` can be a JSON number while `sessionId` is a string,
// `semester` is a number from getCourseInfo but a string from the course list,
// and `week_number` is a number while `day` is a string. The writer normalizes
// before persisting, so in stored files `courseId`/`sessionId`/`semester`/
// `schoolYear` are always strings and `weekNumber`/`day` are always numbers
// (see slideMetadataClient.ts).
export interface SlideMetadataSource {
  courseId?: string;
  courseTitle?: string;
  sessionId?: string;
  sessionTitle?: string;
  instructor?: string;
  professors?: string[];
  semester?: string;
  schoolYear?: string;
  college?: string;
  classrooms?: string[];
  weekNumber?: number;
  day?: number;
}

export interface SlideExtractionMeta {
  extractor: 'builtin' | 'qt';
  ssimThreshold?: number;
  extractedAt: string;
}

// Post-processing provenance: which phases ran, not how many slides each removed.
export interface SlidePostProcessingMeta {
  ran: boolean;
  duplicateRemoval: boolean;
  exclusionList: boolean;
  aiFiltering: boolean;
  aiClassifierMode: AIClassifierMode | null;
  completedAt: string;
}

export interface SlideReviewMeta {
  // Set when a human opens the folder's image review and dwells (implicit).
  reviewed: boolean;
  reviewedAt: string | null;
  // One-way latch: a human mutated this folder (delete/restore/crop) while reviewing.
  edited: boolean;
  editedAt: string | null;
  // Current state: any slide in this folder currently has an applied crop.
  cropped: boolean;
}

export interface SlideMetadata {
  version: number;
  kind: SlideMetadataKind;
  source: SlideMetadataSource;
  extraction: SlideExtractionMeta;
  postProcessing?: SlidePostProcessingMeta;
  review: SlideReviewMeta;
  createdAt: string;
  updatedAt: string;
}
