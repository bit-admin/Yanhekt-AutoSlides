<template>
  <Teleport to="body">
    <!-- No backdrop dismissal: the user must choose Continue or Cancel so the
         extraction toggle state stays consistent with their intent. -->
    <div class="modal-overlay extraction-features-overlay">
      <div
        class="dialog-box extraction-features-modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <h3 :id="titleId" class="dialog-title">
          {{ $t('playback.extractionFeatures.title') }}
        </h3>
        <p class="dialog-help">
          {{ $t('playback.extractionFeatures.lead') }}
        </p>

          <label class="feature-option">
            <input v-model="aiEnabled" type="checkbox" class="feature-checkbox" />
            <span class="feature-copy">
              <span class="feature-title">{{ $t('settings.enableAIFiltering') }}</span>
              <span class="feature-desc">{{ $t('settings.aiFilteringDescription') }}</span>
            </span>
          </label>

          <label class="feature-option">
            <input
              v-model="watchSyncEnabled"
              type="checkbox"
              class="feature-checkbox"
              :disabled="busy"
            />
            <span class="feature-copy">
              <span class="feature-title">{{ $t('settings.enableCloudWatchSync') }}</span>
              <span class="feature-desc">{{ $t('settings.cloudWatchSyncDescription') }}</span>
            </span>
          </label>

          <p v-if="error" class="feature-error">{{ error }}</p>

        <div class="dialog-actions">
          <button type="button" class="btn dialog-btn" :disabled="busy" @click="onCancel">
            {{ $t('playback.extractionFeatures.cancel') }}
          </button>
          <button
            type="button"
            class="btn btn--primary dialog-btn"
            :disabled="busy"
            @click="onContinue"
          >
            <span v-if="busy" class="feature-spinner" aria-hidden="true"></span>
            <span>{{ $t('playback.extractionFeatures.continue') }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { configStore, persistConfig } from '../../stores/configStore'
import { authStore } from '../../stores/authStore'
import { cloudStorageStore } from '../../stores/cloudStorageStore'
import { markExtractionFeaturesPromptSeen } from '../../stores/extractionFeaturesPromptStore'

const emit = defineEmits<{
  /** User confirmed — extraction should start with applied settings. */
  continue: []
  /** User cancelled — extraction must not start. */
  cancel: []
}>()

const { t } = useI18n()
const titleId = useId()

// Seed from current prefs so the prompt reflects what's already on.
const aiEnabled = ref(configStore.aiFilteringEnabled)
const watchSyncEnabled = ref(configStore.cloudWatchSyncEnabled)
const busy = ref(false)
const error = ref<string | null>(null)

const onCancel = () => {
  if (busy.value) return
  // Still mark seen: the user was offered the choice; don't re-ask every toggle.
  markExtractionFeaturesPromptSeen()
  emit('cancel')
}

const onContinue = async () => {
  if (busy.value) return
  error.value = null
  busy.value = true

  try {
    configStore.aiFilteringEnabled = aiEnabled.value
    persistConfig()

    if (!watchSyncEnabled.value) {
      configStore.cloudWatchSyncEnabled = false
      persistConfig()
    } else if (!authStore.isLoggedIn.value) {
      // Persist intent; groups provision after sign-in + re-enable or Init in Settings.
      configStore.cloudWatchSyncEnabled = true
      persistConfig()
    } else {
      // Mirror Settings: only keep watch-sync on when storage ends ready.
      let st = await cloudStorageStore.ensureReady()
      if (st !== 'ready') {
        const ok = await cloudStorageStore.initialize()
        st = ok ? 'ready' : cloudStorageStore.status.value
      }
      if (st !== 'ready') {
        configStore.cloudWatchSyncEnabled = false
        persistConfig()
        error.value =
          cloudStorageStore.status.value === 'uninitialized'
            ? t('settings.cloudWatchSyncNeedInit')
            : t('settings.cloudWatchSyncProvisionFailed')
        return
      }
      configStore.cloudWatchSyncEnabled = true
      persistConfig()
    }

    markExtractionFeaturesPromptSeen()
    emit('continue')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.extraction-features-overlay {
  padding: 1.5rem;
  z-index: var(--z-super-modal);
}

.extraction-features-modal {
  width: min(28rem, 100%);
}

.feature-option {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin: 0;
  padding: 0.75rem 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: 0.625rem;
  background: var(--bg-subtle);
  cursor: pointer;
  user-select: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.feature-option:hover {
  border-color: var(--border-strong);
  background: var(--bg-hover);
}

.feature-option:has(input:checked) {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border-color));
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-subtle));
}

.feature-checkbox {
  margin-top: 0.2rem;
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  accent-color: var(--accent);
  cursor: pointer;
}

.feature-checkbox:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.feature-copy {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.feature-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.35;
}

.feature-desc {
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--text-secondary);
}

.feature-error {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: var(--danger);
}

.feature-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: feature-spin 0.8s linear infinite;
}

@keyframes feature-spin {
  to {
    transform: rotate(360deg);
  }
}

.dialog-actions .btn {
  gap: 0.375rem;
}
</style>
