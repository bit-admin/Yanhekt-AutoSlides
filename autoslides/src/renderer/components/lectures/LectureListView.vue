<template>
  <!-- Structure/CSS mirrored from FolderListView (Slides) — course cards + folder-item rows. -->
  <div class="folder-list">
    <div
      v-for="(group, groupIdx) in groups"
      :key="group.courseKey || groupIdx"
      :class="{ 'course-group': isGroupingActive(group) }"
    >
      <div
        v-if="isGroupingActive(group) || group.courseKey === 'unrecognised'"
        class="course-header"
        @click="isSelectMode && emit('select-group', group.items.map((i) => i.path))"
      >
        <input
          v-if="isSelectMode"
          type="checkbox"
          class="course-checkbox"
          :checked="isGroupFullySelected(group)"
          :indeterminate.prop="isGroupPartiallySelected(group)"
          @click.stop
          @change="emit('select-group', group.items.map((i) => i.path))"
        />
        <svg
          v-if="group.courseKey !== 'unrecognised'"
          class="course-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <span class="course-name">
          {{ group.courseKey === 'unrecognised' ? $t('lectures.unrecognised') : group.courseName }}
        </span>
        <span
          v-if="group.courseId"
          class="entity-id"
          :title="$t('trash.courseIdHint', { id: group.courseId })"
        >{{ group.courseId }}</span>
        <span
          v-else-if="group.courseKey === 'unrecognised'"
          class="entity-id entity-id--unknown"
        >{{ group.items.length }}</span>
      </div>

      <button
        v-for="item in group.items"
        :key="item.path"
        type="button"
        class="folder-item"
        :class="{
          'folder-item-grouped': isGroupingActive(group) || group.courseKey === 'unrecognised',
          'folder-item-selected': isSelectMode && selectedPaths.includes(item.path),
          'folder-item-edit': isSelectMode,
          'folder-item-active-job': activePath === item.path,
        }"
        @click="isSelectMode ? emit('toggle-selection', item.path) : emit('open', item.path)"
      >
        <div v-if="isSelectMode" class="folder-checkbox">
          <input
            type="checkbox"
            :checked="selectedPaths.includes(item.path)"
            @click.stop
            @change="emit('toggle-selection', item.path)"
          />
        </div>

        <!-- Stream type is said by the glyph (camera / monitor, as on the
             Session page), not by a color. -->
        <div class="folder-icon">
          <svg v-if="item.videoType === 'camera'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <svg v-else-if="item.videoType === 'screen'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2"/>
            <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none"/>
          </svg>
        </div>

        <div class="folder-copy">
          <div class="folder-mainline">
            <div class="folder-heading">
              <span class="folder-name" :title="item.name">{{ item.displayName }}</span>
              <span
                v-if="item.videoType"
                class="meta-badge"
                :class="'meta-badge--' + item.videoType"
              >{{ item.videoType === 'screen' ? $t('lectures.screen') : $t('lectures.camera') }}</span>
              <span
                v-if="item.compressPreset"
                class="meta-badge meta-badge--compressed"
                :title="$t('lectures.compressedHint', { preset: item.compressPreset })"
              >{{ $t('lectures.compressed') }} · {{ item.compressPreset }}</span>
              <span
                v-if="!item.recognised"
                class="entity-id entity-id--unknown"
              >{{ $t('lectures.unrecognisedBadge') }}</span>
              <span
                v-if="!groupByCourse && item.courseId"
                class="entity-id"
                :title="$t('trash.courseIdHint', { id: item.courseId })"
              >{{ item.courseId }}</span>
              <span
                v-if="item.sessionId"
                class="entity-id"
                :title="$t('trash.sessionIdHint', { id: item.sessionId })"
              >{{ item.sessionId }}</span>
            </div>
            <div class="folder-counts">
              <span class="folder-count-text">
                <span class="count-value">{{ formatBytes(item.size) }}</span>
              </span>
              <template v-if="activePath === item.path && activeProgress != null">
                <span class="folder-count-separator">/</span>
                <span class="folder-count-text progress-text">
                  <span class="count-label">{{ $t('lectures.compressing') }}</span>
                  <span class="count-value">{{ activeProgress }}%</span>
                </span>
              </template>
            </div>
          </div>
        </div>
      </button>
    </div>

    <EmptySetState v-if="groups.length === 0 && !isLoading" :title="$t('lectures.empty')" />
  </div>
</template>

<script setup lang="ts">
import type { LectureCourseGroup } from '@features/lectures/useLecturesPage'
import EmptySetState from '../shell/EmptySetState.vue'

const props = defineProps<{
  groups: LectureCourseGroup[]
  groupByCourse: boolean
  isSelectMode: boolean
  selectedPaths: string[]
  isLoading: boolean
  formatBytes: (n: number) => string
  activePath?: string | null
  activeProgress?: number | null
}>()

const emit = defineEmits<{
  (e: 'toggle-selection', path: string): void
  (e: 'select-group', paths: string[]): void
  (e: 'open', path: string): void
}>()

const isGroupingActive = (group: LectureCourseGroup) =>
  props.groupByCourse && !!group.courseName && group.courseKey !== 'unrecognised'

const isGroupFullySelected = (group: LectureCourseGroup) => {
  if (group.items.length === 0) return false
  return group.items.every((i) => props.selectedPaths.includes(i.path))
}

const isGroupPartiallySelected = (group: LectureCourseGroup) => {
  const count = group.items.filter((i) => props.selectedPaths.includes(i.path)).length
  return count > 0 && count < group.items.length
}

</script>

<style scoped>
/* Lifted from FolderListView.vue so Lectures list geometry matches Slides. */
.folder-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  min-height: 0;
  flex: 1;
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

.course-icon {
  color: var(--text-secondary);
}

.course-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1;
  white-space: nowrap;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
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
  cursor: help;
}

.entity-id::before {
  content: '#';
  opacity: 0.55;
  margin-right: 1px;
}

.entity-id--unknown {
  border-style: dashed;
  background: none;
  text-transform: none;
  letter-spacing: 0.04em;
}

.entity-id--unknown::before {
  content: none;
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
  color: inherit;
}

.folder-item:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
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

.folder-item-active-job {
  border-color: var(--accent);
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
  color: var(--text-secondary);
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

.folder-heading {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.folder-name {
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

.folder-count-text {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.folder-count-separator {
  color: var(--text-secondary);
}

.count-value {
  font-variant-numeric: tabular-nums;
}

.progress-text {
  color: var(--accent);
}

/* Quiet chips — not the loud full-pill look from the first Lectures draft. */
.meta-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: var(--bg-subtle);
  color: var(--text-secondary);
  white-space: nowrap;
}

.meta-badge--screen,
.meta-badge--camera {
  border-color: var(--border-color);
  color: var(--text-secondary);
  background: var(--bg-selected);
}

.meta-badge--compressed {
  border-color: var(--success);
  color: var(--success);
  background: var(--success-bg, var(--bg-subtle));
}

</style>
