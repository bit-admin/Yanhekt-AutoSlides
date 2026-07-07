import { ref } from 'vue'

export type CloudAutoSyncMode = 'disabled' | 'edited' | 'reviewed'

/**
 * Buffered settings for the Cloud tab's "Sync" section (auto-import folders to
 * Cloud Notes on review/edit, plus optional auto-publish to the Cloud Index).
 * Self-contained (no options) — reads/writes config directly and participates in
 * the Settings page's prepare/discard/commit lifecycle like the other tabs.
 */
export function useCloudSettings() {
  const cloudAutoSyncMode = ref<CloudAutoSyncMode>('disabled')
  const tempCloudAutoSyncMode = ref<CloudAutoSyncMode>('disabled')
  const cloudAutoPublishAfterSync = ref(false)
  const tempCloudAutoPublishAfterSync = ref(false)

  const load = async () => {
    const cfg = await window.electronAPI.config.get()
    cloudAutoSyncMode.value = cfg.cloudAutoSyncMode ?? 'disabled'
    cloudAutoPublishAfterSync.value = cfg.cloudAutoPublishAfterSync ?? false
    tempCloudAutoSyncMode.value = cloudAutoSyncMode.value
    tempCloudAutoPublishAfterSync.value = cloudAutoPublishAfterSync.value
  }

  const resetTemp = () => {
    tempCloudAutoSyncMode.value = cloudAutoSyncMode.value
    tempCloudAutoPublishAfterSync.value = cloudAutoPublishAfterSync.value
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
  }

  return {
    tempCloudAutoSyncMode,
    tempCloudAutoPublishAfterSync,
    load,
    resetTemp,
    save,
  }
}

export type UseCloudSettingsReturn = ReturnType<typeof useCloudSettings>
