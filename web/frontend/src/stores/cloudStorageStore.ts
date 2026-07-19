import { computed, ref, watch } from 'vue';
import type { NoteGroup } from '../lib/notes/notesTypes';
import { isUserGroupName, USER_GROUP_NAME } from '../lib/notes/notesTypes';
import { notesClient } from '../lib/notes/notesClient';
import { authStore } from './authStore';
import { createLogger } from '../lib/logger';

const log = createLogger('CloudStorage');

export type CloudStorageStatus = 'unknown' | 'checking' | 'not-signed-in' | 'ready' | 'error';

// Module-singleton view of whether the managed ASuser group (watch-mode capture
// target) is provisioned. Ported from the desktop cloudStorageStore, simplified
// to the web's needs: only ASuser is ever provisioned (no import feature → no
// ASnote, no README), and there is no persisted per-account "initialized" flag —
// the watch-sync Settings toggle IS the intent, so provisioning is a lazy,
// idempotent ensure at extraction start. Kept from the desktop design:
//  - the single-flight lock (two surfaces can never double-create the group);
//  - the transient-failure rule (a failed groupList never provisions);
//  - the server as sole authority (a group deleted server-side self-heals on
//    the next ensure).
const status = ref<CloudStorageStatus>('unknown');
// ASuser — the personal watch-mode capture group.
const userGroupId = ref<number | null>(null);
const userGroupName = ref('');
const lastError = ref('');

const canUse = computed(() => status.value === 'ready' && userGroupId.value !== null);

/** Single in-flight check/provision — the guarantee that concurrent triggers
 * can never double-create the managed group. */
let inFlight: Promise<CloudStorageStatus> | null = null;

function adoptGroups(groups: NoteGroup[]): void {
  const user = groups.find((g) => isUserGroupName(g.name));
  userGroupId.value = user?.id ?? null;
  userGroupName.value = user?.name ?? '';
}

function reset(): void {
  status.value = 'unknown';
  userGroupId.value = null;
  userGroupName.value = '';
  lastError.value = '';
}

// Account switches / sign-out invalidate the adopted group ids.
watch(
  () => authStore.userId.value,
  () => reset(),
);

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

async function doRefresh(provisionIfMissing: boolean): Promise<CloudStorageStatus> {
  status.value = 'checking';
  lastError.value = '';
  const res = await notesClient.groupList();
  if (!res.ok) {
    // Transient failures never provision.
    lastError.value = res.error;
    status.value = failureStatus();
    return status.value;
  }
  let groups = res.data;
  if (provisionIfMissing && !groups.some((g) => isUserGroupName(g.name))) {
    log.info('ASuser group missing — provisioning');
    const createRes = await notesClient.groupCreate(USER_GROUP_NAME);
    if (!createRes.ok) {
      lastError.value = createRes.error;
      status.value = failureStatus();
      return status.value;
    }
    // groupCreate returns no id — re-fetch the list to adopt it.
    const relist = await notesClient.groupList();
    if (!relist.ok) {
      lastError.value = relist.error;
      status.value = failureStatus();
      return status.value;
    }
    groups = relist.data;
  }
  adoptGroups(groups);
  if (userGroupId.value !== null) {
    status.value = 'ready';
  } else if (provisionIfMissing) {
    // Create + relist succeeded but the group still isn't there — server-side anomaly.
    lastError.value = 'managed-group-missing';
    status.value = 'error';
  } else {
    // Non-provisioning check on an account that never provisioned: not an error,
    // just not usable yet — ensureUserGroup() is the path that creates it.
    status.value = 'unknown';
  }
  return status.value;
}

/** Re-check against the server without provisioning. Concurrent callers share the in-flight op. */
function refresh(): Promise<CloudStorageStatus> {
  if (inFlight) return inFlight;
  return withLock(() => doRefresh(false));
}

/**
 * Ensure the ASuser group exists (create it if missing) and adopt its id.
 * Called lazily at extraction start and when the watch-sync toggle is enabled.
 */
function ensureUserGroup(): Promise<CloudStorageStatus> {
  return withLock(() => doRefresh(true));
}

export const cloudStorageStore = {
  status,
  userGroupId,
  userGroupName,
  lastError,
  canUse,
  refresh,
  ensureUserGroup,
};
