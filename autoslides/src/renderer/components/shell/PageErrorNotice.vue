<template>
  <PageBanner
    tone="danger"
    :recheck-label="retry ? $t('pageError.retry') : undefined"
    :busy="retrying"
    @recheck="runRetry"
  >
    <template v-if="problem">
      <span class="page-error-row">{{ $t(messageKey, { dir: problem.dir }) }}</span>
      <i18n-t class="page-error-row page-error-hint" tag="span" scope="global" :keypath="hintKey">
        <template #privacy>
          <button type="button" class="page-banner-link" @click="openPrivacySettings">{{ $t('pageError.outputDir.privacyLink') }}</button>
        </template>
        <template #recreate>
          <button type="button" class="page-banner-link" :disabled="recreating" @click="recreateOutputFolder">{{ $t('pageError.outputDir.recreateLink') }}</button>
        </template>
        <template #folder>
          <button type="button" class="page-banner-link" @click="changeOutputFolder">{{ $t('pageError.outputDir.folderLink') }}</button>
        </template>
      </i18n-t>
    </template>
    <template v-else>{{ message }}</template>
  </PageBanner>
</template>

<script setup lang="ts">
// Page-level load failure, rendered as the shared top-of-page strip.
// An unusable output folder (denied / missing / unreachable, see
// @common/outputDirAccess) gets a problem line plus a what-to-do line with
// inline actions; any other error shows its message without the IPC wrapper.
import { computed, ref, watch } from 'vue'
import { parseOutputDirProblem, userFacingIpcError } from '@common/outputDirAccess'
import { configStore } from '@shared/services/configStore'
import { createLogger } from '@shared/utils/logger'
import PageBanner from './PageBanner.vue'

const log = createLogger('PageErrorNotice')

const props = defineProps<{
  error: unknown
  /** Re-run the failed load; a returned promise keeps the retry icon spinning. */
  retry?: () => unknown
}>()

const isMacOS = navigator.userAgent.includes('Mac')

// A failed "create it again" can refine the problem (e.g. the drive turned out
// to be gone) before the host reloads; a new error from the host resets it.
const refinedError = ref<string | null>(null)
watch(() => props.error, () => { refinedError.value = null })
const currentError = computed(() => refinedError.value ?? props.error)

const problem = computed(() => parseOutputDirProblem(currentError.value))
const message = computed(() => userFacingIpcError(currentError.value))

const messageKey = computed(() => {
  const kind = problem.value?.kind
  if (kind === 'denied') return isMacOS ? 'pageError.outputDir.denied.message' : 'pageError.outputDir.denied.messageGeneric'
  return `pageError.outputDir.${kind}.message`
})
const hintKey = computed(() => {
  const kind = problem.value?.kind
  if (kind === 'denied') return isMacOS ? 'pageError.outputDir.denied.fixHint' : 'pageError.outputDir.denied.fixHintGeneric'
  return `pageError.outputDir.${kind}.fixHint`
})

const retrying = ref(false)

async function runRetry(): Promise<void> {
  if (!props.retry || retrying.value) return
  retrying.value = true
  try {
    await props.retry()
  } catch (error) {
    log.warn('Retry failed:', error)
  } finally {
    retrying.value = false
  }
}

const recreating = ref(false)

async function recreateOutputFolder(): Promise<void> {
  if (recreating.value) return
  recreating.value = true
  try {
    const result = await window.electronAPI.config.recreateOutputDirectory()
    if (result.ok) {
      await runRetry()
    } else if (parseOutputDirProblem(result.error)) {
      refinedError.value = result.error
    } else {
      log.warn('Failed to recreate output folder:', result.error)
    }
  } catch (error) {
    log.warn('Failed to recreate output folder:', error)
  } finally {
    recreating.value = false
  }
}

async function openPrivacySettings(): Promise<void> {
  try {
    await window.electronAPI.shell.openPrivacySettings()
  } catch (error) {
    log.warn('Failed to open privacy settings:', error)
  }
}

async function changeOutputFolder(): Promise<void> {
  const before = configStore.outputDirectory
  try {
    const updated = await window.electronAPI.config.selectOutputDirectory()
    // Pages rescan when outputDirectory changes; re-picking the same folder
    // (e.g. after granting access) needs an explicit retry.
    if (updated && updated.outputDirectory === before) void runRetry()
  } catch (error) {
    log.warn('Failed to change output folder:', error)
  }
}
</script>

<style scoped>
.page-error-row {
  display: block;
}

.page-error-hint {
  color: var(--text-secondary);
}
</style>
