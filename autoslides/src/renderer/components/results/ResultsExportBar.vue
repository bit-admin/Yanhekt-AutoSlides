<template>
  <!-- Second toolbar row: PDF/PPTX export over the folder selection. Grayed
       out until Select mode is active. `pdf` is the parent's usePdfMaker
       instance (composable-object-as-prop; explicit .value in bindings). -->
  <div class="export-bar" :class="{ 'export-bar-disabled': !isFolderEditMode }">
    <div class="export-bar-left">
      <button class="btn" :disabled="exportControlsDisabled" @click="toggleSortOrder">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        {{ pdf.useCustomOrder.value ? $t('pdfmaker.customOrder') : $t('pdfmaker.sortAZ') }}
      </button>
    </div>

    <div class="export-bar-right">
      <div class="config-item">
        <label class="config-label">{{ $t('pdfmaker.aspectRatio') }}</label>
        <select v-model="pdf.aspectRatio.value" class="select-field pdf-select" :disabled="exportControlsDisabled">
          <option value="16:9">16:9</option>
          <option value="4:3">4:3</option>
        </select>
      </div>

      <label class="reduce-toggle">
        <input type="checkbox" v-model="pdf.reduceEnabled.value" :disabled="exportControlsDisabled" />
        <span>{{ $t('pdfmaker.reduceSize') }}</span>
      </label>

      <div class="reduce-config-group" :class="{ disabled: !pdf.reduceEnabled.value }">
        <select
          v-model="pdf.reduceEffort.value"
          class="select-field pdf-select"
          :disabled="exportControlsDisabled || !pdf.reduceEnabled.value"
        >
          <option value="standard">{{ $t('pdfmaker.effortStandard') }}</option>
          <option value="compact">{{ $t('pdfmaker.effortCompact') }}</option>
          <option value="minimal">{{ $t('pdfmaker.effortMinimal') }}</option>
          <option value="custom">{{ $t('pdfmaker.effortCustom') }}</option>
        </select>

        <div class="config-item">
          <label class="config-label">{{ $t('pdfmaker.colors') }}</label>
          <span v-if="pdf.reduceEffort.value !== 'custom'" class="config-value">{{ pdf.customColors.value }}</span>
          <select
            v-else
            v-model="pdf.customColors.value"
            class="select-field pdf-select"
            :disabled="exportControlsDisabled || !pdf.reduceEnabled.value"
          >
            <option :value="null">{{ $t('pdfmaker.colorsOriginal') }}</option>
            <option :value="256">256</option>
            <option :value="128">128</option>
            <option :value="64">64</option>
            <option :value="32">32</option>
            <option :value="16">16</option>
          </select>
        </div>

        <div class="config-item">
          <label class="config-label">{{ $t('pdfmaker.size') }}</label>
          <span v-if="pdf.reduceEffort.value !== 'custom'" class="config-value">{{ pdf.displaySize.value }}</span>
          <select
            v-else
            v-model="pdf.customSize.value"
            class="select-field pdf-select"
            :disabled="exportControlsDisabled || !pdf.reduceEnabled.value"
          >
            <option v-for="opt in pdf.sizeOptions.value" :key="opt" :value="opt">{{ formatSizeOption(opt) }}</option>
          </select>
        </div>
      </div>

      <WorkspaceExportOptions :label="exportMenuLabel" :disabled="exportControlsDisabled">
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 1h8l4 4v10H2V1zm8 1v3h3l-3-3zM4 8h8v1H4V8zm0 2h8v1H4v-1zm0 2h5v1H4v-1z" fill="currentColor"/>
          </svg>
        </template>

        <div class="export-menu-section" role="radiogroup" :aria-label="$t('pdfmaker.outputFormat')">
          <span class="export-menu-section-label">{{ $t('pdfmaker.outputFormat') }}</span>
          <div class="mode-segmented">
            <label class="mode-option">
              <input type="radio" name="slides-output-format" v-model="pdf.outputFormat.value" value="pdf" />
              <span>{{ $t('pdfmaker.formatPdf') }}</span>
            </label>
            <label class="mode-option">
              <input type="radio" name="slides-output-format" v-model="pdf.outputFormat.value" value="pptx" />
              <span>{{ $t('pdfmaker.formatPptx') }}</span>
            </label>
          </div>
        </div>

        <div class="export-menu-section" role="radiogroup" :aria-label="$t('pdfmaker.outputMode')">
          <span class="export-menu-section-label">{{ $t('pdfmaker.outputMode') }}</span>
          <div class="mode-segmented">
            <label class="mode-option">
              <input type="radio" name="slides-output-mode" v-model="pdf.outputMode.value" value="single" />
              <span>{{ pdf.outputFormat.value === 'pptx' ? $t('pdfmaker.combineOnePptx') : $t('pdfmaker.combineOnePdf') }}</span>
            </label>
            <label class="mode-option">
              <input type="radio" name="slides-output-mode" v-model="pdf.outputMode.value" value="batch" />
              <span>{{ pdf.outputFormat.value === 'pptx' ? $t('pdfmaker.separatePptxs') : $t('pdfmaker.separatePdfs') }}</span>
            </label>
          </div>
        </div>

        <div class="export-menu-section" role="group" :aria-label="$t('pdfmaker.pages')">
          <span class="export-menu-section-label">{{ $t('pdfmaker.pages') }}</span>
          <label class="cover-toggle">
            <input type="checkbox" v-model="pdf.includeCover.value" />
            <span>{{ $t('pdfmaker.includeCover') }}</span>
          </label>
        </div>
      </WorkspaceExportOptions>

      <button
        class="btn btn--primary"
        @click="handleMakePdf"
        :disabled="exportControlsDisabled || selectedCount === 0"
      >
        <svg v-if="!pdf.isGenerating.value" width="16" height="16" viewBox="0 0 16 16">
          <path d="M2 1h8l4 4v10H2V1zm8 1v3h3l-3-3zM4 8h8v1H4V8zm0 2h8v1H4v-1zm0 2h5v1H4v-1z" fill="currentColor"/>
        </svg>
        <span v-if="pdf.isGenerating.value" class="progress-text">
          {{ pdf.generateProgress.value.current }}/{{ pdf.generateProgress.value.total }}
        </span>
        <span v-else>{{ $t('pdfmaker.makeOutput', { format: pdf.outputFormat.value.toUpperCase() }) }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { usePdfMaker } from '@features/export/usePdfMaker'
import WorkspaceExportOptions from '../shell/WorkspaceExportOptions.vue'

const props = defineProps<{
  pdf: ReturnType<typeof usePdfMaker>
  isFolderEditMode: boolean
  selectedCount: number
}>()

const { t } = useI18n()

const exportControlsDisabled = computed(() => !props.isFolderEditMode || props.pdf.isGenerating.value)

const formatSizeOption = (size: string) => {
  const [w, h] = size.split('x')
  return w && h ? `${w}×${h}` : size
}

const outputModeLabel = computed(() => {
  if (props.pdf.outputMode.value === 'single') {
    return props.pdf.outputFormat.value === 'pptx'
      ? t('pdfmaker.combineOnePptx')
      : t('pdfmaker.combineOnePdf')
  }

  return props.pdf.outputFormat.value === 'pptx'
    ? t('pdfmaker.separatePptxs')
    : t('pdfmaker.separatePdfs')
})

const exportMenuLabel = computed(() => `${props.pdf.outputFormat.value.toUpperCase()} · ${outputModeLabel.value}`)

const toggleSortOrder = () => {
  if (props.pdf.useCustomOrder.value) {
    props.pdf.resetSortOrder()
  } else {
    props.pdf.enableCustomOrder()
  }
}

const handleMakePdf = async () => {
  if (props.selectedCount === 0) return

  const result = await props.pdf.makePdf()

  if (result.success && result.mode === 'batch') {
    const isPptx = result.format === 'pptx'
    const response = await window.electronAPI.dialog?.showMessageBox?.({
      type: 'info',
      buttons: [t('pdfmaker.openOutputFolder'), 'OK'],
      defaultId: 0,
      title: t(isPptx ? 'pdfmaker.pptxsSavedTitle' : 'pdfmaker.pdfsSavedTitle'),
      message: t(isPptx ? 'pdfmaker.pptxsSaved' : 'pdfmaker.pdfsSaved', { path: result.outputDir }),
    })

    if (response?.response === 0) {
      await window.electronAPI.shell?.openPath?.(result.outputDir)
    }
  } else if (result.success && result.mode === 'single') {
    const isPptx = result.format === 'pptx'
    const response = await window.electronAPI.dialog?.showMessageBox?.({
      type: 'info',
      buttons: [t(isPptx ? 'pdfmaker.openPptx' : 'pdfmaker.openPdf'), 'OK'],
      defaultId: 0,
      title: t(isPptx ? 'pdfmaker.pptxSavedTitle' : 'pdfmaker.pdfSavedTitle'),
      message: t(isPptx ? 'pdfmaker.pptxSaved' : 'pdfmaker.pdfSaved', { path: result.path }),
    })

    if (response?.response === 0 && result.path) {
      await window.electronAPI.shell?.openPath?.(result.path)
    }
  } else if (!result.success && result.error && result.error !== 'Cancelled') {
    await window.electronAPI.dialog?.showMessageBox?.({
      type: 'error',
      buttons: ['OK'],
      title: t('pdfmaker.errorTitle'),
      message: result.error,
    })
  }
}
</script>

<style scoped src="../../shared/styles/workspaceExportBar.css"></style>

<style scoped>
.export-bar-disabled {
  pointer-events: none;
}

.export-bar-left,
.export-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  row-gap: 6px;
}

.export-bar-right {
  justify-content: flex-end;
}

.reduce-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-input);
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.2s, border-color 0.2s;
}

.reduce-toggle:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-input);
}

.reduce-toggle input {
  margin: 0;
  cursor: pointer;
  width: 14px;
  height: 14px;
  accent-color: var(--control-accent);
}

.reduce-config-group {
  display: flex;
  align-items: center;
  gap: 8px;
  transition: opacity 0.2s;
}

.reduce-config-group.disabled {
  opacity: 0.5;
}

/* Inline config-row selects — auto width instead of the shared full width */
.pdf-select {
  width: auto;
}

.config-value {
  font-size: 13px;
  color: var(--text-primary);
  padding: 4px 8px;
  background-color: var(--bg-page);
  border: 1px solid var(--border-input);
  border-radius: 4px;
  white-space: nowrap;
}

.cover-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}

.cover-toggle:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-input);
}

.cover-toggle input {
  width: 14px;
  height: 14px;
  margin: 0;
  cursor: pointer;
  accent-color: var(--control-accent);
}

.progress-text {
  font-variant-numeric: tabular-nums;
}
</style>
