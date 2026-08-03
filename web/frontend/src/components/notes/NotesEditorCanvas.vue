<template>
  <section class="nec-canvas">
    <div class="nec-topbar">
      <button
        v-if="mobile"
        type="button"
        class="nec-menu-btn"
        :aria-label="$t('cloudNotes.openSidebar')"
        @click="emit('open-sidebar')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <div class="nec-topbar-spacer" />
      <!-- Save status left of actions so Export/⋯ stay flush to the right edge. -->
      <span
        v-if="hasNote && (saveStatus === 'saving' || saveStatus === 'saved')"
        class="nec-save"
        :class="saveStatus"
      >
        <template v-if="saveStatus === 'saving'">{{ $t('cloudNotes.saving') }}</template>
        <template v-else>{{ $t('cloudNotes.saved') }}</template>
      </span>
      <RouterLink class="nec-back" :to="{ name: 'home' }" :title="$t('cloudNotes.backToApp')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
        <span>{{ $t('cloudNotes.backToApp') }}</span>
      </RouterLink>
      <!-- Share left of Export: Notion-style popover (link-only). Image check runs
           on open so live edits that add images stay shareable. -->
      <div v-if="hasNote" ref="shareRoot" class="nec-share">
        <button
          type="button"
          class="nec-export-btn nec-share-btn"
          :class="{ open: shareOpen }"
          :aria-expanded="shareOpen"
          :title="$t('cloudNotes.shareTip')"
          @click="toggleShare"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span>{{ $t('cloudNotes.shareButton') }}</span>
          <svg class="nec-export-caret" :class="{ flipped: shareOpen }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <div v-if="shareOpen" class="nec-share-menu" role="dialog" :aria-label="$t('cloudNotes.shareTitle')">
          <h3 class="nec-share-title">{{ $t('cloudNotes.shareTitle') }}</h3>
          <p class="nec-share-meta">
            <template v-if="shareImageCount > 0">{{ $t('cloudNotes.shareImagesCount', { n: shareImageCount }) }}</template>
            <template v-else>{{ $t('cloudNotes.shareNoImages') }}</template>
          </p>

          <label class="nec-share-label" for="nec-share-url">{{ $t('cloudNotes.shareLongLabel') }}</label>
          <div class="nec-share-url-row">
            <input
              id="nec-share-url"
              class="nec-share-url"
              readonly
              :value="shareLongUrl"
              :placeholder="shareImageCount === 0 ? $t('cloudNotes.shareNoImages') : ''"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <button
              type="button"
              class="nec-share-copy"
              :disabled="shareImageCount === 0 || !shareLongUrl"
              :title="shareCopied ? $t('cloudNotes.shareCopied') : $t('cloudNotes.shareCopy')"
              :aria-label="shareCopied ? $t('cloudNotes.shareCopied') : $t('cloudNotes.shareCopy')"
              @click="onCopyShare"
            >
              <!-- check mark briefly after copy -->
              <svg v-if="shareCopied" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            class="nec-share-secondary"
            :disabled="shareImageCount === 0 || !shareLongUrl"
            @click="onOpenShare"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            <span>{{ $t('cloudNotes.shareOpen') }}</span>
          </button>

          <p class="nec-share-hint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>{{ $t('cloudNotes.shareImagesOnlyHint') }}</span>
          </p>
        </div>
      </div>
      <div v-if="hasNote && canExport" ref="exportRoot" class="nec-export">
        <button
          type="button"
          class="nec-export-btn"
          :class="{ open: exportOpen }"
          :disabled="exportBusy"
          :aria-expanded="exportOpen"
          :title="$t('cloudNotes.exportTip')"
          @click="toggleExport"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>{{ exportBusy ? $t('cloudNotes.exportBusy') : $t('cloudNotes.exportButton') }}</span>
          <svg class="nec-export-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <div v-if="exportOpen" class="nec-export-menu" role="menu">
          <p class="nec-export-menu-label">{{ $t('cloudNotes.exportFormatLabel') }}</p>
          <button
            type="button"
            class="nec-export-item"
            role="menuitem"
            :disabled="exportBusy"
            @click="runExport('pdf')"
          >
            <span class="nec-export-item-name">{{ $t('cloudNotes.exportPdf') }}</span>
            <span class="nec-export-item-desc">{{ $t('cloudNotes.exportPdfDesc') }}</span>
          </button>
          <button
            type="button"
            class="nec-export-item"
            role="menuitem"
            :disabled="exportBusy"
            @click="runExport('markdown')"
          >
            <span class="nec-export-item-name">{{ $t('cloudNotes.exportMarkdown') }}</span>
            <span class="nec-export-item-desc">{{ $t('cloudNotes.exportMarkdownDesc') }}</span>
          </button>
          <p v-if="exportError" class="nec-export-error">{{ exportError }}</p>
        </div>
      </div>
      <div v-if="hasNote" ref="menuRoot" class="nec-more">
        <button
          type="button"
          class="nec-more-btn"
          :aria-expanded="menuOpen"
          :aria-label="$t('cloudNotes.moreActions')"
          :title="$t('cloudNotes.moreActions')"
          @click="toggleMenu"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="19" cy="12" r="1.6" />
          </svg>
        </button>
        <div v-if="menuOpen" class="nec-more-menu" role="menu">
          <p class="nec-more-section-label">{{ $t('cloudNotes.fontSetLabel') }}</p>
          <div class="nec-font-tiles">
            <button
              v-for="set in NOTES_FONT_SETS"
              :key="set.id"
              type="button"
              class="nec-font-tile"
              :class="{ active: fontSetId === set.id }"
              role="menuitemradio"
              :aria-checked="fontSetId === set.id"
              @click="selectFontSet(set.id)"
            >
              <span class="nec-font-tile-ag" :style="{ fontFamily: set.previewFamily }">Ag</span>
              <span class="nec-font-tile-name">{{ fontSetLabel(set.id) }}</span>
            </button>
          </div>

          <div class="nec-more-divider" />

          <button type="button" class="nec-more-item" role="menuitem" @click="onCopyContents">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>{{ copyFlash ? $t('cloudNotes.copiedContents') : $t('cloudNotes.copyContents') }}</span>
          </button>
          <button type="button" class="nec-more-item" role="menuitem" @click="emit('duplicate'); menuOpen = false">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="8" y="8" width="12" height="12" rx="2" />
              <path d="M4 16V6a2 2 0 0 1 2-2h10" />
            </svg>
            <span>{{ $t('cloudNotes.duplicatePage') }}</span>
          </button>
          <button type="button" class="nec-more-item nec-more-item--danger" role="menuitem" @click="emit('delete'); menuOpen = false">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            <span>{{ $t('cloudNotes.deletePage') }}</span>
          </button>

          <div class="nec-more-divider" />

          <button
            type="button"
            class="nec-more-item nec-more-toggle"
            role="menuitemcheckbox"
            :aria-checked="smallText"
            @click="toggleSmallText"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 7h10M9 7v12M14 17h6M17 11v6" />
            </svg>
            <span>{{ $t('cloudNotes.smallText') }}</span>
            <span class="nec-switch" :class="{ on: smallText }" aria-hidden="true"><span class="nec-switch-knob" /></span>
          </button>
          <button
            type="button"
            class="nec-more-item nec-more-toggle"
            role="menuitemcheckbox"
            :aria-checked="fullWidth"
            @click="toggleFullWidth"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4" />
            </svg>
            <span>{{ $t('cloudNotes.fullWidth') }}</span>
            <span class="nec-switch" :class="{ on: fullWidth }" aria-hidden="true"><span class="nec-switch-knob" /></span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="!hasNote" class="nec-empty">
      <div class="nec-empty-card">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <p>{{ $t('cloudNotes.selectNote') }}</p>
        <button type="button" class="nec-empty-cta" @click="emit('create-note')">
          {{ $t('cloudNotes.newPage') }}
        </button>
      </div>
    </div>

    <div v-else class="nec-doc-scroll custom-scrollbar">
      <div
        class="nec-doc"
        :class="{ 'is-small-text': smallText, 'is-full-width': fullWidth }"
        :style="{ fontFamily: docFontFamily }"
      >
        <input
          class="nec-title"
          :value="title"
          :placeholder="$t('cloudNotes.untitled')"
          @input="onTitleInput"
          @blur="emit('save-title')"
          @keyup.enter="($event.target as HTMLInputElement).blur()"
        />

        <div class="nec-meta">
          <label class="nec-meta-label">
            <span class="nec-meta-caption">{{ $t('cloudNotes.folderLabel') }}</span>
            <select class="nec-group-select" :value="String(groupId)" @change="onGroupChange">
              <option value="0">{{ $t('cloudNotes.defaultGroup') }}</option>
              <option v-for="g in moveGroups" :key="g.id" :value="String(g.id)">{{ g.name }}</option>
            </select>
          </label>
        </div>

        <div
          :ref="(el) => emit('set-holder', el as HTMLElement | null)"
          class="nec-editor-doc"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import type { NoteGroup } from '../../lib/notes/notesTypes'
import { managedNoteDisplayName } from '../../lib/notes/notesTypes'
import {
  NOTES_FONT_FALLBACKS,
  NOTES_FONT_SETS,
  ensureNotesFontSetLoaded,
  isNotesFontSetId,
  type NotesFontSetId,
} from '../../lib/notes/notesFontSets'
import { noteImageUrls } from '../../lib/notes/notesContent'
import { exportNote, noteContentToMarkdown, type NoteExportFormat } from '../../lib/notes/noteExportWeb'
import { buildSharePayload, buildShareUrl, parseCossImageUrl } from '../../lib/notes/shareLink'
import { configStore, persistConfig } from '../../stores/configStore'

const props = defineProps<{
  hasNote: boolean
  title: string
  groupId: number
  moveGroups: NoteGroup[]
  saveStatus: 'idle' | 'saving' | 'saved'
  mobile: boolean
  /** Notes outside ASnote can be exported (PDF / Markdown). */
  canExport: boolean
  /** Live Editor.js document for export / copy / duplicate / share. */
  getContent: () => Promise<string>
}>()

const emit = defineEmits<{
  'open-sidebar': []
  'create-note': []
  'update:title': [value: string]
  'save-title': []
  'move-group': [groupId: number]
  'set-holder': [el: HTMLElement | null]
  duplicate: []
  delete: []
}>()

const { t } = useI18n()

const menuOpen = ref(false)
const menuRoot = ref<HTMLElement | null>(null)
const exportOpen = ref(false)
const exportRoot = ref<HTMLElement | null>(null)
const exportBusy = ref(false)
const exportError = ref('')
const shareOpen = ref(false)
const shareRoot = ref<HTMLElement | null>(null)
const shareLongUrl = ref('')
const shareImageCount = ref(0)
const shareCopied = ref(false)
const copyFlash = ref(false)
let copyFlashTimer: ReturnType<typeof setTimeout> | undefined
let shareCopyTimer: ReturnType<typeof setTimeout> | undefined

const fontSetId = computed<NotesFontSetId>(() => {
  const v = configStore.notesFontSet
  return v === 'serif' || v === 'mono' ? v : 'default'
})

const smallText = computed(() => !!configStore.notesSmallText)
const fullWidth = computed(() => !!configStore.notesFullWidth)

const docFontFamily = computed(() => NOTES_FONT_FALLBACKS[fontSetId.value])

function fontSetLabel(id: NotesFontSetId): string {
  if (id === 'serif') return t('cloudNotes.fontSetSerif')
  if (id === 'mono') return t('cloudNotes.fontSetMono')
  return t('cloudNotes.fontSetDefault')
}

function closeMenus(): void {
  menuOpen.value = false
  exportOpen.value = false
  shareOpen.value = false
}

function toggleMenu(): void {
  exportOpen.value = false
  shareOpen.value = false
  menuOpen.value = !menuOpen.value
  if (menuOpen.value) {
    // Prefetch all three so the Ag tiles render in the real faces.
    void Promise.all(NOTES_FONT_SETS.map((s) => ensureNotesFontSetLoaded(s.id)))
  }
}

function toggleExport(): void {
  if (exportBusy.value) return
  menuOpen.value = false
  shareOpen.value = false
  exportError.value = ''
  exportOpen.value = !exportOpen.value
}

async function toggleShare(): Promise<void> {
  menuOpen.value = false
  exportOpen.value = false
  if (shareOpen.value) {
    shareOpen.value = false
    return
  }
  // Rebuild from live editor content each open (image eligibility is not pre-gated).
  try {
    const content = await props.getContent()
    const urls = noteImageUrls(content)
    const cossCount = urls.reduce((n, u) => n + (parseCossImageUrl(u) ? 1 : 0), 0)
    const title = managedNoteDisplayName(props.title || t('cloudNotes.untitled'))
    const payload = buildSharePayload(title, urls)
    shareImageCount.value = cossCount
    shareLongUrl.value = cossCount > 0 ? buildShareUrl(payload) : ''
  } catch {
    shareImageCount.value = 0
    shareLongUrl.value = ''
  }
  shareCopied.value = false
  shareOpen.value = true
}

async function onCopyShare(): Promise<void> {
  if (!shareLongUrl.value) return
  try {
    await navigator.clipboard.writeText(shareLongUrl.value)
    shareCopied.value = true
    if (shareCopyTimer) clearTimeout(shareCopyTimer)
    shareCopyTimer = setTimeout(() => {
      shareCopied.value = false
    }, 1500)
  } catch {
    /* clipboard denied */
  }
}

function onOpenShare(): void {
  if (!shareLongUrl.value) return
  window.open(shareLongUrl.value, '_blank', 'noopener,noreferrer')
}

function selectFontSet(id: NotesFontSetId): void {
  if (configStore.notesFontSet !== id) {
    configStore.notesFontSet = id
    persistConfig()
  }
  void ensureNotesFontSetLoaded(id)
  // Keep the ⋯ menu open so the user can chain layout toggles.
}

function toggleSmallText(): void {
  configStore.notesSmallText = !configStore.notesSmallText
  persistConfig()
}

function toggleFullWidth(): void {
  configStore.notesFullWidth = !configStore.notesFullWidth
  persistConfig()
}

async function onCopyContents(): Promise<void> {
  try {
    const content = await props.getContent()
    const title = managedNoteDisplayName(props.title || t('cloudNotes.untitled'))
    const md = noteContentToMarkdown(title, content)
    await navigator.clipboard.writeText(md)
    copyFlash.value = true
    if (copyFlashTimer) clearTimeout(copyFlashTimer)
    copyFlashTimer = setTimeout(() => {
      copyFlash.value = false
    }, 1500)
  } catch {
    // Clipboard may be blocked; leave menu open so the user can retry/export.
  }
}

async function runExport(format: NoteExportFormat): Promise<void> {
  if (exportBusy.value) return
  exportBusy.value = true
  exportError.value = ''
  try {
    const content = await props.getContent()
    const title = managedNoteDisplayName(props.title || t('cloudNotes.untitled'))
    const fontSet = isNotesFontSetId(configStore.notesFontSet)
      ? configStore.notesFontSet
      : 'default'
    const res = await exportNote(title, content, format, fontSet)
    if (res.ok) {
      exportOpen.value = false
      if (res.cjkFallback) {
        // Soft notice — file already downloaded.
        exportError.value = t('cloudNotes.exportCjkWarning')
      }
    } else {
      exportError.value = res.error || t('cloudNotes.exportFailed')
    }
  } catch (e) {
    exportError.value = e instanceof Error ? e.message : String(e)
  } finally {
    exportBusy.value = false
  }
}

function onDocPointerDown(e: PointerEvent): void {
  if (!menuOpen.value && !exportOpen.value && !shareOpen.value) return
  const target = e.target
  if (!(target instanceof Node)) return
  if (
    menuRoot.value?.contains(target)
    || exportRoot.value?.contains(target)
    || shareRoot.value?.contains(target)
  ) return
  closeMenus()
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeMenus()
}

// Lazy-load the active set when the canvas mounts or the preference changes.
watch(
  fontSetId,
  (id) => {
    void ensureNotesFontSetLoaded(id)
  },
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown, true)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  document.removeEventListener('keydown', onKeydown)
  if (copyFlashTimer) clearTimeout(copyFlashTimer)
  if (shareCopyTimer) clearTimeout(shareCopyTimer)
})

function onTitleInput(e: Event): void {
  emit('update:title', (e.target as HTMLInputElement).value)
}

function onGroupChange(e: Event): void {
  emit('move-group', Number((e.target as HTMLSelectElement).value))
}
</script>

<style scoped>
.nec-canvas {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--nt-bg, #ffffff);
  color: var(--nt-text, #37352f);
}

.nec-topbar {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  /* Modest right inset so Export / ⋯ aren't hard against the window edge. */
  padding: 6px 12px 6px 14px;
  flex-shrink: 0;
}

.nec-menu-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--nt-text-muted, #787774);
  cursor: pointer;
}

.nec-menu-btn:hover {
  background: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
  color: var(--nt-text, #37352f);
}

.nec-topbar-spacer {
  flex: 1;
}

.nec-export,
.nec-share {
  position: relative;
}

.nec-export-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 8px 0 10px;
  border: 1px solid var(--nt-border, rgba(0, 0, 0, 0.1));
  border-radius: 6px;
  background: transparent;
  color: var(--nt-text-muted, #787774);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
}

.nec-export-btn:hover:not(:disabled),
.nec-export-btn.open {
  background: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
  color: var(--nt-text, #37352f);
}

.nec-export-btn:disabled {
  opacity: 0.65;
  cursor: default;
}

.nec-export-caret {
  margin-left: 1px;
  opacity: 0.75;
  transition: transform 0.15s ease;
}

.nec-export-caret.flipped {
  transform: rotate(180deg);
}

/* Notion-style share popover anchored under the Share button. */
.nec-share-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 40;
  width: min(360px, calc(100vw - 24px));
  padding: 18px 18px 14px;
  border-radius: 12px;
  border: 1px solid var(--nt-border, rgba(0, 0, 0, 0.08));
  background: var(--nt-bg, #ffffff);
  box-shadow: 0 10px 36px rgba(0, 0, 0, 0.14);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.nec-share-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  text-align: center;
  color: var(--nt-text, #37352f);
}

.nec-share-meta {
  margin: -4px 0 2px;
  font-size: 13px;
  text-align: center;
  color: var(--nt-text-muted, #787774);
}

.nec-share-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--nt-text-muted, #787774);
}

.nec-share-url-row {
  display: flex;
  align-items: stretch;
  gap: 0;
  border: 1px solid var(--nt-border, rgba(0, 0, 0, 0.1));
  border-radius: 8px;
  background: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.02));
  overflow: hidden;
}

.nec-share-url {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  height: 34px;
  padding: 0 10px;
  border: none;
  background: transparent;
  color: var(--nt-text, #37352f);
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.nec-share-url:focus {
  outline: none;
}

.nec-share-copy {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  border: none;
  border-left: 1px solid var(--nt-border, rgba(0, 0, 0, 0.08));
  background: transparent;
  color: var(--nt-text-muted, #787774);
  cursor: pointer;
}

.nec-share-copy:hover:not(:disabled) {
  background: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
  color: var(--nt-text, #37352f);
}

.nec-share-copy:disabled {
  opacity: 0.45;
  cursor: default;
}

.nec-share-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 34px;
  border: 1px solid var(--nt-border, rgba(0, 0, 0, 0.1));
  border-radius: 8px;
  background: transparent;
  color: var(--nt-text, #37352f);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.nec-share-secondary:hover:not(:disabled) {
  background: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
}

.nec-share-secondary:disabled {
  opacity: 0.5;
  cursor: default;
}

.nec-share-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 2px 0 0;
  padding-top: 8px;
  border-top: 1px solid var(--nt-border, rgba(0, 0, 0, 0.06));
  font-size: 12px;
  line-height: 1.4;
  color: var(--nt-text-muted, #787774);
}

.nec-share-hint svg {
  flex-shrink: 0;
  margin-top: 1px;
  opacity: 0.85;
}

.nec-export-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 40;
  min-width: 260px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid var(--nt-border, rgba(0, 0, 0, 0.08));
  background: var(--nt-bg, #ffffff);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nec-export-menu-label {
  margin: 0 0 6px;
  padding: 0 2px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--nt-text-muted, #787774);
}

.nec-export-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  /* Keep text left-aligned with FORMAT; small x-padding for hover only. */
  padding: 8px 2px;
  border: none;
  border-radius: 7px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.nec-export-item:hover:not(:disabled) {
  background: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
}

.nec-export-item:disabled {
  opacity: 0.55;
  cursor: default;
}

.nec-export-item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--nt-text, #37352f);
}

.nec-export-item-desc {
  font-size: 11.5px;
  color: var(--nt-text-muted, #787774);
  line-height: 1.3;
}

.nec-export-error {
  margin: 4px 8px 6px;
  font-size: 11.5px;
  color: var(--danger, #d70015);
  line-height: 1.35;
}

.nec-more {
  position: relative;
}

.nec-more-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--nt-border, rgba(0, 0, 0, 0.1));
  border-radius: 6px;
  background: transparent;
  color: var(--nt-text-muted, #787774);
  cursor: pointer;
}

.nec-more-btn:hover,
.nec-more-btn[aria-expanded='true'] {
  background: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
  color: var(--nt-text, #37352f);
}

.nec-more-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 40;
  width: 260px;
  max-width: calc(100vw - 24px);
  padding: 12px;
  border-radius: 10px;
  border: 1px solid var(--nt-border, rgba(0, 0, 0, 0.08));
  background: var(--nt-bg, #ffffff);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.12);
}

.nec-more-section-label {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--nt-text-muted, #787774);
}

.nec-more-divider {
  height: 1px;
  margin: 10px 0;
  background: var(--nt-border, rgba(0, 0, 0, 0.08));
}

.nec-more-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 6px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--nt-text, #37352f);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.nec-more-item:hover {
  background: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
}

.nec-more-item svg {
  flex-shrink: 0;
  color: var(--nt-text-muted, #787774);
}

.nec-more-item--danger {
  color: var(--danger, #d70015);
}

.nec-more-item--danger svg {
  color: inherit;
}

.nec-more-item span:not(.nec-switch):not(.nec-switch-knob) {
  flex: 1;
  min-width: 0;
}

.nec-more-toggle {
  /* label + switch: switch stays right */
}

.nec-switch {
  position: relative;
  width: 32px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--nt-sidebar-active, rgba(0, 0, 0, 0.12));
  transition: background 0.15s ease;
}

.nec-switch.on {
  background: var(--accent, #2383e2);
}

.nec-switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  transition: transform 0.15s ease;
}

.nec-switch.on .nec-switch-knob {
  transform: translateX(14px);
}

.nec-font-tiles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.nec-font-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 6px 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--nt-text-muted, #787774);
  cursor: pointer;
}

.nec-font-tile:hover {
  background: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
}

.nec-font-tile.active {
  background: var(--nt-sidebar-active, rgba(35, 131, 226, 0.12));
  color: var(--accent, #2383e2);
}

.nec-font-tile-ag {
  font-size: 22px;
  line-height: 1.1;
  color: inherit;
}

.nec-font-tile-name {
  font-size: 11px;
  font-weight: 500;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}

.nec-back {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--nt-border, rgba(0, 0, 0, 0.1));
  border-radius: 6px;
  background: transparent;
  color: var(--nt-text-muted, #787774);
  font-size: 12.5px;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}

.nec-back:hover {
  background: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
  color: var(--nt-text, #37352f);
}

.nec-save {
  font-size: 12px;
  color: var(--nt-text-muted, #787774);
  margin-right: 4px;
  white-space: nowrap;
}

.nec-save.saving {
  color: var(--nt-text-muted, #787774);
}

.nec-save.saved {
  color: var(--success, #0f7b6c);
}

.nec-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.nec-empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--nt-text-muted, #787774);
  text-align: center;
}

.nec-empty-card p {
  margin: 0;
  font-size: 14px;
}

.nec-empty-cta {
  margin-top: 4px;
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  background: var(--nt-sidebar-active, rgba(0, 0, 0, 0.08));
  color: var(--nt-text, #37352f);
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
}

.nec-empty-cta:hover {
  background: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.12));
}

.nec-doc-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.nec-doc {
  /* Shared left gutter for title / meta / body so the ＋ / drag-handle
     toolbar doesn't leave body text indented relative to the heading. */
  --nt-toolbar-gutter: 56px;
  --nt-doc-width: var(--nt-doc-max, 52rem);
  --nt-body-size: 16px;
  max-width: var(--nt-doc-width);
  margin: 0 auto;
  padding: 12px 48px 120px;
  box-sizing: border-box;
  font-size: var(--nt-body-size);
  transition: max-width 0.15s ease;
}

.nec-doc.is-full-width {
  --nt-doc-width: min(100%, 96rem);
}

.nec-doc.is-small-text {
  --nt-body-size: 14px;
}

.nec-doc.is-small-text :deep(.ce-paragraph),
.nec-doc.is-small-text :deep(.cdx-block),
.nec-doc.is-small-text :deep(.ce-header[contentEditable]) {
  font-size: inherit;
}

.nec-title {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 8px 0 4px;
  /* Match editor body left edge (body sits after the toolbar gutter). */
  padding-left: var(--nt-toolbar-gutter);
  border: none;
  background: transparent;
  color: var(--nt-text, #37352f);
  font-size: var(--nt-title-size, 2.5rem);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  font-family: inherit;
}

.nec-doc.is-small-text .nec-title {
  font-size: calc(var(--nt-title-size, 2.5rem) * 0.82);
}

.nec-title::placeholder {
  color: var(--nt-text-muted, #787774);
  opacity: 0.55;
}

.nec-title:focus {
  outline: none;
}

.nec-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 4px 0 20px;
  padding-left: var(--nt-toolbar-gutter);
  padding-bottom: 12px;
  border-bottom: 1px solid var(--nt-border, rgba(0, 0, 0, 0.06));
}

.nec-meta-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--nt-text-muted, #787774);
}

.nec-meta-caption {
  flex-shrink: 0;
}

.nec-group-select {
  appearance: none;
  max-width: 12rem;
  padding: 4px 22px 4px 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  background:
    linear-gradient(45deg, transparent 50%, var(--nt-text-muted, #787774) 50%) calc(100% - 10px) 10px / 5px 5px no-repeat,
    linear-gradient(135deg, var(--nt-text-muted, #787774) 50%, transparent 50%) calc(100% - 6px) 10px / 5px 5px no-repeat,
    transparent;
  color: var(--nt-text, #37352f);
  font-size: 12.5px;
  cursor: pointer;
}

.nec-group-select:hover {
  background-color: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
}

.nec-group-select:focus {
  outline: none;
  border-color: var(--nt-border, rgba(0, 0, 0, 0.12));
  background-color: var(--nt-sidebar-hover, rgba(0, 0, 0, 0.04));
}

.nec-editor-doc {
  /* Left gutter for Editor.js block toolbar (＋ / drag handle). */
  padding-left: var(--nt-toolbar-gutter);
  box-sizing: border-box;
  min-height: 12rem;
}

/* Layout only — Editor.js chrome/theme lives in styles/editor.css. */
.nec-editor-doc :deep(.ce-block__content),
.nec-editor-doc :deep(.ce-toolbar__content) {
  max-width: 100%;
  margin: 0;
}

.nec-editor-doc :deep(.ce-paragraph),
.nec-editor-doc :deep(.ce-header),
.nec-editor-doc :deep(.cdx-block) {
  font-family: inherit;
}

.nec-editor-doc :deep(.ce-header) {
  font-weight: 600;
  letter-spacing: -0.01em;
}

@media (max-width: 768px) {
  .nec-doc {
    --nt-toolbar-gutter: 40px;
    padding: 4px 20px 96px;
  }

  .nec-title {
    font-size: 1.85rem;
  }
}
</style>
