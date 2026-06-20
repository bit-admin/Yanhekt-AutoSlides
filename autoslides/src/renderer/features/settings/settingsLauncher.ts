import { ref } from 'vue'
import type { AdvancedTabId } from './settingsTypes'

// Module-singleton trigger for opening the Advanced Settings modal at a specific
// tab from anywhere in the renderer (mirrors navigationStore). The settings modal
// lives in LeftPanel; it watches `requestId` and reacts. We bump a monotonic id
// so repeat requests for the same tab still fire.
const requestedTab = ref<AdvancedTabId | null>(null)
const requestId = ref(0)

const openSettingsTab = (tab: AdvancedTabId): void => {
  requestedTab.value = tab
  requestId.value++
}

export const settingsLauncher = {
  requestedTab,
  requestId,
  openSettingsTab,
}
