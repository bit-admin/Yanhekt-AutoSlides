import { ref } from 'vue'

export type CloudAutoSyncMode = 'disabled' | 'edited' | 'reviewed'
export type CloudAutoResyncMode = 'disabled' | 'edited'

/**
 * Buffered settings for the Cloud tab's "Sync" section (auto-import folders to
 * Cloud Notes on review/edit). Also the "Resync" controls: when an
 * already-imported folder is edited again, replace its note. Self-contained (no
 * options) — reads/writes config directly and participates in the Settings
 * page's prepare/discard/commit lifecycle like the other tabs.
 */
export function useCloudSettings() {
  const cloudAutoSyncMode = ref<CloudAutoSyncMode>('disabled')
  const tempCloudAutoSyncMode = ref<CloudAutoSyncMode>('disabled')
  const cloudAutoResyncMode = ref<CloudAutoResyncMode>('disabled')
  const tempCloudAutoResyncMode = ref<CloudAutoResyncMode>('disabled')
  const cloudShareEmbedTimeline = ref(true)
  const tempCloudShareEmbedTimeline = ref(true)

  const load = async () => {
    const cfg = await window.electronAPI.config.get()
    cloudAutoSyncMode.value = cfg.cloudAutoSyncMode ?? 'disabled'
    cloudAutoResyncMode.value = cfg.cloudAutoResyncMode ?? 'disabled'
    cloudShareEmbedTimeline.value = cfg.cloudShareEmbedTimeline !== false
    resetTemp()
  }

  const resetTemp = () => {
    tempCloudAutoSyncMode.value = cloudAutoSyncMode.value
    tempCloudAutoResyncMode.value = cloudAutoResyncMode.value
    tempCloudShareEmbedTimeline.value = cloudShareEmbedTimeline.value
  }

  const save = async () => {
    if (tempCloudAutoSyncMode.value !== cloudAutoSyncMode.value) {
      await window.electronAPI.config.setCloudAutoSyncMode(tempCloudAutoSyncMode.value)
      cloudAutoSyncMode.value = tempCloudAutoSyncMode.value
    }
    if (tempCloudAutoResyncMode.value !== cloudAutoResyncMode.value) {
      await window.electronAPI.config.setCloudAutoResyncMode(tempCloudAutoResyncMode.value)
      cloudAutoResyncMode.value = tempCloudAutoResyncMode.value
    }
    if (tempCloudShareEmbedTimeline.value !== cloudShareEmbedTimeline.value) {
      await window.electronAPI.config.setCloudShareEmbedTimeline(tempCloudShareEmbedTimeline.value)
      cloudShareEmbedTimeline.value = tempCloudShareEmbedTimeline.value
    }
  }

  return {
    tempCloudAutoSyncMode,
    tempCloudAutoResyncMode,
    tempCloudShareEmbedTimeline,
    load,
    resetTemp,
    save,
  }
}

export type UseCloudSettingsReturn = ReturnType<typeof useCloudSettings>
