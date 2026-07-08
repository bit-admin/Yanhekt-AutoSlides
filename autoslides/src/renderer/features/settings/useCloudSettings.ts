import { ref } from 'vue'

export type CloudAutoSyncMode = 'disabled' | 'edited' | 'reviewed'
export type CloudAutoResyncMode = 'disabled' | 'edited'

/**
 * Buffered settings for the Cloud tab's "Sync" section (auto-import folders to
 * Cloud Notes on review/edit, plus optional auto-publish to the Cloud Index).
 * Also the "Resync" controls: when an already-imported folder is edited again,
 * replace its note (and optionally re-publish to the Index). Self-contained (no
 * options) — reads/writes config directly and participates in the Settings
 * page's prepare/discard/commit lifecycle like the other tabs.
 */
export function useCloudSettings() {
  const cloudAutoSyncMode = ref<CloudAutoSyncMode>('disabled')
  const tempCloudAutoSyncMode = ref<CloudAutoSyncMode>('disabled')
  const cloudAutoPublishAfterSync = ref(false)
  const tempCloudAutoPublishAfterSync = ref(false)
  const cloudAutoResyncMode = ref<CloudAutoResyncMode>('disabled')
  const tempCloudAutoResyncMode = ref<CloudAutoResyncMode>('disabled')
  const cloudAutoRepublishAfterResync = ref(false)
  const tempCloudAutoRepublishAfterResync = ref(false)

  const load = async () => {
    const cfg = await window.electronAPI.config.get()
    cloudAutoSyncMode.value = cfg.cloudAutoSyncMode ?? 'disabled'
    cloudAutoPublishAfterSync.value = cfg.cloudAutoPublishAfterSync ?? false
    cloudAutoResyncMode.value = cfg.cloudAutoResyncMode ?? 'disabled'
    cloudAutoRepublishAfterResync.value = cfg.cloudAutoRepublishAfterResync ?? false
    resetTemp()
  }

  const resetTemp = () => {
    tempCloudAutoSyncMode.value = cloudAutoSyncMode.value
    tempCloudAutoPublishAfterSync.value = cloudAutoPublishAfterSync.value
    tempCloudAutoResyncMode.value = cloudAutoResyncMode.value
    tempCloudAutoRepublishAfterResync.value = cloudAutoRepublishAfterResync.value
  }

  const save = async () => {
    if (tempCloudAutoSyncMode.value !== cloudAutoSyncMode.value) {
      await window.electronAPI.config.setCloudAutoSyncMode(tempCloudAutoSyncMode.value)
      cloudAutoSyncMode.value = tempCloudAutoSyncMode.value
    }
    if (tempCloudAutoPublishAfterSync.value !== cloudAutoPublishAfterSync.value) {
      await window.electronAPI.config.setCloudAutoPublishAfterSync(tempCloudAutoPublishAfterSync.value)
      cloudAutoPublishAfterSync.value = tempCloudAutoPublishAfterSync.value
    }
    if (tempCloudAutoResyncMode.value !== cloudAutoResyncMode.value) {
      await window.electronAPI.config.setCloudAutoResyncMode(tempCloudAutoResyncMode.value)
      cloudAutoResyncMode.value = tempCloudAutoResyncMode.value
    }
    if (tempCloudAutoRepublishAfterResync.value !== cloudAutoRepublishAfterResync.value) {
      await window.electronAPI.config.setCloudAutoRepublishAfterResync(tempCloudAutoRepublishAfterResync.value)
      cloudAutoRepublishAfterResync.value = tempCloudAutoRepublishAfterResync.value
    }
  }

  return {
    tempCloudAutoSyncMode,
    tempCloudAutoPublishAfterSync,
    tempCloudAutoResyncMode,
    tempCloudAutoRepublishAfterResync,
    load,
    resetTemp,
    save,
  }
}

export type UseCloudSettingsReturn = ReturnType<typeof useCloudSettings>
