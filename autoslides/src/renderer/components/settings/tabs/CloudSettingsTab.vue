<template>
  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.cloudStorage.title') }}</h4>
    <div class="setting-item">
      <div class="setting-description">{{ $t('advanced.cloudStorage.intro') }}</div>

      <div class="cloud-storage-cards">
        <!-- ASnote: the slide-import storage group. -->
        <div class="cloud-storage-card">
          <span class="cloud-storage-dot" :class="statusClass"></span>
          <div class="cloud-storage-text">
            <span class="cloud-storage-title">{{ noteGroupName }} {{ statusText }}</span>
            <span class="cloud-storage-subtitle">{{ $t('advanced.cloudStorage.groupDescription') }}</span>
          </div>
          <span v-if="noteIdText" class="cloud-storage-meta">{{ noteIdText }}</span>
        </div>

        <!-- ASuser: the personal watch-mode notes group. -->
        <div class="cloud-storage-card">
          <span class="cloud-storage-dot" :class="statusClass"></span>
          <div class="cloud-storage-text">
            <span class="cloud-storage-title">{{ userGroupName }} {{ statusText }}</span>
            <span class="cloud-storage-subtitle">{{ $t('advanced.cloudStorage.groupDescriptionUser') }}</span>
          </div>
          <span v-if="userIdText" class="cloud-storage-meta">{{ userIdText }}</span>
        </div>
      </div>

      <!-- Shared actions for both groups (they provision + refresh together). -->
      <div class="cloud-storage-footer">
        <span v-if="lastCheckedText" class="cloud-storage-checked">{{ lastCheckedText }}</span>
        <span class="cloud-storage-footer-spacer"></span>
        <button
          v-if="store.status.value === 'uninitialized'"
          type="button"
          class="btn btn--primary btn--sm"
          @click="onInitialize"
        >
          {{ $t('cloudNotes.initStorage') }}
        </button>
        <button
          type="button"
          class="btn--icon"
          :title="busy ? $t('advanced.cloudStorage.refreshing') : $t('advanced.cloudStorage.refresh')"
          :disabled="busy"
          @click="onRefresh"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ spinning: busy }">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M3 21v-5h5"/>
          </svg>
        </button>
      </div>

      <p v-if="store.status.value === 'error' && store.lastError.value" class="cloud-storage-error">
        {{ store.lastError.value }}
      </p>
    </div>
  </div>

  <!-- Sync: auto-import folders to Cloud Notes on review/edit. Only shown once
       cloud storage is ready, since the whole flow is a no-op otherwise. -->
  <div v-if="store.canUse.value" class="advanced-setting-section">
    <h4>{{ $t('advanced.cloudStorage.syncTitle') }}</h4>
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.cloudStorage.syncMode') }}</label>
      <div class="setting-description">{{ $t('advanced.cloudStorage.syncDescription') }}</div>
      <div class="auto-post-processing-control">
        <select v-model="tempCloudAutoSyncMode" class="select-field sync-mode-select">
          <option value="disabled">{{ $t('advanced.cloudStorage.syncModeDisabled') }}</option>
          <option value="edited">{{ $t('advanced.cloudStorage.syncModeEdited') }}</option>
          <option value="reviewed">{{ $t('advanced.cloudStorage.syncModeReviewed') }}</option>
        </select>
        <label class="checkbox-label" :class="{ 'checkbox-label-disabled': tempCloudAutoSyncMode === 'disabled' }">
          <input
            type="checkbox"
            v-model="tempCloudAutoPublishAfterSync"
            :disabled="tempCloudAutoSyncMode === 'disabled'"
          />
          {{ $t('advanced.cloudStorage.autoPublish') }}
        </label>
      </div>
      <div class="setting-description">{{ $t('advanced.cloudStorage.autoPublishDescription') }}</div>
    </div>

    <div class="setting-item" :class="{ 'resync-locked': syncDisabled }">
      <label class="setting-label">{{ $t('advanced.cloudStorage.resyncMode') }}</label>
      <div class="setting-description">
        {{ syncDisabled ? $t('advanced.cloudStorage.resyncRequiresSync') : $t('advanced.cloudStorage.resyncDescription') }}
      </div>
      <div class="auto-post-processing-control">
        <select v-model="tempCloudAutoResyncMode" class="select-field sync-mode-select" :disabled="syncDisabled">
          <option value="disabled">{{ $t('advanced.cloudStorage.resyncModeDisabled') }}</option>
          <option value="edited">{{ $t('advanced.cloudStorage.resyncModeEdited') }}</option>
        </select>
        <label class="checkbox-label" :class="{ 'checkbox-label-disabled': tempCloudAutoResyncMode === 'disabled' }">
          <input
            type="checkbox"
            v-model="tempCloudAutoRepublishAfterResync"
            :disabled="tempCloudAutoResyncMode === 'disabled'"
          />
          {{ $t('advanced.cloudStorage.autoRepublish') }}
        </label>
      </div>
      <div class="setting-description">{{ $t('advanced.cloudStorage.autoRepublishDescription') }}</div>
    </div>

    <!-- Watch-mode capture sync: the personal ASuser notes flow (right-panel
         Notes tab). Independent of the folder auto-sync above. -->
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.cloudStorage.watchSyncTitle') }}</label>
      <div class="setting-description">{{ $t('advanced.cloudStorage.watchSyncDescription') }}</div>
      <div class="auto-post-processing-control">
        <label class="checkbox-label">
          <input type="checkbox" v-model="tempCloudWatchSyncEnabled" />
          {{ $t('advanced.cloudStorage.watchSyncEnable') }}
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Cloud storage status + explicit initialization. Pure status/action section
// (like the AI tab's model-info card) — no buffered prepare/commit settings,
// so it reads the shared cloudStorageStore directly instead of settingsContext.
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MANAGED_GROUP_NAME, USER_GROUP_NAME } from '@common/notesTypes'
import { cloudStorageStore } from '@features/cloudNotes/cloudStorageStore'
import { useSettingsContext } from '@features/settings/settingsContext'

const { t } = useI18n()
const store = cloudStorageStore

// Buffered "Sync" settings live in the shared settings bundle (Save/Cancel).
const { advanced } = useSettingsContext()
const {
  tempCloudAutoSyncMode,
  tempCloudAutoPublishAfterSync,
  tempCloudAutoResyncMode,
  tempCloudAutoRepublishAfterResync,
  tempCloudWatchSyncEnabled,
} = advanced.cloud

// Resync replaces a note that auto-sync created, so it's meaningless without
// auto-sync. Whenever auto-sync is turned off, force resync (and its republish)
// off too — the resync controls are also disabled in the template below.
const syncDisabled = computed(() => tempCloudAutoSyncMode.value === 'disabled')
watch(tempCloudAutoSyncMode, (mode) => {
  if (mode === 'disabled') {
    tempCloudAutoResyncMode.value = 'disabled'
    tempCloudAutoRepublishAfterResync.value = false
  }
})
// The managed groups' names are fixed, non-localized identifiers (server-side
// dedup keys) — always show them, even before the groups exist, so each card's
// title reads e.g. "ASnote Not initialized" rather than a blank prefix.
const noteGroupName = MANAGED_GROUP_NAME
const userGroupName = USER_GROUP_NAME

const busy = computed(() =>
  store.status.value === 'checking' || store.status.value === 'repairing')

const statusText = computed(() => {
  switch (store.status.value) {
    case 'ready': return t('advanced.cloudStorage.statusReady')
    case 'uninitialized': return t('advanced.cloudStorage.statusUninitialized')
    case 'not-signed-in': return t('advanced.cloudStorage.statusNotSignedIn')
    case 'checking': return t('advanced.cloudStorage.statusChecking')
    case 'repairing': return t('advanced.cloudStorage.statusRepairing')
    case 'error': return t('advanced.cloudStorage.statusError')
    default: return t('advanced.cloudStorage.statusChecking')
  }
})

const statusClass = computed(() => {
  switch (store.status.value) {
    case 'ready': return 'is-ready'
    case 'uninitialized':
    case 'not-signed-in': return 'is-warning'
    case 'error': return 'is-error'
    default: return 'is-pending'
  }
})

// Per-card server-assigned group id (once ready).
const noteIdText = computed(() =>
  store.status.value === 'ready' && store.managedGroupId.value != null
    ? `ID ${store.managedGroupId.value}`
    : '')
const userIdText = computed(() =>
  store.status.value === 'ready' && store.userGroupId.value != null
    ? `ID ${store.userGroupId.value}`
    : '')

// When the status was last confirmed against the server (shown once, below both cards).
const lastCheckedText = computed(() =>
  store.lastCheckedAt.value
    ? `${t('advanced.cloudStorage.lastChecked')} ${new Date(store.lastCheckedAt.value).toLocaleString()}`
    : '')

const onRefresh = () => { void store.refresh() }
const onInitialize = () => { void store.initialize() }

onMounted(() => {
  // 'unknown' means the launch check hasn't run (e.g. signed out at launch,
  // then signed in without the watcher firing here) — check on first open.
  if (store.status.value === 'unknown') void store.refresh()
})
</script>

<style scoped>
.cloud-storage-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cloud-storage-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background-color: var(--bg-subtle);
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

.cloud-storage-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.cloud-storage-footer-spacer {
  flex: 1;
}

.cloud-storage-checked {
  font-size: 11px;
  color: var(--text-secondary);
}

.cloud-storage-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: var(--text-muted);
}

.cloud-storage-dot.is-ready { background-color: var(--success); }
.cloud-storage-dot.is-warning { background-color: var(--warning); }
.cloud-storage-dot.is-error { background-color: var(--danger); }

.cloud-storage-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.cloud-storage-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.cloud-storage-subtitle {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.cloud-storage-meta {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.cloud-storage-error {
  margin: 6px 0 0;
  font-size: 11px;
  color: var(--danger);
}

.auto-post-processing-control .sync-mode-select {
  border: none;
  border-radius: 0;
  border-bottom: 1px solid var(--border-input);
  background-color: transparent;
  min-height: unset;
  padding: 8px 12px;
}

.auto-post-processing-control .sync-mode-select:focus {
  box-shadow: none;
}

.checkbox-label-disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.checkbox-label-disabled input[type="checkbox"] {
  cursor: not-allowed;
}

/* Resync requires auto-sync: dim the label/hint when auto-sync is off (the
   select itself is disabled via :disabled). */
.resync-locked .setting-label {
  opacity: 0.55;
}
</style>
