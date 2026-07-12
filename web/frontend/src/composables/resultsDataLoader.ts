// Pure data-aggregation helpers for the Slides page.
// Ported from autoslides/src/renderer/features/results/resultsDataLoader.ts —
// the four IPC reads become slideStore (IndexedDB) reads, and the crop-entry
// join is dropped (no cropping on the web). No Vue refs are read or written
// here — the caller owns reactive state.

import { compareToolFolders, compareToolImages } from '../lib/toolFolders'
import {
  listFolders,
  listActiveImages,
  getTrashEntries,
  getFolderMetadata,
} from '../lib/slideStore'
import type { RemovedEntry, ResultsFolder, ResultsItem, SlideMetadata } from './resultsTypes'
import { createLogger } from '../lib/logger'
const log = createLogger('ResultsDataLoader')

export interface ResultsDataIO {
  getFolders(): Promise<Array<{ name: string; path: string; imageCount: number }>>
  getImages(folderPath: string): Promise<Array<{ name: string; path: string }>>
  getTrashEntries(): Promise<RemovedEntry[]>
  getMetadata(folderPath: string): Promise<SlideMetadata | null>
}

export function createResultsDataIO(): ResultsDataIO {
  return {
    getFolders: () => listFolders(),
    getImages: (folderPath) => listActiveImages(folderPath),
    getTrashEntries: () => getTrashEntries(),
    getMetadata: (folderPath) => getFolderMetadata(folderPath),
  }
}

export interface FolderSummariesResult {
  activeFolders: Array<{ name: string; path: string }>
  trashEntries: RemovedEntry[]
  folders: ResultsFolder[]
}

export async function loadFolderSummaries(io: ResultsDataIO): Promise<FolderSummariesResult> {
  const [activeFolderList, removedEntries] = await Promise.all([
    io.getFolders(),
    io.getTrashEntries(),
  ])

  const activeCounts = await Promise.all(
    activeFolderList.map(async (folder) => {
      let metadata = null
      let coverImageId = undefined
      try {
        metadata = await io.getMetadata(folder.path)
        const images = await io.getImages(folder.path)
        if (images && images.length > 0) {
          coverImageId = images[0].path
        }
      } catch (error) {
        log.warn(`Failed to load metadata/images for ${folder.name}:`, error)
      }
      return { folder, count: folder.imageCount, metadata, coverImageId }
    }),
  )

  const folderMap = new Map<string, ResultsFolder>()

  for (const { folder, count, metadata, coverImageId } of activeCounts) {
    folderMap.set(folder.name, {
      name: folder.name,
      path: folder.path,
      activeCount: count,
      removedCount: 0,
      metadata,
      coverImageId,
    })
  }

  for (const entry of removedEntries) {
    const existing = folderMap.get(entry.originalParentFolder)
    if (existing) {
      existing.removedCount += 1
    } else {
      folderMap.set(entry.originalParentFolder, {
        name: entry.originalParentFolder,
        activeCount: 0,
        removedCount: 1,
      })
    }
  }

  const folders = Array.from(folderMap.values()).sort((a, b) => compareToolFolders(a.name, b.name))

  return {
    activeFolders: activeFolderList.map(({ name, path }) => ({ name, path })),
    trashEntries: removedEntries,
    folders,
  }
}

export interface BuildFolderItemsContext {
  io: ResultsDataIO
  activeFolderPath: string | undefined
  trashEntries: RemovedEntry[]
}

export async function buildFolderItems(
  folder: ResultsFolder,
  ctx: BuildFolderItemsContext,
): Promise<ResultsItem[]> {
  let activeItems: ResultsItem[] = []
  if (ctx.activeFolderPath) {
    try {
      const images = await ctx.io.getImages(ctx.activeFolderPath)
      activeItems = images.map((image) => ({
        id: image.path,
        name: image.name,
        status: 'active' as const,
        imagePath: image.path,
        originalPath: image.path,
      }))
    } catch (error) {
      log.warn(`Failed to load images for ${folder.name}:`, error)
    }
  }

  const removedItems: ResultsItem[] = ctx.trashEntries
    .filter((entry) => entry.originalParentFolder === folder.name)
    .map((entry) => ({
      id: entry.id,
      name: entry.filename,
      status: 'removed' as const,
      trashPath: entry.trashPath,
      originalPath: entry.originalPath,
      reason: entry.reason,
      reasonDetails: entry.reasonDetails,
      trashedAt: entry.trashedAt,
    }))

  return [...activeItems, ...removedItems].sort((a, b) => compareToolImages(a.name, b.name))
}
