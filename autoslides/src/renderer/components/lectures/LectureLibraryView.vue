<template>
  <div class="library-view custom-scrollbar">
    <!-- ── Shows grid (Emby-inspired poster wall) ───────────────────── -->
    <template v-if="browseLevel === 'courses'">
      <div class="lib-toolbar">
        <div class="lib-toolbar-left">
          <span class="lib-count">
            {{ $t('lectures.libraryCourseCount', { count: courses.length }) }}
          </span>
          <span v-if="isHydrating" class="lib-status">{{ $t('lectures.libraryHydrating') }}</span>
        </div>
      </div>

      <div v-if="courses.length === 0" class="lib-empty">
        <p>{{ $t('lectures.libraryEmpty') }}</p>
        <p class="lib-empty-hint">{{ $t('lectures.libraryEmptyHint') }}</p>
      </div>

      <div v-else class="shows-grid">
        <button
          v-for="course in courses"
          :key="course.courseId"
          type="button"
          class="show-card"
          @click="emit('open-course', course.courseId)"
        >
          <div class="show-poster">
            <img
              v-if="posters[course.posterSourcePath || '']"
              :src="posters[course.posterSourcePath || '']"
              :alt="course.title"
              class="show-poster-img"
              loading="lazy"
            />
            <div v-else class="show-poster-placeholder">
              <span class="show-poster-initial">{{ posterInitial(course.title) }}</span>
            </div>
            <div class="show-poster-overlay" aria-hidden="true">
              <span class="show-play-orb">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </span>
            </div>
            <span class="show-ep-badge">{{ course.episodeCount }}</span>
            <span v-if="course.dualCount > 0" class="show-dual-dot" :title="$t('lectures.libraryDual')">
              {{ $t('lectures.libraryDual') }}
            </span>
          </div>
          <div class="show-meta">
            <div class="show-title" :title="course.title">{{ course.title }}</div>
            <div class="show-sub">
              <template v-if="course.schoolYear || course.semester">
                <span v-if="course.schoolYear">{{ course.schoolYear }}</span>
                <span v-if="course.schoolYear && semesterLabel(course.semester)"> · </span>
                <span v-if="semesterLabel(course.semester)">{{ semesterLabel(course.semester) }}</span>
              </template>
              <template v-else-if="course.instructor">
                {{ course.instructor }}
              </template>
              <template v-else>
                {{ $t('lectures.libraryFileCount', { count: course.fileCount }) }}
              </template>
            </div>
            <div v-if="course.instructor && (course.schoolYear || course.semester)" class="show-sub show-sub--2">
              {{ course.instructor }}
            </div>
          </div>
        </button>
      </div>
    </template>

    <!-- ── Show detail (Emby-inspired hero + episode rail) ──────────── -->
    <template v-else-if="browseLevel === 'course' && activeCourse">
      <div class="detail-page">
        <!-- Soft backdrop from poster -->
        <div
          v-if="posters[activeCourse.posterSourcePath || '']"
          class="detail-backdrop"
          :style="{ backgroundImage: `url(${posters[activeCourse.posterSourcePath || '']})` }"
          aria-hidden="true"
        />
        <div class="detail-backdrop-scrim" aria-hidden="true" />

        <button type="button" class="detail-back" @click="emit('back-courses')">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <div class="detail-hero">
          <div class="detail-poster">
            <img
              v-if="posters[activeCourse.posterSourcePath || '']"
              :src="posters[activeCourse.posterSourcePath || '']"
              :alt="activeCourse.title"
              class="detail-poster-img"
            />
            <div v-else class="detail-poster-placeholder">
              <span class="show-poster-initial">{{ posterInitial(activeCourse.title) }}</span>
            </div>
          </div>

          <div class="detail-info">
            <h1 class="detail-title">{{ activeCourse.title }}</h1>

            <div class="detail-chips">
              <span v-if="activeCourse.schoolYear" class="chip">{{ activeCourse.schoolYear }}</span>
              <span v-if="semesterLabel(activeCourse.semester)" class="chip">
                {{ semesterLabel(activeCourse.semester) }}
              </span>
              <span class="chip chip--count">
                {{ $t('lectures.libraryEpisodeCount', { count: activeCourse.episodeCount }) }}
              </span>
              <span v-if="activeCourse.dualCount > 0" class="chip chip--accent">
                {{ $t('lectures.libraryDual') }} · {{ activeCourse.dualCount }}
              </span>
              <span v-if="activeCourse.college" class="chip">{{ activeCourse.college }}</span>
            </div>

            <div class="detail-facts">
              <div v-if="activeCourse.instructor" class="fact">
                <span class="fact-label">{{ $t('lectures.libraryInstructor') }}</span>
                <span class="fact-value">{{ activeCourse.instructor }}</span>
              </div>
              <div v-if="activeCourse.classrooms?.length" class="fact">
                <span class="fact-label">{{ $t('lectures.libraryClassrooms') }}</span>
                <span class="fact-value">{{ activeCourse.classrooms.join(', ') }}</span>
              </div>
              <div class="fact">
                <span class="fact-label">{{ $t('lectures.libraryFiles') }}</span>
                <span class="fact-value">
                  {{ $t('lectures.libraryFileCount', { count: activeCourse.fileCount }) }}
                </span>
              </div>
              <div class="fact">
                <span class="fact-label">ID</span>
                <span class="fact-value fact-value--mono">{{ activeCourse.courseId }}</span>
              </div>
            </div>

            <div class="detail-actions">
              <button
                v-if="firstPlayable"
                type="button"
                class="btn-play"
                @click="emit('play-session', activeCourse.courseId, firstPlayable)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                {{ $t('lectures.libraryPlay') }}
              </button>
            </div>
          </div>
        </div>

        <section class="episodes-section">
          <h2 class="episodes-heading">
            {{ $t('lectures.libraryEpisodes') }}
            <span class="episodes-heading-count">{{ activeCourse.sessions.length }}</span>
          </h2>

          <div v-if="activeCourse.sessions.length === 0" class="lib-empty lib-empty--inline">
            <p>{{ $t('lectures.libraryNoEpisodes') }}</p>
          </div>

          <div v-else class="episodes-grid">
            <button
              v-for="session in activeCourse.sessions"
              :key="session.sessionId"
              type="button"
              class="episode-card"
              @click="emit('play-session', activeCourse.courseId, session)"
            >
              <div class="episode-thumb">
                <img
                  v-if="posters[session.posterSourcePath || '']"
                  :src="posters[session.posterSourcePath || '']"
                  alt=""
                  class="episode-thumb-img"
                  loading="lazy"
                />
                <div v-else class="episode-thumb-placeholder">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
                <div class="episode-thumb-overlay" aria-hidden="true">
                  <span class="show-play-orb show-play-orb--sm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </span>
                </div>
                <span v-if="session.episode != null" class="episode-index">
                  {{ session.episode }}
                </span>
              </div>

              <div class="episode-body">
                <div class="episode-title-row">
                  <span v-if="session.episode != null" class="episode-num">
                    {{ session.episode }}.
                  </span>
                  <span class="episode-title" :title="session.title">{{ session.title }}</span>
                </div>
                <div class="episode-sub">
                  <span v-if="formatDate(session)">{{ formatDate(session) }}</span>
                  <span v-if="formatDate(session) && sessionBytes(session)"> · </span>
                  <span v-if="sessionBytes(session)">{{ sessionBytes(session) }}</span>
                </div>
                <div class="episode-badges">
                  <span v-if="session.screen && session.camera" class="ep-badge ep-badge--dual">
                    {{ $t('lectures.libraryDual') }}
                  </span>
                  <span v-else-if="session.screen" class="ep-badge">{{ $t('lectures.screen') }}</span>
                  <span v-else-if="session.camera" class="ep-badge">{{ $t('lectures.camera') }}</span>
                  <span
                    v-if="session.screen?.compressPreset"
                    class="ep-badge ep-badge--comp"
                    :title="$t('lectures.compressedHint', { preset: session.screen.compressPreset })"
                  >
                    {{ session.screen.compressPreset }}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import {
  formatLibraryBytes,
  formatLibrarySemester,
  formatSessionDate,
  sessionTotalBytes,
  type LibraryCourse,
  type LibrarySession,
} from '@features/lectures/libraryModel'
import type { LibraryBrowseLevel } from '@features/lectures/useLectureLibrary'

const props = defineProps<{
  browseLevel: LibraryBrowseLevel
  courses: LibraryCourse[]
  activeCourse: LibraryCourse | null
  isHydrating: boolean
  posters: Record<string, string>
}>()

const emit = defineEmits<{
  (e: 'open-course', courseId: string): void
  (e: 'back-courses'): void
  (e: 'play-session', courseId: string, session: LibrarySession): void
  (e: 'need-poster', path: string): void
}>()

const firstPlayable = computed(() => props.activeCourse?.sessions[0] || null)

const posterInitial = (title: string): string => {
  const t = (title || '').trim()
  return t ? t[0]!.toUpperCase() : '?'
}

const semesterLabel = (sem?: string | number | null): string => formatLibrarySemester(sem)

const formatDate = (session: LibrarySession): string => formatSessionDate(session)

const sessionBytes = (session: LibrarySession): string => {
  const n = sessionTotalBytes(session)
  return n > 0 ? formatLibraryBytes(n) : ''
}

// Lazy-request posters for visible cards.
watch(
  () => [props.browseLevel, props.courses, props.activeCourse] as const,
  () => {
    if (props.browseLevel === 'courses') {
      for (const c of props.courses) {
        if (c.posterSourcePath) emit('need-poster', c.posterSourcePath)
      }
    } else if (props.activeCourse) {
      if (props.activeCourse.posterSourcePath) {
        emit('need-poster', props.activeCourse.posterSourcePath)
      }
      for (const s of props.activeCourse.sessions) {
        if (s.posterSourcePath) emit('need-poster', s.posterSourcePath)
      }
    }
  },
  { immediate: true, deep: true },
)
</script>

<style scoped>
.library-view {
  flex: 1;
  min-width: 0;
  min-height: 0;
  /* Desktop shell: vertical scroll only — never invent a horizontal page scroll. */
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0;
  background: var(--bg-page);
}

/* ── Toolbar ─────────────────────────────────────────────────────── */
.lib-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px 6px;
  position: sticky;
  top: 0;
  z-index: 5;
  background: linear-gradient(var(--bg-page) 70%, transparent);
}

.lib-toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.lib-count {
  font-size: 13px;
  font-weight: 550;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.lib-status {
  font-size: 12px;
  color: var(--text-muted);
}

.lib-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  gap: 6px;
  color: var(--text-muted);
  text-align: center;
  padding: 24px;
}

.lib-empty--inline {
  min-height: 120px;
}

.lib-empty p {
  margin: 0;
  font-size: 13px;
}

.lib-empty-hint {
  font-size: 12px !important;
  max-width: 380px;
  line-height: 1.45;
}

/* ── Shows grid ──────────────────────────────────────────────────── */
.shows-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(168px, 100%), 1fr));
  gap: 18px 14px;
  padding: 8px 20px 28px;
  min-width: 0;
  max-width: 100%;
}

.show-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: inherit;
  border-radius: 10px;
}

.show-poster {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 10px;
  overflow: hidden;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.show-card:hover .show-poster {
  /* No scale() — it bleeds past the card and can widen the scrollport. */
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: 0 10px 28px var(--shadow-md), 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
}

.show-poster-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.show-poster-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(120% 80% at 20% 10%, color-mix(in srgb, var(--accent) 28%, transparent), transparent 55%),
    linear-gradient(160deg, var(--bg-elevated), var(--bg-subtle));
}

.show-poster-initial {
  font-size: 42px;
  font-weight: 700;
  color: color-mix(in srgb, var(--text-primary) 55%, var(--accent));
  letter-spacing: -0.02em;
  user-select: none;
}

.show-poster-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.28);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.show-card:hover .show-poster-overlay {
  opacity: 1;
}

.show-play-orb {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
  color: #111;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}

.show-play-orb--sm {
  width: 36px;
  height: 36px;
}

.show-ep-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  min-width: 24px;
  height: 22px;
  padding: 0 7px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  font-size: 11px;
  font-weight: 650;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-variant-numeric: tabular-nums;
  backdrop-filter: blur(6px);
}

.show-dual-dot {
  position: absolute;
  left: 8px;
  bottom: 8px;
  padding: 2px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 88%, #000);
  color: var(--text-on-accent);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.02em;
}

.show-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 0 2px;
}

.show-title {
  font-size: 13px;
  font-weight: 650;
  color: var(--text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.3;
}

.show-sub {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.show-sub--2 {
  opacity: 0.9;
}

/* ── Detail page ─────────────────────────────────────────────────── */
.detail-page {
  position: relative;
  min-height: 100%;
  min-width: 0;
  max-width: 100%;
  padding: 16px 22px 36px;
  /* Clip scaled backdrop / hover glows so they never create horizontal scroll. */
  overflow-x: hidden;
}

.detail-backdrop {
  position: absolute;
  /* Keep blur fill inside the page box — no scale() (that forced horizontal overflow). */
  top: 0;
  left: 0;
  right: 0;
  height: 320px;
  background-size: cover;
  background-position: center 30%;
  filter: blur(28px) saturate(1.15);
  opacity: 0.35;
  pointer-events: none;
}

.detail-backdrop-scrim {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 340px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--bg-page) 20%, transparent) 0%,
    var(--bg-page) 100%
  );
  pointer-events: none;
}

.detail-back {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  margin-bottom: 12px;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  background: color-mix(in srgb, var(--bg-elevated) 80%, transparent);
  color: var(--text-primary);
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: background 0.15s, border-color 0.15s;
}

.detail-back:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.detail-hero {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 200px) minmax(0, 1fr);
  gap: 22px;
  align-items: start;
  margin-bottom: 28px;
  min-width: 0;
  max-width: 100%;
}

.detail-poster {
  width: 100%;
  max-width: 200px;
  aspect-ratio: 2 / 3;
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  box-shadow: 0 12px 40px var(--shadow-lg);
  justify-self: start;
}

.detail-poster-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.detail-poster-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(120% 80% at 20% 10%, color-mix(in srgb, var(--accent) 28%, transparent), transparent 55%),
    linear-gradient(160deg, var(--bg-elevated), var(--bg-subtle));
}

.detail-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 4px;
}

.detail-title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  line-height: 1.15;
}

.detail-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 550;
  backdrop-filter: blur(6px);
}

.chip--count {
  font-variant-numeric: tabular-nums;
}

.chip--accent {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  color: var(--accent);
}

.detail-facts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px 16px;
  max-width: 640px;
}

.fact {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.fact-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.fact-value {
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fact-value--mono {
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--text-secondary);
}

.detail-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.btn-play {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 18px;
  border: none;
  border-radius: 999px;
  background: var(--text-primary);
  color: var(--bg-page);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
}

.btn-play:hover {
  opacity: 0.92;
  transform: translateY(-1px);
}

/* ── Episodes ────────────────────────────────────────────────────── */
.episodes-section {
  position: relative;
  z-index: 1;
  min-width: 0;
  max-width: 100%;
}

.episodes-heading {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 650;
  color: var(--text-primary);
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.episodes-heading-count {
  font-size: 12px;
  font-weight: 550;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.episodes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr));
  gap: 14px;
  min-width: 0;
  max-width: 100%;
}

.episode-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: inherit;
  border-radius: 10px;
}

.episode-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 10px;
  overflow: hidden;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}

.episode-card:hover .episode-thumb {
  border-color: var(--accent);
  box-shadow: 0 6px 20px var(--shadow-md);
  transform: translateY(-1px);
}

.episode-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.episode-thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  background: var(--bg-subtle);
}

.episode-thumb-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.28);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.episode-card:hover .episode-thumb-overlay {
  opacity: 1;
}

.episode-index {
  position: absolute;
  left: 8px;
  top: 8px;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 11px;
  font-weight: 650;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-variant-numeric: tabular-nums;
}

.episode-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 0 2px;
}

.episode-title-row {
  display: flex;
  gap: 6px;
  min-width: 0;
  align-items: baseline;
}

.episode-num {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 650;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.episode-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.episode-sub {
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.episode-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.ep-badge {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 600;
}

.ep-badge--dual {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  color: var(--accent);
}

.ep-badge--comp {
  text-transform: lowercase;
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 35%, transparent);
  background: color-mix(in srgb, var(--success) 12%, transparent);
}

@media (max-width: 720px) {
  .detail-hero {
    grid-template-columns: 1fr;
  }

  .detail-poster {
    width: min(180px, 48vw);
  }

  .detail-title {
    font-size: 22px;
  }

  .shows-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 14px 10px;
    padding: 8px 14px 24px;
  }
}
</style>
