<template>
  <div class="export-bar">
    <span class="export-count">{{ selectedCount }} {{ $t('trash.selected') }}</span>

    <div class="export-mode">
      <label class="mode-option">
        <input
          type="radio"
          value="single"
          :checked="outputMode === 'single'"
          :disabled="isGenerating"
          @change="$emit('update:outputMode', 'single')"
        />
        <span>{{ $t('pdfmaker.combineOnePdf') }}</span>
      </label>
      <label class="mode-option">
        <input
          type="radio"
          value="batch"
          :checked="outputMode === 'batch'"
          :disabled="isGenerating"
          @change="$emit('update:outputMode', 'batch')"
        />
        <span>{{ $t('pdfmaker.separatePdfs') }}</span>
      </label>
    </div>

    <button
      class="btn btn--primary make-btn"
      :disabled="selectedCount === 0 || isGenerating"
      @click="$emit('make')"
    >
      <span v-if="isGenerating">{{ progress.current }}/{{ progress.total }}</span>
      <span v-else>{{ $t('pdfmaker.makeOutput', { format: 'PDF' }) }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
// Export controls shown in folder select mode (PDF-only subset of the
// desktop ResultsExportBar).
import type { PdfOutputMode } from '../../composables/usePdfExport'

defineProps<{
  selectedCount: number
  outputMode: PdfOutputMode
  isGenerating: boolean
  progress: { current: number; total: number }
}>()

defineEmits<{
  'update:outputMode': [mode: PdfOutputMode]
  make: []
}>()
</script>

<style scoped>
.export-bar {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
  padding: 0.625rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  background-color: var(--bg-surface);
}

.export-count {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.export-mode {
  display: flex;
  gap: 1rem;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: var(--text-primary);
  cursor: pointer;
}

.make-btn {
  margin-left: auto;
  min-width: 7rem;
}
</style>
