// Pure data-aggregation helpers for Results View. Wraps the four IPC reads
// (pdfmaker.getFolders, pdfmaker.getImages, trash.getEntries, crop.getEntries)
// and merges them into the folder summary + per-folder item list. No Vue refs
// are read or written here — the caller owns reactive state.

import { compareToolFolders, compareToolImages } from '@shared/utils/toolWindowFolders';
import type {
  CropEntry,
  RemovedEntry,
  ResultsFolder,
  ResultsItem,
} from './resultsTypes';

export interface ResultsDataIO {
  getFolders(): Promise<Array<{ name: string; path: string; imageCount: number }>>;
  getImages(folderPath: string): Promise<Array<{ name: string; path: string }>>;
  getTrashEntries(): Promise<RemovedEntry[]>;
  getCropEntries(): Promise<CropEntry[]>;
}

export function createResultsDataIO(): ResultsDataIO {
  return {
    getFolders: () => window.electronAPI.pdfmaker.getFolders(),
    getImages: (folderPath) => window.electronAPI.pdfmaker.getImages(folderPath),
    getTrashEntries: () => window.electronAPI.trash.getEntries() as Promise<RemovedEntry[]>,
    getCropEntries: () => window.electronAPI.crop.getEntries() as Promise<CropEntry[]>,
  };
}

export interface FolderSummariesResult {
  activeFolders: Array<{ name: string; path: string }>;
  trashEntries: RemovedEntry[];
  cropEntries: CropEntry[];
  folders: ResultsFolder[];
}

export async function loadFolderSummaries(io: ResultsDataIO): Promise<FolderSummariesResult> {
  const [activeFolderList, removedEntries, currentCropEntries] = await Promise.all([
    io.getFolders(),
    io.getTrashEntries(),
    io.getCropEntries(),
  ]);

  const activeCounts = await Promise.all(
    activeFolderList.map(async (folder) => {
      try {
        const images = await io.getImages(folder.path);
        return { folder, count: images.length };
      } catch (error) {
        console.warn(`Failed to count images for ${folder.name}:`, error);
        return { folder, count: 0 };
      }
    }),
  );

  const folderMap = new Map<string, ResultsFolder>();

  for (const { folder, count } of activeCounts) {
    folderMap.set(folder.name, {
      name: folder.name,
      path: folder.path,
      activeCount: count,
      removedCount: 0,
    });
  }

  for (const entry of removedEntries) {
    const existing = folderMap.get(entry.originalParentFolder);
    if (existing) {
      existing.removedCount += 1;
    } else {
      folderMap.set(entry.originalParentFolder, {
        name: entry.originalParentFolder,
        activeCount: 0,
        removedCount: 1,
      });
    }
  }

  const folders = Array.from(folderMap.values()).sort((a, b) => compareToolFolders(a.name, b.name));

  return {
    activeFolders: activeFolderList.map(({ name, path }) => ({ name, path })),
    trashEntries: removedEntries,
    cropEntries: currentCropEntries,
    folders,
  };
}

export interface BuildFolderItemsContext {
  io: ResultsDataIO;
  activeFolderPath: string | undefined;
  trashEntries: RemovedEntry[];
  cropEntriesByOriginalPath: Map<string, CropEntry>;
}

export async function buildFolderItems(
  folder: ResultsFolder,
  ctx: BuildFolderItemsContext,
): Promise<ResultsItem[]> {
  const cropMap = ctx.cropEntriesByOriginalPath;

  let activeItems: ResultsItem[] = [];
  if (ctx.activeFolderPath) {
    try {
      const images = await ctx.io.getImages(ctx.activeFolderPath);
      activeItems = images.map((image) => {
        const cropEntry = cropMap.get(image.path);

        return {
          id: image.path,
          name: image.name,
          status: 'active' as const,
          imagePath: image.path,
          originalPath: image.path,
          isCropped: !!cropEntry,
          isAutoCropped: cropEntry?.autoCropped ?? false,
          cropPath: cropEntry?.cropPath,
          cropRect: cropEntry?.rect,
          croppedAt: cropEntry?.croppedAt,
        };
      });
    } catch (error) {
      console.warn(`Failed to load images for ${folder.name}:`, error);
    }
  }

  const removedItems: ResultsItem[] = ctx.trashEntries
    .filter((entry) => entry.originalParentFolder === folder.name)
    .map((entry) => {
      const cropEntry = cropMap.get(entry.originalPath);

      return {
        id: entry.id,
        name: entry.filename,
        status: 'removed' as const,
        trashPath: entry.trashPath,
        originalPath: entry.originalPath,
        reason: entry.reason,
        reasonDetails: entry.reasonDetails,
        trashedAt: entry.trashedAt,
        isCropped: !!cropEntry,
        isAutoCropped: cropEntry?.autoCropped ?? false,
        cropPath: cropEntry?.cropPath,
        cropRect: cropEntry?.rect,
        croppedAt: cropEntry?.croppedAt,
      };
    });

  return [...activeItems, ...removedItems].sort((a, b) => compareToolImages(a.name, b.name));
}
