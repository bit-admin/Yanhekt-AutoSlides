<template>
  <div v-if="visible" class="modal-overlay" @click="$emit('cancel')">
    <div class="modal-content w-[600px] max-w-[90vw] max-h-[80vh]" @click.stop>
      <div class="modal-header">
        <h3 class="m-0 text-base font-semibold text-text">{{ $t('settings.advancedSettings') }}</h3>
        <button @click="$emit('cancel')" class="close-btn bg-transparent border-none cursor-pointer p-1 rounded transition-colors hover:bg-hover">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="modal-body p-0 overflow-hidden flex flex-col text-text">
        <div class="flex gap-1 border-b border-border bg-subtle shrink-0">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="$emit('update:activeTab', tab.id)"
            :class="[
              'flex items-center gap-1.5 py-2 px-3.5 bg-transparent border-none border-b-2 border-transparent text-text-secondary text-xs font-medium cursor-pointer transition-all -mb-px hover:text-text hover:bg-black/4 [&.active]:text-accent [&.active]:border-b-accent [&.active]:bg-surface',
            ]"
          >
            <svg class="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path v-if="tab.id === 'general'" d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle v-if="tab.id === 'general'" cx="12" cy="12" r="3"/>
              <path v-if="tab.id === 'imageProcessing'" d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
              <circle v-if="tab.id === 'imageProcessing'" cx="12" cy="13" r="3"/>
              <polygon v-if="tab.id === 'playback'" points="5 3 19 12 5 21 5 3"/>
              <path v-if="tab.id === 'network'" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/>
              <path v-if="tab.id === 'network'" d="M2 12h20"/>
              <path v-if="tab.id === 'network'" d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              <rect v-if="tab.id === 'ai'" x="4" y="4" width="16" height="16" rx="2" ry="2"/>
              <path v-if="tab.id === 'ai'" d="M9 9h.01"/>
              <path v-if="tab.id === 'ai'" d="M15 9h.01"/>
              <path v-if="tab.id === 'ai'" d="M9 15h.01"/>
              <path v-if="tab.id === 'ai'" d="M15 15h.01"/>
              <path v-if="tab.id === 'ai'" d="M12 9v6"/>
              <path v-if="tab.id === 'ai'" d="M9 12h6"/>
            </svg>
            {{ $t(`advanced.tabs.${tab.id}`) }}
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-4">
          <div v-show="activeTab === 'general'" class="flex flex-col">
            <slot name="general" />
          </div>
          <div v-show="activeTab === 'imageProcessing'" class="flex flex-col">
            <slot name="imageProcessing" />
          </div>
          <div v-show="activeTab === 'playback'" class="flex flex-col">
            <slot name="playback" />
          </div>
          <div v-show="activeTab === 'network'" class="flex flex-col">
            <slot name="network" />
          </div>
          <div v-show="activeTab === 'ai'" class="flex flex-col">
            <slot name="ai" />
          </div>
        </div>
      </div>
      <div class="flex justify-end gap-2 p-4 border-t border-border bg-elevated shrink-0">
        <button @click="$emit('cancel')" class="cancel-btn py-2 px-4 border border-border-input rounded text-xs cursor-pointer transition-all bg-elevated text-text-secondary hover:bg-hover hover:border-border-strong">{{ $t('advanced.cancel') }}</button>
        <button @click="$emit('save')" class="save-btn py-2 px-4 border border-accent rounded text-xs cursor-pointer transition-all bg-accent text-white hover:bg-accent-hover hover:border-accent-hover">{{ $t('advanced.save') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AdvancedTabId } from '@features/settings/settingsTypes'

defineProps<{
  visible: boolean
  activeTab: AdvancedTabId
  tabs: { id: AdvancedTabId }[]
}>()

defineEmits<{
  (e: 'cancel'): void
  (e: 'save'): void
  (e: 'update:activeTab', id: AdvancedTabId): void
}>()
</script>
