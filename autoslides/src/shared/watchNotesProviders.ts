// Desktop watch notes append kept slides to an Obsidian vault or a Notion page.
export const WATCH_NOTES_PROVIDERS = ['obsidian', 'notion'] as const
export type WatchNotesProviderId = typeof WATCH_NOTES_PROVIDERS[number]
export const DEFAULT_WATCH_NOTES_PROVIDER: WatchNotesProviderId = 'obsidian'

export function isWatchNotesProvider(value: unknown): value is WatchNotesProviderId {
  return WATCH_NOTES_PROVIDERS.some((provider) => provider === value)
}

export function normalizeWatchNotesProvider(value: unknown): WatchNotesProviderId {
  return isWatchNotesProvider(value) ? value : DEFAULT_WATCH_NOTES_PROVIDER
}
