import { reactive } from 'vue'

// Session-only collapse state for the left (sidebar) and right (Task/Download)
// panels. Mirrors rightPanelStore: a single reactive object shared by App.vue
// (which drives the rendered panel widths) and the title-bar toggle buttons.
// Not persisted — matches how panel widths, tabs, and the right-panel tab all
// reset on reload.
export const layoutStore = reactive<{ leftCollapsed: boolean; rightCollapsed: boolean }>({
  leftCollapsed: false,
  rightCollapsed: false,
})

export const toggleLeftPanel = (): void => {
  layoutStore.leftCollapsed = !layoutStore.leftCollapsed
}

export const toggleRightPanel = (): void => {
  layoutStore.rightCollapsed = !layoutStore.rightCollapsed
}
