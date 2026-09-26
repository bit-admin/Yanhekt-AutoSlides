<template>
  <!-- How to create a Notion internal connection. Settings → Add-ons shows all
       four steps; onboarding drops the last (picking a page per lecture). -->
  <ol class="notion-steps">
    <li class="notion-step">
      <span class="notion-step-number" aria-hidden="true">1</span>
      <i18n-t keypath="advanced.addons.notionStep1" tag="span" class="notion-step-text">
        <template #link>
          <a href="#" class="external-link" @click.prevent="openNotionConnections">{{ $t('advanced.addons.notionConnectionsLink') }}</a>
        </template>
      </i18n-t>
    </li>
    <li v-for="n in laterSteps" :key="n" class="notion-step">
      <span class="notion-step-number" aria-hidden="true">{{ n }}</span>
      <span class="notion-step-text">{{ $t(`advanced.addons.notionStep${n}`) }}</span>
    </li>
  </ol>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NOTION_CONNECTIONS_URL } from '@common/notionLinks'

const props = withDefaults(defineProps<{
  /** Include step 4 (choose the page for each lecture in the Notes tab). */
  withPickStep?: boolean
}>(), { withPickStep: true })

const laterSteps = computed(() => (props.withPickStep ? [2, 3, 4] : [2, 3]))

function openNotionConnections(): void {
  void window.electronAPI.shell.openExternal(NOTION_CONNECTIONS_URL)
}
</script>

<style scoped>
/* Same bordered block as the Tools list in Add-ons: one row per step. */
.notion-steps {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

.notion-step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
}

.notion-step + .notion-step {
  border-top: 1px solid var(--border-color);
}

.notion-step-number {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: var(--bg-selected);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.notion-step-text {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
}
</style>
