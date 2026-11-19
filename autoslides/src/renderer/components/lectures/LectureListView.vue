<template>
  <div class="folder-list">
    <div v-for="group in groups" :key="group.key" :class="{ 'course-group': group.courseId }">
      <component
        :is="isSelectMode && !group.courseId ? 'label' : 'div'"
        v-if="group.courseId || group.key === 'unrecognised'"
        class="course-header"
        :class="{ 'course-header--unrecognised': !group.courseId }"
      >
        <input
          v-if="isSelectMode"
          :id="group.courseId ? `${disclosureId(group.key)}-check` : undefined"
          type="checkbox"
          class="course-checkbox"
          :aria-labelledby="group.courseId ? `${disclosureId(group.key)}-title` : undefined"
          :checked="allSelected(group.paths)"
          :indeterminate.prop="someSelected(group.paths)"
          @change="emit('select-group', group.paths)"
        />
        <!-- Like Slides: in Select mode the title selects the course (a label for
             its checkbox); only the chevron collapses. Outside Select mode the
             title collapses too, and the chevron is the keyboard target. -->
        <template v-if="group.courseId">
          <component
            :is="isSelectMode ? 'label' : 'button'"
            :id="`${disclosureId(group.key)}-title`"
            :for="isSelectMode ? `${disclosureId(group.key)}-check` : undefined"
            :type="isSelectMode ? undefined : 'button'"
            :tabindex="isSelectMode ? undefined : -1"
            class="group-toggle"
            @click="!isSelectMode && toggleGroup(disclosureId(group.key))"
          >
            <svg class="course-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <span class="course-name">{{ group.courseName }}</span>
            <span class="entity-id" :title="$t('trash.courseIdHint', { id: group.courseId })">{{ group.courseId }}</span>
          </component>
          <button
            type="button"
            class="chevron-toggle"
            :aria-expanded="!collapsedGroups.has(disclosureId(group.key))"
            :aria-controls="disclosureId(group.key)"
            :aria-label="collapsedGroups.has(disclosureId(group.key)) ? $t('lectures.expandGroup') : $t('lectures.collapseGroup')"
            @click="toggleGroup(disclosureId(group.key))"
          >
            <svg class="group-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6"/>
          </svg>
          </button>
        </template>
        <template v-else>
          <span class="course-name">{{ $t('lectures.unrecognised') }}</span>
          <span class="entity-id entity-id--unknown">{{ group.paths.length }}</span>
        </template>
      </component>

      <div
        :id="group.courseId ? disclosureId(group.key) : undefined"
        v-show="!group.courseId || !collapsedGroups.has(disclosureId(group.key))"
      >
        <div
          v-for="section in group.sections"
          :key="section.session?.id ?? 'files'"
          :class="{ 'session-group': section.session }"
        >
          <div v-if="section.session" class="session-header">
            <input
              v-if="isSelectMode"
              :id="`${disclosureId(group.key, section.session.id)}-check`"
              type="checkbox"
              class="session-checkbox"
              :aria-labelledby="`${disclosureId(group.key, section.session.id)}-title`"
              :checked="allSelected(section.paths)"
              :indeterminate.prop="someSelected(section.paths)"
              @change="emit('select-group', section.paths)"
            />
            <component
              :is="isSelectMode ? 'label' : 'button'"
              :id="`${disclosureId(group.key, section.session.id)}-title`"
              :for="isSelectMode ? `${disclosureId(group.key, section.session.id)}-check` : undefined"
              :type="isSelectMode ? undefined : 'button'"
              :tabindex="isSelectMode ? undefined : -1"
              class="group-toggle"
              @click="!isSelectMode && toggleGroup(disclosureId(group.key, section.session.id))"
            >
              <svg class="folder-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
              </svg>
              <span class="session-name" :title="section.session.title">{{ section.session.title }}</span>
              <span
                class="entity-id"
                :title="$t('trash.sessionIdHint', { id: section.session.id })"
              >{{ section.session.id }}</span>
            </component>
            <button
              type="button"
              class="chevron-toggle"
              :aria-expanded="!collapsedGroups.has(disclosureId(group.key, section.session.id))"
              :aria-controls="disclosureId(group.key, section.session.id)"
              :aria-label="collapsedGroups.has(disclosureId(group.key, section.session.id)) ? $t('lectures.expandGroup') : $t('lectures.collapseGroup')"
              @click="toggleGroup(disclosureId(group.key, section.session.id))"
            >
              <svg class="group-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m9 6 6 6-6 6"/>
            </svg>
            </button>
          </div>

          <div
            :id="section.session ? disclosureId(group.key, section.session.id) : undefined"
            v-show="!section.session || !collapsedGroups.has(disclosureId(group.key, section.session.id))"
          >
            <component
              :is="isSelectMode ? 'label' : 'button'"
              v-for="item in section.items"
              :key="item.path"
              :type="isSelectMode ? undefined : 'button'"
              class="folder-item"
              :class="{
                'folder-item--session': section.session,
                'folder-item--unrecognised': group.key === 'unrecognised',
                'folder-item-selected': isSelectMode && selected.has(item.path),
              }"
              :title="item.name"
              @click="!isSelectMode && emit('open', item.path)"
            >
              <input
                v-if="isSelectMode"
                class="file-checkbox"
                type="checkbox"
                :checked="selected.has(item.path)"
                :aria-label="item.name"
                @change="emit('toggle-selection', item.path)"
              />

              <span class="folder-icon">
                <svg v-if="item.slidesFolder" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="9" cy="9" r="2"/>
                  <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>
                </svg>
                <svg v-else-if="item.isSubtitle" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="2" y="5" width="20" height="14" rx="2"/>
                  <path d="M10.5 10.2a2.2 2.2 0 1 0 0 3.6"/>
                  <path d="M17 10.2a2.2 2.2 0 1 0 0 3.6"/>
                </svg>
                <svg v-else-if="item.videoType === 'camera'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <svg v-else-if="item.videoType === 'screen' || item.videoType === 'slides'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
                <svg v-else-if="lectureListFileKind(item) === 'audio'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="9" y="2" width="6" height="11" rx="3"/>
                  <path d="M5 10v1a7 7 0 0 0 14 0v-1"/>
                  <line x1="12" y1="18" x2="12" y2="22"/>
                </svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2"/>
                  <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none"/>
                </svg>
              </span>

              <span class="folder-heading">
                <span
                  v-if="!section.session || item.displayName !== section.session.displayName || lectureListFileKind(item) === 'other'"
                  class="folder-name"
                >{{ item.displayName }}</span>
                <span
                  v-if="lectureListFileKind(item) !== 'other'"
                  :class="section.session ? 'file-role' : 'meta-badge meta-badge--type'"
                >{{ $t(fileKindLabels[lectureListFileKind(item)]) }}</span>
                <span v-if="section.session && item.ext" class="file-extension">{{ item.ext.slice(1) }}</span>
                <span
                  v-if="item.slidesFolder && !item.slidesFolder.hasTimeline"
                  class="entity-id entity-id--unknown"
                  :title="$t('lectures.noTimelineHint')"
                >{{ $t('lectures.noTimeline') }}</span>
                <span v-if="!item.recognised" class="entity-id entity-id--unknown">{{ $t('lectures.unrecognisedBadge') }}</span>
                <span
                  v-if="!group.courseId && item.courseId"
                  class="entity-id"
                  :title="$t('trash.courseIdHint', { id: item.courseId })"
                >{{ item.courseId }}</span>
                <span
                  v-if="!section.session && item.sessionId"
                  class="entity-id"
                  :title="$t('trash.sessionIdHint', { id: item.sessionId })"
                >{{ item.sessionId }}</span>
              </span>
              <span class="folder-counts">
                <span v-if="item.slidesFolder">{{ $t('lectures.slideCount', { count: item.slidesFolder.imageCount }) }}</span>
                <span v-else>{{ formatBytes(item.size) }}</span>
              </span>
            </component>
          </div>
        </div>
      </div>
    </div>

    <EmptySetState v-if="groups.length === 0 && !isLoading" :title="$t('lectures.empty')" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import {
  lectureListFileKind,
  type LectureListFileKind,
  type LectureListGroup,
} from '@features/lectures/lectureListModel'
import EmptySetState from '../shell/EmptySetState.vue'

const props = defineProps<{
  groups: LectureListGroup[]
  isSelectMode: boolean
  selectedPaths: string[]
  isLoading: boolean
  formatBytes: (n: number) => string
}>()

const emit = defineEmits<{
  (e: 'toggle-selection', path: string): void
  (e: 'select-group', paths: string[]): void
  (e: 'open', path: string): void
}>()

const fileKindLabels: Record<LectureListFileKind, string> = {
  screen: 'lectures.screen',
  slidesVideo: 'lectures.slidesVideo',
  camera: 'lectures.camera',
  audio: 'lectures.micAudio',
  subtitles: 'lectures.subtitles',
  slides: 'lectures.slidesFolder',
  other: '',
}

const selected = computed(() => new Set(props.selectedPaths))
const allSelected = (paths: string[]) => paths.every((path) => selected.value.has(path))
const someSelected = (paths: string[]) => !allSelected(paths) && paths.some((path) => selected.value.has(path))

const listId = useId()
const collapsedGroups = ref(new Set<string>())
const disclosureId = (courseKey: string, sessionId?: string) =>
  sessionId === undefined ? `${listId}-${courseKey}` : `${listId}-${courseKey}-session-${sessionId}`
const toggleGroup = (key: string) => {
  if (!collapsedGroups.value.delete(key)) collapsedGroups.value.add(key)
}
</script>

<style scoped>
.folder-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  /* Fill the viewport for the empty state, but let .content-area scroll. */
  flex: 1 0 auto;
  width: 100%;
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

.course-header,
.session-header,
.group-toggle {
  display: flex;
  align-items: center;
  user-select: none;
}

.course-header {
  min-height: 28px;
}

.course-header--unrecognised {
  gap: 10px;
  padding: 10px 14px;
}

.session-group {
  margin: 0 12px 10px 16px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
}

.session-header {
  background-color: var(--bg-subtle);
}

.group-toggle {
  flex: 1;
  min-width: 0;
  gap: 10px;
  padding: 10px 12px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.course-header .group-toggle {
  padding-inline: 14px;
}

.course-header:not(.course-header--unrecognised):hover,
.session-header:hover {
  background-color: var(--bg-hover);
}

.chevron-toggle {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  align-self: stretch;
  padding: 0 14px;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.chevron-toggle:hover {
  color: var(--text-primary);
}

.chevron-toggle[aria-expanded='true'] .group-chevron {
  transform: rotate(90deg);
}

label.course-header,
label.group-toggle,
input[type='checkbox'] {
  cursor: pointer;
}

.course-icon,
.folder-icon {
  display: flex;
  flex-shrink: 0;
  color: var(--text-secondary);
}

.course-name,
.session-name,
.folder-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.entity-id {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  white-space: nowrap;
  padding: 2px 6px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-subtle);
}

.entity-id::before {
  content: '#';
  opacity: 0.55;
  margin-right: 1px;
}

.entity-id--unknown {
  border-style: dashed;
  background: none;
}

.entity-id--unknown::before {
  content: none;
}

.course-checkbox,
.session-checkbox,
.file-checkbox {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--control-accent);
}

.course-checkbox {
  width: 18px;
  height: 18px;
}

.course-header:not(.course-header--unrecognised) .course-checkbox {
  margin-inline-start: 14px;
}

.session-checkbox {
  margin-inline-start: 12px;
}

.folder-item {
  display: flex;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-input);
  text-align: left;
  cursor: pointer;
  color: inherit;
}

.folder-item--session {
  padding: 10px 16px 10px 26px;
  border-radius: 0;
  border-color: var(--border-color) transparent transparent;
}

.folder-item--unrecognised {
  margin: 0 8px 8px;
  width: calc(100% - 16px);
  border-radius: 6px;
}

.folder-item:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.folder-item:focus-visible,
.chevron-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.folder-item-selected,
.folder-item-selected:hover {
  background-color: var(--bg-selected);
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent) inset;
}

/* Rows inside a session box are stacked, not separate cards: a selection
   ring on each would draw a double black line between neighbours. Keep the
   hairline above each row and mark hover/selection with the wash alone (the
   checkbox says the rest). Separate cards (unrecognised, ungrouped) keep the
   Slides-style ring. */
.folder-item--session:hover,
.folder-item--session.folder-item-selected {
  border-color: var(--border-color) transparent transparent;
  box-shadow: none;
}

.folder-item--session.folder-item-selected,
.folder-item--session.folder-item-selected:hover {
  background-color: var(--bg-selected);
}

.folder-heading {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px 8px;
  flex-wrap: wrap;
}

.folder-counts {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.file-role {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.file-extension {
  color: var(--text-muted);
  font-size: 11px;
  text-transform: uppercase;
}

.meta-badge {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  white-space: nowrap;
}

.meta-badge--type {
  color: var(--text-secondary);
  background: var(--bg-selected);
}
</style>
