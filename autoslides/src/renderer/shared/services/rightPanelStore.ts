import { reactive } from 'vue'

// Shared active-tab state for the right panel. Lifted out of RightPanel.vue so
// the title bar can host the Task/Download view switcher (Obsidian-style) while
// RightPanel renders the matching content. Both read/write this single object.
export type RightPanelTab = 'task' | 'download'

export const rightPanelStore = reactive<{ currentTab: RightPanelTab }>({
  currentTab: 'task',
})

export function setRightPanelTab(tab: RightPanelTab): void {
  rightPanelStore.currentTab = tab
}
