import { computed } from 'vue'
import { configStore } from '@shared/services/configStore'
import { overrides } from '@shared/overrideRegistry'

export interface SavedSearchEntry {
  keyword: string
  mode: 'live' | 'recorded'
}

// configStore is reactive and re-broadcast after every config:setSavedSearches,
// so computeds straight off it never go stale. A registered override (demo mode)
// substitutes fabricated entries (the real config is loaded as-is and may be empty).
export const savedSearchesLive = computed<string[]>(() =>
  overrides.savedSearches ? overrides.savedSearches.live() : (configStore.savedSearchesLive ?? []))
export const savedSearchesRecorded = computed<string[]>(() =>
  overrides.savedSearches ? overrides.savedSearches.recorded() : (configStore.savedSearchesRecorded ?? []))

// Merged for the Home page: live entries first, then recorded.
export const mergedSavedSearches = computed<SavedSearchEntry[]>(() => [
  ...savedSearchesLive.value.map((keyword): SavedSearchEntry => ({ keyword, mode: 'live' })),
  ...savedSearchesRecorded.value.map((keyword): SavedSearchEntry => ({ keyword, mode: 'recorded' }))
])

export const addSavedSearch = (mode: 'live' | 'recorded', keyword: string) => {
  const kw = keyword.trim()
  const current = mode === 'live' ? savedSearchesLive.value : savedSearchesRecorded.value
  if (!kw || current.includes(kw)) return
  window.electronAPI.config.setSavedSearches(mode, [...current, kw])
}

export const removeSavedSearch = (mode: 'live' | 'recorded', keyword: string) => {
  const current = mode === 'live' ? savedSearchesLive.value : savedSearchesRecorded.value
  window.electronAPI.config.setSavedSearches(mode, current.filter(s => s !== keyword))
}
