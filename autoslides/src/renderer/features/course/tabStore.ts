import { reactive } from 'vue'
import { configStore } from '@shared/services/configStore'
import type { Course } from './useCourseList'

// Module-singleton tab state (same pattern as navigationStore / rightPanelStore).
//
// The renderer now has one persistent **Info tab** (Home / Search / Live &
// Recorded browsing + the sessions list) plus N **playback tabs**. Clicking a
// live stream or a recording session opens a playback tab; each keeps its own
// PlaybackPage mounted (so background playback + extraction continue), and the
// task queue opens one tab per concurrent task. `activeTabId === null` means the
// Info tab is showing.
//
// Session is held loosely (`unknown`) because the canonical Session type lives in
// the video feature domain, which the course domain may not import; MainContent
// (a component, unrestricted) casts it back when binding PlaybackPage.

export type TabOrigin = 'manual' | 'task'

export interface PlaybackTab {
  id: string
  mode: 'live' | 'recorded'
  course: Course
  session: unknown | null
  streamId: string
  sessionId?: string
  title: string
  origin: TabOrigin
  taskId?: string
}

export interface OpenTabParams {
  mode: 'live' | 'recorded'
  course: Course
  session?: unknown | null
  streamId: string
  sessionId?: string
  title: string
  origin?: TabOrigin
  taskId?: string
}

interface TabState {
  tabs: PlaybackTab[]
  activeTabId: string | null // null === Info tab
}

const state = reactive<TabState>({
  tabs: [],
  activeTabId: null,
})

let nextTabId = 1
const genTabId = () => `tab_${Date.now()}_${nextTabId++}`

// Clamp mirrors the main-process config validation (1–10) so a hand-edited
// config.json value above the UI cap of 5 still behaves for power users.
const getMaxManualTabs = (): number => {
  const raw = configStore.maxManualTabs ?? 3
  return Math.max(1, Math.min(10, raw))
}

// A playback tab is identified by its session (recorded) or stream (live).
const isSameTarget = (
  tab: PlaybackTab,
  mode: 'live' | 'recorded',
  sessionId?: string,
  streamId?: string,
): boolean =>
  tab.mode === mode &&
  (mode === 'recorded' ? tab.sessionId === sessionId : tab.streamId === streamId)

export function findTab(
  mode: 'live' | 'recorded',
  sessionId?: string,
  streamId?: string,
): PlaybackTab | undefined {
  return state.tabs.find(t => isSameTarget(t, mode, sessionId, streamId))
}

export type OpenTabResult =
  | { ok: true; tab: PlaybackTab; focusedExisting: boolean }
  | { ok: false; reason: 'manual_limit' }

/**
 * Open (or focus) a playback tab. Re-opening an already-open target focuses the
 * existing tab instead of duplicating it. Manual opens are capped by
 * `maxManualTabs`; task opens are uncapped (governed by parallelTasks upstream).
 */
export function openPlaybackTab(
  params: OpenTabParams,
  opts: { activate?: boolean } = {},
): OpenTabResult {
  const activate = opts.activate ?? true
  const origin = params.origin ?? 'manual'

  const existing = findTab(params.mode, params.sessionId, params.streamId)
  if (existing) {
    if (activate) state.activeTabId = existing.id
    return { ok: true, tab: existing, focusedExisting: true }
  }

  if (origin === 'manual') {
    const manualCount = state.tabs.filter(t => t.origin === 'manual').length
    if (manualCount >= getMaxManualTabs()) {
      return { ok: false, reason: 'manual_limit' }
    }
  }

  const tab: PlaybackTab = {
    id: genTabId(),
    mode: params.mode,
    course: params.course,
    session: params.session ?? null,
    streamId: params.streamId,
    sessionId: params.sessionId,
    title: params.title,
    origin,
    taskId: params.taskId,
  }
  state.tabs.push(tab)
  if (activate) state.activeTabId = tab.id
  return { ok: true, tab, focusedExisting: false }
}

/** Close a tab; if it was active, fall back to a neighbor or the Info tab. */
export function closeTab(id: string): void {
  const idx = state.tabs.findIndex(t => t.id === id)
  if (idx === -1) return
  const wasActive = state.activeTabId === id
  state.tabs.splice(idx, 1)
  if (wasActive) {
    const neighbor = state.tabs[idx] ?? state.tabs[idx - 1] ?? null
    state.activeTabId = neighbor ? neighbor.id : null
  }
}

/** Close the playback tab opened for a given task (used on task completion). */
export function closeTabByTaskId(taskId: string): void {
  const tab = state.tabs.find(t => t.taskId === taskId)
  if (tab) closeTab(tab.id)
}

/** Activate a tab by id, or the Info tab with `null`. */
export function activateTab(id: string | null): void {
  if (id === null || state.tabs.some(t => t.id === id)) {
    state.activeTabId = id
  }
}

export const tabStore = {
  state,
  openPlaybackTab,
  closeTab,
  closeTabByTaskId,
  activateTab,
  findTab,
}
