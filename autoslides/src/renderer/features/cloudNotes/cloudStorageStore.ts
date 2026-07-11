import { ref, computed } from 'vue'
import type { NoteGroup } from '@common/notesTypes'
import {
  isManagedGroupName,
  isUserGroupName,
  MANAGED_GROUP_NAME,
  USER_GROUP_NAME,
  README_NOTE_TITLE,
} from '@common/notesTypes'
import { overrides } from '@shared/overrideRegistry'
import type { CloudNotesProvider } from '@shared/overrideRegistry'
import { configStore } from '@shared/services/configStore'
import { createLogger } from '@shared/utils/logger'
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
 * triggering concurrently can never double-create the managed group. */
let inFlight: Promise<CloudStorageStatus> | null = null

// Resolved lazily per call so the demo bootstrap's override lands first.
function api(): CloudNotesProvider {
  return overrides.cloudNotesProvider ?? window.electronAPI.cloudNotes
}

function hasFlag(): boolean {
  return userBadge != null && (configStore.cloudStorageInitializedUsers ?? []).includes(userBadge)
}

async function persistFlag(initialized: boolean): Promise<void> {
  if (!userBadge) return
  await window.electronAPI.config.setCloudStorageInitialized(userBadge, initialized)
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
  status.value = 'unknown'
  managedGroupId.value = null
  managedGroupName.value = ''
  userGroupId.value = null
  userGroupName.value = ''
  lastCheckedAt.value = null
  lastError.value = ''
}

/** Queue `task` behind any in-flight check/provision, tracking it as in-flight. */
async function withLock(task: () => Promise<CloudStorageStatus>): Promise<CloudStorageStatus> {
  while (inFlight) {
    try { await inFlight } catch { /* previous op's failure is its caller's problem */ }
  }
  const run = task()
  inFlight = run
  try {
    return await run
  } finally {
    inFlight = null
  }
}

function failureStatus(): CloudStorageStatus {
  return lastError.value === 'not-signed-in' ? 'not-signed-in' : 'error'
}

/** Scan the full note list (paged, capped) for the README note's title. */
async function readmeExists(): Promise<boolean | null> {
  let p = 1
  let lastPage = 1
  do {
    const res = await api().list({ page: p, pageSize: FETCH_PAGE_SIZE })
    if (!res.ok) {
      lastError.value = res.error
      return null
    }
    if (res.data.data.some((n) => n.title === README_NOTE_TITLE)) return true
    lastPage = Math.max(1, res.data.last_page)
    p += 1
  } while (p <= lastPage && p <= MAX_FETCH_PAGES)
  return false
}

async function ensureReadme(): Promise<boolean> {
  const exists = await readmeExists()
  if (exists == null) return false
  if (exists) return true
  const createRes = await api().create()
  if (!createRes.ok) {
    lastError.value = createRes.error
    return false
  }
  const id = createRes.data
  const titleRes = await api().updateTitle(id, README_NOTE_TITLE)
  if (!titleRes.ok) {
    lastError.value = titleRes.error
    return false
  }
  const contentRes = await api().updateContent(id, buildReadmeContent())
  if (!contentRes.ok) {
    lastError.value = contentRes.error
    return false
  }
  return true
}

/**
 * Provision the managed storage: create either managed group (ASnote import
 * target, ASuser watch-mode captures) if a fresh server read shows it missing,
 * ensure the README note exists, and adopt both. groupCreate returns no id, so
 * the group list is re-fetched after any creation.
 */
async function provision(): Promise<boolean> {
  const listRes = await api().groupList()
  if (!listRes.ok) {
    lastError.value = listRes.error
    return false
  }
  let groups = listRes.data
  const missing: string[] = []
  if (!groups.some((g) => isManagedGroupName(g.name))) missing.push(MANAGED_GROUP_NAME)
  if (!groups.some((g) => isUserGroupName(g.name))) missing.push(USER_GROUP_NAME)
  if (missing.length > 0) {
    for (const name of missing) {
      const createRes = await api().groupCreate(name)
      if (!createRes.ok) {
        lastError.value = createRes.error
        return false
      }
    }
    const relist = await api().groupList()
    if (!relist.ok) {
      lastError.value = relist.error
      return false
    }
    groups = relist.data
    if (!groups.some((g) => isManagedGroupName(g.name)) || !groups.some((g) => isUserGroupName(g.name))) {
      lastError.value = 'managed-group-missing'
      return false
    }
  }
  adoptGroups(groups)
  return ensureReadme()
}

async function doRefresh(): Promise<CloudStorageStatus> {
  status.value = 'checking'
  lastError.value = ''
  const res = await api().groupList()
  if (!res.ok) {
    // Transient failures never provision or reclassify to 'uninitialized'.
    lastError.value = res.error
    status.value = failureStatus()
    lastCheckedAt.value = Date.now()
    return status.value
  }
  const hasNote = res.data.some((g) => isManagedGroupName(g.name))
  const hasUser = res.data.some((g) => isUserGroupName(g.name))
  if (hasNote && hasUser) {
    adoptGroups(res.data)
    // Initialized on another machine / before the flag existed — self-heal it.
    if (!hasFlag()) void persistFlag(true).catch((err) => log.warn('flag self-heal failed', err))
    status.value = 'ready'
  } else if (hasFlag()) {
    // Initialized before but a managed group is gone (deleted server-side, or
    // ASuser predates this feature): re-provision the missing one(s).
    log.info('a managed group is missing for an initialized account — re-provisioning')
    status.value = 'repairing'
    status.value = (await provision()) ? 'ready' : failureStatus()
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
  const result = await withLock(async () => {
    status.value = 'repairing'
    lastError.value = ''
    const ok = await provision()
    if (ok) {
      await persistFlag(true).catch((err) => log.warn('persisting init flag failed', err))
      status.value = 'ready'
    } else {
      status.value = failureStatus()
    }
    lastCheckedAt.value = Date.now()
    return status.value
  })
  return result === 'ready'
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
