// Notes add-ons: where watch-mode notes are written. A watch note is the
// per-lecture note AutoSlides creates when a manual playback tab starts slide
// extraction, then appends each post-processing-kept slide to. Yanhekt Notes
// (the ASuser group of the account's Yanhekt cloud notes) keeps an editable note;
// Obsidian (a local Markdown vault) only ever gets slide images appended. The list
// is here so config, migration and the Settings picker agree.

export type WatchNotesProviderId = 'yanhekt' | 'obsidian'

export const WATCH_NOTES_PROVIDERS: readonly WatchNotesProviderId[] = ['yanhekt', 'obsidian']

export const DEFAULT_WATCH_NOTES_PROVIDER: WatchNotesProviderId = 'yanhekt'

/** Coerce a stored value to a known provider id (unknown or missing → default). */
export function normalizeWatchNotesProvider(value: unknown): WatchNotesProviderId {
  return WATCH_NOTES_PROVIDERS.includes(value as WatchNotesProviderId)
    ? (value as WatchNotesProviderId)
    : DEFAULT_WATCH_NOTES_PROVIDER
}

/**
 * One-time migration off the pre-add-ons `cloudWatchSyncEnabled` key, which
 * always meant "sync to Yanhekt". Returns the new keys to write, or null when
 * the legacy key is absent (nothing to migrate). Anything but a literal `true`
 * migrates as disabled.
 */
export function migrateLegacyWatchSync(
  hasLegacy: boolean,
  legacyValue: unknown
): { watchNotesEnabled: boolean; watchNotesProvider: WatchNotesProviderId } | null {
  if (!hasLegacy) return null
  return { watchNotesEnabled: legacyValue === true, watchNotesProvider: 'yanhekt' }
}
