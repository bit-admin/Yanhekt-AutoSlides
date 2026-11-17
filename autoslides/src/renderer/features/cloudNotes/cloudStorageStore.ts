import { ref, computed } from 'vue'
import { noteErrorText } from './noteErrors'
import type { NoteGroup } from '@common/notesTypes'
import {
  isManagedGroupName,
  isUserGroupName,
  MANAGED_GROUP_NAME,
  USER_GROUP_NAME,
  README_NOTE_TITLE,
} from '@common/notesTypes'
import type { CloudNotesProvider } from '@shared/overrideRegistry'
import { configStore } from '@shared/services/configStore'
import { createLatest } from '@shared/utils/latest'
import { createLogger } from '@shared/utils/logger'
import { ownedNotesApi } from './ownedNotesApi'
import { buildReadmeContent } from './readmeContent'

const log = createLogger('CloudStorage')

/** Page size / cap mirroring useCloudNotes' full-set paging. */
const FETCH_PAGE_SIZE = 500
const MAX_FETCH_PAGES = 20

export type CloudStorageStatus =
  | 'unknown'
  | 'checking'
  | 'not-signed-in'
  | 'uninitialized'
  | 'repairing'
  | 'ready'
  | 'error'

// Module-singleton cloud-storage state (same pattern as navigationStore): every
// surface that imports/publishes notes shares one view of whether the managed
// ASnote group is provisioned, instead of each useCloudNotes() instance deciding
// from its own (possibly never-loaded) group list — the bug that used to create
// a duplicate ASnote group on every Slides-page import.
//
// Semantics: the server is the authority on whether the group exists; the
// persisted per-badge flag (config.cloudStorageInitializedUsers) only encodes
// user *intent*. Flag set + group missing → the user initialized before and the
// group was deleted server-side, so refresh() auto re-provisions. Flag unset →
// never initialized: refresh() reports 'uninitialized' and import/publish stays
// gated until the user explicitly runs initialize() (Settings → Cloud, or the
// Cloud Notes page button).
const status = ref<CloudStorageStatus>('unknown')
// ASnote — the import target group.
const managedGroupId = ref<number | null>(null)
const managedGroupName = ref('')
// ASuser — the personal watch-mode capture group.
const userGroupId = ref<number | null>(null)
const userGroupName = ref('')
const lastCheckedAt = ref<number | null>(null)
const lastError = ref('')

const canUse = computed(() => status.value === 'ready')
/** Known-bad states that gate import/publish UI. 'unknown'/'checking' are NOT
 * blocked — ensureReady() re-checks at action time, so an already-initialized
 * user is never locked out while the launch check is still in flight. */
const blocked = computed(() => status.value === 'uninitialized' || status.value === 'not-signed-in')

let userBadge: string | null = null
/** Single in-flight check/provision — the actual guarantee that two surfaces
 * triggering concurrently can never double-create the managed group. Belongs
 * to the account bound when it started: `setUser` drops it, so the next
 * account's check is its own and never a join of the previous account's. */
let inFlight: Promise<CloudStorageStatus> | null = null

// Which account the state above describes. `setUser` starts a new binding;
// a check or provision keeps the one it started under (`Run`) and, once that
// is no longer current, writes nothing: no status, no group ids, no flag.
const binding = createLatest()
let boundLive = binding.begin()

/** What one check or provision works with, fixed when it starts. */
interface Run {
  badge: string | null
  /** The note calls of that account: main refuses them once another is active. */
  api: CloudNotesProvider
  live: () => boolean
}

// The provider is resolved per run, so the demo bootstrap's override lands first.
function startRun(): Run {
  return { badge: userBadge, api: ownedNotesApi(userBadge), live: boundLive }
}

function hasFlag(run: Run): boolean {
  return run.badge != null && (configStore.cloudStorageInitializedUsers ?? []).includes(run.badge)
}

/** The flag of the account the run was started for, never of whoever is signed in by now. */
async function persistFlag(run: Run, initialized: boolean): Promise<void> {
  if (!run.badge || !run.live()) return
  await window.electronAPI.config.setCloudStorageInitialized(run.badge, initialized)
}

/** Adopt whichever managed groups are present in a fresh group list. */
function adoptGroups(groups: NoteGroup[]): void {
  const note = groups.find((g) => isManagedGroupName(g.name))
  const user = groups.find((g) => isUserGroupName(g.name))
  managedGroupId.value = note?.id ?? null
  managedGroupName.value = note?.name ?? ''
  userGroupId.value = user?.id ?? null
  userGroupName.value = user?.name ?? ''
}

/** Set the account the store tracks (null on sign-out). Resets to 'unknown'. */
function setUser(badge: string | null): void {
  userBadge = badge
  boundLive = binding.begin()
  inFlight = null
  status.value = 'unknown'
  managedGroupId.value = null
  managedGroupName.value = ''
  userGroupId.value = null
  userGroupName.value = ''
  lastCheckedAt.value = null
  lastError.value = ''
}

/** Queue `task` behind any in-flight check/provision, tracking it as in-flight. */
async function withLock(task: (run: Run) => Promise<CloudStorageStatus>): Promise<CloudStorageStatus> {
  const live = boundLive
  while (inFlight) {
    try { await inFlight } catch { /* previous op's failure is its caller's problem */ }
  }
  // The account changed while this waited its turn: it is no longer wanted.
  if (!live()) return status.value
  const run = task(startRun())
  inFlight = run
  try {
    return await run
  } finally {
    // Only its own slot: after an account change the slot is the next account's.
    if (inFlight === run) inFlight = null
  }
}

function failureStatus(): CloudStorageStatus {
  return lastError.value === 'not-signed-in' ? 'not-signed-in' : 'error'
}

/** Record why a step failed, unless the run is no longer the bound account's. */
function fail(run: Run, error: string): false {
  if (run.live()) lastError.value = noteErrorText(error)
  return false
}

/** Scan the full note list (paged, capped) for the README note's title. */
async function readmeExists(run: Run): Promise<boolean | null> {
  let p = 1
  let lastPage = 1
  do {
    const res = await run.api.list({ page: p, pageSize: FETCH_PAGE_SIZE })
    if (!run.live()) return null
    if (!res.ok) {
      fail(run, res.error)
      return null
    }
    if (res.data.data.some((n) => n.title === README_NOTE_TITLE)) return true
    lastPage = Math.max(1, res.data.last_page)
    p += 1
  } while (p <= lastPage && p <= MAX_FETCH_PAGES)
  return false
}

async function ensureReadme(run: Run): Promise<boolean> {
  const exists = await readmeExists(run)
  if (exists == null) return false
  if (exists) return true
  const createRes = await run.api.create()
  if (!run.live()) return false
  if (!createRes.ok) return fail(run, createRes.error)
  const id = createRes.data
  const titleRes = await run.api.updateTitle(id, README_NOTE_TITLE)
  const contentRes = titleRes.ok ? await run.api.updateContent(id, buildReadmeContent()) : titleRes
  if (!contentRes.ok) {
    // Do not leave a blank note behind; the next check retries the README.
    // (After an account change this delete is refused like the rest: the
    // blank note stays with the account it was made for.)
    await run.api.delete(id)
    return fail(run, contentRes.error)
  }
  return run.live()
}

/**
 * Provision the managed storage: create either managed group (ASnote import
 * target, ASuser watch-mode captures) if a fresh server read shows it missing,
 * ensure the README note exists, and adopt both. groupCreate returns no id, so
 * the group list is re-fetched after any creation.
 *
 * Every step is a call of the run's account. If the account changes part-way,
 * the steps already made stay with that account (its next check finds the
 * groups by name and carries on) and the rest are not sent.
 */
async function provision(run: Run): Promise<boolean> {
  const listRes = await run.api.groupList()
  if (!run.live()) return false
  if (!listRes.ok) return fail(run, listRes.error)
  let groups = listRes.data
  const missing: string[] = []
  if (!groups.some((g) => isManagedGroupName(g.name))) missing.push(MANAGED_GROUP_NAME)
  if (!groups.some((g) => isUserGroupName(g.name))) missing.push(USER_GROUP_NAME)
  if (missing.length > 0) {
    for (const name of missing) {
      const createRes = await run.api.groupCreate(name)
      if (!run.live()) return false
      if (!createRes.ok) return fail(run, createRes.error)
    }
    const relist = await run.api.groupList()
    if (!run.live()) return false
    if (!relist.ok) return fail(run, relist.error)
    groups = relist.data
    if (!groups.some((g) => isManagedGroupName(g.name)) || !groups.some((g) => isUserGroupName(g.name))) {
      return fail(run, 'managed-group-missing')
    }
  }
  adoptGroups(groups)
  return ensureReadme(run)
}

async function doRefresh(run: Run): Promise<CloudStorageStatus> {
  status.value = 'checking'
  lastError.value = ''
  const res = await run.api.groupList()
  if (!run.live()) return status.value
  if (!res.ok) {
    // Transient failures never provision or reclassify to 'uninitialized'.
    lastError.value = noteErrorText(res.error)
    status.value = failureStatus()
    lastCheckedAt.value = Date.now()
    return status.value
  }
  const hasNote = res.data.some((g) => isManagedGroupName(g.name))
  const hasUser = res.data.some((g) => isUserGroupName(g.name))
  if (hasNote && hasUser) {
    adoptGroups(res.data)
    // Initialized on another machine / before the flag existed — self-heal it.
    if (!hasFlag(run)) void persistFlag(run, true).catch((err) => log.warn('flag self-heal failed', err))
    status.value = 'ready'
  } else if (hasFlag(run)) {
    // Initialized before but a managed group is gone (deleted server-side, or
    // ASuser predates this feature): re-provision the missing one(s).
    log.info('a managed group is missing for an initialized account — re-provisioning')
    status.value = 'repairing'
    const ok = await provision(run)
    if (!run.live()) return status.value
    status.value = ok ? 'ready' : failureStatus()
  } else {
    adoptGroups(res.data)
    status.value = 'uninitialized'
  }
  lastCheckedAt.value = Date.now()
  return status.value
}

/** Re-check against the server. Concurrent callers share the in-flight check. */
function refresh(): Promise<CloudStorageStatus> {
  if (inFlight) return inFlight
  return withLock(doRefresh)
}

/**
 * Action-time guard for import/publish: waits out any in-flight op, then runs a
 * fresh check (auto re-provisioning only in the flag-set case). Never initializes
 * a never-initialized account — callers block on 'uninitialized' with guidance.
 */
function ensureReady(): Promise<CloudStorageStatus> {
  return withLock(doRefresh)
}

/**
 * Explicit initialization (Settings → Cloud / Cloud Notes page button). The only
 * path that provisions for a never-initialized account; sets the persisted flag.
 */
async function initialize(): Promise<boolean> {
  let started: Run | null = null
  const result = await withLock(async (run) => {
    started = run
    status.value = 'repairing'
    lastError.value = ''
    const ok = await provision(run)
    if (!run.live()) return status.value
    if (ok) {
      await persistFlag(run, true).catch((err) => log.warn('persisting init flag failed', err))
      if (!run.live()) return status.value
      status.value = 'ready'
    } else {
      status.value = failureStatus()
    }
    lastCheckedAt.value = Date.now()
    return status.value
  })
  // True only for the account it was asked for: after a switch the status read
  // back here is the next account's.
  const run = started as Run | null
  return run !== null && run.live() && result === 'ready'
}

export const cloudStorageStore = {
  status,
  managedGroupId,
  managedGroupName,
  userGroupId,
  userGroupName,
  lastCheckedAt,
  lastError,
  canUse,
  blocked,
  setUser,
  refresh,
  ensureReady,
  initialize,
}
