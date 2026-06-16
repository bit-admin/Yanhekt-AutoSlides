import { computed } from 'vue'
import { configStore } from '@shared/services/configStore'
import { isDemoMode, demoSavedSearchesLive, demoSavedSearchesRecorded } from '@shared/services/demoData'

export interface SavedSearchEntry {
  keyword: string
  mode: 'live' | 'recorded'
}

// configStore is reactive and re-broadcast after every config:setSavedSearches,
// so computeds straight off it never go stale. In demo mode we substitute
// fabricated entries (the real config is loaded as-is and may be empty).
export const savedSearchesLive = computed<string[]>(() =>
  isDemoMode() ? demoSavedSearchesLive() : (configStore.savedSearchesLive ?? []))
export const savedSearchesRecorded = computed<string[]>(() =>
  isDemoMode() ? demoSavedSearchesRecorded() : (configStore.savedSearchesRecorded ?? []))

// Merged for the Home page: live entries first, then recorded.
export const mergedSavedSearches = computed<SavedSearchEntry[]>(() => [
  ...savedSearchesLive.value.map((keyword): SavedSearchEntry => ({ keyword, mode: 'live' })),
  ...savedSearchesRecorded.value.map((keyword): SavedSearchEntry => ({ keyword, mode: 'recorded' }))
])

export const addSavedSearch = (mode: 'live' | 'recorded', keyword: string) => {
  if (isDemoMode()) return // demo entries are fabricated; never persist to real config
  const kw = keyword.trim()
  const current = mode === 'live' ? savedSearchesLive.value : savedSearchesRecorded.value
  if (!kw || current.includes(kw)) return
  window.electronAPI.config.setSavedSearches(mode, [...current, kw])
}

export const removeSavedSearch = (mode: 'live' | 'recorded', keyword: string) => {
  if (isDemoMode()) return // demo entries are fabricated; never persist to real config
  const current = mode === 'live' ? savedSearchesLive.value : savedSearchesRecorded.value
  window.electronAPI.config.setSavedSearches(mode, current.filter(s => s !== keyword))
}
