import { computed, ref, watch } from 'vue';
import type { NoteGroup } from '../lib/notes/notesTypes';
import {
  isManagedGroupName,
  isUserGroupName,
  MANAGED_GROUP_NAME,
  USER_GROUP_NAME,
  README_NOTE_TITLE,
} from '../lib/notes/notesTypes';
import { buildReadmeContent } from '../lib/notes/readmeContent';
import { notesClient } from '../lib/notes/notesClient';
import { authStore } from './authStore';
import {
  isCloudStorageInitialized,
  setCloudStorageInitialized,
} from './configStore';
import { createLogger } from '../lib/logger';

const log = createLogger('CloudStorage');

/** Page size / cap mirroring useCloudNotes' full-set paging (README scan only). */
const FETCH_PAGE_SIZE = 500;
const MAX_FETCH_PAGES = 20;

/**
 * How long a `ready` status is trusted without re-hitting groupList. Settings
 * Refresh and force paths bypass this. Extraction + watch-sync re-entry share
 * the short-circuit so a happy path does zero storage network after init.
 */
const READY_TTL_MS = 5 * 60 * 1000;

export type CloudStorageStatus =
  | 'unknown'
  | 'checking'
  | 'not-signed-in'
  | 'uninitialized'
  | 'repairing'
  | 'ready'
  | 'error';

export interface RefreshOptions {
  /** Bypass the ready TTL and re-check the server. */
  force?: boolean;
}

// Module-singleton cloud-storage state (desktop parity, web-adapted):
// provisions BOTH ASnote (desktop-import readiness) and ASuser (watch-mode),
// plus a README note on first init. Server group list is the authority; the
// persisted per-badge flag only encodes user *intent*:
//  - flag set + group missing → auto re-provision (repair)
//  - flag unset + group missing → uninitialized (no auto-create)
//  - both groups present → ready + flag self-heal
// Call reduction: ready TTL short-circuit, single-flight lock, and
// adoptFromGroups() so the Notes page's groupList can update this store
// without a second network round-trip.
const status = ref<CloudStorageStatus>('unknown');
// ASnote — the import target group (desktop / cross-app readiness).
const managedGroupId = ref<number | null>(null);
const managedGroupName = ref('');
// ASuser — the personal watch-mode capture group.
const userGroupId = ref<number | null>(null);
const userGroupName = ref('');
const lastCheckedAt = ref<number | null>(null);
const lastError = ref('');

const canUse = computed(() => status.value === 'ready');
/** Known-bad states that gate UI. 'unknown'/'checking' are NOT blocked so an
 * already-initialized user isn't locked out while a soft check is in flight. */
const blocked = computed(
  () => status.value === 'uninitialized' || status.value === 'not-signed-in',
);

let userBadge: string | null = null;
/** Single in-flight check/provision — concurrent surfaces never double-create. */
let inFlight: Promise<CloudStorageStatus> | null = null;

function hasFlag(): boolean {
  return userBadge != null && isCloudStorageInitialized(userBadge);
}

function persistFlag(initialized: boolean): void {
  if (!userBadge) return;
  setCloudStorageInitialized(userBadge, initialized);
}

function adoptGroups(groups: NoteGroup[]): void {
  const note = groups.find((g) => isManagedGroupName(g.name));
  const user = groups.find((g) => isUserGroupName(g.name));
  managedGroupId.value = note?.id ?? null;
  managedGroupName.value = note?.name ?? '';
  userGroupId.value = user?.id ?? null;
  userGroupName.value = user?.name ?? '';
}

function clearGroups(): void {
  managedGroupId.value = null;
  managedGroupName.value = '';
  userGroupId.value = null;
  userGroupName.value = '';
}

/** Set the account the store tracks (null on sign-out). Resets to 'unknown'. */
function setUser(badge: string | null): void {
  userBadge = badge;
  status.value = 'unknown';
  clearGroups();
  lastCheckedAt.value = null;
  lastError.value = '';
}

function isReadyFresh(): boolean {
  return (
    status.value === 'ready' &&
    lastCheckedAt.value != null &&
    Date.now() - lastCheckedAt.value < READY_TTL_MS &&
    managedGroupId.value != null &&
    userGroupId.value != null
  );
}

/** Queue `task` behind any in-flight check/provision, tracking it as in-flight. */
async function withLock(task: () => Promise<CloudStorageStatus>): Promise<CloudStorageStatus> {
  while (inFlight) {
    try {
      await inFlight;
    } catch {
      /* previous op's failure is its caller's problem */
    }
  }
  const run = task();
  inFlight = run;
  try {
    return await run;
  } finally {
    inFlight = null;
  }
}

function failureStatus(): CloudStorageStatus {
  return lastError.value === 'not-signed-in' ? 'not-signed-in' : 'error';
}

/** Scan the full note list (paged, capped) for the README note's title. */
async function readmeExists(): Promise<boolean | null> {
  let p = 1;
  let lastPage = 1;
  do {
    const res = await notesClient.list({ page: p, pageSize: FETCH_PAGE_SIZE });
    if (!res.ok) {
      lastError.value = res.error;
      return null;
    }
    if (res.data.data.some((n) => n.title === README_NOTE_TITLE)) return true;
    lastPage = Math.max(1, res.data.last_page);
    p += 1;
  } while (p <= lastPage && p <= MAX_FETCH_PAGES);
  return false;
}

async function ensureReadme(): Promise<boolean> {
  const exists = await readmeExists();
  if (exists == null) return false;
  if (exists) return true;
  const createRes = await notesClient.create();
  if (!createRes.ok) {
    lastError.value = createRes.error;
    return false;
  }
  const id = createRes.data;
  const titleRes = await notesClient.updateTitle(id, README_NOTE_TITLE);
  if (!titleRes.ok) {
    lastError.value = titleRes.error;
    return false;
  }
  const contentRes = await notesClient.updateContent(id, buildReadmeContent());
  if (!contentRes.ok) {
    lastError.value = contentRes.error;
    return false;
  }
  return true;
}

/**
 * Provision managed storage: create missing ASnote / ASuser, re-list (create
 * returns no id), adopt both, ensure README. Only called from initialize() or
 * the flag-set repair path.
 */
async function provision(): Promise<boolean> {
  const listRes = await notesClient.groupList();
  if (!listRes.ok) {
    lastError.value = listRes.error;
    return false;
  }
  let groups = listRes.data;
  const missing: string[] = [];
  if (!groups.some((g) => isManagedGroupName(g.name))) missing.push(MANAGED_GROUP_NAME);
  if (!groups.some((g) => isUserGroupName(g.name))) missing.push(USER_GROUP_NAME);
  if (missing.length > 0) {
    log.info('provisioning managed groups', missing);
    for (const name of missing) {
      const createRes = await notesClient.groupCreate(name);
      if (!createRes.ok) {
        lastError.value = createRes.error;
        return false;
      }
    }
    const relist = await notesClient.groupList();
    if (!relist.ok) {
      lastError.value = relist.error;
      return false;
    }
    groups = relist.data;
    if (
      !groups.some((g) => isManagedGroupName(g.name)) ||
      !groups.some((g) => isUserGroupName(g.name))
    ) {
      lastError.value = 'managed-group-missing';
      return false;
    }
  }
  adoptGroups(groups);
  return ensureReadme();
}

async function doRefresh(): Promise<CloudStorageStatus> {
  status.value = 'checking';
  lastError.value = '';
  const res = await notesClient.groupList();
  if (!res.ok) {
    // Transient failures never provision or reclassify to 'uninitialized'.
    lastError.value = res.error;
    status.value = failureStatus();
    lastCheckedAt.value = Date.now();
    return status.value;
  }
  const hasNote = res.data.some((g) => isManagedGroupName(g.name));
  const hasUser = res.data.some((g) => isUserGroupName(g.name));
  if (hasNote && hasUser) {
    adoptGroups(res.data);
    // Initialized on another machine / before the flag existed — self-heal it.
    if (!hasFlag()) {
      try {
        persistFlag(true);
      } catch (err) {
        log.warn('flag self-heal failed', err);
      }
    }
    status.value = 'ready';
  } else if (hasFlag()) {
    // Initialized before but a managed group is gone: re-provision missing.
    log.info('a managed group is missing for an initialized account — re-provisioning');
    status.value = 'repairing';
    status.value = (await provision()) ? 'ready' : failureStatus();
  } else {
    adoptGroups(res.data);
    status.value = 'uninitialized';
  }
  lastCheckedAt.value = Date.now();
  return status.value;
}

/**
 * Re-check against the server without first-time create. Concurrent callers
 * share the in-flight op. Ready + fresh TTL short-circuits unless force.
 */
function refresh(opts: RefreshOptions = {}): Promise<CloudStorageStatus> {
  if (!opts.force && isReadyFresh()) return Promise.resolve(status.value);
  if (inFlight) return inFlight;
  return withLock(doRefresh);
}

/**
 * Action-time guard (extraction / watch-sync): TTL short-circuit when ready;
 * otherwise re-check (auto-repair only when flag set). Never first-time inits.
 */
function ensureReady(opts: RefreshOptions = {}): Promise<CloudStorageStatus> {
  if (!opts.force && isReadyFresh()) return Promise.resolve('ready');
  if (inFlight) return inFlight;
  return withLock(doRefresh);
}

/**
 * Explicit initialization (Settings Init / hybrid watch-sync enable). The only
 * path that provisions a never-initialized account; sets the persisted flag.
 */
async function initialize(): Promise<boolean> {
  // Already ready + fresh → nothing to do (hybrid toggle path).
  if (isReadyFresh()) return true;
  const result = await withLock(async () => {
    status.value = 'repairing';
    lastError.value = '';
    const ok = await provision();
    if (ok) {
      try {
        persistFlag(true);
      } catch (err) {
        log.warn('persisting init flag failed', err);
      }
      status.value = 'ready';
    } else {
      status.value = failureStatus();
    }
    lastCheckedAt.value = Date.now();
    return status.value;
  });
  return result === 'ready';
}

/**
 * Local adopt from a group list already fetched elsewhere (Notes page).
 * Upgrade-only: if both managed groups are present, mark ready + self-heal the
 * flag without a network round-trip. Partial lists only update adopted ids.
 */
function adoptFromGroups(groups: NoteGroup[]): void {
  const hasNote = groups.some((g) => isManagedGroupName(g.name));
  const hasUser = groups.some((g) => isUserGroupName(g.name));
  adoptGroups(groups);
  if (hasNote && hasUser) {
    if (!hasFlag()) {
      try {
        persistFlag(true);
      } catch (err) {
        log.warn('flag self-heal failed', err);
      }
    }
    status.value = 'ready';
    lastCheckedAt.value = Date.now();
    lastError.value = '';
  }
}

// Account switches / sign-out: rebind badge and soft-check once on login.
// Soft refresh (not initialize) so we never auto-create for a never-inited account.
watch(
  () => authStore.userId.value,
  (badge) => {
    const next = badge || null;
    // Skip no-op rebinds that would thrash a fresh ready state (same badge).
    if (next === userBadge) {
      if (next && status.value === 'unknown') void refresh();
      return;
    }
    setUser(next);
    if (next) void refresh();
  },
  { immediate: true },
);

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
  adoptFromGroups,
};
