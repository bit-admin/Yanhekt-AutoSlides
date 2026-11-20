// Desktop watch notes append kept slides to an Obsidian vault or a Notion page.
export const WATCH_NOTES_PROVIDERS = ['obsidian', 'notion'] as const
export type WatchNotesProviderId = typeof WATCH_NOTES_PROVIDERS[number]

// The Notes Provider setting: a provider, or Off (no provider), the default
// since 2026-11-21 so a new install needs no Obsidian or Notion setup. The
// Enable Watch Notes switch is separate and unchanged.
export const WATCH_NOTES_CHOICES = ['off', ...WATCH_NOTES_PROVIDERS] as const
export type WatchNotesChoice = typeof WATCH_NOTES_CHOICES[number]
export const DEFAULT_WATCH_NOTES_PROVIDER: WatchNotesChoice = 'off'

export function isWatchNotesProvider(value: unknown): value is WatchNotesProviderId {
  return WATCH_NOTES_PROVIDERS.some((provider) => provider === value)
}

export function isWatchNotesChoice(value: unknown): value is WatchNotesChoice {
  return WATCH_NOTES_CHOICES.some((choice) => choice === value)
}

/** A stored value as a choice: anything unknown (the retired `yanhekt`) is Off. */
export function normalizeWatchNotesProvider(value: unknown): WatchNotesChoice {
  return isWatchNotesChoice(value) ? value : DEFAULT_WATCH_NOTES_PROVIDER
}
