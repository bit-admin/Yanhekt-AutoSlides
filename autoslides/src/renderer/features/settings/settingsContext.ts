// Provide/inject contract for LeftPanel.vue and the per-tab child components
// extracted under components/settings/tabs/. LeftPanel constructs the six
// composables and provides them as one bundle so each tab can inject the
// pieces it needs without 60+ individual props.
//
// Phase 6 currently extracts NetworkSettingsTab as validation. The remaining
// four tabs (#general, #imageProcessing, #playback, #ai) consume the same
// context and can be extracted incrementally in follow-up commits.

import type { InjectionKey } from 'vue'
import { inject } from 'vue'
import type { useAuth } from '@features/platform/useAuth'
import type { useSettings } from '@features/settings/useSettings'
import type { useAdvancedSettings } from '@features/settings/useAdvancedSettings'
import type { useCacheManagement } from '@features/platform/useCacheManagement'
import type { useAISettings } from '@features/ai/useAISettings'
import type { usePHashExclusion } from '@features/ai/usePHashExclusion'

export interface SettingsContext {
  auth: ReturnType<typeof useAuth>
  settings: ReturnType<typeof useSettings>
  advanced: ReturnType<typeof useAdvancedSettings>
  cache: ReturnType<typeof useCacheManagement>
  ai: ReturnType<typeof useAISettings>
  phash: ReturnType<typeof usePHashExclusion>
}

export const settingsContextKey: InjectionKey<SettingsContext> = Symbol('settingsContext')

export function useSettingsContext(): SettingsContext {
  const ctx = inject(settingsContextKey)
  if (!ctx) {
    throw new Error(
      'useSettingsContext() called outside <LeftPanel>. Settings tabs must be rendered inside LeftPanel.vue.',
    )
  }
  return ctx
}
