<template>
  <div v-if="visible" class="modal-overlay" @click="$emit('cancel')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>{{ $t('settings.advancedSettings') }}</h3>
        <button @click="$emit('cancel')" class="close-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="advanced-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="$emit('update:activeTab', tab.id)"
            :class="['tab-btn', { active: activeTab === tab.id }]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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

        <div class="advanced-settings-content">
          <div v-show="activeTab === 'general'" class="tab-content">
            <slot name="general" />
          </div>
          <div v-show="activeTab === 'imageProcessing'" class="tab-content">
            <slot name="imageProcessing" />
          </div>
          <div v-show="activeTab === 'playback'" class="tab-content">
            <slot name="playback" />
          </div>
          <div v-show="activeTab === 'network'" class="tab-content">
            <slot name="network" />
          </div>
          <div v-show="activeTab === 'ai'" class="tab-content">
            <slot name="ai" />
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button @click="$emit('cancel')" class="cancel-btn">{{ $t('advanced.cancel') }}</button>
        <button @click="$emit('save')" class="save-btn">{{ $t('advanced.save') }}</button>
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

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  border-radius: 8px;
  width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: #f8f9fa;
}

.modal-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #333;
}

.advanced-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #e0e0e0;
  background-color: #fafafa;
  flex-shrink: 0;
}

.advanced-tabs .tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #666;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: -1px;
}

.advanced-tabs .tab-btn:hover {
  color: #333;
  background-color: rgba(0, 0, 0, 0.04);
}

.advanced-tabs .tab-btn.active {
  color: #007acc;
  border-bottom-color: #007acc;
  background-color: white;
}

.advanced-tabs .tab-btn svg {
  flex-shrink: 0;
}

.tab-content {
  display: flex;
  flex-direction: column;
}

.advanced-settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  margin-bottom: 0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #e0e0e0;
  background-color: #f8f9fa;
  flex-shrink: 0;
}

.cancel-btn, .save-btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  background-color: #f8f9fa;
  color: #666;
}

.cancel-btn:hover {
  background-color: #e9ecef;
  border-color: #adb5bd;
}

.save-btn {
  background-color: #007acc;
  color: white;
  border-color: #007acc;
}

.save-btn:hover {
  background-color: #0056b3;
  border-color: #0056b3;
}

@media (prefers-color-scheme: dark) {
  .modal-content {
    background-color: #2d2d2d;
  }

  .modal-header {
    border-bottom-color: #404040;
  }

  .modal-header h3 {
    color: #e0e0e0;
  }

  .close-btn {
    color: #e0e0e0;
  }

  .close-btn:hover {
    background-color: #3d3d3d;
  }

  .modal-body {
    color: #e0e0e0;
  }

  .advanced-tabs {
    background-color: #252525;
    border-bottom-color: #404040;
  }

  .advanced-tabs .tab-btn {
    color: #aaa;
  }

  .advanced-tabs .tab-btn:hover {
    color: #e0e0e0;
    background-color: rgba(255, 255, 255, 0.04);
  }

  .advanced-tabs .tab-btn.active {
    color: #4a9eff;
    border-bottom-color: #4a9eff;
    background-color: #2d2d2d;
  }

  .modal-actions {
    background-color: #252525;
    border-top-color: #404040;
  }

  .cancel-btn {
    background-color: #2d2d2d;
    color: #b0b0b0;
    border-color: #404040;
  }

  .cancel-btn:hover {
    background-color: #3d3d3d;
    border-color: #555;
  }

  .save-btn {
    background-color: #4a9eff;
    border-color: #4a9eff;
  }

  .save-btn:hover {
    background-color: #3a8eef;
    border-color: #3a8eef;
  }
}
</style>
