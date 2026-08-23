<template>
  <aside class="ns-sidebar">
    <div class="ns-top">
      <div class="ns-brand-row">
        <RouterLink class="ns-brand" :to="{ name: 'home' }" :title="$t('cloudNotes.backToApp')">
          <svg class="ns-brand-mark" width="22" height="16" viewBox="0 0 30 22" fill="none" aria-hidden="true">
            <rect width="30" height="22" rx="5" fill="#FF0000" />
            <polygon points="12,6 20,11 12,16" fill="white" />
            <line x1="6" y1="18" x2="24" y2="18" stroke="white" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <span class="ns-brand-text">
            <span class="ns-brand-name">{{ $t('cloudNotes.workspaceBrand') }}</span>
            <span class="ns-brand-product">{{ $t('cloudNotes.workspaceProduct') }}</span>
          </span>
        </RouterLink>
        <button
          v-if="mobile"
          type="button"
          class="ns-icon-btn"
          :aria-label="$t('cloudNotes.closeSidebar')"
          @click="emit('close')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div class="ns-search-wrap">
        <svg class="ns-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          class="ns-search"
          :value="keyword"
          :placeholder="$t('cloudNotes.searchPlaceholder')"
          @input="onSearchInput"
        />
      </div>

      <button type="button" class="ns-new-page" @click="emit('create-note')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {{ $t('cloudNotes.newPage') }}
      </button>
    </div>

    <div class="ns-scroll custom-scrollbar">
      <!-- Filters: All + groups -->
      <button
        type="button"
        class="ns-row"
        :class="{ active: activeGroupId === '' }"
        @click="emit('set-group', '')"
      >
        <svg class="ns-row-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        <span class="ns-row-label">{{ $t('cloudNotes.allNotes') }}</span>
      </button>

      <div v-if="managedGroups.length > 0" class="ns-section">
        <div class="ns-section-label">{{ $t('cloudNotes.managedSection') }}</div>
        <button
          v-for="g in managedGroups"
          :key="g.id"
          type="button"
          class="ns-row"
          :class="{ active: activeGroupId === g.id }"
          :title="groupLabel(g)"
          @click="emit('set-group', g.id)"
        >
          <svg class="ns-row-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          </svg>
          <span class="ns-row-label">{{ groupLabel(g) }}</span>
        </button>
      </div>

      <div class="ns-section">
        <div class="ns-section-label">{{ $t('cloudNotes.otherGroupsSection') }}</div>
        <div v-for="g in otherGroups" :key="g.id" class="ns-row-wrap">
          <button
            type="button"
            class="ns-row"
            :class="{ active: activeGroupId === g.id }"
            :title="groupLabel(g)"
            @click="emit('set-group', g.id)"
          >
            <svg class="ns-row-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span class="ns-row-label">
              {{ groupLabel(g) }}
            </span>
          </button>
          <button
            v-if="g.id !== 0"
            type="button"
            class="ns-icon-btn ns-row-action"
            :title="$t('cloudNotes.deleteGroup')"
            @click.stop="emit('delete-group', g.id, groupLabel(g))"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>

        <div v-if="creating" class="ns-inline-create">
          <svg class="ns-row-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <input
            ref="inputEl"
            v-model="name"
            class="ns-inline-input"
            :class="{ 'has-error': !!error }"
            :placeholder="$t('cloudNotes.newGroupPlaceholder')"
            :aria-label="$t('cloudNotes.newGroupTitle')"
            :aria-invalid="!!error"
            @keydown.enter.prevent="commit"
            @keydown.esc.prevent="cancel"
            @input="onInput"
            @blur="onBlur"
          />
        </div>
        <button
          v-else
          type="button"
          class="ns-row ns-row--muted"
          @click="startCreate"
        >
          <svg class="ns-row-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span class="ns-row-label">{{ $t('cloudNotes.newGroupTitle') }}</span>
        </button>
      </div>

      <div class="ns-divider" />

      <!-- Note pages under the active filter -->
      <div class="ns-section-label ns-pages-label">
        <span>{{ $t('cloudNotes.pagesSection') }}</span>
        <button
          type="button"
          class="ns-icon-btn"
          :title="$t('cloudNotes.refreshList')"
          :disabled="loading"
          @click="emit('refresh')"
        >
          <svg :class="{ spinning: loading }" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>
      </div>

      <div v-if="loading" class="ns-empty">{{ $t('cloudNotes.loading') }}</div>
      <div v-else-if="notes.length === 0" class="ns-empty">{{ $t('cloudNotes.noNotes') }}</div>
      <div v-for="note in notes" :key="note.id" class="ns-row-wrap">
        <button
          type="button"
          class="ns-row ns-page-row"
          :class="{ active: selectedNoteId === note.id }"
          :title="noteListTitle(note)"
          @click="emit('open-note', note.id)"
        >
          <svg class="ns-row-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span class="ns-row-label">{{ noteListTitle(note) }}</span>
        </button>
        <button
          type="button"
          class="ns-icon-btn ns-row-action"
          :title="$t('cloudNotes.delete')"
          @click.stop="emit('delete-note', note.id)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
    </div>

    <div v-if="totalPages > 1" class="ns-pager">
      <button type="button" class="ns-pager-btn" :disabled="page <= 1" @click="emit('go-page', page - 1)">‹</button>
      <span>{{ page }} / {{ totalPages }}</span>
      <button type="button" class="ns-pager-btn" :disabled="page >= totalPages" @click="emit('go-page', page + 1)">›</button>
    </div>

    <NotesUserMenu />

    <Teleport to="body">
      <div
        v-if="creating && error"
        class="ns-inline-error"
        role="alert"
        :style="errorStyle"
      >{{ error }}</div>
    </Teleport>
  </aside>
</template>

<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  formatNoteDisplayTitle,
  formatNoteGroupLabel,
  NOTE_GROUP_NAME_MAX,
  validateNoteGroupName,
  type NoteGroup,
  type NoteSummary,
} from '../../lib/notes/notesTypes'
import NotesUserMenu from './NotesUserMenu.vue'

const { t } = useI18n()

function groupLabel(g: { id: number; name: string }): string {
  return formatNoteGroupLabel(g, t)
}

const props = defineProps<{
  keyword: string
  activeGroupId: number | ''
  managedGroups: NoteGroup[]
  otherGroups: NoteGroup[]
  notes: NoteSummary[]
  selectedNoteId: number | null
  loading: boolean
  page: number
  totalPages: number
  mobile: boolean
}>()

const emit = defineEmits<{
  close: []
  refresh: []
  'create-note': []
  'create-group': [name: string]
  'set-group': [id: number | '']
  'open-note': [id: number]
  'delete-note': [id: number]
  'delete-group': [id: number, name: string]
  'go-page': [page: number]
  'update:keyword': [value: string]
}>()

function noteListTitle(note: NoteSummary): string {
  const managed = props.managedGroups.some((g) => g.id === note.note_group_id)
  return formatNoteDisplayTitle(note.title, managed) || t('cloudNotes.untitled')
}

function onSearchInput(e: Event): void {
  emit('update:keyword', (e.target as HTMLInputElement).value)
}

const creating = ref(false)
const name = ref('')
const error = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const errorStyle = ref<Record<string, string>>({})
let suppressBlur = false
let committing = false

function existingNames(): string[] {
  return [...props.managedGroups, ...props.otherGroups].map((g) => g.name)
}

function nameMessage(raw: string): string {
  const code = validateNoteGroupName(raw, existingNames())
  if (!code) return ''
  return t(`cloudNotes.groupName.${code}`, { max: NOTE_GROUP_NAME_MAX })
}

function syncErrorPos(): void {
  const el = inputEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  errorStyle.value = {
    top: `${Math.round(r.bottom + 4)}px`,
    left: `${Math.round(r.left)}px`,
    width: `${Math.round(Math.max(r.width, 160))}px`,
  }
}

function startCreate(): void {
  name.value = ''
  error.value = ''
  creating.value = true
  void nextTick(() => {
    inputEl.value?.focus()
    syncErrorPos()
  })
}

function cancel(): void {
  suppressBlur = true
  creating.value = false
  name.value = ''
  error.value = ''
  void nextTick(() => { suppressBlur = false })
}

function onInput(): void {
  const code = validateNoteGroupName(name.value, existingNames())
  if (!code || code === 'empty') {
    error.value = ''
  } else if (code === 'tooLong' || error.value) {
    error.value = nameMessage(name.value)
  }
  void nextTick(syncErrorPos)
}

function commit(): void {
  const err = nameMessage(name.value)
  if (err) {
    error.value = err
    void nextTick(() => {
      syncErrorPos()
      inputEl.value?.focus()
    })
    return
  }
  if (committing) return
  committing = true
  suppressBlur = true
  emit('create-group', name.value.trim())
  creating.value = false
  name.value = ''
  error.value = ''
  committing = false
  void nextTick(() => { suppressBlur = false })
}

function onBlur(): void {
  if (suppressBlur || committing) return
  if (!name.value.trim()) {
    cancel()
    return
  }
  const err = nameMessage(name.value)
  if (err) {
    error.value = err
    void nextTick(syncErrorPos)
    return
  }
  commit()
}

watch(creating, (open) => {
  if (open) window.addEventListener('resize', syncErrorPos)
  else window.removeEventListener('resize', syncErrorPos)
})

onUnmounted(() => {
  window.removeEventListener('resize', syncErrorPos)
})
</script>

<style scoped>
.ns-sidebar {
  display: flex;
  flex-direction: column;
  /* Width is driven by the parent (inline style on desktop, drawer CSS on mobile). */
  width: 100%;
  height: 100%;
  min-height: 0;
  min-width: 0;
  background: var(--nt-sidebar-bg, #f7f7f5);
  color: var(--nt-text, #37352f);
  border-right: 1px solid var(--nt-border, rgba(0, 0, 0, 0.06));
  box-sizing: border-box;
}

.ns-top {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 10px 10px;
  flex-shrink: 0;
}

.ns-brand-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;
  margin-bottom: 6px;
}

.ns-brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: inherit;
  text-decoration: none;
  border-radius: 6px;
  padding: 2px 4px 2px 6px;
}

.ns-brand:hover {
  background: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
}

.ns-brand-mark {
  flex-shrink: 0;
}

.ns-brand-text {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3em;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.ns-brand-name {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--nt-text, #37352f);
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Product word (“Notes”) is quieter — different weight/color from the brand. */
.ns-brand-product {
  font-size: 13.5px;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: var(--nt-text-muted, #787774);
  flex-shrink: 0;
}

.ns-search-wrap {
  position: relative;
}

.ns-search-icon {
  position: absolute;
  left: 9px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--nt-text-muted, #787774);
  pointer-events: none;
}

.ns-search {
  width: 100%;
  box-sizing: border-box;
  padding: 7px 8px 7px 28px;
  border: none;
  border-radius: 6px;
  background: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
  color: var(--nt-text, #37352f);
  font-size: 13px;
}

.ns-search::placeholder {
  color: var(--nt-text-muted, #787774);
}

.ns-search:focus {
  outline: 2px solid var(--nt-accent, #2383e2);
  outline-offset: 0;
}

.ns-new-page {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--nt-text, #37352f);
  font-size: 13.5px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.ns-new-page:hover {
  background: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
}

.ns-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 8px 12px;
}

.ns-section {
  margin-top: 6px;
}

.ns-section-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 8px 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--nt-text-muted, #787774);
}

.ns-pages-label {
  margin-top: 2px;
}

.ns-divider {
  height: 1px;
  margin: 10px 6px;
  background: var(--nt-border, rgba(0, 0, 0, 0.06));
}

.ns-row-wrap {
  display: flex;
  align-items: center;
  border-radius: 6px;
}

.ns-row-wrap:hover .ns-row-action {
  opacity: 1;
}

.ns-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 5px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--nt-text, #37352f);
  font-size: 13.5px;
  text-align: left;
  cursor: pointer;
}

.ns-row:hover {
  background: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
}

.ns-row.active {
  background: var(--nt-sidebar-active, rgba(0, 0, 0, 0.08));
  font-weight: 500;
}

.ns-row--muted {
  color: var(--nt-text-muted, #787774);
}

.ns-row-icon {
  flex-shrink: 0;
  opacity: 0.75;
}

.ns-row-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ns-page-row {
  font-weight: 400;
}

.ns-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--nt-text-muted, #787774);
  cursor: pointer;
  flex-shrink: 0;
}

.ns-icon-btn:hover:not(:disabled) {
  background: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
  color: var(--nt-text, #37352f);
}

.ns-icon-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.ns-row-action {
  opacity: 0;
}

.ns-row-action:hover {
  color: var(--danger, #c4554d) !important;
}

.ns-empty {
  padding: 16px 10px;
  text-align: center;
  font-size: 12.5px;
  color: var(--nt-text-muted, #787774);
}

.ns-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 8px;
  border-top: 1px solid var(--nt-border, rgba(0, 0, 0, 0.06));
  font-size: 12px;
  color: var(--nt-text-muted, #787774);
  flex-shrink: 0;
}

.ns-pager-btn {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.ns-pager-btn:hover:not(:disabled) {
  background: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
  color: var(--nt-text, #37352f);
}

.ns-pager-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.spinning {
  animation: ns-spin 0.9s linear infinite;
}

@keyframes ns-spin {
  to {
    transform: rotate(360deg);
  }
}

.ns-inline-create {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 8px;
}

.ns-inline-input {
  flex: 1 1 auto;
  min-width: 0;
  box-sizing: border-box;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--nt-accent, #2383e2);
  border-radius: 4px;
  background: var(--bg-input, #fff);
  color: var(--nt-text, #37352f);
  font-size: 13px;
  outline: none;
  box-shadow: 0 0 0 1px var(--nt-accent, #2383e2);
}

.ns-inline-input::placeholder {
  color: var(--nt-text-muted, #787774);
}

.ns-inline-input.has-error {
  border-color: var(--danger, #c4554d);
  box-shadow: 0 0 0 1px var(--danger, #c4554d);
}

.ns-inline-error {
  position: fixed;
  z-index: var(--z-overlay, 30);
  box-sizing: border-box;
  padding: 6px 8px;
  background: var(--danger-bg, #ffe8e6);
  border: 1px solid var(--danger-border, #feb2b2);
  border-radius: 4px;
  color: var(--danger, #c4554d);
  font-size: 11px;
  line-height: 1.35;
  box-shadow: 0 4px 12px var(--shadow-md, rgba(0, 0, 0, 0.12));
  pointer-events: none;
}
</style>
