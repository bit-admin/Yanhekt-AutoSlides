<template>
  <!-- Connected: the stored token (masked) + Disconnect. Otherwise: paste +
       Connect, which verifies and stores the token at once. -->
  <template v-if="configStore.notionConnected">
    <div class="input-group notion-token-row">
      <input
        :value="connection.storedToken.value"
        :type="connection.showToken.value ? 'text' : 'password'"
        readonly
        spellcheck="false"
        class="text-input notion-token-input"
      />
      <button
        type="button"
        class="btn btn--adornment"
        :title="connection.showToken.value ? $t('advanced.hideToken') : $t('advanced.showToken')"
        @click="connection.showToken.value = !connection.showToken.value"
      >
        <svg v-if="connection.showToken.value" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
      <button type="button" class="btn btn--danger-outline" :disabled="connection.busy.value" @click="connection.disconnect">
        {{ $t('advanced.addons.notionDisconnect') }}
      </button>
    </div>
    <div class="notion-connected">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {{ configStore.notionWorkspaceName
        ? $t('advanced.addons.notionConnectedTo', { name: configStore.notionWorkspaceName })
        : $t('advanced.addons.notionConnected') }}
    </div>
  </template>
  <template v-else>
    <div v-if="showDescription" class="setting-description">{{ $t('advanced.addons.notionTokenDescription') }}</div>
    <form class="input-group" @submit.prevent="connection.connect">
      <input
        v-model="connection.tokenInput.value"
        :type="connection.showToken.value ? 'text' : 'password'"
        autocomplete="off"
        spellcheck="false"
        class="text-input notion-token-input"
        :placeholder="$t('advanced.addons.notionTokenPlaceholder')"
      />
      <button
        type="button"
        class="btn btn--adornment"
        :title="connection.showToken.value ? $t('advanced.hideToken') : $t('advanced.showToken')"
        @click="connection.showToken.value = !connection.showToken.value"
      >
        <svg v-if="connection.showToken.value" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
      <button type="submit" class="btn" :disabled="connection.busy.value || !connection.tokenInput.value.trim()">
        {{ connection.busy.value ? $t('advanced.addons.notionConnecting') : $t('advanced.addons.notionConnect') }}
      </button>
    </form>
    <div v-if="errorText" class="notion-error" role="status">{{ errorText }}</div>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { configStore } from '@shared/services/configStore'
import type { NotionConnection } from '@features/settings/useNotionConnection'

const props = withDefaults(defineProps<{
  connection: NotionConnection
  /** "Stored on this computer only." above the empty field. */
  showDescription?: boolean
}>(), { showDescription: true })

const { t } = useI18n()

const errorText = computed(() => {
  switch (props.connection.error.value) {
    case null: return ''
    case 'unauthorized': return t('advanced.addons.notionErrorUnauthorized')
    case 'network': return t('advanced.addons.notionErrorNetwork')
    default: return t('advanced.addons.notionErrorOther')
  }
})
</script>

<style scoped>
.notion-token-row {
  margin-top: 4px;
}

.notion-token-input {
  flex: 1;
  min-width: 0;
  width: 100%;
}

.notion-connected {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0 4px;
  font-size: 13px;
  color: var(--text-primary);
}

.notion-connected svg {
  color: var(--success);
}

.notion-error {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--danger);
}
</style>
