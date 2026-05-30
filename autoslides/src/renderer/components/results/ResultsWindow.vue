<template>
  <div class="flex flex-col h-full bg-surface text-text">
    <div class="flex justify-between items-center py-2.5 px-4 bg-subtle border-b border-border gap-3">
      <div class="flex items-center gap-2">
        <button v-if="currentView === 'images'" class="flex items-center gap-1 py-1.5 px-2.5 border border-border-input rounded bg-surface text-xs cursor-pointer transition-all whitespace-nowrap hover:bg-elevated hover:border-text-muted" @click="goBack">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
          {{ $t('trash.back') }}
        </button>

        <div v-if="currentView === 'images'" class="flex items-center gap-1.5">
          <label class="text-xs text-text-secondary whitespace-nowrap">{{ $t('trash.viewMode') }}:</label>
          <select v-model="contextMode" class="flex items-center gap-1 py-1.5 px-2.5 border border-border-input rounded bg-surface text-xs cursor-pointer transition-all whitespace-nowrap focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed">
            <option value="context">{{ $t('trash.showContext') }}</option>
            <option value="extracted-only">{{ $t('trash.extractedOnly') }}</option>
            <option value="removed-only">{{ $t('trash.removedOnly') }}</option>
          </select>
        </div>

        <div v-if="currentView === 'images'" class="flex items-center gap-1.5">
          <label class="text-xs text-text-secondary whitespace-nowrap">{{ $t('trash.filterReason') }}:</label>
          <select v-model="selectedReason" class="flex items-center gap-1 py-1.5 px-2.5 border border-border-input rounded bg-surface text-xs cursor-pointer transition-all whitespace-nowrap focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed" :disabled="!hasRemovedItems">
            <option value="">{{ $t('trash.all') }}</option>
            <option value="duplicate">{{ $t('trash.duplicate') }}</option>
            <option value="exclusion">{{ $t('trash.exclusion') }}</option>
            <option value="ai_filtered">{{ $t('trash.aiFilteredNotSlide') }}</option>
            <option value="ai_filtered_edit">{{ $t('trash.aiFilteredEdit') }}</option>
            <option value="manual">{{ $t('trash.manual') }}</option>
          </select>
        </div>

        <button class="flex items-center gap-1 py-1.5 px-2.5 border border-border-input rounded bg-surface text-xs cursor-pointer transition-all whitespace-nowrap hover:bg-elevated hover:border-text-muted disabled:opacity-50 disabled:cursor-not-allowed" @click="refresh" :disabled="isLoading">
          <svg width="16" height="16" viewBox="0 0 16 16" :class="{ 'animate-spin': isLoading }">
            <path d="M13.65 2.35A7.958 7.958 0 008 0a8 8 0 108 8h-2a6 6 0 11-1.76-4.24l-2.12 2.12H16V0l-2.35 2.35z" fill="currentColor"/>
          </svg>
          {{ $t('trash.refresh') }}
        </button>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="currentView === 'images'"
          class="flex items-center gap-1 py-1.5 px-2.5 border-none rounded bg-danger text-white text-xs font-medium cursor-pointer transition-all whitespace-nowrap hover:bg-danger-hover disabled:text-white/55 disabled:cursor-not-allowed"
          @click="confirmDelete"
          :disabled="selectedActiveItems.length === 0 || isLoading"
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M5.5 0v1H1v2h14V1h-4.5V0h-5zM2 4l1 11h10l1-11H2zm4 2h1v7H6V6zm3 0h1v7H9V6z" fill="currentColor"/>
          </svg>
          {{ $t('trash.delete') }}
        </button>

        <div
          v-if="currentView === 'images'"
          class="action-split"
          :class="{ 'action-split-open': showRestoreMenu }"
        >
          <button
            class="action-split-main flex items-center gap-1 py-1.5 px-2.5 border-none bg-success text-white text-xs font-medium cursor-pointer transition-all whitespace-nowrap hover:opacity-90 disabled:text-white/55 disabled:cursor-not-allowed"
            @click="restoreSelected"
            :disabled="selectedRemovedItems.length === 0 || isLoading"
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M8 2L4 6h3v6h2V6h3L8 2z" fill="currentColor"/>
              <path d="M2 13h12v1H2v-1z" fill="currentColor"/>
            </svg>
            {{ $t('trash.restore') }}
          </button>
          <button
            class="action-split-toggle border-none bg-success text-white text-xs font-medium cursor-pointer transition-all whitespace-nowrap hover:opacity-90 disabled:text-white/55 disabled:cursor-not-allowed"
            :title="$t('trash.restoreAutoCropMoreOptions')"
            @click.stop="toggleRestoreMenu"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-if="showRestoreMenu" class="action-split-menu">
            <button
              class="action-split-menu-item"
              :disabled="!hasCroppedInCurrentFolder || isLoading"
              :title="$t('trash.restoreAllCroppedHint')"
              @click="handleRestoreCropped"
            >
              <div class="text-[11px] font-medium leading-tight whitespace-nowrap">{{ $t('trash.restoreAllCropped') }}</div>
            </button>
          </div>
        </div>

        <div
          v-if="currentView === 'images'"
          class="action-split"
          :class="{ 'action-split-open': showAutoCropMenu }"
        >
          <button
            class="action-split-main flex items-center gap-1 py-1.5 px-2.5 border-none bg-accent text-white text-xs font-medium cursor-pointer transition-all whitespace-nowrap hover:bg-accent-hover disabled:text-white/55 disabled:cursor-not-allowed"
            @click="handleAutoCropSelected"
            :disabled="!canAutoCropSelected || isLoading"
            :title="$t('trash.autoCropSelectedHint')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M17 15h2V7c0-1.1-.9-2-2-2H9v2h8v8zM7 17V1H5v4H1v2h4v10c0 1.1.9 2 2 2h10v4h2v-4h4v-2H7z" fill="currentColor"/>
            </svg>
            {{ $t('trash.autoCropSelected') }}
          </button>
          <button
            class="action-split-toggle border-none bg-accent text-white text-xs font-medium cursor-pointer transition-all whitespace-nowrap hover:bg-accent-hover disabled:text-white/55 disabled:cursor-not-allowed"
            :title="$t('trash.restoreAutoCropMoreOptions')"
            @click.stop="toggleAutoCropMenu"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-if="showAutoCropMenu" class="action-split-menu action-split-menu-accent">
            <button
              class="action-split-menu-item action-split-menu-item-accent"
              :disabled="!canRunBaselineAction || isLoading"
              :title="baselineActionTitle"
              @click="handleBaselineAction"
            >
              <div class="text-[11px] font-medium leading-tight whitespace-nowrap">{{ baselineActionLabel }}</div>
            </button>
          </div>
        </div>

        <div
          v-if="currentView === 'images'"
          class="action-split"
          :class="{ 'action-split-open': showRemoveDuplicatesMenu }"
        >
          <button
            class="action-split-main flex items-center gap-1 py-1.5 px-2.5 border-none bg-text-warning text-white text-xs font-medium cursor-pointer transition-all whitespace-nowrap hover:bg-text-warning disabled:text-white/55 disabled:cursor-not-allowed"
            @click="handleRemoveDuplicates"
            :disabled="!canRemoveDuplicatesInCurrentFolder || isLoading"
            :title="$t('trash.removeDuplicatesHint')"
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <rect x="1.5" y="4.5" width="8.5" height="8.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/>
              <path d="M5.5 3V2.5c0-.8.7-1.5 1.5-1.5h5c.8 0 1.5.7 1.5 1.5v5c0 .8-.7 1.5-1.5 1.5h-.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              <path d="M4 8.75h3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            {{ $t('trash.removeDuplicates') }}
          </button>
          <button
            class="action-split-toggle border-none bg-text-warning text-white text-xs font-medium cursor-pointer transition-all whitespace-nowrap hover:bg-text-warning disabled:text-white/55 disabled:cursor-not-allowed"
            :title="$t('trash.restoreAutoCropMoreOptions')"
            @click.stop="toggleRemoveDuplicatesMenu"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-if="showRemoveDuplicatesMenu" class="action-split-menu action-split-menu-dedup">
            <label
              class="flex items-center gap-1.5 min-h-[30px] py-1.5 px-2.5 text-white cursor-pointer transition-colors hover:bg-text-warning"
              :title="$t('trash.removeDuplicatesAfterActionsHint')"
              @click.stop
            >
              <input type="checkbox" v-model="dedupAfterCropActions" class="shrink-0 w-3.5 h-3.5 m-0 accent-accent cursor-pointer" :disabled="isLoading" />
              <span class="flex-1 min-w-0 text-[11px] font-medium leading-tight whitespace-nowrap">{{ $t('trash.removeDuplicatesAfterActions') }}</span>
            </label>
          </div>
        </div>

        <button
          v-if="currentView === 'folders' && isFolderEditMode"
          class="flex items-center gap-1 py-1.5 px-2.5 border-none rounded bg-danger text-white text-xs font-medium cursor-pointer transition-all whitespace-nowrap hover:bg-danger-hover disabled:text-white/55 disabled:cursor-not-allowed"
          :disabled="!canClearSelectedFolders || isLoading"
          @click="handleClearSelectedFolders"
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M5.5 0v1H1v2h14V1h-4.5V0h-5zM2 4l1 11h10l1-11H2zm4 2h1v7H6V6zm3 0h1v7H9V6z" fill="currentColor"/>
          </svg>
          {{ $t('trash.clearFolder') }}
          <span v-if="selectedFolderNames.length > 0" class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.25 ml-1 rounded-full bg-white/25 text-white text-[11px] font-semibold tabular-nums">{{ selectedFolderNames.length }}</span>
        </button>

        <button
          v-if="currentView === 'folders'"
          class="flex items-center gap-1 py-1.5 px-3 border border-border-input rounded bg-surface text-text text-xs font-medium cursor-pointer transition-all whitespace-nowrap hover:bg-elevated hover:border-text-muted disabled:opacity-50 disabled:cursor-not-allowed"
          :class="{ '!bg-accent !border-accent !text-white hover:!bg-accent-hover hover:!border-accent-hover': isFolderEditMode }"
          :disabled="!canEditFolders || isLoading"
          @click="toggleFolderEditMode"
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <rect x="1.5" y="1.5" width="13" height="13" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.4"/>
            <path d="M4.5 8.2l2.4 2.4 4.6-5.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          {{ isFolderEditMode ? $t('trash.doneEditing') : $t('trash.editFolders') }}
        </button>

        <button
          class="flex items-center gap-1 py-1.5 px-2.5 border-none rounded bg-text-muted text-white text-xs font-medium cursor-pointer transition-all whitespace-nowrap hover:opacity-90 disabled:text-white/55 disabled:cursor-not-allowed"
          @click="confirmClearTrash"
          :disabled="!canClearTrash || isLoading"
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M5.5 0v1H1v2h14V1h-4.5V0h-5zM2 4l1 11h10l1-11H2zm4 2h1v7H6V6zm3 0h1v7H9V6z" fill="currentColor"/>
          </svg>
          {{ $t('trash.clearTrash') }}
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4 scrollbar-thin" ref="contentAreaRef">
      <div v-if="isLoading" class="flex flex-col items-center justify-center h-full gap-4 text-text-muted">
        <div class="spinner"></div>
        <span>{{ $t('trash.loading') }}</span>
      </div>

      <template v-else-if="currentView === 'folders'">
        <div v-if="folders.length === 0" class="flex flex-col items-center justify-center h-full gap-4 text-text-muted">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <path d="M8 12v40h48V20H32l-6-8H8z" fill="currentColor" opacity="0.3"/>
          </svg>
          <span>{{ $t('trash.noResultsFolders') }}</span>
        </div>

        <div v-else class="flex flex-col gap-1">
          <div
            v-for="(group, groupIdx) in courseGroups"
            :key="group.courseName || groupIdx"
            :class="{ 'course-group': isGroupingActive }"
          >
            <div
              v-if="isGroupingActive"
              class="course-header"
              @click="isFolderEditMode && selectAllInCourse(group.folderNames)"
            >
              <input
                v-if="isFolderEditMode"
                type="checkbox"
                class="course-checkbox"
                :checked="isCourseFullySelected(group.folderNames)"
                :indeterminate.prop="isCoursePartiallySelected(group.folderNames)"
                @click.stop
                @change="selectAllInCourse(group.folderNames)"
              />
              <svg class="shrink-0" width="16" height="16" viewBox="0 0 16 16">
                <path d="M8 2L1 6l7 4 7-4L8 2z" fill="#3b6ea5"/>
                <path d="M4 7.5v4c0 1.2 1.8 2 4 2s4-.8 4-2v-4L8 10.5 4 7.5z" fill="#5a9fd4"/>
              </svg>
              <span class="course-name">{{ group.courseName }}</span>
              <svg
                class="course-chevron"
                :class="{ collapsed: isCourseCollapsed(group.courseName) }"
                width="14" height="14" viewBox="0 0 16 16"
                @click.stop="toggleCourseCollapse(group.courseName)"
              >
                <path d="M4 3l6 5-6 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>

            <template v-if="!isCourseCollapsed(group.courseName)">
            <button
              v-for="entry in group.folders"
              :key="entry.folder.name"
              class="folder-item"
              :class="{
                'folder-item-grouped': isGroupingActive,
                'folder-item-last-visited': !isFolderEditMode && entry.folder.name === lastVisitedFolderName,
                'folder-item-selected': isFolderEditMode && selectedFolderNames.includes(entry.folder.name),
                'folder-item-edit': isFolderEditMode,
              }"
              :ref="(el) => setFolderItemRef(entry.folder.name, el as HTMLButtonElement | null)"
              @click="isFolderEditMode ? toggleFolderSelection(entry.folder.name) : handleOpenFolder(entry.folder)"
            >
              <div v-if="isFolderEditMode" class="flex items-center shrink-0">
                <input
                  type="checkbox"
                  :checked="selectedFolderNames.includes(entry.folder.name)"
                  class="w-4 h-4 cursor-pointer"
                  @click.stop
                  @change="toggleFolderSelection(entry.folder.name)"
                />
              </div>

              <div class="flex items-center shrink-0">
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path d="M3 5v14h18V8h-9l-2-3H3z" fill="#f0c36d"/>
                  <path d="M3 8h18v11H3V8z" fill="#f7d994"/>
                </svg>
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="flex-1 min-w-0 text-[13px] font-semibold text-text overflow-hidden text-ellipsis whitespace-nowrap">{{ formatToolFolderName(entry.folder.name) }}</span>
                  <div class="flex items-center gap-2 shrink-0 text-text-muted text-xs font-medium">
                    <span class="inline-flex items-baseline gap-1">
                      <span class="tabular-nums">{{ entry.folder.activeCount }}</span>
                      <span class="text-inherit lowercase">{{ $t('trash.active') }}</span>
                    </span>
                    <span class="text-[#a0a8b1]">/</span>
                    <span class="inline-flex items-baseline gap-1">
                      <span class="tabular-nums">{{ entry.folder.removedCount }}</span>
                      <span class="text-inherit lowercase">{{ $t('trash.removed') }}</span>
                    </span>
                  </div>
                </div>
              </div>

              <svg v-if="!isFolderEditMode" class="shrink-0 text-text-muted" width="16" height="16" viewBox="0 0 16 16">
                <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            </template>
          </div>
        </div>
      </template>

      <template v-else>
        <div v-if="filteredItems.length === 0" class="flex flex-col items-center justify-center h-full gap-4 text-text-muted">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <rect x="8" y="8" width="48" height="48" fill="currentColor" opacity="0.3"/>
            <circle cx="22" cy="22" r="6" fill="currentColor" opacity="0.2"/>
            <path d="M8 44l16-16 12 12 12-16 8 8v24H8V44z" fill="currentColor" opacity="0.2"/>
          </svg>
          <span>{{ folderItems.length === 0 ? $t('trash.emptyFolder') : $t('trash.emptyFiltered') }}</span>
        </div>

        <ResultsImageGrid
          v-else
          :items="filteredItems"
          :selected-ids="selectedIds"
          :thumbnails="thumbnails"
          :thumbnail-size="thumbnailSize"
          @toggle-selection="toggleSelection"
          @preview="openPreview"
        />
      </template>
    </div>

    <div class="flex justify-between items-center py-2 px-4 bg-subtle border-t border-border text-xs text-text-secondary">
      <div class="flex items-center gap-3">
        <span v-if="currentView === 'folders'">{{ $t('trash.total') }}: {{ folders.length }}</span>
        <template v-else>
          <button
            class="py-1 px-2.5 text-xs border border-border-strong rounded bg-surface text-text cursor-pointer transition-colors hover:bg-elevated hover:border-text-muted disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="filteredItems.length === 0"
            @click="toggleSelectAllFiltered"
          >
            {{ allFilteredSelected ? $t('trash.clearSelection') : $t('trash.selectAll') }}
          </button>
          <span>{{ $t('trash.selected') }}: {{ selectedIds.length }} / {{ $t('trash.total') }}: {{ filteredItems.length }}</span>
        </template>
      </div>

      <div v-if="currentView === 'images'" class="flex items-center gap-1.5 py-1 px-2 bg-elevated rounded-md">
        <svg width="12" height="12" viewBox="0 0 16 16" class="text-text-secondary shrink-0">
          <rect x="3" y="3" width="10" height="10" fill="currentColor" opacity="0.6"/>
        </svg>
        <input
          type="range"
          v-model="thumbnailSize"
          min="180"
          max="640"
          step="20"
          class="size-slider"
        />
        <svg width="16" height="16" viewBox="0 0 16 16" class="text-text-secondary shrink-0">
          <rect x="2" y="2" width="12" height="12" fill="currentColor" opacity="0.6"/>
        </svg>
      </div>

      <label v-if="currentView === 'folders'" class="flex items-center gap-1.5 py-0.5 px-2 border border-border rounded bg-elevated text-xs text-text-secondary cursor-pointer whitespace-nowrap transition-colors hover:bg-hover hover:border-border-strong">
        <input type="checkbox" v-model="groupByCourse" class="w-[11px] h-[11px] m-0 accent-accent cursor-pointer" />
        <span>{{ $t('trash.groupByCourse') }}</span>
      </label>
    </div>

    <div v-if="previewItem" class="preview-overlay" @click="closePreview">
      <div class="preview-modal" :class="{ 'metadata-visible': showPreviewMetadata, 'crop-mode': isCropMode }" @click.stop>
        <button class="preview-close" @click="closePreview">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>

        <div class="preview-content">
          <div class="preview-image-container">
            <div ref="previewStageShell" class="preview-stage-shell" :class="{ 'crop-active': isCropMode }">
              <div
                ref="previewStage"
                class="preview-stage"
                :class="{ 'crop-stage': isCropMode }"
                :style="previewStageStyle"
                @pointerdown="handleCropStagePointerDown"
              >
                <img
                  v-if="previewImageSrc"
                  :src="previewImageSrc"
                  :alt="previewItem.name"
                  class="preview-image"
                  draggable="false"
                  @load="handlePreviewImageLoad"
                />
                <div v-else class="preview-image-placeholder">
                  <svg width="64" height="64" viewBox="0 0 64 64">
                    <rect x="8" y="8" width="48" height="48" fill="currentColor" opacity="0.2"/>
                  </svg>
                </div>

                <div
                  v-if="isCropMode && cropRectPx"
                  class="crop-selection"
                  :style="cropSelectionStyle"
                  @pointerdown.stop="startCropInteraction('move', $event)"
                >
                  <div class="crop-grid">
                    <span v-for="line in 2" :key="`v-${line}`" class="crop-grid-line vertical" :style="{ left: `${line * 33.333}%` }"></span>
                    <span v-for="line in 2" :key="`h-${line}`" class="crop-grid-line horizontal" :style="{ top: `${line * 33.333}%` }"></span>
                  </div>
                  <button
                    v-for="handle in cropHandles"
                    :key="handle"
                    type="button"
                    class="crop-handle"
                    :class="`crop-handle-${handle}`"
                    @pointerdown.stop="startCropInteraction(handle, $event)"
                  ></button>
                </div>
              </div>
            </div>

            <div class="preview-actions">
              <template v-if="isCropMode">
                <button class="preview-action-btn" :disabled="isLoading" @click="cancelCropMode">
                  {{ $t('trash.cancel') }}
                </button>
                <button class="preview-action-btn preview-action-btn-primary" :disabled="!canApplyCrop || isLoading" @click="applyCrop">
                  {{ $t('trash.applyCrop') }}
                </button>
              </template>
              <template v-else>
                <button
                  v-if="canRestoreCrop"
                  class="preview-action-btn"
                  :disabled="isLoading"
                  @click="restoreCrop"
                >
                  {{ $t('trash.restoreCrop') }}
                </button>
                <button
                  v-if="canRecrop"
                  class="preview-action-btn"
                  :disabled="isLoading"
                  @click="startCropMode"
                >
                  {{ $t('trash.recrop') }}
                </button>
                <template v-else-if="canStartCrop">
                  <button
                    class="preview-action-btn"
                    :disabled="isLoading || isAutoCropDetecting"
                    @click="startCropMode"
                  >
                    {{ $t('trash.crop') }}
                  </button>
                  <button
                    class="preview-action-btn"
                    :disabled="isLoading || isAutoCropDetecting"
                    @click="startAutoCropMode"
                  >
                    {{ $t('trash.autoCrop') }}
                  </button>
                </template>
                <button
                  v-if="canSetCurrentAsBaseline"
                  class="preview-action-btn"
                  :disabled="isLoading || isCurrentPreviewBaseline"
                  :title="isCurrentPreviewBaseline ? $t('trash.currentBaselineTooltip') : $t('trash.useAsCropBaselineHint')"
                  @click="handleSetBaseline"
                >
                  {{ $t('trash.useAsCropBaseline') }}
                </button>
                <button class="preview-action-btn" @click="togglePreviewMetadata">
                  <span>{{ showPreviewMetadata ? $t('trash.hideMetadata') : $t('trash.showMetadata') }}</span>
                  <svg width="14" height="14" viewBox="0 0 16 16">
                    <path
                      :d="showPreviewMetadata ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              </template>
            </div>
          </div>

          <div class="preview-info-container">
            <div class="preview-info-title">{{ $t('trash.metadata') }}</div>
            <table class="preview-info-table">
              <tbody>
                <tr>
                  <td class="info-label">{{ $t('trash.filename') }}</td>
                  <td class="info-value">{{ previewItem.name }}</td>
                </tr>
                <tr>
                  <td class="info-label">{{ $t('trash.folder') }}</td>
                  <td class="info-value">{{ currentFolderDisplayName }}</td>
                </tr>
                <tr>
                  <td class="info-label">{{ $t('trash.status') }}</td>
                  <td class="info-value">
                    <span v-if="previewItem.status === 'active' && previewItem.isCropped" class="status-badge status-cropped">{{ getCropLabel() }}</span>
                    <span class="status-badge" :class="previewItem.status === 'active' ? 'status-active' : 'status-removed'">{{ getStatusLabel(previewItem.status) }}</span>
                  </td>
                </tr>
                <tr v-if="previewItem.status === 'active'">
                  <td class="info-label">{{ $t('trash.currentPath') }}</td>
                  <td class="info-value info-path">{{ previewItem.imagePath || previewItem.originalPath }}</td>
                </tr>
                <tr v-if="previewItem.status === 'active' && previewItem.isCropped && previewItem.croppedAt">
                  <td class="info-label">{{ $t('trash.croppedAt') }}</td>
                  <td class="info-value">{{ formatDate(previewItem.croppedAt) }}</td>
                </tr>
                <tr v-if="previewItem.status === 'active' && previewItem.isCropped && previewItem.cropRect">
                  <td class="info-label">{{ $t('trash.cropArea') }}</td>
                  <td class="info-value">{{ formatCropArea(previewItem.cropRect) }}</td>
                </tr>
                <tr v-if="previewItem.status === 'removed'">
                  <td class="info-label">{{ $t('trash.originalPath') }}</td>
                  <td class="info-value info-path">{{ previewItem.originalPath }}</td>
                </tr>
                <tr v-if="previewItem.status === 'removed' && previewItem.reason">
                  <td class="info-label">{{ $t('trash.filterReason') }}</td>
                  <td class="info-value">
                    <span :class="['reason-badge', `reason-${previewItem.reason}`]">{{ getReasonLabel(previewItem.reason) }}</span>
                  </td>
                </tr>
                <tr v-if="previewItem.status === 'removed' && previewItem.reasonDetails">
                  <td class="info-label">{{ $t('trash.reasonDetails') }}</td>
                  <td class="info-value">{{ previewItem.reasonDetails }}</td>
                </tr>
                <tr v-if="previewItem.status === 'removed' && previewItem.trashedAt">
                  <td class="info-label">{{ $t('trash.trashedAt') }}</td>
                  <td class="info-value">{{ formatDate(previewItem.trashedAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { createAutoCropWorkerClient } from '@shared/autoCrop'
import { useResultsView, type CropRect, type ResultsItem, type ResultsReason } from '@features/results/useResultsView'
import { useCropEditor, type CropHandle } from '@features/results/useCropEditor'
import { getCourseName } from '@shared/utils/toolWindowFolders'
import ResultsImageGrid from './ResultsImageGrid.vue'

const { t } = useI18n()

const {
  folders,
  currentView,
  currentFolder,
  lastVisitedFolderName,
  currentFolderDisplayName,
  folderItems,
  filteredItems,
  selectedIds,
  selectedActiveItems,
  selectedRemovedItems,
  selectedReason,
  contextMode,
  thumbnails,
  thumbnailSize,
  isLoading,
  previewItem,
  baselineCrop,
  hasRemovedItems,
  canAutoCropSelected,
  canSetCurrentAsBaseline,
  canSetSelectedAsBaseline,
  isCurrentPreviewBaseline,
  canApplyBaselineSelected,
  canRemoveDuplicatesInCurrentFolder,
  hasCroppedInCurrentFolder,
  hasAutoCroppedInCurrentFolder,
  trashEntries,
  openFolder,
  goBack,
  refresh,
  toggleSelection,
  openPreview: openPreviewItem,
  closePreview: closePreviewItem,
  deleteSelected,
  restoreSelected,
  autoCropSelected,
  setBaselineCrop,
  setSelectedBaselineCrop,
  clearBaselineCrop,
  applyBaselineToSelected,
  removeDuplicatesInCurrentFolder,
  restoreAllCroppedInFolder,
  restoreAutoCroppedInFolder,
  clearTrash,
  removeFolders,
  applyCropToImage,
  restoreCropFromImage,
  formatDate,
  formatToolFolderName,
} = useResultsView()


const allFilteredSelected = computed(() => {
  if (filteredItems.value.length === 0) return false
  const selected = new Set(selectedIds.value)
  return filteredItems.value.every((item) => selected.has(item.id))
})

function toggleSelectAllFiltered() {
  if (filteredItems.value.length === 0) return
  const filteredIds = filteredItems.value.map((item) => item.id)
  if (allFilteredSelected.value) {
    const filteredSet = new Set(filteredIds)
    selectedIds.value = selectedIds.value.filter((id) => !filteredSet.has(id))
  } else {
    const merged = new Set(selectedIds.value)
    filteredIds.forEach((id) => merged.add(id))
    selectedIds.value = Array.from(merged)
  }
}

const contentAreaRef = ref<HTMLDivElement | null>(null)
const folderItemRefs = new Map<string, HTMLButtonElement>()
const folderScrollTop = ref(0)

function setFolderItemRef(name: string, el: HTMLButtonElement | null) {
  if (el) {
    folderItemRefs.set(name, el)
  } else {
    folderItemRefs.delete(name)
  }
}

async function handleOpenFolder(folder: { name: string }) {
  folderScrollTop.value = contentAreaRef.value?.scrollTop ?? 0
  const target = folders.value.find((f) => f.name === folder.name)
  if (target) {
    await openFolder(target)
  }
}

watch(currentView, async (view) => {
  if (view !== 'folders') return
  await nextTick()
  const container = contentAreaRef.value
  if (!container) return
  container.scrollTop = folderScrollTop.value
  const target = lastVisitedFolderName.value
    ? folderItemRefs.get(lastVisitedFolderName.value)
    : null
  if (target) {
    const containerRect = container.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    if (targetRect.top < containerRect.top || targetRect.bottom > containerRect.bottom) {
      target.scrollIntoView({ block: 'nearest' })
    }
  }
})

const showPreviewMetadata = ref(false)

const autoCropClient = createAutoCropWorkerClient()
onBeforeUnmount(() => autoCropClient.destroy())
const detectBbox = autoCropClient.detectBbox

const {
  isCropMode,
  cropRectPx,
  previewStageShell,
  previewStage,
  isAutoCropDetecting,
  previewImageSrc,
  canRestoreCrop,
  canRecrop,
  canStartCrop,
  canApplyCrop,
  previewStageStyle,
  cropSelectionStyle,
  resetCropState,
  handlePreviewImageLoad,
  startCropMode,
  cancelCropMode,
  startAutoCropMode,
  handleCropStagePointerDown,
  startCropInteraction,
  applyCrop,
  restoreCrop,
} = useCropEditor({
  previewItem,
  isLoading,
  thumbnails,
  showPreviewMetadata,
  applyCropToImage,
  restoreCropFromImage,
  detectBbox,
  t,
})

const DEDUP_AFTER_CROP_ACTIONS_KEY = 'autoslides.results.dedupAfterCropActions'

const readDedupAfterCropActions = () => {
  try {
    return window.sessionStorage.getItem(DEDUP_AFTER_CROP_ACTIONS_KEY) !== 'false'
  } catch {
    return true
  }
}

const dedupAfterCropActions = ref(readDedupAfterCropActions())
const showRestoreMenu = ref(false)
const showAutoCropMenu = ref(false)
const showRemoveDuplicatesMenu = ref(false)

watch(dedupAfterCropActions, (value) => {
  try {
    window.sessionStorage.setItem(DEDUP_AFTER_CROP_ACTIONS_KEY, value ? 'true' : 'false')
  } catch {
    // Session storage can be unavailable in restricted renderer contexts.
  }
})

const cropHandles: CropHandle[] = ['nw', 'ne', 'sw', 'se']

const currentFolderRemovedIds = computed(() => {
  return folderItems.value
    .filter((item) => item.status === 'removed')
    .map((item) => item.id)
})

const hasCropBaseline = computed(() => !!baselineCrop.value)

const baselineActionLabel = computed(() => {
  return hasCropBaseline.value ? t('trash.applyBaseline') : t('trash.setBaseline')
})

const baselineActionTitle = computed(() => {
  return hasCropBaseline.value ? t('trash.applyBaselineHint') : t('trash.setBaselineHint')
})

const canRunBaselineAction = computed(() => {
  return hasCropBaseline.value ? canApplyBaselineSelected.value : canSetSelectedAsBaseline.value
})

const canClearTrash = computed(() => {
  if (currentView.value === 'images') {
    return currentFolderRemovedIds.value.length > 0
  }

  return folders.value.some((folder) => folder.removedCount > 0)
})

const isFolderEditMode = ref(false)
const selectedFolderNames = ref<string[]>([])
const groupByCourse = ref(true)

const isGroupingActive = computed(() => groupByCourse.value)
const collapsedCourses = ref<Set<string>>(new Set())

const toggleCourseCollapse = (courseName: string) => {
  if (collapsedCourses.value.has(courseName)) {
    collapsedCourses.value.delete(courseName)
  } else {
    collapsedCourses.value.add(courseName)
  }
}

const isCourseCollapsed = (courseName: string) => collapsedCourses.value.has(courseName)

interface CourseGroup {
  courseName: string
  folderNames: string[]
  folders: Array<{ folder: (typeof folders.value)[number]; index: number }>
}

const courseGroups = computed<CourseGroup[]>(() => {
  if (!isGroupingActive.value) {
    return [{
      courseName: '',
      folderNames: folders.value.map((f) => f.name),
      folders: folders.value.map((folder, index) => ({ folder, index })),
    }]
  }
  const groups: CourseGroup[] = []
  let current: CourseGroup | null = null
  folders.value.forEach((folder, index) => {
    const courseName = getCourseName(folder.name)
    if (!current || current.courseName !== courseName) {
      current = { courseName, folderNames: [], folders: [] }
      groups.push(current)
    }
    current.folderNames.push(folder.name)
    current.folders.push({ folder, index })
  })
  return groups
})

const isCourseFullySelected = (folderNames: string[]) => {
  if (folderNames.length === 0) return false
  return folderNames.every((name) => selectedFolderNames.value.includes(name))
}

const isCoursePartiallySelected = (folderNames: string[]) => {
  if (folderNames.length === 0) return false
  const selected = selectedFolderNames.value
  const count = folderNames.filter((name) => selected.includes(name)).length
  return count > 0 && count < folderNames.length
}

function selectAllInCourse(folderNames: string[]) {
  if (folderNames.length === 0) return
  if (isCourseFullySelected(folderNames)) {
    const remove = new Set(folderNames)
    selectedFolderNames.value = selectedFolderNames.value.filter((name) => !remove.has(name))
    return
  }
  const merged = new Set(selectedFolderNames.value)
  folderNames.forEach((name) => merged.add(name))
  selectedFolderNames.value = Array.from(merged)
}

const canEditFolders = computed(() => folders.value.length > 0)
const canClearSelectedFolders = computed(
  () => isFolderEditMode.value && selectedFolderNames.value.length > 0,
)

watch(currentView, (view) => {
  if (view !== 'folders') {
    isFolderEditMode.value = false
    selectedFolderNames.value = []
  }
})

watch(folders, (list) => {
  if (selectedFolderNames.value.length === 0) return
  const available = new Set(list.map((folder) => folder.name))
  selectedFolderNames.value = selectedFolderNames.value.filter((name) => available.has(name))
})

function toggleFolderEditMode() {
  isFolderEditMode.value = !isFolderEditMode.value
  if (!isFolderEditMode.value) {
    selectedFolderNames.value = []
  }
}

function toggleFolderSelection(name: string) {
  const index = selectedFolderNames.value.indexOf(name)
  if (index === -1) {
    selectedFolderNames.value.push(name)
  } else {
    selectedFolderNames.value.splice(index, 1)
  }
}

async function handleClearSelectedFolders() {
  if (!canClearSelectedFolders.value) return

  const targets = [...selectedFolderNames.value]
  const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
    type: 'warning',
    buttons: [t('trash.cancel'), t('trash.clearFolder')],
    defaultId: 1,
    cancelId: 0,
    title: t('trash.confirmClearFoldersTitle'),
    message: t('trash.confirmClearFolders', { count: targets.length }),
  })

  if (confirmed?.response !== 1) return

  const summary = await removeFolders(targets)

  selectedFolderNames.value = []
  isFolderEditMode.value = false

  await window.electronAPI.dialog?.showMessageBox?.({
    type: 'info',
    buttons: ['OK'],
    title: t('trash.confirmClearFoldersTitle'),
    message: t('trash.clearFoldersSummary', summary),
  })
}

const getReasonLabel = (reason: ResultsReason) => {
  switch (reason) {
    case 'duplicate':
      return t('trash.duplicate')
    case 'exclusion':
      return t('trash.exclusion')
    case 'ai_filtered':
      return t('trash.aiFilteredNotSlide')
    case 'ai_filtered_edit':
      return t('trash.aiFilteredEdit')
    case 'manual':
      return t('trash.manual')
    default:
      return reason
  }
}

const getStatusLabel = (status: 'active' | 'removed') => {
  return status === 'active' ? t('trash.active') : t('trash.removed')
}

const getCropLabel = (item?: ResultsItem | null) => {
  const target = item ?? previewItem.value
  return target?.isAutoCropped ? t('trash.autoCropped') : t('trash.cropped')
}

const formatCropArea = (rect?: CropRect) => {
  if (!rect) return ''
  return `${rect.x}, ${rect.y}, ${rect.width} × ${rect.height}`
}

const openPreview = (item: ResultsItem) => {
  resetCropState()
  showPreviewMetadata.value = false
  openPreviewItem(item)
}

const closePreview = () => {
  resetCropState()
  showPreviewMetadata.value = false
  closePreviewItem()
}

const togglePreviewMetadata = () => {
  showPreviewMetadata.value = !showPreviewMetadata.value
}

const confirmDelete = async () => {
  if (selectedActiveItems.value.length === 0) return

  const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
    type: 'question',
    buttons: [t('trash.cancel'), t('trash.delete')],
    defaultId: 1,
    cancelId: 0,
    title: t('trash.confirmDeleteTitle'),
    message: t('trash.confirmDelete', { count: selectedActiveItems.value.length }),
  })

  if (confirmed?.response === 1) {
    await deleteSelected()
  }
}

const handleAutoCropSelected = async () => {
  showAutoCropMenu.value = false
  if (!canAutoCropSelected.value) return

  const summary = await autoCropSelected({ removeDuplicates: dedupAfterCropActions.value })
  await window.electronAPI.dialog?.showMessageBox?.({
    type: 'info',
    buttons: ['OK'],
    title: t('trash.autoCropSelected'),
    message: t('trash.autoCropSelectedSummary', { ...summary }),
  })
}

const handleRemoveDuplicates = async () => {
  showRemoveDuplicatesMenu.value = false
  if (!canRemoveDuplicatesInCurrentFolder.value) return

  const summary = await removeDuplicatesInCurrentFolder()
  await window.electronAPI.dialog?.showMessageBox?.({
    type: 'info',
    buttons: ['OK'],
    title: t('trash.removeDuplicates'),
    message: t('trash.removeDuplicatesSummary', { ...summary }),
  })
}

const handleSetBaseline = () => {
  const item = previewItem.value
  if (!item) return
  setBaselineCrop(item)
}

const handleBaselineAction = async () => {
  showAutoCropMenu.value = false

  if (!hasCropBaseline.value) {
    if (!canSetSelectedAsBaseline.value) return
    setSelectedBaselineCrop()
    return
  }

  if (!canApplyBaselineSelected.value) return

  const summary = await applyBaselineToSelected({ removeDuplicates: dedupAfterCropActions.value })
  clearBaselineCrop()
  await window.electronAPI.dialog?.showMessageBox?.({
    type: 'info',
    buttons: ['OK'],
    title: t('trash.applyBaseline'),
    message: t('trash.applyBaselineSummary', { ...summary }),
  })
}

const handleRestoreCropped = async () => {
  showRestoreMenu.value = false
  if (!hasCroppedInCurrentFolder.value) return

  const buttons = hasAutoCroppedInCurrentFolder.value
    ? [
        t('trash.cancel'),
        t('trash.restoreAllCropped'),
        t('trash.restoreAutoCroppedOnly'),
      ]
    : [t('trash.cancel'), t('trash.restoreAllCropped')]

  const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
    type: 'question',
    buttons,
    defaultId: 1,
    cancelId: 0,
    title: t('trash.restoreAllCropped'),
    message: t('trash.confirmRestoreAllCropped'),
  })
  if (confirmed?.response !== 1 && confirmed?.response !== 2) return

  const summary = confirmed.response === 2
    ? await restoreAutoCroppedInFolder()
    : await restoreAllCroppedInFolder()
  await window.electronAPI.dialog?.showMessageBox?.({
    type: 'info',
    buttons: ['OK'],
    title: t('trash.restoreAllCropped'),
    message: t('trash.restoreAllCroppedSummary', summary),
  })
}

const toggleRestoreMenu = () => {
  showRestoreMenu.value = !showRestoreMenu.value
  if (showRestoreMenu.value) {
    showAutoCropMenu.value = false
    showRemoveDuplicatesMenu.value = false
  }
}

const toggleAutoCropMenu = () => {
  showAutoCropMenu.value = !showAutoCropMenu.value
  if (showAutoCropMenu.value) {
    showRestoreMenu.value = false
    showRemoveDuplicatesMenu.value = false
  }
}

const toggleRemoveDuplicatesMenu = () => {
  showRemoveDuplicatesMenu.value = !showRemoveDuplicatesMenu.value
  if (showRemoveDuplicatesMenu.value) {
    showRestoreMenu.value = false
    showAutoCropMenu.value = false
  }
}

const handleGlobalClickForActionMenus = (event: MouseEvent) => {
  if (!showRestoreMenu.value && !showAutoCropMenu.value && !showRemoveDuplicatesMenu.value) return
  const target = event.target as HTMLElement | null
  if (target?.closest('.action-split')) return
  showRestoreMenu.value = false
  showAutoCropMenu.value = false
  showRemoveDuplicatesMenu.value = false
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClickForActionMenus)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleGlobalClickForActionMenus)
})

const confirmClearTrash = async () => {
  if (!canClearTrash.value) return

  const isFolderScoped = currentView.value === 'images' && currentFolder.value

  const scopeIds = isFolderScoped ? currentFolderRemovedIds.value : trashEntries.value.map((e) => e.id)
  const scopedEntries = trashEntries.value.filter((e) => scopeIds.includes(e.id))
  const hasEditEntries = scopedEntries.some((e) => e.reason === 'ai_filtered_edit')

  const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
    type: 'warning',
    buttons: [t('trash.cancel'), t('trash.clearTrash')],
    defaultId: 1,
    cancelId: 0,
    title: isFolderScoped ? t('trash.confirmClearFolderTitle') : t('trash.confirmClearTitle'),
    message: isFolderScoped
      ? t('trash.confirmClearFolder', { folder: currentFolderDisplayName.value })
      : t('trash.confirmClear'),
    checkboxLabel: hasEditEntries ? t('trash.keepAiFilteredEdit') : undefined,
    checkboxChecked: hasEditEntries,
  })

  if (confirmed?.response === 1) {
    const keepEdit = !!confirmed.checkboxChecked && hasEditEntries
    if (keepEdit) {
      const idsToClear = scopedEntries
        .filter((e) => e.reason !== 'ai_filtered_edit')
        .map((e) => e.id)
      await clearTrash(idsToClear)
    } else {
      await clearTrash(isFolderScoped ? currentFolderRemovedIds.value : undefined)
    }
  }
}

</script>

<style scoped>
/* ------------------------------------------------------------------ */
/* Action split button group (compound button + dropdown toggle)       */
/* ------------------------------------------------------------------ */
.action-split {
  position: relative;
  display: inline-flex;
  align-items: stretch;
}

.action-split-main {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.action-split-toggle {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.25);
  padding: 0 7px;
  min-width: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.action-split-open .action-split-main {
  border-bottom-left-radius: 0;
}

.action-split-open .action-split-toggle {
  border-bottom-right-radius: 0;
}

/* Base dropdown menu (green / restore) */
.action-split-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: var(--success);
  border-top: 1px solid rgba(255, 255, 255, 0.25);
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
  z-index: 30;
  overflow: hidden;
}

/* Accent variant (auto-crop) */
.action-split-menu-accent {
  background-color: var(--accent);
}

.action-split-menu-item-accent:hover:not(:disabled) {
  background-color: var(--accent-hover);
}

/* Dedup variant */
.action-split-menu-dedup {
  background-color: var(--warning);
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}

.action-split-menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 30px;
  text-align: left;
  background: transparent;
  border: none;
  padding: 6px 10px;
  cursor: pointer;
  color: var(--text-on-accent);
}

.action-split-menu-item + .action-split-menu-item {
  border-top: 1px solid rgba(255, 255, 255, 0.25);
}

.action-split-menu-item:hover:not(:disabled) {
  opacity: 0.85;
}

.action-split-menu-item:disabled {
  color: rgba(255, 255, 255, 0.5);
  cursor: not-allowed;
}

/* ------------------------------------------------------------------ */
/* Folder list                                                         */
/* ------------------------------------------------------------------ */
.course-group {
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-top: 8px;
  overflow: hidden;
}

.course-group:first-child {
  margin-top: 0;
}

.course-header {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 28px;
  padding: 10px 14px 10px;
  cursor: pointer;
  user-select: none;
}

.course-chevron {
  flex-shrink: 0;
  margin-left: auto;
  color: var(--text-secondary);
  transition: transform 0.15s;
  cursor: pointer;
}

.course-chevron.collapsed {
  transform: rotate(0deg);
}

.course-chevron:not(.collapsed) {
  transform: rotate(90deg);
}

.course-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  line-height: 1;
  white-space: nowrap;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.course-checkbox {
  width: 18px;
  height: 18px;
  margin: 0;
  cursor: pointer;
  accent-color: var(--accent);
}

.folder-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-surface);
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
}

.folder-item:hover {
  background-color: var(--bg-elevated);
  border-color: var(--border-strong);
}

.folder-item-last-visited {
  background-color: var(--accent);
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent) inset;
}

.folder-item-last-visited:hover {
  background-color: var(--accent-hover);
  border-color: var(--accent-hover);
}

.folder-item-edit {
  cursor: pointer;
}

.folder-item-selected {
  background-color: var(--danger);
  border-color: var(--danger);
  box-shadow: 0 0 0 1px var(--danger) inset;
}

.folder-item-selected:hover {
  background-color: var(--danger-hover);
  border-color: var(--danger-hover);
}

.folder-item-grouped {
  margin: 0 8px 8px;
  width: calc(100% - 16px);
  border-radius: 6px;
}

/* ------------------------------------------------------------------ */
/* Status / reason badges                                              */
/* ------------------------------------------------------------------ */
.status-badge,
.reason-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
}

.status-active {
  background-color: var(--accent);
  color: var(--accent-strong);
}

.status-cropped {
  background-color: var(--bg-elevated);
  color: var(--text-secondary);
}

.status-removed {
  background-color: var(--danger);
  color: var(--danger);
}

.reason-badge + .reason-badge,
.status-badge + .status-badge {
  margin-left: 6px;
}

.reason-duplicate {
  background-color: var(--warning-bg);
  color: var(--warning);
}

.reason-exclusion {
  background-color: var(--accent);
  color: var(--accent);
}

.reason-ai_filtered {
  background-color: var(--success-bg);
  color: var(--success);
}

.reason-ai_filtered_edit {
  background-color: var(--warning-bg);
  color: var(--warning);
}

.reason-manual {
  background-color: var(--danger);
  color: var(--danger);
}

/* ------------------------------------------------------------------ */
/* Content area scrollbar                                              */
/* ------------------------------------------------------------------ */
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.3s ease;
}

.scrollbar-thin:hover {
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  transition: background 0.3s ease;
}

.scrollbar-thin:hover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* ------------------------------------------------------------------ */
/* Spinner                                                             */
/* ------------------------------------------------------------------ */
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* ------------------------------------------------------------------ */
/* Size slider                                                         */
/* ------------------------------------------------------------------ */
.size-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 140px;
  height: 4px;
  background: var(--text-muted);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.size-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--bg-surface);
  border: 1px solid var(--text-muted);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* ------------------------------------------------------------------ */
/* Preview modal                                                       */
/* ------------------------------------------------------------------ */
.preview-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
}

.preview-modal {
  position: relative;
  width: min(960px, calc(100vw - 48px));
  aspect-ratio: 16 / 10;
  max-height: calc(100vh - 48px);
  background-color: var(--bg-surface);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.3);
}

.preview-modal.metadata-visible {
  width: min(1200px, calc(100vw - 48px));
  aspect-ratio: auto;
}

.preview-close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.9);
  color: var(--text-primary);
  cursor: pointer;
}

.preview-content {
  height: 100%;
}

.preview-modal.metadata-visible .preview-content {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
  min-height: 420px;
  height: auto;
}

.preview-image-container {
  position: relative;
  background-color: var(--bg-surface);
  padding: 54px 18px 58px;
  height: 100%;
}

.preview-modal.metadata-visible .preview-image-container {
  min-height: 420px;
  height: auto;
}

.preview-stage-shell {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-stage-shell.crop-active {
  position: relative;
}

.preview-stage {
  position: relative;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-stage.crop-stage {
  cursor: crosshair;
}

.preview-image,
.preview-image-placeholder {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.preview-image {
  user-select: none;
}

.preview-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(51, 51, 51, 0.28);
}

.preview-actions {
  position: absolute;
  right: 14px;
  bottom: 14px;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.preview-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: none;
  border-radius: 999px;
  background-color: rgba(255, 255, 255, 0.92);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.preview-action-btn-primary {
  background-color: var(--accent);
  color: var(--text-on-accent);
}

.preview-action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.preview-modal:not(.metadata-visible) .preview-info-container {
  display: none;
}

.preview-info-container {
  padding: 20px;
  overflow-y: auto;
}

.preview-info-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 14px;
  color: var(--text-primary);
}

.preview-info-table {
  width: 100%;
  border-collapse: collapse;
}

.preview-info-table td {
  padding: 10px 0;
  border-bottom: 1px solid var(--border-color);
  vertical-align: top;
}

.info-label {
  width: 110px;
  color: var(--text-secondary);
  font-size: 12px;
}

.info-value {
  font-size: 12px;
  color: var(--text-primary);
  word-break: break-word;
}

.info-path {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

/* ------------------------------------------------------------------ */
/* Crop overlay (drag handles + grid — complex positioning math)       */
/* ------------------------------------------------------------------ */
.crop-selection {
  position: absolute;
  border: 2px solid var(--bg-surface);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.56);
  cursor: move;
  touch-action: none;
}

.crop-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.crop-grid-line {
  position: absolute;
  background-color: rgba(255, 255, 255, 0.62);
}

.crop-grid-line.vertical {
  top: 0;
  bottom: 0;
  width: 1px;
  transform: translateX(-0.5px);
}

.crop-grid-line.horizontal {
  left: 0;
  right: 0;
  height: 1px;
  transform: translateY(-0.5px);
}

.crop-handle {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 50%;
  background-color: var(--bg-surface);
  transform: translate(-50%, -50%);
  padding: 0;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
}

.crop-handle-nw {
  top: 0;
  left: 0;
  cursor: nwse-resize;
}

.crop-handle-ne {
  top: 0;
  left: 100%;
  cursor: nesw-resize;
}

.crop-handle-sw {
  top: 100%;
  left: 0;
  cursor: nesw-resize;
}

.crop-handle-se {
  top: 100%;
  left: 100%;
  cursor: nwse-resize;
}

/* ------------------------------------------------------------------ */
/* Animation                                                           */
/* ------------------------------------------------------------------ */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
