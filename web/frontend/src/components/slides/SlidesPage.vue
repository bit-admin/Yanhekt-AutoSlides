<template>
  <div class="slides-workspace" :class="{ 'is-mobile': isMobile }">
    <header class="sw-chrome">
      <div class="sw-chrome-left">
        <button
          v-if="isMobile"
          type="button"
          class="sw-icon-btn"
          :aria-label="$t('slides.openSidebar')"
          @click="sidebarOpen = true"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <RouterLink class="sw-brand" :to="{ name: 'home' }" :title="$t('slides.backToApp')">
          <svg class="sw-brand-mark" width="22" height="16" viewBox="0 0 30 22" fill="none" aria-hidden="true">
            <rect width="30" height="22" rx="5" fill="#FF0000" />
            <polygon points="12,6 20,11 12,16" fill="white" />
            <line x1="6" y1="18" x2="24" y2="18" stroke="white" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <span class="sw-brand-text">
            <span class="sw-brand-name">{{ $t('slides.workspaceBrand') }}</span>
            <span class="sw-brand-product">{{ $t('slides.workspaceProduct') }}</span>
          </span>
        </RouterLink>
      </div>

      <div class="sw-chrome-right">
        <RouterLink class="sw-back" :to="{ name: 'home' }">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          {{ $t('slides.backToApp') }}
        </RouterLink>
        <button type="button" class="sw-chrome-btn" :disabled="rv.isLoading.value" @click="onRefresh">
          {{ $t('trash.refresh') }}
        </button>
      </div>
    </header>

    <div v-if="bannerError" class="sw-banner" @click="bannerError = ''">{{ bannerError }}</div>

    <div class="sw-body">
      <div
        v-if="isMobile && sidebarOpen"
        class="sw-backdrop"
        @click="sidebarOpen = false"
      />

      <SlidesSidebar
        class="sw-sidebar"
        :class="{ 'is-open': !isMobile || sidebarOpen }"
        :folders="rv.folders.value"
        :active-folder-name="rv.currentFolder.value?.name ?? null"
        :trash-count="rv.trashEntries.value.length"
        @select="onSelectFolder"
        @remove="removeFolderWithConfirm"
        @clear-trash="clearAllTrash"
      />

      <SlidesMain
        :has-folder="!!rv.currentFolder.value"
        :empty-library="rv.folders.value.length === 0 && !rv.isLoading.value"
        :title="reviewTitle"
        :subtitle="reviewSubtitle"
        :items="rv.filteredItems.value"
        :thumbnails="rv.thumbnails.value"
        :selected-ids="rv.selectedIds.value"
        :thumbnail-size="rv.thumbnailSize.value"
        :context-mode="rv.contextMode.value"
        :selected-reason="rv.selectedReason.value"
        :loading="rv.isLoading.value"
        :has-removed-items="rv.hasRemovedItems.value"
        :selected-active-count="rv.selectedActiveItems.value.length"
        :selected-removed-count="rv.selectedRemovedItems.value.length"
        :export-disabled="exportDisabled"
        :exporting-format="slidesExport.exportingFormat.value"
        :export-progress="slidesExport.exportProgress.value"
        :all-selected="allFilteredSelected"
        :empty-message="emptyReviewMessage"
        @update:context-mode="(m) => (rv.contextMode.value = m)"
        @update:selected-reason="(r) => (rv.selectedReason.value = r)"
        @update:thumbnail-size="(n) => (rv.thumbnailSize.value = n)"
        @toggle="rv.toggleSelection($event)"
        @preview="rv.openPreview($event)"
        @restore-item="restoreSingleItem"
        @delete-item="deleteSingleItem"
        @toggle-select-all="toggleSelectAllFiltered"
        @restore="rv.restoreSelected()"
        @delete="deleteSelectedWithConfirm"
        @clear-selection="rv.clearSelection()"
        @export="exportCurrentFolder"
        @clear-folder-trash="clearFolderTrash"
      />
    </div>

    <SlidesPreviewModal
      :item="rv.previewItem.value"
      :items="rv.filteredItems.value"
      :thumbnails="rv.thumbnails.value"
      @close="rv.closePreview()"
      @restore="restoreFromPreview"
      @delete="deleteFromPreview"
      @navigate="rv.openPreview($event)"
    />

    <div v-if="rv.isLoading.value" class="sw-loading">
      <div class="spinner spinner--lg" />
    </div>
  </div>
</template>

<script setup lang="ts">
// Full-page iCloud Photos–style Slides workspace: folder sidebar + main 16:9 grid.
import { computed, nextTick, onActivated, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import SlidesSidebar from './SlidesSidebar.vue'
import SlidesMain from './SlidesMain.vue'
import SlidesPreviewModal from './SlidesPreviewModal.vue'
import { useResultsView } from '../../composables/useResultsView'
import { useSlidesExport, type ExportFormat } from '../../composables/useSlidesExport'
import type { ResultsFolder, ResultsItem } from '../../composables/resultsTypes'

defineOptions({ name: 'SlidesPage' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const rv = useResultsView()
const slidesExport = useSlidesExport()

const bannerError = ref('')
const sidebarOpen = ref(false)
const isMobile = ref(false)
/** Prevents route ↔ selection feedback loops while we replace URLs. */
let syncingRoute = false

function checkMobile(): void {
  isMobile.value = window.innerWidth <= 768
}

const allFilteredSelected = computed(() => {
  const items = rv.filteredItems.value
  if (items.length === 0) return false
  const selected = new Set(rv.selectedIds.value)
  return items.every((item) => selected.has(item.id))
})

const exportDisabled = computed(
  () =>
    slidesExport.isExporting.value ||
    rv.isLoading.value ||
    !rv.folderItems.value.some((item) => item.status === 'active'),
)

const reviewTitle = computed(() => {
  const folder = rv.currentFolder.value
  if (!folder) return ''
  return rv.getFolderDisplayName(folder.name).course || folder.name
})

const reviewSubtitle = computed(() => {
  const folder = rv.currentFolder.value
  if (!folder) return ''
  return rv.getFolderDisplayName(folder.name).details || ''
})

const emptyReviewMessage = computed(() =>
  rv.folderItems.value.length === 0 ? t('trash.emptyFolder') : t('trash.emptyFiltered'),
)

function parseRouteFolderName(): string | null {
  // vue-router already decodes params — do not decodeURIComponent again.
  const raw = route.params.folderName
  const s = Array.isArray(raw) ? raw[0] : raw
  return s && typeof s === 'string' ? s : null
}

function routeToFolder(name: string | null): void {
  syncingRoute = true
  const target =
    name == null
      ? { name: 'slides' as const }
      : { name: 'slides-folder' as const, params: { folderName: name } }
  void router.replace(target).finally(() => {
    void nextTick(() => {
      syncingRoute = false
    })
  })
}

async function openFolder(folder: ResultsFolder): Promise<void> {
  await rv.openFolder(folder)
  routeToFolder(folder.name)
}

async function onSelectFolder(folder: ResultsFolder): Promise<void> {
  await openFolder(folder)
  if (isMobile.value) sidebarOpen.value = false
}

/** Prefer deep-linked folder; otherwise auto-open the first album so main isn't blank. */
async function ensureFolderOpen(): Promise<void> {
  if (syncingRoute) return
  const folderName = parseRouteFolderName()

  if (rv.folders.value.length === 0 && !rv.isLoading.value) {
    if (rv.currentView.value === 'images') rv.goBack()
    return
  }

  if (folderName) {
    if (rv.currentFolder.value?.name === folderName && rv.currentView.value === 'images') {
      return
    }
    const folder = rv.folders.value.find((f) => f.name === folderName)
    if (!folder) {
      bannerError.value = t('slides.folderMissing')
      // Fall through to first folder if any.
    } else {
      await rv.openFolder(folder)
      return
    }
  }

  // Bare /slides or missing deep link: open first folder.
  if (rv.folders.value.length > 0) {
    const first = rv.folders.value[0]
    if (rv.currentFolder.value?.name !== first.name || rv.currentView.value !== 'images') {
      await openFolder(first)
    }
  }
}

async function syncFromRoute(): Promise<void> {
  if (syncingRoute) return
  if (rv.folders.value.length === 0) {
    await rv.refresh()
  }
  await ensureFolderOpen()
}

async function onRefresh(): Promise<void> {
  const result = await rv.refresh()
  if (result === 'folder-missing') {
    bannerError.value = t('slides.folderMissing')
  }
  await ensureFolderOpen()
}

const removeFolderWithConfirm = async (folder: ResultsFolder) => {
  const displayName = rv.getFolderDisplayName(folder.name).course || folder.name
  if (!window.confirm(t('trash.confirmDeleteFolder', { folder: displayName }))) return
  const wasOpen = rv.currentFolder.value?.name === folder.name
  await rv.removeFolders([folder.name])
  if (wasOpen) {
    if (rv.folders.value.length > 0) {
      await openFolder(rv.folders.value[0])
    } else {
      rv.goBack()
      routeToFolder(null)
    }
  }
}

const clearAllTrash = async () => {
  if (!window.confirm(t('trash.confirmClear'))) return
  await rv.clearTrash()
}

const clearFolderTrash = async () => {
  const folder = rv.currentFolder.value
  if (!folder) return
  if (!window.confirm(t('trash.confirmClearFolder', { folder: rv.currentFolderDisplayName.value }))) return
  const ids = rv.trashEntries.value
    .filter((entry) => entry.originalParentFolder === folder.name)
    .map((entry) => entry.id)
  if (ids.length === 0) return
  await rv.clearTrash(ids)
}

const deleteSelectedWithConfirm = async () => {
  const count = rv.selectedActiveItems.value.length
  if (count === 0) return
  if (!window.confirm(t('trash.confirmDelete', { count }))) return
  await rv.deleteSelected()
}

const toggleSelectAllFiltered = () => {
  if (allFilteredSelected.value) {
    rv.clearSelection()
  } else {
    rv.selectAll()
  }
}

const exportCurrentFolder = async (format: ExportFormat) => {
  const folder = rv.currentFolder.value
  if (!folder) return
  await slidesExport.exportFolder(folder.name, format)
}

const restoreFromPreview = async (item: ResultsItem) => {
  rv.closePreview()
  rv.selectedIds.value = [item.id]
  await rv.restoreSelected()
}

const deleteFromPreview = async (item: ResultsItem) => {
  if (!window.confirm(t('trash.confirmDelete', { count: 1 }))) return
  rv.closePreview()
  rv.selectedIds.value = [item.id]
  await rv.deleteSelected()
}

const restoreSingleItem = async (item: ResultsItem) => {
  rv.selectedIds.value = [item.id]
  await rv.restoreSelected()
}

const deleteSingleItem = async (item: ResultsItem) => {
  if (!window.confirm(t('trash.confirmDelete', { count: 1 }))) return
  rv.selectedIds.value = [item.id]
  await rv.deleteSelected()
}

watch(
  () => route.params.folderName,
  () => {
    void ensureFolderOpen()
  },
)

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  void syncFromRoute()
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

onActivated(() => {
  void rv.refresh().then(() => ensureFolderOpen())
})
</script>

<style scoped>
.slides-workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--st-bg);
  color: var(--st-text);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
}

.sw-chrome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 1rem;
  border-bottom: 1px solid var(--st-border);
  background: var(--st-bg);
  z-index: 5;
  flex-shrink: 0;
}

.sw-chrome-left,
.sw-chrome-right {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
}

.sw-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 0.45rem;
  background: transparent;
  color: var(--st-text);
  cursor: pointer;
}

.sw-icon-btn:hover {
  background: var(--st-hover);
}

.sw-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  color: inherit;
  min-width: 0;
}

.sw-brand-mark {
  flex-shrink: 0;
  border-radius: 4px;
}

.sw-brand-text {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3rem;
  min-width: 0;
}

.sw-brand-name {
  font-size: 0.975rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--st-text);
}

.sw-brand-product {
  font-size: 0.975rem;
  font-weight: 600;
  color: var(--st-text-secondary);
}

.sw-back {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.45rem;
  border-radius: 0.4rem;
  text-decoration: none;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--st-text-secondary);
  white-space: nowrap;
}

.sw-back:hover {
  color: var(--st-text);
  background: var(--st-hover);
}

.sw-chrome-btn {
  border: none;
  background: transparent;
  color: var(--st-text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  padding: 0.35rem 0.6rem;
  border-radius: 0.4rem;
  cursor: pointer;
}

.sw-chrome-btn:hover:not(:disabled) {
  background: var(--st-hover);
  color: var(--st-text);
}

.sw-chrome-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.sw-banner {
  margin: 0.5rem 1rem 0;
  padding: 0.5rem 0.8rem;
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--st-danger) 12%, var(--st-surface));
  color: var(--st-danger);
  font-size: 0.8125rem;
  cursor: pointer;
  flex-shrink: 0;
}

.sw-body {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.sw-sidebar {
  flex-shrink: 0;
}

.sw-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.28);
  z-index: 8;
}

.sw-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--st-bg) 55%, transparent);
  z-index: 30;
  pointer-events: none;
}

@media (max-width: 768px) {
  .sw-sidebar {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 10;
    width: min(280px, 86vw);
    transform: translateX(-105%);
    transition: transform 0.2s ease;
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.12);
  }

  .sw-sidebar.is-open {
    transform: translateX(0);
  }

  .sw-back span,
  .sw-chrome-btn {
    font-size: 0.75rem;
  }
}
</style>

<style>
.slides-workspace {
  --st-bg: #ffffff;
  --st-sidebar-bg: #f5f5f7;
  --st-sidebar-active: rgba(0, 0, 0, 0.06);
  --st-surface: #ffffff;
  --st-elevated: #ffffff;
  --st-text: #1d1d1f;
  --st-text-secondary: #6e6e73;
  --st-text-muted: #86868b;
  --st-border: rgba(0, 0, 0, 0.08);
  --st-hover: rgba(0, 0, 0, 0.04);
  --st-active: rgba(0, 0, 0, 0.08);
  --st-accent: #0071e3;
  --st-selection-ring: rgba(0, 113, 227, 0.35);
  --st-danger: #ff3b30;
  --st-media-well: #f0f0f2;
  --st-sidebar-width: 240px;
  --st-toolbar-height: 52px;
  --st-radius-card: 0.5rem;
  --st-radius-control: 0.45rem;
  position: relative;
}

html[data-theme='dark'] .slides-workspace {
  --st-bg: #000000;
  --st-sidebar-bg: #1c1c1e;
  --st-sidebar-active: rgba(255, 255, 255, 0.1);
  --st-surface: #1c1c1e;
  --st-elevated: #2c2c2e;
  --st-text: #f5f5f7;
  --st-text-secondary: #a1a1a6;
  --st-text-muted: #8e8e93;
  --st-border: rgba(255, 255, 255, 0.12);
  --st-hover: rgba(255, 255, 255, 0.08);
  --st-active: rgba(255, 255, 255, 0.12);
  --st-accent: #0a84ff;
  --st-selection-ring: rgba(10, 132, 255, 0.45);
  --st-danger: #ff453a;
  --st-media-well: #1c1c1e;
}
</style>
