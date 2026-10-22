/**
 * Temporary: which course snapshot terms exist (built-in and imported), shared
 * by the Settings snapshot table and the Search page term picker.
 *
 * Read once on first use and again after anything that changes the folders:
 * an import, or Clear Cache / Reset All Data (which remove imported terms).
 */

import { ref } from 'vue'
import type { CourseSnapshotImportResult, CourseSnapshotTerm } from '@common/apiTypes'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('CourseSnapshotTerms')

export const snapshotTerms = ref<CourseSnapshotTerm[]>([])
export const snapshotTermsLoaded = ref(false)

let pending: Promise<void> | null = null

/** Read the term list again. Concurrent calls share one read. */
export function refreshSnapshotTerms(): Promise<void> {
  pending ??= (async () => {
    try {
      snapshotTerms.value = await window.electronAPI.api.listCourseSnapshotTerms()
    } catch (error: unknown) {
      log.warn('Failed to list course snapshot terms:', error)
    } finally {
      snapshotTermsLoaded.value = true
      pending = null
    }
  })()
  return pending
}

/** Read the term list unless it was read already. */
export function ensureSnapshotTerms(): Promise<void> {
  return snapshotTermsLoaded.value ? Promise.resolve() : refreshSnapshotTerms()
}

/** Open the file picker and import; the list is read again afterwards. Null when cancelled. */
export async function importSnapshotFiles(): Promise<CourseSnapshotImportResult | null> {
  const result = await window.electronAPI.api.importCourseSnapshot()
  if (result) await refreshSnapshotTerms()
  return result
}
