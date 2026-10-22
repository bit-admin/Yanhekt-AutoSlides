<template>
  <div class="snapshot-terms" :class="{ 'is-off': !enabled }">
    <div class="snapshot-toolbar">
      <button type="button" class="btn" :disabled="!enabled || importing" @click="runImport">
        {{ importing ? $t('advanced.snapshotImporting') : $t('advanced.snapshotImport') }}
      </button>
      <span class="snapshot-count">{{ $t('advanced.snapshotTermCount', { count: snapshotTerms.length }) }}</span>
    </div>

    <div v-if="status" class="snapshot-status" :class="status.type">
      <div v-for="(line, i) in status.lines" :key="i">{{ line }}</div>
    </div>

    <div class="snapshot-table-wrap custom-scrollbar">
      <table class="snapshot-table">
        <thead>
          <tr>
            <th>{{ $t('advanced.snapshotTerm') }}</th>
            <th class="num">{{ $t('advanced.snapshotCourses') }}</th>
            <th>{{ $t('advanced.snapshotSource') }}</th>
            <th class="pick">{{ $t('advanced.snapshotInPicker') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="snapshotTerms.length === 0">
            <td colspan="4" class="snapshot-empty">{{ $t('advanced.snapshotEmpty') }}</td>
          </tr>
          <tr v-for="row in snapshotTerms" :key="row.term">
            <td>{{ termLabel(row.term) }}</td>
            <td class="num">{{ row.courses.toLocaleString() }}</td>
            <td>{{ sourceLabel(row) }}</td>
            <td class="pick">
              <input
                type="checkbox"
                :aria-label="$t('advanced.snapshotInPicker')"
                :title="alwaysListed(row.term) ? $t('advanced.snapshotAlwaysListed') : ''"
                :disabled="!enabled || alwaysListed(row.term)"
                :checked="alwaysListed(row.term) || pickerTerms.includes(row.term)"
                @change="toggle(row.term, $event)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="setting-description snapshot-format">{{ $t('advanced.snapshotFormat') }}</div>
  </div>
</template>

<script setup lang="ts">
/**
 * Temporary: the course snapshot terms in Settings → General → Temporary
 * Workarounds. Lists built-in and imported terms, imports more, and picks
 * which older terms the Search page term picker lists. Goes away with the
 * snapshot once the course index replaces it.
 */
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CourseSnapshotRejectReason, CourseSnapshotTerm } from '@common/apiTypes'
import { parseTermKey } from '@common/courseSnapshotTerm'
import { academicTermLabel } from '@shared/i18n/displayNames'
import { importSnapshotFiles, refreshSnapshotTerms, snapshotTerms } from '@shared/services/courseSnapshotTerms'

const props = defineProps<{ enabled: boolean }>()
const pickerTerms = defineModel<string[]>('pickerTerms', { required: true })

const { t } = useI18n()

/** The picker always lists 2023 Fall onward (useSearchPage `FIRST_TERM`). */
const ALWAYS_FROM = { schoolYear: 2023, semester: 1 }

const importing = ref(false)
const status = ref<{ type: 'success' | 'warning' | 'error'; lines: string[] } | null>(null)

onMounted(() => {
  void refreshSnapshotTerms()
})

function alwaysListed(term: string): boolean {
  const parts = parseTermKey(term)
  if (!parts) return false
  return parts.schoolYear * 10 + parts.semester >= ALWAYS_FROM.schoolYear * 10 + ALWAYS_FROM.semester
}

function termLabel(term: string): string {
  const parts = parseTermKey(term)
  return parts ? academicTermLabel(`${parts.schoolYear}-${parts.schoolYear + 1}`, parts.semester, term) : term
}

function sourceLabel(row: CourseSnapshotTerm): string {
  if (row.source === 'builtin') return t('advanced.snapshotSourceBuiltin')
  return row.replacesBuiltin ? t('advanced.snapshotSourceReplaces') : t('advanced.snapshotSourceImported')
}

function toggle(term: string, event: Event): void {
  const on = (event.target as HTMLInputElement).checked
  const rest = pickerTerms.value.filter((t) => t !== term)
  pickerTerms.value = on ? [...rest, term] : rest
}

const REASON_KEY: Record<CourseSnapshotRejectReason, string> = {
  name: 'advanced.snapshotRejectName',
  format: 'advanced.snapshotRejectFormat',
  empty: 'advanced.snapshotRejectEmpty',
}

async function runImport(): Promise<void> {
  if (!props.enabled || importing.value) return
  importing.value = true
  status.value = null
  try {
    const result = await importSnapshotFiles()
    if (!result) return
    const lines: string[] = []
    if (result.imported.length > 0) {
      lines.push(t('advanced.snapshotImported', { terms: result.imported.map((r) => termLabel(r.term)).join(', ') }))
    }
    for (const r of result.rejected) {
      lines.push(t('advanced.snapshotRejected', { file: r.file, reason: t(REASON_KEY[r.reason]) }))
    }
    const type = result.rejected.length === 0 ? 'success' : result.imported.length > 0 ? 'warning' : 'error'
    status.value = { type, lines }
  } catch {
    status.value = { type: 'error', lines: [t('advanced.snapshotImportFailed')] }
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.snapshot-terms {
  margin-top: 10px;
  padding: 10px 12px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-subtle);
}

.snapshot-terms.is-off {
  opacity: 0.55;
}

.snapshot-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.snapshot-count {
  font-size: 11px;
  color: var(--text-muted);
}

.snapshot-status {
  margin-top: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.snapshot-status.success {
  background-color: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success-border);
}

.snapshot-status.warning {
  background-color: var(--warning-bg);
  color: var(--warning);
  border: 1px solid var(--warning-border);
}

.snapshot-status.error {
  background-color: var(--danger-bg);
  color: var(--danger);
  border: 1px solid var(--danger-border);
}

.snapshot-table-wrap {
  margin-top: 10px;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-elevated);
}

.snapshot-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.snapshot-table th,
.snapshot-table td {
  padding: 6px 10px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.snapshot-table tbody tr:last-child td {
  border-bottom: none;
}

.snapshot-table th {
  position: sticky;
  top: 0;
  z-index: var(--z-raised);
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  background: var(--bg-elevated);
}

.snapshot-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.snapshot-table .pick {
  width: 1%;
  white-space: nowrap;
  text-align: center;
}

.snapshot-empty {
  color: var(--text-muted);
  text-align: center;
}

.snapshot-format {
  margin-top: 8px;
}
</style>
