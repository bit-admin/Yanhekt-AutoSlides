<template>
  <div class="cloud-notes-tab">
    <!-- Public-images notice banner -->
    <div v-if="bannerVisible" class="cn-banner">
      <span class="cn-banner-msg">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3l9 16H3L12 3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M12 10v4M12 17h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
        <span>{{ $t('cloudNotes.bannerNotice') }}
          <a class="cn-banner-a" :href="WHY_URL" @click.prevent="openExt(WHY_URL)">{{ $t('cloudNotes.bannerWhy') }} ↗</a>
        </span>
      </span>
      <span class="cn-banner-actions">
        <a v-if="viewMode === 'index'" class="cn-banner-link" :href="SHARE_ORIGIN" @click.prevent="openExt(SHARE_ORIGIN)">{{ $t('cloudIndex.bannerOpenIndex') }} ↗</a>
        <a v-else class="cn-banner-link" :href="MYNOTES_URL" @click.prevent="openExt(MYNOTES_URL)">{{ $t('cloudNotes.bannerMyNotes') }} ↗</a>
        <button class="cn-banner-close" :title="$t('cloudNotes.bannerDismiss')" :aria-label="$t('cloudNotes.bannerDismiss')" @click="bannerVisible = false">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </button>
      </span>
    </div>

    <div class="cn-body">
    <!-- Not signed in -->
    <div v-if="cn.notSignedIn.value" class="cn-signin">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
        <path d="M12 11a3 3 0 100-6 3 3 0 000 6zM5 20a7 7 0 0114 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      <p>{{ $t('cloudNotes.notSignedIn') }}</p>
    </div>

    <template v-else>
      <!-- Left region: groups + list, sharing one search toolbar that spans
           both. The editor sits to the right with its own header. -->
      <div class="cn-sidebar">
        <div class="cn-toolbar">
          <button
            class="cn-collapse-btn"
            :class="{ active: groupCollapsed }"
            :title="$t('cloudNotes.toggleGroups')"
            :aria-label="$t('cloudNotes.toggleGroups')"
            @click="toggleGroups"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <!-- Notes mode: filter notes + new note -->
          <template v-if="viewMode === 'notes'">
            <div class="cn-search-wrap">
              <svg class="cn-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                v-model="cn.keyword.value"
                class="cn-search"
                :placeholder="$t('cloudNotes.searchPlaceholder')"
              />
            </div>
            <button class="cn-newnote-btn" :title="$t('cloudNotes.newNote')" @click="onCreateNote">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>
              </svg>
            </button>
          </template>
          <!-- Index mode: search the index / paste a share link -->
          <template v-else>
            <div class="cn-search-wrap">
              <svg v-if="idx.searchMode.value === 'search'" class="cn-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <svg v-else class="cn-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9.5 14.5 14.5 9.5"/><path d="M11 7.5 12.4 6.1a3.5 3.5 0 0 1 5 5L16 12.5"/><path d="M13 16.5 11.6 17.9a3.5 3.5 0 0 1-5-5L8 11.5"/>
              </svg>
              <input
                v-if="idx.searchMode.value === 'search'"
                v-model="idx.query.value"
                class="cn-search"
                :placeholder="$t('cloudIndex.searchPlaceholder')"
                @keyup.enter="onIndexSearch"
              />
              <input
                v-else
                v-model="idx.pasteLink.value"
                class="cn-search"
                :placeholder="$t('cloudIndex.pastePlaceholder')"
                @keyup.enter="onIndexPaste"
              />
            </div>
            <button
              class="cn-newnote-btn"
              :title="idx.searchMode.value === 'search' ? $t('cloudIndex.toggleToPaste') : $t('cloudIndex.toggleToSearch')"
              @click="idx.togglePaste()"
            >
              <svg v-if="idx.searchMode.value === 'search'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9.5 14.5 14.5 9.5"/><path d="M11 7.5 12.4 6.1a3.5 3.5 0 0 1 5 5L16 12.5"/><path d="M13 16.5 11.6 17.9a3.5 3.5 0 0 1-5-5L8 11.5"/>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </button>
          </template>
        </div>
        <div class="cn-sidebar-panes">
      <!-- Left: groups -->
      <aside
        class="cn-groups"
        :class="{ collapsed: groupCollapsed }"
        :style="{ width: groupColPx }"
      >
        <div class="cn-groups-scroll custom-scrollbar">
          <!-- AutoSlides Index — flips the whole page into index mode -->
          <button
            class="cn-group-item cn-index-nav"
            :class="{ active: viewMode === 'index' }"
            @click="enterIndexMode"
          >
            <svg class="cn-group-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            {{ $t('cloudIndex.navTitle') }}
          </button>

          <button
            class="cn-group-item"
            :class="{ active: viewMode === 'notes' && cn.activeGroupId.value === '' }"
            @click="selectAllNotes"
          >
            <svg class="cn-group-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            {{ $t('cloudNotes.allNotes') }}
          </button>

          <!-- Notes mode: managed + user groups -->
          <template v-if="viewMode === 'notes'">
          <!-- Section: AutoSlides-managed groups — distinct tinted card -->
          <div class="cn-managed-section">
            <div class="cn-managed-header">{{ $t('cloudNotes.managedSection') }}</div>
            <div
              v-for="g in cn.managedGroups.value"
              :key="g.id"
              class="cn-group-item-row"
            >
              <button
                class="cn-group-item cn-group-item--managed"
                :class="{ active: cn.activeGroupId.value === g.id }"
                :title="g.name"
                @click="cn.setGroup(g.id)"
              >
                <svg class="cn-group-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
                </svg>
                {{ g.name }}
              </button>
              <button
                class="cn-icon-btn cn-group-delete"
                :title="$t('cloudNotes.deleteGroup')"
                @click.stop="onDeleteGroup(g.id, g.name)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>
              </button>
            </div>
            <button
              v-if="cloudStorageStore.status.value === 'uninitialized' || cloudStorageStore.status.value === 'repairing'"
              class="cn-init-btn"
              :disabled="cloudStorageStore.status.value === 'repairing'"
              :title="$t('cloudNotes.initStorageTip')"
              @click="onInitStorage"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><path d="M12 12v4M10 14h4"/>
              </svg>
              {{ cloudStorageStore.status.value === 'repairing' ? $t('cloudNotes.initializing') : $t('cloudNotes.initStorage') }}
            </button>
          </div>

          <!-- Section: other groups (Ungrouped + user-created) -->
          <div class="cn-groups-header">{{ $t('cloudNotes.otherGroupsSection') }}</div>
          <div
            v-for="g in cn.otherGroups.value"
            :key="g.id"
            class="cn-group-item-row"
          >
            <button
              class="cn-group-item"
              :class="{ active: cn.activeGroupId.value === g.id }"
              :title="g.id === 0 ? $t('cloudNotes.defaultGroup') : (g.name || $t('cloudNotes.defaultGroup'))"
              @click="cn.setGroup(g.id)"
            >
              <svg class="cn-group-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              {{ g.id === 0 ? $t('cloudNotes.defaultGroup') : (g.name || $t('cloudNotes.defaultGroup')) }}
            </button>
            <button
              v-if="g.id !== 0"
              class="cn-icon-btn cn-group-delete"
              :title="$t('cloudNotes.deleteGroup')"
              @click.stop="onDeleteGroup(g.id, g.name)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>
            </button>
          </div>
          </template>

          <!-- Index mode: filters + course list (grouped from the last search) -->
          <template v-else>
            <div class="cn-groups-sep"></div>
            <!-- Filter bar (mirrors the Index website): narrows the course list -->
            <div v-if="idx.showFilterBar.value" class="cn-index-filters">
              <select v-if="idx.colleges.value.length > 1" v-model="idx.collegeFilter.value" class="cn-index-filter">
                <option value="">{{ $t('cloudIndex.allColleges') }}</option>
                <option v-for="c in idx.colleges.value" :key="c" :value="c">{{ c }}</option>
              </select>
              <select v-if="idx.terms.value.length > 1" v-model="idx.termFilter.value" class="cn-index-filter">
                <option value="">{{ $t('cloudIndex.allTerms') }}</option>
                <option v-for="tm in idx.terms.value" :key="tm.key" :value="tm.key">{{ termOptionLabel(tm) }}</option>
              </select>
              <select v-if="idx.instructors.value.length > 1" v-model="idx.instructorFilter.value" class="cn-index-filter">
                <option value="">{{ $t('cloudIndex.allInstructors') }}</option>
                <option v-for="i in idx.instructors.value" :key="i" :value="i">{{ i }}</option>
              </select>
            </div>
            <div v-if="!idx.hasResults.value" class="cn-index-groups-empty">
              {{ idx.searching.value ? $t('cloudNotes.loading') : $t('cloudIndex.searchToBrowse') }}
            </div>
            <div v-else-if="idx.courseGroups.value.length === 0" class="cn-index-groups-empty">
              {{ $t('cloudIndex.noMatches') }}
            </div>
            <button
              v-for="g in idx.courseGroups.value"
              :key="g.courseId"
              class="cn-group-item cn-index-course"
              :class="{ active: idx.selectedCourseId.value === g.courseId }"
              :title="g.courseTitle"
              @click="idx.selectCourse(g.courseId)"
            >
              <span class="cn-index-course-title">{{ g.courseTitle }}</span>
              <span class="cn-index-course-meta">{{ courseSub(g) }}</span>
            </button>
          </template>
        </div>

        <div v-if="viewMode === 'notes'" class="cn-groups-footer">
          <button class="cn-newgroup-btn" @click="showNewGroupModal = true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            {{ $t('cloudNotes.newGroupTitle') }}
          </button>
        </div>
      </aside>

      <NewGroupModal :open="showNewGroupModal" :cn="cn" @close="showNewGroupModal = false" />

      <!-- groups | list resize divider (drag left past the threshold collapses groups) -->
      <div class="cn-divider" @mousedown="startResize('group', $event)"></div>

      <!-- Middle: note list (notes mode) / index browse (index mode) -->
      <section class="cn-list" :style="{ width: (viewMode === 'index' ? indexListWidth : listWidth) + 'px' }">
        <!-- NOTES MODE -->
        <template v-if="viewMode === 'notes'">
        <div class="cn-list-items custom-scrollbar">
          <div v-if="cn.loading.value" class="cn-empty">{{ $t('cloudNotes.loading') }}</div>
          <div v-else-if="cn.notes.value.length === 0" class="cn-empty">{{ $t('cloudNotes.noNotes') }}</div>
          <div
            v-for="note in cn.notes.value"
            :key="note.id"
            class="cn-note-item-row"
          >
            <button
              class="cn-note-item"
              :class="{ active: cn.selectedNoteId.value === note.id }"
              :title="note.title || $t('cloudNotes.untitled')"
              @click="ed.openNote(note.id)"
            >
              <span class="cn-note-title">{{ note.title || $t('cloudNotes.untitled') }}</span>
              <span class="cn-note-meta">{{ note.updated_at }}</span>
            </button>
            <button
              class="cn-icon-btn cn-note-delete"
              :title="$t('cloudNotes.delete')"
              @click.stop="onDeleteNote(note.id)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </div>

        <div v-if="cn.totalPages.value > 1" class="cn-pager">
          <button class="btn btn--sm btn--ghost" :disabled="cn.page.value <= 1" @click="cn.goToPage(cn.page.value - 1)">‹</button>
          <span>{{ cn.page.value }} / {{ cn.totalPages.value }}</span>
          <button class="btn btn--sm btn--ghost" :disabled="cn.page.value >= cn.totalPages.value" @click="cn.goToPage(cn.page.value + 1)">›</button>
        </div>
        </template>

        <!-- INDEX MODE -->
        <template v-else>
        <div class="cn-list-items custom-scrollbar">
          <!-- No search yet → recently-added feed -->
          <template v-if="!idx.hasResults.value">
            <div v-if="idx.recentFiles.value.length === 0" class="cn-empty">{{ $t('cloudIndex.nothingYet') }}</div>
            <template v-else>
              <div class="cn-index-feed-header">{{ $t('cloudIndex.recentlyAdded') }}</div>
              <button
                v-for="f in idx.recentFiles.value"
                :key="f.shareId"
                class="cn-note-item cn-index-file"
                :class="{ active: idx.selectedShareId.value === f.shareId }"
                @click="idx.openRecentFile(f)"
              >
                <span class="cn-note-title">{{ f.courseTitle || $t('cloudIndex.untitledCourse') }}<template v-if="f.sessionTitle"> · {{ f.sessionTitle }}</template></span>
                <span class="cn-note-meta">{{ recentMeta(f) }}</span>
              </button>
            </template>
          </template>

          <!-- Search results → sessions of the selected course + inline versions -->
          <template v-else>
            <div v-if="idx.sessions.value.length === 0" class="cn-empty">
              {{ idx.searching.value ? $t('cloudNotes.loading') : $t('cloudIndex.selectCourse') }}
            </div>
            <div
              v-for="s in idx.sessions.value"
              :key="s.courseId + '.' + s.sessionId"
              class="cn-index-session-block"
            >
              <div class="cn-note-item-row">
                <button
                  class="cn-note-item cn-index-session"
                  :class="{ expanded: idx.isExpanded(s.courseId, s.sessionId) }"
                  @click="idx.toggleSession(s)"
                >
                  <span class="cn-note-title">
                    <svg class="cn-index-caret" :class="{ open: idx.isExpanded(s.courseId, s.sessionId) }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
                    {{ s.sessionTitle || $t('cloudIndex.untitledSession') }}
                  </span>
                  <span class="cn-note-meta">{{ sessionMeta(s) }}</span>
                </button>
                <button
                  class="cn-icon-btn cn-note-delete"
                  :title="$t('cloudIndex.requestRemoval')"
                  @click.stop="onOpenRemoval(s.courseId, s.sessionId)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3v18"/><path d="M5 4h11l-2 3.5L16 11H5"/></svg>
                </button>
              </div>

              <!-- Indented, inline version list (one /v2/api/lecture call, cached) -->
              <div v-if="idx.isExpanded(s.courseId, s.sessionId)" class="cn-index-versions">
                <div v-if="sessionEntry(s)?.loading" class="cn-index-versions-status">{{ $t('cloudIndex.loadingFiles') }}</div>
                <div v-else-if="sessionEntry(s)?.error" class="cn-index-versions-status cn-index-versions-status--error">{{ $t('cloudIndex.loadError') }}</div>
                <div v-else-if="(sessionEntry(s)?.versions.length ?? 0) === 0" class="cn-index-versions-status">{{ $t('cloudIndex.noFilesIndexed') }}</div>
                <button
                  v-for="(v, i) in sessionEntry(s)?.versions ?? []"
                  :key="v.shareId"
                  class="cn-index-version"
                  :class="{ active: idx.selectedShareId.value === v.shareId }"
                  @click="onOpenVersion(v, s)"
                >
                  <span class="cn-index-version-ord">{{ $t('cloudIndex.slidesOrd', { n: i + 1 }) }}</span>
                  <span class="cn-index-version-count">{{ $t('cloudIndex.slideCount', { n: v.imageCount ?? 0 }) }}</span>
                  <span v-if="v.edited" class="cn-index-badge cn-index-badge--edited">{{ $t('cloudIndex.edited') }}</span>
                  <svg v-if="v.reviewed" class="cn-index-verified" :title="$t('cloudIndex.reviewed')" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1.2 14.4l-4-4 1.4-1.4 2.6 2.6 5.4-5.4 1.4 1.4z"/></svg>
                </button>
              </div>
            </div>
          </template>
        </div>

        </template>

        <!-- Footer: Import / Export (mode-aware; keeps its position) -->
        <div v-if="footerVisible" class="cn-list-footer">
          <template v-if="viewMode === 'notes'">
            <button
              class="cn-tool-btn"
              :disabled="cloudStorageStore.blocked.value"
              :title="cloudStorageStore.blocked.value ? $t('cloudNotes.storageNotInitialized') : $t('cloudNotes.importTip')"
              @click="openImportModal"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>
              </svg>
              <span v-if="imp.importing.value">{{ imp.overall.value.done }}/{{ imp.overall.value.total }}</span>
              <span v-else>{{ $t('cloudNotes.importButton') }}</span>
            </button>
            <button class="cn-tool-btn" :title="$t('cloudNotes.exportTip')" @click="exportModalRef?.openFromFooter()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>
              </svg>
              <span v-if="exp.exporting.value">{{ exp.overall.value.done }}/{{ exp.overall.value.total }}</span>
              <span v-else>{{ $t('cloudNotes.exportButton') }}</span>
            </button>
          </template>
          <template v-else>
            <!-- Both buttons stay clickable while a run is active/unread so they
                 can reopen the progress modal (mirrors the notes-mode buttons). -->
            <button
              class="cn-tool-btn"
              :disabled="cloudStorageStore.blocked.value || (!idx.viewer.value && imp.queue.value.length === 0)"
              :title="cloudStorageStore.blocked.value ? $t('cloudNotes.storageNotInitialized') : $t('cloudNotes.importTip')"
              @click="onImportVersion"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>
              </svg>
              <span v-if="imp.importing.value">{{ imp.overall.value.done }}/{{ imp.overall.value.total }}</span>
              <span v-else>{{ $t('cloudNotes.importButton') }}</span>
            </button>
            <button
              class="cn-tool-btn"
              :disabled="!idx.viewer.value && !idxExp.item.value"
              :title="$t('cloudNotes.exportTip')"
              @click="onExportVersion"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>
              </svg>
              <span v-if="idxExp.exporting.value && idxExp.item.value">{{ idxExp.item.value.downloaded }}/{{ idxExp.item.value.total }}</span>
              <span v-else>{{ $t('cloudNotes.exportButton') }}</span>
            </button>
          </template>
        </div>
      </section>
        </div><!-- /.cn-sidebar-panes -->
      </div><!-- /.cn-sidebar -->

      <!-- list | editor resize divider -->
      <div class="cn-divider cn-divider--editor" @mousedown="startResize('list', $event)"></div>

      <ImportSelectModal
        :open="showImportModal && importPhase === 'select'"
        @close="closeImportModal"
        @start="onStartImport"
      />

      <!-- Import progress + conflict resolution (shared with the Slides page) -->
      <ImportProgressModal
        :open="showImportModal && importPhase === 'progress'"
        :title="$t('cloudNotes.importTitle')"
        :imp="imp"
        @close="closeImportModal"
        @done="doneImport"
        @open-note="onOpenConflictNote"
      />

      <NotesExportModal ref="exportModalRef" :cn="cn" :exp="exp" />

      <!-- Index export progress modal (single item, mirrors the notes export modal) -->
      <IndexExportModal
        :open="showIdxExportModal"
        :idx-exp="idxExp"
        @close="showIdxExportModal = false"
        @done="doneIdxExport"
      />

      <NoteShareModal
        ref="shareModalRef"
        :cn="cn"
        :publisher="publisher"
        :get-content="ed.currentNoteContent"
        :on-content-updated="onEditorContentUpdated"
      />

      <!-- Right: editor (notes mode) / slide viewer (index mode) -->
      <NoteEditorPane
        v-if="viewMode === 'notes'"
        :cn="cn"
        :ed="ed"
        @share="shareModalRef?.open()"
      />
      <CloudIndexViewer
        v-else
        :detail="idx.viewer.value"
        :loading="idx.viewerLoading.value"
        :error="idx.viewerError.value"
      />

      <!-- Request-removal modal (index mode) -->
      <CloudIndexRemovalModal
        v-if="removalTarget"
        :course-id="removalTarget.courseId"
        :session-id="removalTarget.sessionId"
        :on-submit="idx.requestRemoval"
        @close="removalTarget = null"
        @removed="onRemovalDone"
      />
    </template>
    </div>

    <div v-if="cn.error.value" class="cn-error" @click="cn.error.value = ''">{{ cn.error.value }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCloudNotes } from '@features/cloudNotes/useCloudNotes'
import { useAuth } from '@features/platform/useAuth'
import { cloudStorageStore } from '@features/cloudNotes/cloudStorageStore'
import { buildReadmeContent } from '@features/cloudNotes/readmeContent'
import { useNoteImport } from '@features/cloudNotes/useNoteImport'
import { useShareIndexExport } from '@features/cloudNotes/useShareIndexExport'
import { useCloudIndexBrowse, type IndexTermOption } from '@features/cloudNotes/useCloudIndexBrowse'
import { navigationStore } from '@features/course/navigationStore'
import type { IndexLecture, IndexVersion } from '@common/notesTypes'
import CloudIndexViewer from './CloudIndexViewer.vue'
import CloudIndexRemovalModal from './CloudIndexRemovalModal.vue'
import { useNotesPublish } from '@features/cloudNotes/useNotesPublish'
import ImportProgressModal from './ImportProgressModal.vue'
import NoteEditorPane from './NoteEditorPane.vue'
import NoteShareModal from './NoteShareModal.vue'
import NewGroupModal from './NewGroupModal.vue'
import ImportSelectModal from './ImportSelectModal.vue'
import NotesExportModal from './NotesExportModal.vue'
import IndexExportModal from './IndexExportModal.vue'
import { useNoteEditor } from '@features/cloudNotes/useNoteEditor'
import { useNoteExport } from '@features/cloudNotes/useNoteExport'
import { noteOpenRequestStore, notesRefreshStore } from '@features/cloudNotes/noteOpenRequest'
import { SHARE_ORIGIN } from '@common/shareLink'
import { NOTE_COPYRIGHT } from '@common/notesContent'

const { t } = useI18n()
const cn = useCloudNotes()
const { userId } = useAuth()

const imp = useNoteImport(cn, {
  meta: (count, date) => t('cloudNotes.noteMeta', { count, date }),
  warning: NOTE_COPYRIGHT,
  slideCaption: (n) => t('cloudNotes.noteSlideCaption', { n }),
})
const publisher = useNotesPublish(cn)

// Editor.js lifecycle (parent-constructed — see useNoteEditor's doc comment).
const ed = useNoteEditor(cn, t)
const shareModalRef = ref<InstanceType<typeof NoteShareModal> | null>(null)
const onEditorContentUpdated = (content: string) => ed.mountEditor(content)

// ── AutoSlides Index (merged-in "index mode") ──────────────────────────────
// The page toggles between the notes editor (default) and a native browser over
// the AutoSlides Index v2 APIs. `idx` owns index data/state; `imp` (notes
// import) is reused for share-link import; `idxExp` exports a version's slides.
const viewMode = ref<'notes' | 'index'>('notes')
const idx = useCloudIndexBrowse()
const idxExp = useShareIndexExport()
const indexLoaded = ref(false)
const removalTarget = ref<{ courseId: string; sessionId: string } | null>(null)
// Index-mode pane widths: course names run long, so the LEFT column gets its
// own wider range; the middle (sessions) list is narrower than in notes mode's
// former default since session titles are short.
const INDEX_GROUP_MIN = 230
const INDEX_GROUP_MAX = 460
const indexGroupWidth = ref(290)
const INDEX_LIST_MIN = 280
const INDEX_LIST_MAX = 720
const indexListWidth = ref(360)

const footerVisible = computed(() =>
  viewMode.value === 'notes' ? cn.hasManagedStorage.value : true,
)

async function enterIndexMode(): Promise<void> {
  viewMode.value = 'index'
  if (!indexLoaded.value) {
    indexLoaded.value = true
    await idx.loadRecent()
  }
}

/** Return to notes mode on the "All notes" group. */
function selectAllNotes(): void {
  viewMode.value = 'notes'
  cn.setGroup('')
}

function onIndexSearch(): void {
  const term = idx.query.value.trim()
  if (!term) { idx.clearSearch(); return }
  void idx.runSearch(term)
}

function onIndexPaste(): void {
  void idx.resolvePaste()
}

const sessionEntry = (s: IndexLecture) => idx.sessionEntryFor(s.courseId, s.sessionId)

/** Open a version, preferring the richer lecture data cached from /v2/api/lecture. */
function onOpenVersion(v: IndexVersion, s: IndexLecture): void {
  const lecture = idx.sessionEntryFor(s.courseId, s.sessionId)?.lecture ?? s
  void idx.openVersion(v, lecture)
}

function onOpenRemoval(courseId: string, sessionId: string): void {
  removalTarget.value = { courseId, sessionId }
}

async function onRemovalDone(): Promise<void> {
  const target = removalTarget.value
  removalTarget.value = null
  if (target) await idx.reloadSession(target.courseId, target.sessionId)
}

/** Import the open version's slides as a managed Cloud Note — runs through the
 *  shared ImportProgressModal, exactly like the notes-mode import. */
async function onImportVersion(): Promise<void> {
  // Reopen straight into the progress modal if a run is active or unread.
  if (imp.queue.value.length > 0) {
    importPhase.value = 'progress'
    showImportModal.value = true
    return
  }
  const v = idx.viewer.value
  if (!v) return
  const st = await cloudStorageStore.ensureReady()
  if (st !== 'ready') {
    await window.electronAPI.dialog?.showMessageBox?.({
      type: 'info',
      title: t('cloudIndex.importToNotes'),
      message: st === 'not-signed-in' ? t('cloudNotes.notSignedIn')
        : st === 'uninitialized' ? t('cloudNotes.storageNotInitialized')
        : cloudStorageStore.lastError.value || t('cloudNotes.storageCheckFailed'),
      buttons: [t('cloudNotes.importClose')],
    })
    return
  }
  await cn.refreshGroups()
  importPhase.value = 'progress'
  showImportModal.value = true
  await imp.importShareLink(v.sourceUrl, t('cloudNotes.importResolving'), v.metadata)
}

// ── Index export — same modal UI as the notes-mode export progress phase. ──
const showIdxExportModal = ref(false)

/** Export the open version's slides to a local folder. */
async function onExportVersion(): Promise<void> {
  showIdxExportModal.value = true
  // Reopen the in-flight/unresolved run instead of starting over.
  if (idxExp.exporting.value || idxExp.item.value?.status === 'conflict') return
  const v = idx.viewer.value
  if (!v) { showIdxExportModal.value = false; return }
  idxExp.reset()
  await idxExp.startExport(v.resolved)
}

/** Explicit dismissal of a finished/skipped export: clear it and close. */
function doneIdxExport(): void {
  idxExp.skipConflict()
  idxExp.reset()
  showIdxExportModal.value = false
}

// ── Index display helpers (term / instructor / meta lines) ──────────────────
function semesterLabel(s?: string): string {
  if (s === '1') return t('cloudIndex.fall')
  if (s === '2') return t('cloudIndex.spring')
  return s ? t('cloudIndex.termN', { n: s }) : ''
}
function instructorOf(l: { instructor?: string; professors?: string[] }): string {
  return l.instructor || (l.professors ?? []).join(', ')
}
function termLabel(l: IndexLecture): string {
  return [l.schoolYear, semesterLabel(l.semester), l.college].filter(Boolean).join(' · ')
}
/** Label for a term-filter dropdown option, e.g. "2025-2026 · Fall". */
function termOptionLabel(tm: IndexTermOption): string {
  return [tm.schoolYear, semesterLabel(tm.semester)].filter(Boolean).join(' · ')
}
function sessionMeta(l: IndexLecture): string {
  return [instructorOf(l), termLabel(l)].filter(Boolean).join(' · ')
}
/** Course-row second line: "#60490 · 王一夫 · 2025-2026 · Fall" (no college). */
function courseSub(g: { courseId: string; items: IndexLecture[] }): string {
  const first = g.items[0]
  return [
    `#${g.courseId}`,
    first ? instructorOf(first) : '',
    first?.schoolYear ?? '',
    first ? semesterLabel(first.semester) : '',
  ].filter(Boolean).join(' · ')
}
function recentMeta(f: { instructor?: string; professors?: string[]; schoolYear?: string; semester?: string; college?: string; imageCount?: number; createdAt?: string }): string {
  return [
    instructorOf(f),
    [f.schoolYear, semesterLabel(f.semester), f.college].filter(Boolean).join(' · '),
    f.imageCount ? t('cloudIndex.slideCount', { n: f.imageCount }) : '',
    f.createdAt ? new Date(f.createdAt).toLocaleDateString() : '',
  ].filter(Boolean).join(' · ')
}

// A course-name pre-search from the sessions header (navigationStore) enters
// index mode and runs the search. `immediate` covers a request set right before
// this page lazily mounts.
watch(
  () => navigationStore.cloudIndexSearchRequest.value,
  (req) => {
    if (!req) return
    void enterIndexMode()
    void idx.runSearch(req.term)
  },
  { immediate: true },
)

const MYNOTES_URL = 'https://www.yanhekt.cn/profile/myNotes'
const WHY_URL = 'https://github.com/bit-admin/yanhekt-coss-browser'
function openExt(url: string): void { window.electronAPI.shell.openExternal(url) }

// Dismissible per session — resets to visible when the Tools window reopens.
const bannerVisible = ref(true)

// ── Resizable panes (groups | list | editor) ──────────────────────────────
// Session-only widths, same drag-to-resize / drag-to-collapse model as the
// window's left panel (App.vue). Mins keep the groups column wide enough for
// "Init cloud storage" on one line and the list wide enough for the long
// README note title.
const GROUP_MIN = 200
const GROUP_MAX = 340
const LIST_MIN = 250
const LIST_MAX = 560
const COLLAPSE_GAP = 60
const groupWidth = ref(210)
const listWidth = ref(300)
const groupCollapsed = ref(false)
// Shared by the groups column and the toolbar spacer above it, so the toolbar's
// middle border lines up with the groups | list pane divider.
const groupColPx = computed(() => {
  if (groupCollapsed.value) return '0px'
  return (viewMode.value === 'index' ? indexGroupWidth.value : groupWidth.value) + 'px'
})

const toggleGroups = (): void => { groupCollapsed.value = !groupCollapsed.value }

let resizing: 'group' | 'list' | null = null
let resizeStartX = 0
let resizeStartGroup = 0
let resizeStartList = 0

function onResizeMove(e: MouseEvent): void {
  if (!resizing) return
  const dx = e.clientX - resizeStartX
  if (resizing === 'group') {
    const raw = resizeStartGroup + dx
    const min = viewMode.value === 'index' ? INDEX_GROUP_MIN : GROUP_MIN
    const max = viewMode.value === 'index' ? INDEX_GROUP_MAX : GROUP_MAX
    if (raw < min - COLLAPSE_GAP) {
      groupCollapsed.value = true
      return
    }
    groupCollapsed.value = false
    const clamped = Math.min(Math.max(min, raw), max)
    if (viewMode.value === 'index') indexGroupWidth.value = clamped
    else groupWidth.value = clamped
  } else if (viewMode.value === 'index') {
    const raw = resizeStartList + dx
    indexListWidth.value = Math.min(Math.max(INDEX_LIST_MIN, raw), INDEX_LIST_MAX)
  } else {
    const raw = resizeStartList + dx
    listWidth.value = Math.min(Math.max(LIST_MIN, raw), LIST_MAX)
  }
}

function stopResize(): void {
  resizing = null
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', stopResize)
}

function startResize(type: 'group' | 'list', e: MouseEvent): void {
  resizing = type
  resizeStartX = e.clientX
  // While collapsed the groups column reads as 0 wide, so dragging the divider
  // out from the edge re-expands it (like the window's left panel).
  resizeStartGroup = groupCollapsed.value
    ? 0
    : viewMode.value === 'index' ? indexGroupWidth.value : groupWidth.value
  resizeStartList = viewMode.value === 'index' ? indexListWidth.value : listWidth.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
}

const showNewGroupModal = ref(false)

async function onCreateNote(): Promise<void> {
  const id = await cn.createNote()
  if (id != null) await ed.openNote(id)
}

async function onDeleteNote(noteId: number): Promise<void> {
  if (!confirm(t('cloudNotes.confirmDeleteNote'))) return
  if (cn.selectedNoteId.value === noteId) await ed.destroyEditor()
  await cn.deleteNote(noteId)
}

/** Explicit init entry point — provisions via the shared store (sets the
 * persisted per-account flag), then reconciles this page's local instance. */
async function onInitStorage(): Promise<void> {
  await cloudStorageStore.initialize()
  await cn.init()
}

// ── Import slides to notes ─────────────────────────────────────────────────
// The folder-select phase lives in ImportSelectModal; the progress phase in the
// shared ImportProgressModal. Both are gated by showImportModal + importPhase,
// which must stay here (the index-mode import path drives them too).
const showImportModal = ref(false)
const importPhase = ref<'select' | 'progress'>('select')

function openImportModal(): void {
  showImportModal.value = true
  // Reopen straight into progress if a run is active or its results are unread;
  // the select phase reloads its folder list on open (ImportSelectModal watch).
  importPhase.value = imp.queue.value.length > 0 ? 'progress' : 'select'
}

function closeImportModal(): void {
  // Only hide the modal — the queue (running or finished) stays alive so
  // reopening returns to the progress view. It is cleared only by "Done".
  showImportModal.value = false
}

function doneImport(): void {
  // Explicit dismissal of a finished queue: clear it and return to the picker.
  imp.reset()
  importPhase.value = 'select'
  showImportModal.value = false
}

function onStartImport(names: string[]): void {
  importPhase.value = 'progress'
  // Fire-and-forget: the queue runs in the background and survives modal close.
  void imp.startImport(names)
}

async function onOpenConflictNote(id?: number): Promise<void> {
  if (id == null) return
  closeImportModal()
  // An index-mode import conflict links to an existing NOTE — switch back to
  // notes mode (and let the editor pane mount) before opening it.
  if (viewMode.value === 'index') {
    viewMode.value = 'notes'
    await nextTick()
  }
  await ed.openNote(id)
}

// ── Export notes to slides ─────────────────────────────────────────────────
const exp = useNoteExport(cn)

const exportModalRef = ref<InstanceType<typeof NotesExportModal> | null>(null)

async function onDeleteGroup(id: number, name: string): Promise<void> {
  if (!confirm(t('cloudNotes.confirmDeleteGroup', { name }))) return
  await cn.deleteGroup(id)
}

onMounted(async () => {
  // Refresh the shared storage status too — covers the Tools-window instance,
  // where the main window's launch check never ran (shared/serialized, cheap).
  void cloudStorageStore.refresh()
  await cn.init()
  // Recreate the README on every open so it stays at the top (the server sorts
  // by created time, so re-saving wouldn't move it). No-op if absent.
  await cn.recreateReadme(buildReadmeContent())
})

// Cross-page "open this note" signal (e.g. Cloud Index's import-conflict row
// linking back to an existing managed note). Runs on every request, including
// the one already pending when this page first mounts.
watch(
  () => noteOpenRequestStore.pending.value,
  (req) => {
    if (req) void ed.openNote(req.noteId)
  },
  { immediate: true },
)

// Cross-page "reload notes" signal — Cloud Index imported a share link through
// its own useCloudNotes() instance, so re-fetch here to surface the new note
// (and any newly-created managed group).
watch(
  () => notesRefreshStore.refreshTick.value,
  () => { void Promise.all([cn.loadAll(), cn.refreshGroups()]) },
)

onUnmounted(() => {
  if (resizing) stopResize()
})

// Account switch: the note list, groups, and any open note belong to the previous
// account. Tear down the editor first (cancels the debounced auto-save so it can't
// write the old note's content under the new account's token), drop the selection,
// then reload for the switched account. cloudStorageStore is rebound separately by
// LeftPanel's [isLoggedIn, userId] watch.
watch(() => userId.value, () => {
  void ed.destroyEditor()
  cn.selectedNote.value = null
  void cn.init()
})

// Live search — filter the list as the user types (client-side, instant).
watch(() => cn.keyword.value, () => cn.searchNotes(true))

</script>

<style scoped>
.cloud-notes-tab {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--bg-surface);
}

/* ── Public-notes banner ─────────────────────────────────────────────── */
.cn-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  flex-shrink: 0;
  padding: 7px 14px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-primary);
  background-color: var(--warning-bg);
  border-bottom: 1px solid var(--border-color);
}

.cn-banner-msg {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.cn-banner-msg svg {
  color: var(--warning);
  flex-shrink: 0;
}

.cn-banner-a,
.cn-banner-link {
  color: var(--link-color);
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
}

.cn-banner-a:hover,
.cn-banner-link:hover {
  text-decoration: underline;
}

.cn-banner-link {
  font-weight: 600;
  flex-shrink: 0;
}

.cn-banner-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.cn-banner-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 0;
}

.cn-banner-close:hover {
  color: var(--text-primary);
  background-color: var(--bg-hover);
}

/* ── Three-pane body ─────────────────────────────────────────────────── */
.cn-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

/* Left region: search toolbar on top, groups + list panes below. Sized by its
   children (groups + divider + list); the editor takes the rest. The right
   border runs full-height (toolbar + panes) so the sidebar | editor seam is
   continuous through the top bar. */
.cn-sidebar {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--border-color);
}

.cn-sidebar-panes {
  flex: 1;
  display: flex;
  min-height: 0;
}

/* Shared search toolbar spanning groups + list (aligns with the editor header). */
.cn-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

/* Collapse-groups button (left of the search), matches the title bar panel toggle. */
.cn-collapse-btn {
  flex-shrink: 0;
  width: 26px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.cn-collapse-btn:hover {
  color: var(--text-primary);
  background-color: var(--bg-hover);
}

.cn-collapse-btn.active {
  color: var(--accent);
  background-color: var(--badge-active-bg);
}

/* Pane resize handles — zero-width grab strip straddling the boundary
   (same idiom as App.vue's .divider). */
.cn-divider {
  width: 8px;
  margin: 0 -4px;
  flex-shrink: 0;
  position: relative;
  z-index: var(--z-dropdown);
  background: transparent;
  cursor: col-resize;
}

/* ── Left: groups sidebar (matches LeftPanel navigator design) ───────── */
.cn-groups {
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.cn-groups.collapsed {
  overflow: hidden;
  border-right: none;
}

.cn-groups-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cn-groups-header {
  padding: 0 10px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.1px;
  color: var(--text-muted);
  margin-top: 2px;
  margin-bottom: 4px;
}

/* ── Managed Groups — flat like the rest, set off by separators above/below
      and an accent header (no card). ───────────────────────────────────────── */
.cn-managed-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
  /* Bleed to the sidebar edges (cancel the scroll's 10px padding) so the
     separators span full width, then re-pad so items stay aligned. */
  margin: 14px -10px;
  padding: 12px 10px;
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
}

/* Same shape as .cn-groups-header, tinted accent. */
.cn-managed-header {
  padding: 0 10px;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.1px;
  color: var(--accent);
}

/* Accent the managed group's icon so the row reads as app-owned. */
.cn-group-item--managed .cn-group-icon {
  color: var(--accent);
  opacity: 1;
}

/* Standalone "All notes" button — full width, no flex-grow */
.cn-group-item {
  flex: 0 0 auto;
  width: 100%;
  text-align: left;
  border: none;
  border-radius: 6px;
  padding: 8px 10px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 9px;
  box-sizing: border-box;
  transition: all 0.15s;
}

/* Inside a row, the button fills remaining space next to the delete icon */
.cn-group-item-row {
  display: flex;
  align-items: center;
  position: relative;
}

.cn-group-item-row .cn-group-item {
  flex: 1 1 0%;
  width: auto;
  min-width: 0;
  /* Reserve room so text never sits under the delete button */
  padding-right: 28px;
}

.cn-group-icon {
  flex-shrink: 0;
  opacity: 0.8;
}

.cn-group-item:hover {
  background-color: var(--bg-hover);
}

/* Active = subtle tinted bg + accent text (matches LeftPanel .nav-item.active) */
.cn-group-item.active {
  background-color: var(--badge-active-bg);
  color: var(--accent);
}

.cn-group-item.active .cn-group-icon {
  color: var(--accent);
}

/* Delete icon — hidden by default, visible on row hover (matches .pinned-unpin) */
.cn-icon-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cn-icon-btn:hover {
  color: var(--danger);
  background-color: var(--bg-hover);
}

.cn-group-delete {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 4px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s, color 0.15s, background-color 0.15s;
}

.cn-group-item-row:hover .cn-group-delete {
  opacity: 1;
  pointer-events: auto;
}

.cn-group-delete:hover {
  color: var(--danger);
  background-color: var(--bg-hover);
}

/* New Group — pinned footer, set off from the list by a top separator.
   The button itself is inset so its rounded hover state aligns with the
   group items above instead of bleeding to the sidebar edges. */
.cn-groups-footer {
  flex-shrink: 0;
  padding: 8px 10px;
  border-top: 1px solid var(--border-color);
}

.cn-newgroup-btn {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-sizing: border-box;
  transition: background-color 0.15s, color 0.15s;
}

.cn-newgroup-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

/* Init cloud storage — flat row matching the group items, accent text. */
.cn-init-btn {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--bg-subtle);
  color: var(--accent);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-sizing: border-box;
  white-space: nowrap;
  transition: background-color 0.15s, border-color 0.15s, opacity 0.15s;
}

.cn-init-btn:hover:not(:disabled) {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.cn-init-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.cn-init-btn svg {
  flex-shrink: 0;
}

/* ── Notes-list footer: Import / Export (mirrors .cn-groups-footer) ── */
.cn-list-footer {
  flex-shrink: 0;
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid var(--border-color);
}

.cn-tool-btn {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-sizing: border-box;
  transition: background-color 0.15s, color 0.15s;
}

.cn-tool-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.cn-tool-btn svg {
  flex-shrink: 0;
}

/* ── Import modal ──────────────────────────────────────────────────────── */
/* ── Middle: note list ───────────────────────────────────────────────── */
.cn-list {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Search input — recessed field matching LeftPanel .nav-search.
   Uses box-shadow for focus ring so the border doesn't add height. */
.cn-search-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background-color: var(--hover-tint);
  transition: box-shadow 0.2s;
}

.cn-search-wrap:focus-within {
  box-shadow: 0 0 0 2px var(--focus-ring), 0 0 0 1px var(--accent);
}

.cn-search-icon {
  flex-shrink: 0;
  color: var(--text-muted);
}

.cn-search {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  padding: 0;
  height: var(--control-height);
}

/* New note icon button — matches LeftPanel .user-banner-action */
.cn-newnote-btn {
  flex-shrink: 0;
  width: 26px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.cn-newnote-btn:hover {
  color: var(--text-primary);
  background-color: var(--bg-hover);
}

.cn-list-items {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Note row — wraps the item button + hover-reveal delete (matches .cn-group-item-row) */
.cn-note-item-row {
  display: flex;
  align-items: center;
  position: relative;
}

.cn-note-item {
  flex: 1 1 0%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 6px;
  padding: 8px 10px;
  padding-right: 28px;
  cursor: pointer;
  box-sizing: border-box;
  transition: all 0.15s;
}

.cn-note-item:hover {
  background-color: var(--bg-hover);
}

/* Active = subtle tinted bg + accent text (matches LeftPanel .nav-item.active) */
.cn-note-item.active {
  background-color: var(--badge-active-bg);
  color: var(--accent);
}

.cn-note-item.active .cn-note-title {
  color: var(--accent);
}

.cn-note-item.active .cn-note-meta {
  color: var(--accent);
  opacity: 0.7;
}

.cn-note-title {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cn-note-meta {
  font-size: 11px;
  color: var(--text-muted);
}

/* Note delete — hidden by default, visible on row hover (matches .cn-group-delete) */
.cn-note-delete {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 4px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s, color 0.15s, background-color 0.15s;
}

.cn-note-item-row:hover .cn-note-delete {
  opacity: 1;
  pointer-events: auto;
}

.cn-note-delete:hover {
  color: var(--danger);
  background-color: var(--bg-hover);
}

.cn-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 8px;
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-secondary);
}

/* ── Right: editor ───────────────────────────────────────────────────── */
.cn-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

/* Sign-in prompt */
.cn-signin {
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
}

.cn-error {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--danger-bg);
  color: var(--danger);
  border: 1px solid var(--danger-border);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 12px;
  max-width: 70%;
  cursor: pointer;
  z-index: var(--z-dropdown);
}

/* ── AutoSlides Index (index mode) ───────────────────────────────────── */
/* Distinct accent for the mode toggle. */
.cn-index-nav {
  color: var(--accent);
  font-weight: 600;
}
.cn-index-nav .cn-group-icon {
  color: var(--accent);
}
.cn-index-nav.active {
  background: var(--badge-active-bg);
}

/* Divider under the two nav entries (index mode) — full-bleed like the
   managed-section separators in notes mode. */
.cn-groups-sep {
  flex-shrink: 0;
  height: 1px;
  margin: 10px -10px;
  background: var(--border-color);
}

/* Filter bar (index mode) — the website's college/term/instructor selects,
   stacked to fit the sidebar column. */
.cn-index-filters {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 0 10px;
}

.cn-index-filter {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid var(--border-input);
  border-radius: 6px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s;
}

.cn-index-filter:focus {
  border-color: var(--accent);
}

.cn-index-groups-empty {
  padding: 16px 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-muted);
}

/* Course rows (left panel, index mode): two-line title + meta. */
.cn-index-course {
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  height: auto;
  padding: 8px 10px;
}
.cn-index-course-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.cn-index-course-meta {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.cn-index-course.active .cn-index-course-title {
  color: var(--accent);
}

/* Recently-added / session feed header. */
.cn-index-feed-header {
  padding: 10px 12px 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.cn-index-file .cn-note-title {
  white-space: normal;
}

/* Session rows + inline version accordion. */
.cn-index-session-block {
  border-bottom: 1px solid var(--border-color);
}
.cn-index-caret {
  flex-shrink: 0;
  margin-right: 4px;
  transition: transform 0.15s ease;
  color: var(--text-muted);
}
.cn-index-caret.open {
  transform: rotate(90deg);
}
.cn-index-session .cn-note-title {
  display: flex;
  align-items: center;
}

.cn-index-versions {
  padding: 2px 0 6px 22px;
}
.cn-index-versions-status {
  padding: 6px 12px;
  font-size: 12px;
  color: var(--text-muted);
}
.cn-index-versions-status--error {
  color: var(--danger);
}
.cn-index-version {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  color: var(--text-primary);
}
.cn-index-version:hover {
  background: var(--bg-hover);
}
.cn-index-version.active {
  background: var(--badge-active-bg);
  color: var(--accent);
}
.cn-index-version-ord {
  font-size: 12px;
  font-weight: 600;
}
.cn-index-version-count {
  font-size: 12px;
  color: var(--text-secondary);
}
.cn-index-badge--edited {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--badge-cropped-bg);
  color: var(--badge-cropped-text);
}
.cn-index-verified {
  color: var(--accent);
  margin-left: auto;
}

/* Downloading progress colored like the modal's other in-flight statuses. */
</style>
