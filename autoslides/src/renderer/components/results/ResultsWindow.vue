<template>
  <div class="results-window">
    <div class="toolbar">
      <div class="toolbar-left">
        <button v-if="currentView === 'images'" class="btn back-btn" @click="goBack">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
          {{ $t('trash.back') }}
        </button>

        <div v-if="currentView === 'images'" class="filter-group">
          <label>{{ $t('trash.viewMode') }}:</label>
          <select v-model="contextMode" class="select-field filter-select">
            <option value="context">{{ $t('trash.showContext') }}</option>
            <option value="extracted-only">{{ $t('trash.extractedOnly') }}</option>
            <option value="removed-only">{{ $t('trash.removedOnly') }}</option>
          </select>
        </div>

        <div v-if="currentView === 'images'" class="filter-group">
          <label>{{ $t('trash.filterReason') }}:</label>
          <select v-model="selectedReason" class="select-field filter-select" :disabled="!hasRemovedItems">
            <option value="">{{ $t('trash.all') }}</option>
            <option value="duplicate">{{ $t('trash.duplicate') }}</option>
            <option value="exclusion">{{ $t('trash.exclusion') }}</option>
            <option value="ai_filtered">{{ $t('trash.aiFilteredNotSlide') }}</option>
            <option value="ai_filtered_edit">{{ $t('trash.aiFilteredEdit') }}</option>
            <option value="manual">{{ $t('trash.manual') }}</option>
          </select>
        </div>

        <button class="btn refresh-btn" @click="handleRefresh" :disabled="isLoading || isGenerating">
          <svg width="16" height="16" viewBox="0 0 16 16" :class="{ spinning: isLoading }">
            <path d="M13.65 2.35A7.958 7.958 0 008 0a8 8 0 108 8h-2a6 6 0 11-1.76-4.24l-2.12 2.12H16V0l-2.35 2.35z" fill="currentColor"/>
          </svg>
          {{ $t('trash.refresh') }}
        </button>

        <button v-if="currentView === 'folders'" class="btn" @click="openOutputDirectory">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          {{ $t('settings.openFolder') }}
        </button>

        <button
          v-if="currentView === 'folders'"
          class="edit-btn"
          :class="{ 'edit-btn-active': isFolderEditMode }"
          :disabled="!canEditFolders || isLoading || isGenerating"
          @click="toggleFolderEditMode"
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <rect x="1.5" y="1.5" width="13" height="13" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.4"/>
            <path d="M4.5 8.2l2.4 2.4 4.6-5.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          {{ isFolderEditMode ? $t('trash.doneEditing') : $t('trash.editFolders') }}
        </button>
      </div>

      <div class="actions">
        <button
          v-if="currentView === 'images'"
          class="delete-btn"
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
          class="action-split action-split-restore"
          :class="{ 'action-split-open': showRestoreMenu }"
        >
          <button
            class="restore-btn action-split-main"
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
            class="restore-btn action-split-toggle"
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
              <div class="action-split-menu-title">{{ $t('trash.restoreAllCropped') }}</div>
            </button>
          </div>
        </div>

        <div
          v-if="currentView === 'images'"
          class="action-split action-split-auto-crop"
          :class="{ 'action-split-open': showAutoCropMenu }"
        >
          <button
            class="restore-btn auto-crop-btn action-split-main"
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
            class="restore-btn auto-crop-btn action-split-toggle"
            :title="$t('trash.restoreAutoCropMoreOptions')"
            @click.stop="toggleAutoCropMenu"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-if="showAutoCropMenu" class="action-split-menu">
            <button
              class="action-split-menu-item"
              :disabled="!canRunBaselineAction || isLoading"
              :title="baselineActionTitle"
              @click="handleBaselineAction"
            >
              <div class="action-split-menu-title">{{ baselineActionLabel }}</div>
            </button>
          </div>
        </div>

        <div
          v-if="currentView === 'images'"
          class="action-split action-split-dedup"
          :class="{ 'action-split-open': showRemoveDuplicatesMenu }"
        >
          <button
            class="clear-btn dedup-btn action-split-main"
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
            class="clear-btn dedup-btn action-split-toggle"
            :title="$t('trash.restoreAutoCropMoreOptions')"
            @click.stop="toggleRemoveDuplicatesMenu"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-if="showRemoveDuplicatesMenu" class="action-split-menu action-split-menu-wide">
            <label
              class="action-split-checkbox"
              :title="$t('trash.removeDuplicatesAfterActionsHint')"
              @click.stop
            >
              <input type="checkbox" v-model="dedupAfterCropActions" :disabled="isLoading" />
              <span>{{ $t('trash.removeDuplicatesAfterActions') }}</span>
            </label>
          </div>
        </div>

        <button
          v-if="currentView === 'folders' && isFolderEditMode"
          class="delete-btn"
          :disabled="!canClearSelectedFolders || isLoading || isGenerating"
          @click="handleClearSelectedFolders"
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M5.5 0v1H1v2h14V1h-4.5V0h-5zM2 4l1 11h10l1-11H2zm4 2h1v7H6V6zm3 0h1v7H9V6z" fill="currentColor"/>
          </svg>
          {{ $t('trash.clearFolder') }}
          <span v-if="selectedFolderNames.length > 0" class="edit-count">{{ selectedFolderNames.length }}</span>
        </button>

        <button
          class="clear-btn"
          @click="confirmClearTrash"
          :disabled="!canClearTrash || isLoading || isGenerating"
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M5.5 0v1H1v2h14V1h-4.5V0h-5zM2 4l1 11h10l1-11H2zm4 2h1v7H6V6zm3 0h1v7H9V6z" fill="currentColor"/>
          </svg>
          {{ $t('trash.clearTrash') }}
        </button>
      </div>
    </div>

    <div
      v-if="currentView === 'folders'"
      class="export-bar"
      :class="{ 'export-bar-disabled': !isFolderEditMode }"
    >
      <div class="export-bar-left">
        <button class="btn" :disabled="exportControlsDisabled" @click="toggleSortOrder">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          {{ useCustomOrder ? $t('pdfmaker.customOrder') : $t('pdfmaker.sortAZ') }}
        </button>
      </div>

      <div class="export-bar-right">
        <div class="config-item">
          <label class="config-label">{{ $t('pdfmaker.aspectRatio') }}</label>
          <select v-model="aspectRatio" class="select-field pdf-select" :disabled="exportControlsDisabled">
            <option value="16:9">16:9</option>
            <option value="4:3">4:3</option>
          </select>
        </div>

        <label class="reduce-toggle">
          <input type="checkbox" v-model="reduceEnabled" :disabled="exportControlsDisabled" />
          <span>{{ $t('pdfmaker.reduceSize') }}</span>
        </label>

        <div class="reduce-config-group" :class="{ disabled: !reduceEnabled }">
          <select
            v-model="reduceEffort"
            class="select-field pdf-select"
            :disabled="exportControlsDisabled || !reduceEnabled"
          >
            <option value="standard">{{ $t('pdfmaker.effortStandard') }}</option>
            <option value="compact">{{ $t('pdfmaker.effortCompact') }}</option>
            <option value="minimal">{{ $t('pdfmaker.effortMinimal') }}</option>
            <option value="custom">{{ $t('pdfmaker.effortCustom') }}</option>
          </select>

          <div class="config-item">
            <label class="config-label">{{ $t('pdfmaker.colors') }}</label>
            <span v-if="reduceEffort !== 'custom'" class="config-value">{{ customColors }}</span>
            <select
              v-else
              v-model="customColors"
              class="select-field pdf-select"
              :disabled="exportControlsDisabled || !reduceEnabled"
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
            <span v-if="reduceEffort !== 'custom'" class="config-value">{{ displaySize }}</span>
            <select
              v-else
              v-model="customSize"
              class="select-field pdf-select"
              :disabled="exportControlsDisabled || !reduceEnabled"
            >
              <option v-for="opt in sizeOptions" :key="opt" :value="opt">{{ formatSizeOption(opt) }}</option>
            </select>
          </div>
        </div>

        <div class="export-menu">
          <button
            type="button"
            class="export-menu-toggle"
            :disabled="exportControlsDisabled"
            :aria-expanded="isExportMenuOpen"
            aria-haspopup="menu"
            @click="toggleExportMenu"
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M2 1h8l4 4v10H2V1zm8 1v3h3l-3-3zM4 8h8v1H4V8zm0 2h8v1H4v-1zm0 2h5v1H4v-1z" fill="currentColor"/>
            </svg>
            <span>{{ exportMenuLabel }}</span>
            <svg class="export-menu-chevron" width="12" height="12" viewBox="0 0 12 12">
              <path d="M3 4.5L6 7.5l3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </button>

          <div v-if="isExportMenuOpen" class="export-menu-panel" role="menu">
            <div class="export-menu-section" role="group" :aria-label="$t('pdfmaker.outputFormat')">
              <span class="export-menu-section-label">{{ $t('pdfmaker.outputFormat') }}</span>
              <div class="mode-segmented">
                <label class="mode-option" :class="{ active: outputFormat === 'pdf' }">
                  <input type="radio" v-model="outputFormat" value="pdf" />
                  <span>{{ $t('pdfmaker.formatPdf') }}</span>
                </label>
                <label class="mode-option" :class="{ active: outputFormat === 'pptx' }">
                  <input type="radio" v-model="outputFormat" value="pptx" />
                  <span>{{ $t('pdfmaker.formatPptx') }}</span>
                </label>
              </div>
            </div>

            <div class="export-menu-section" role="group" :aria-label="$t('pdfmaker.outputMode')">
              <span class="export-menu-section-label">{{ $t('pdfmaker.outputMode') }}</span>
              <div class="mode-segmented">
                <label class="mode-option" :class="{ active: outputMode === 'single' }">
                  <input type="radio" v-model="outputMode" value="single" />
                  <span>{{ outputFormat === 'pptx' ? $t('pdfmaker.combineOnePptx') : $t('pdfmaker.combineOnePdf') }}</span>
                </label>
                <label class="mode-option" :class="{ active: outputMode === 'batch' }">
                  <input type="radio" v-model="outputMode" value="batch" />
                  <span>{{ outputFormat === 'pptx' ? $t('pdfmaker.separatePptxs') : $t('pdfmaker.separatePdfs') }}</span>
                </label>
              </div>
            </div>

            <div class="export-menu-section" role="group" :aria-label="$t('pdfmaker.pages')">
              <span class="export-menu-section-label">{{ $t('pdfmaker.pages') }}</span>
              <label class="cover-toggle">
                <input type="checkbox" v-model="includeCover" />
                <span>{{ $t('pdfmaker.includeCover') }}</span>
              </label>
            </div>
          </div>
        </div>

        <button
          class="btn btn--primary"
          @click="handleMakePdf"
          :disabled="exportControlsDisabled || selectedFolderNames.length === 0"
        >
          <svg v-if="!isGenerating" width="16" height="16" viewBox="0 0 16 16">
            <path d="M2 1h8l4 4v10H2V1zm8 1v3h3l-3-3zM4 8h8v1H4V8zm0 2h8v1H4v-1zm0 2h5v1H4v-1z" fill="currentColor"/>
          </svg>
          <span v-if="isGenerating" class="progress-text">
            {{ generateProgress.current }}/{{ generateProgress.total }}
          </span>
          <span v-else>{{ $t('pdfmaker.makeOutput', { format: outputFormat.toUpperCase() }) }}</span>
        </button>
      </div>
    </div>

    <div class="content-area custom-scrollbar" ref="contentAreaRef">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>{{ $t('trash.loading') }}</span>
      </div>

      <template v-else-if="currentView === 'folders'">
        <div v-if="folders.length === 0" class="loading-state empty-state">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <path d="M8 12v40h48V20H32l-6-8H8z" fill="currentColor" opacity="0.3"/>
          </svg>
          <span>{{ $t('trash.noResultsFolders') }}</span>
        </div>

        <div v-else class="folder-list">
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
              <svg class="course-icon" width="16" height="16" viewBox="0 0 16 16">
                <path d="M8 2L1 6l7 4 7-4L8 2z"/>
                <path d="M4 7.5v4c0 1.2 1.8 2 4 2s4-.8 4-2v-4L8 10.5 4 7.5z"/>
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
                'folder-item-drag-over': dragOverIndex === entry.index,
                'folder-item-dragging': dragStartIndex === entry.index,
              }"
              :ref="(el) => setFolderItemRef(entry.folder.name, el as HTMLButtonElement | null)"
              :draggable="isFolderEditMode && !isGenerating"
              @click="isFolderEditMode ? toggleFolderSelection(entry.folder.name) : handleOpenFolder(entry.folder)"
              @dragstart="onFolderDragStart($event, entry.index)"
              @dragover="onFolderDragOver($event, entry.index)"
              @dragleave="onFolderDragLeave"
              @drop="onFolderDrop($event, entry.index)"
              @dragend="onFolderDragEnd"
            >
              <div v-if="isFolderEditMode" class="folder-checkbox">
                <input
                  type="checkbox"
                  :checked="selectedFolderNames.includes(entry.folder.name)"
                  @click.stop
                  @change="toggleFolderSelection(entry.folder.name)"
                />
              </div>

              <div class="folder-icon">
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path d="M3 5v14h18V8h-9l-2-3H3z" fill="#f0c36d"/>
                  <path d="M3 8h18v11H3V8z" fill="#f7d994"/>
                </svg>
              </div>

              <div class="folder-copy">
                <div class="folder-mainline">
                  <span class="folder-name">{{ formatToolFolderName(entry.folder.name) }}</span>
                  <div class="folder-counts">
                    <template v-if="entry.folder.metadata?.review.edited">
                      <span class="folder-count-text">
                        <span class="count-label">{{ $t('trash.edited') }}</span>
                      </span>
                      <span class="folder-count-separator">/</span>
                    </template>
                    <span class="folder-count-text">
                      <span class="count-value">{{ entry.folder.activeCount }}</span>
                      <span class="count-label">{{ $t('trash.active') }}</span>
                    </span>
                    <span class="folder-count-separator">/</span>
                    <span class="folder-count-text">
                      <span class="count-value">{{ entry.folder.removedCount }}</span>
                      <span class="count-label">{{ $t('trash.removed') }}</span>
                    </span>
                  </div>
                </div>
              </div>

              <svg v-if="!isFolderEditMode" class="folder-chevron" width="16" height="16" viewBox="0 0 16 16">
                <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>

              <div v-else class="drag-handle" :title="$t('pdfmaker.customOrderHint')">
                <svg width="20" height="20" viewBox="0 0 16 16">
                  <path d="M4 4h2v2H4zM4 7h2v2H4zM4 10h2v2H4zM10 4h2v2h-2zM10 7h2v2h-2zM10 10h2v2h-2z" fill="currentColor"/>
                </svg>
              </div>
            </button>
            </template>
          </div>
        </div>
      </template>

      <template v-else>
        <div v-if="filteredItems.length === 0" class="loading-state empty-state">
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

    <div v-if="isGenerating" class="progress-bar-container">
      <div
        class="progress-bar"
        :style="{ width: `${generateProgress.total > 0 ? (generateProgress.current / generateProgress.total) * 100 : 0}%` }"
      ></div>
    </div>

    <div class="footer">
      <div class="footer-left">
        <template v-if="currentView === 'folders'">
          <span v-if="!isFolderEditMode">{{ $t('trash.total') }}: {{ sortedFolders.length }}</span>
          <template v-else>
            <span>{{ $t('trash.selected') }}: {{ selectedFolderNames.length }} / {{ $t('trash.total') }}: {{ sortedFolders.length }}</span>
            <span class="footer-separator">|</span>
            <span>{{ $t('pdfmaker.totalImages') }}: {{ selectedImageCount }}</span>
          </template>
        </template>
        <template v-else>
          <button
            class="select-all-btn"
            :disabled="filteredItems.length === 0"
            @click="toggleSelectAllFiltered"
          >
            {{ allFilteredSelected ? $t('trash.clearSelection') : $t('trash.selectAll') }}
          </button>
          <span>{{ $t('trash.selected') }}: {{ selectedIds.length }} / {{ $t('trash.total') }}: {{ filteredItems.length }}</span>
        </template>
      </div>

      <div v-if="currentView === 'images'" class="size-slider-group">
        <svg width="12" height="12" viewBox="0 0 16 16" class="size-icon small">
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
        <svg width="16" height="16" viewBox="0 0 16 16" class="size-icon large">
          <rect x="2" y="2" width="12" height="12" fill="currentColor" opacity="0.6"/>
        </svg>
      </div>

      <label
        v-if="currentView === 'folders'"
        class="group-toggle"
        :class="{ disabled: useCustomOrder }"
        :title="useCustomOrder ? $t('pdfmaker.groupByCourseDisabledHint') : ''"
      >
        <input type="checkbox" v-model="groupByCourse" :disabled="useCustomOrder" />
        <span>{{ $t('trash.groupByCourse') }}</span>
      </label>
    </div>

    <div v-if="previewItem" class="preview-modal-overlay" @click="closePreview">
      <div class="preview-modal" :class="{ 'metadata-visible': showPreviewMetadata, 'crop-mode': isCropMode }" @click.stop>
        <button class="preview-close-btn" @click="closePreview">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>

        <div class="preview-content">
          <div class="preview-image-container" :class="{ 'crop-mode': isCropMode }">
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
                <button class="preview-action-btn primary" :disabled="!canApplyCrop || isLoading" @click="applyCrop">
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
                    <span v-if="previewItem.status === 'active' && previewItem.isCropped" class="badge badge--cropped">{{ getCropLabel() }}</span>
                    <span class="badge" :class="`badge--${previewItem.status}`">{{ getStatusLabel(previewItem.status) }}</span>
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
import { usePdfMaker } from '@features/export/usePdfMaker'
import { getCourseName } from '@shared/utils/toolWindowFolders'
import { configStore } from '@shared/services/configStore'
import ResultsImageGrid from './ResultsImageGrid.vue'

const { t } = useI18n()

// Open the configured output directory (where the slide folders live) in the OS
// file manager. Folder-list view only.
const openOutputDirectory = async () => {
  const dir = configStore.outputDirectory
  if (dir) await window.electronAPI.shell.openPath(dir)
}

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

const {
  sortedFolders,
  useCustomOrder,
  reduceEnabled,
  aspectRatio,
  reduceEffort,
  customColors,
  customSize,
  outputMode,
  outputFormat,
  includeCover,
  sizeOptions,
  displaySize,
  isGenerating,
  generateProgress,
  handleFolderReorder,
  resetSortOrder,
  enableCustomOrder,
  makePdf,
} = usePdfMaker({ folders, selectedNames: selectedFolderNames })

// Custom ordering and course grouping are mutually exclusive: the grouped view
// imposes its own course-first order, so dragging into a custom order turns
// grouping off (the footer checkbox is disabled until order is reset).
watch(useCustomOrder, (value) => {
  if (value) {
    groupByCourse.value = false
  }
})

const isGroupingActive = computed(() => groupByCourse.value && !useCustomOrder.value)
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
  folders: Array<{ folder: (typeof sortedFolders.value)[number]; index: number }>
}

const courseGroups = computed<CourseGroup[]>(() => {
  if (!isGroupingActive.value) {
    return [{
      courseName: '',
      folderNames: sortedFolders.value.map((f) => f.name),
      folders: sortedFolders.value.map((folder, index) => ({ folder, index })),
    }]
  }
  const groups: CourseGroup[] = []
  let current: CourseGroup | null = null
  sortedFolders.value.forEach((folder, index) => {
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

// --- Export bar (PDF/PPTX generation over the folder selection) ---

const exportControlsDisabled = computed(() => !isFolderEditMode.value || isGenerating.value)
const isExportMenuOpen = ref(false)
const dragStartIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

const formatSizeOption = (size: string) => {
  const [w, h] = size.split('x')
  return w && h ? `${w}×${h}` : size
}

const outputModeLabel = computed(() => {
  if (outputMode.value === 'single') {
    return outputFormat.value === 'pptx'
      ? t('pdfmaker.combineOnePptx')
      : t('pdfmaker.combineOnePdf')
  }

  return outputFormat.value === 'pptx'
    ? t('pdfmaker.separatePptxs')
    : t('pdfmaker.separatePdfs')
})

const exportMenuLabel = computed(() => `${outputFormat.value.toUpperCase()} · ${outputModeLabel.value}`)

const selectedImageCount = computed(() =>
  folders.value
    .filter((f) => selectedFolderNames.value.includes(f.name))
    .reduce((sum, f) => sum + f.activeCount, 0)
)

const toggleExportMenu = () => {
  isExportMenuOpen.value = !isExportMenuOpen.value
}

watch(exportControlsDisabled, (disabled) => {
  if (disabled) {
    isExportMenuOpen.value = false
  }
})

const toggleSortOrder = () => {
  if (useCustomOrder.value) {
    resetSortOrder()
  } else {
    enableCustomOrder()
  }
}

const onFolderDragStart = (event: DragEvent, index: number) => {
  dragStartIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

const onFolderDragOver = (event: DragEvent, index: number) => {
  if (dragStartIndex.value === null) return
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  dragOverIndex.value = index
}

const onFolderDragLeave = () => {
  dragOverIndex.value = null
}

const onFolderDrop = (event: DragEvent, toIndex: number) => {
  event.preventDefault()
  if (dragStartIndex.value !== null && dragStartIndex.value !== toIndex) {
    handleFolderReorder(dragStartIndex.value, toIndex)
  }
  dragStartIndex.value = null
  dragOverIndex.value = null
}

const onFolderDragEnd = () => {
  dragStartIndex.value = null
  dragOverIndex.value = null
}

const handleMakePdf = async () => {
  if (selectedFolderNames.value.length === 0) return

  const result = await makePdf()

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

// The toolbar Refresh is a full reset of the folder list: it also drops the
// custom export order and folder selection (matching the old Slides Export
// refresh). Internal refreshes after item actions keep both.
async function handleRefresh() {
  if (currentView.value === 'folders') {
    resetSortOrder()
    selectedFolderNames.value = []
  }
  await refresh()
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
  const target = event.target as HTMLElement | null
  if (isExportMenuOpen.value && !target?.closest('.export-menu')) {
    isExportMenuOpen.value = false
  }
  if (!showRestoreMenu.value && !showAutoCropMenu.value && !showRemoveDuplicatesMenu.value) return
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
.results-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background-color: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
  gap: 10px;
  /* Embedded in the main window (narrower than the old Tools window), the action
     row wraps onto a second line rather than overflowing. */
  flex-wrap: wrap;
  row-gap: 8px;
}

.toolbar-left,
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  row-gap: 6px;
}

/* Second toolbar row: PDF/PPTX export controls. Grayed out until the user
   enters Select mode (folder selection doubles as the export selection). */
.export-bar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
  gap: 10px;
  row-gap: 6px;
  transition: opacity 0.2s;
}

.export-bar-disabled {
  opacity: 0.5;
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
  accent-color: var(--accent);
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

.config-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.config-label {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
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

.export-menu {
  position: relative;
  flex-shrink: 0;
}

.export-menu-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 6px 10px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background-color: var(--bg-surface);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.2s, border-color 0.2s;
}

.export-menu-toggle:hover:not(:disabled) {
  background-color: var(--bg-hover);
  border-color: var(--border-input);
}

.export-menu-toggle:disabled {
  cursor: not-allowed;
}

.export-menu-chevron {
  transition: transform 0.2s;
}

.export-menu-toggle[aria-expanded="true"] .export-menu-chevron {
  transform: rotate(180deg);
}

.export-menu-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: var(--z-overlay);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 260px;
  padding: 10px;
  border: 1px solid var(--border-input);
  border-radius: 6px;
  background-color: var(--bg-card);
  box-shadow: 0 8px 24px var(--shadow-md);
}

.export-menu-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.export-menu-section-label {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.export-menu-panel .mode-segmented {
  width: 100%;
}

.export-menu-panel .mode-option {
  flex: 1;
  justify-content: center;
}

.mode-segmented {
  display: flex;
  align-items: center;
  padding: 2px;
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-input);
  border-radius: 5px;
}

.mode-option {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 24px;
  padding: 3px 8px;
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.2;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.2s, color 0.2s;
}

.mode-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.mode-option.active {
  background-color: var(--bg-surface);
  color: var(--accent);
  box-shadow: 0 1px 2px var(--shadow-sm);
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
  accent-color: var(--accent);
}

.progress-text {
  font-variant-numeric: tabular-nums;
}

/* Inline filter select — auto width instead of the shared full width */
.filter-select {
  width: auto;
  white-space: nowrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-group label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* back/refresh use the shared .btn (base, :hover, :disabled all from
   components.css); svg.spinning rotation is shared too (.spinning). */

.delete-btn,
.restore-btn,
.clear-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  color: var(--text-on-accent);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.delete-btn {
  background-color: var(--danger-strong);
}

.delete-btn:hover:not(:disabled) {
  background-color: var(--danger-strong-hover);
}

.restore-btn {
  background-color: var(--success-strong);
}

.restore-btn:hover:not(:disabled) {
  background-color: var(--success-strong-hover);
}

.auto-crop-btn {
  background-color: var(--accent);
}

.auto-crop-btn:hover:not(:disabled) {
  background-color: var(--accent-hover);
}

.clear-btn {
  background-color: var(--border-strong);
}

.clear-btn:hover:not(:disabled) {
  background-color: var(--neutral-strong-hover);
}

.dedup-btn {
  background-color: var(--warning-strong);
}

.dedup-btn:hover:not(:disabled) {
  background-color: var(--warning-strong-hover);
}

.delete-btn:disabled,
.restore-btn:disabled,
.clear-btn:disabled {
  color: rgba(255, 255, 255, 0.55);
  cursor: not-allowed;
}

.edit-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.edit-btn:hover:not(:disabled) {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.edit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.edit-btn-active {
  background-color: var(--accent);
  border-color: var(--accent);
  color: var(--text-on-accent);
}

.edit-btn-active:hover:not(:disabled) {
  background-color: var(--accent-hover);
  border-color: var(--accent-hover);
}

.edit-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  margin-left: 4px;
  border-radius: 999px;
  background-color: rgba(255, 255, 255, 0.25);
  color: var(--text-on-accent);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

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

.action-split-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: var(--success-strong);
  border-top: 1px solid rgba(255, 255, 255, 0.25);
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
  z-index: var(--z-overlay);
  overflow: hidden;
}

.action-split-auto-crop .action-split-menu {
  background-color: var(--accent);
}

.action-split-auto-crop .action-split-menu-item:hover:not(:disabled) {
  background-color: var(--accent-hover);
}

.action-split-dedup .action-split-menu {
  background-color: var(--warning-strong);
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}

.action-split-dedup .action-split-menu-item:hover:not(:disabled) {
  background-color: var(--warning-strong-hover);
}

.action-split-dedup .action-split-menu-wide {
  min-width: 0;
}

.action-split-menu-wide {
  min-width: 260px;
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
  background-color: var(--success-strong-hover);
}

.action-split-menu-item:disabled {
  color: rgba(255, 255, 255, 0.5);
  cursor: not-allowed;
}

.action-split-menu-title {
  font-size: 11px;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
}

.action-split-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 6px 10px;
  color: var(--text-on-accent);
  cursor: pointer;
  transition: background-color 0.2s;
}

.action-split-checkbox:hover {
  background-color: var(--warning-strong-hover);
}

.action-split-checkbox input {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--accent);
  cursor: pointer;
}

.action-split-checkbox span {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.loading-state {
  height: 100%;
  color: var(--text-muted);
}

.folder-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.course-group {
  background-color: var(--bg-card);
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

.course-icon {
  flex-shrink: 0;
}

/* Two-tone course glyph, themed via accent tokens so it adapts to dark mode. */
.course-icon path:first-child {
  fill: var(--accent-strong);
}

.course-icon path:last-child {
  fill: var(--accent);
}

.course-chevron {
  flex-shrink: 0;
  margin-left: auto;
  color: var(--text-muted);
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
  color: var(--link-color);
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
  background-color: var(--bg-input);
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
}

.folder-item:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.folder-item-last-visited {
  background-color: var(--badge-active-bg);
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent) inset;
}

.folder-item-last-visited:hover {
  background-color: var(--bg-hover);
  border-color: var(--accent);
}

.folder-item-edit {
  cursor: pointer;
}

.folder-item-selected {
  background-color: var(--badge-active-bg);
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent) inset;
}

.folder-item-selected:hover {
  background-color: var(--badge-active-bg);
  border-color: var(--accent-hover);
}

.folder-item-drag-over {
  border-color: var(--accent);
  border-style: dashed;
  background-color: var(--badge-active-bg);
}

.folder-item-dragging {
  opacity: 0.5;
}

.folder-item-grouped {
  margin: 0 8px 8px;
  width: calc(100% - 16px);
  border-radius: 6px;
}

.folder-checkbox {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.folder-checkbox input[type='checkbox'] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.folder-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.folder-copy {
  flex: 1;
  min-width: 0;
}

.folder-mainline {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.folder-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-counts {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
}

.count-badge,
.reason-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
}

.folder-count-text {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.count-label {
  color: inherit;
}

.folder-count-separator {
  color: var(--text-secondary);
}

.count-value {
  font-variant-numeric: tabular-nums;
}

.count-badge.active {
  background-color: var(--badge-active-bg);
  color: var(--badge-active-text);
}

.count-badge.removed {
  background-color: var(--badge-removed-bg);
  color: var(--badge-removed-text);
}

.folder-chevron {
  flex-shrink: 0;
  color: var(--text-muted);
}

.drag-handle {
  flex-shrink: 0;
  cursor: grab;
  padding: 6px 8px;
  opacity: 0.6;
  transition: opacity 0.2s, background-color 0.2s;
  border-radius: 4px;
  color: var(--text-muted);
}

.folder-item:hover .drag-handle {
  opacity: 1;
  background-color: var(--bg-hover);
}

.drag-handle:active {
  cursor: grabbing;
}


.reason-badge.reason-duplicate {
  background-color: var(--reason-duplicate-bg);
  color: var(--reason-duplicate-text);
}

.reason-badge.reason-exclusion {
  background-color: var(--reason-exclusion-bg);
  color: var(--reason-exclusion-text);
}

.reason-badge.reason-ai_filtered {
  background-color: var(--reason-ai-bg);
  color: var(--reason-ai-text);
}

.reason-badge.reason-ai_filtered_edit {
  background-color: var(--reason-ai-edit-bg);
  color: var(--reason-ai-edit-text);
}

.reason-badge.reason-manual {
  background-color: var(--badge-removed-bg);
  color: var(--badge-removed-text);
}

.progress-bar-container {
  height: 3px;
  background-color: var(--border-color);
  width: 100%;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background-color: var(--accent);
  transition: width 0.15s ease-out;
}

.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: var(--bg-elevated);
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-secondary);
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.footer-separator {
  color: var(--border-strong);
}

.select-all-btn {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}

.select-all-btn:hover:not(:disabled) {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.select-all-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.size-slider-group {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background-color: var(--bg-hover);
  border-radius: 6px;
}

.group-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-elevated);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s, border-color 0.15s;
}

.group-toggle:hover:not(.disabled) {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.group-toggle.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.group-toggle input {
  width: 11px;
  height: 11px;
  margin: 0;
  accent-color: var(--accent);
  cursor: pointer;
}

.group-toggle.disabled input {
  cursor: not-allowed;
}

.size-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.size-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 140px;
  height: 4px;
  background: var(--border-strong);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.size-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--bg-input);
  border: 1px solid var(--text-muted);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 1px 3px var(--shadow-lg);
}

.preview-modal-overlay {
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
  background-color: var(--bg-modal);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.3);
}

.preview-modal.metadata-visible {
  width: min(1200px, calc(100vw - 48px));
  aspect-ratio: auto;
}

.preview-close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: var(--z-base);
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background-color: var(--bg-surface);
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
  color: var(--text-muted);
}

.preview-actions {
  position: absolute;
  right: 14px;
  bottom: 14px;
  z-index: var(--z-base);
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
  background-color: var(--bg-surface);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.preview-action-btn.primary {
  background-color: var(--accent);
  color: var(--text-on-accent);
}

.preview-action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.crop-selection {
  position: absolute;
  border: 2px solid #ffffff;
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
  background-color: #ffffff;
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

.info-value .badge + .badge {
  margin-left: 6px;
}

.info-path {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
