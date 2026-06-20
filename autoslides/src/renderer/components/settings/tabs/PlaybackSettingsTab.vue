<template>
  <!-- Auto Extraction After Download -->
  <div class="advanced-setting-section">
    <div class="section-header-with-action">
      <h4>{{ $t('advanced.qtExtractor.title') }}</h4>
      <button type="button" class="section-action-pill" @click="openExtractorInstallModal">
        {{ $t('advanced.qtExtractor.install') }}
      </button>
    </div>
    <p class="section-help-text">{{ $t('advanced.qtExtractor.titleDescription') }}</p>

    <div class="setting-item">
      <div class="auto-post-processing-control">
        <label class="checkbox-label">
          <input type="checkbox" v-model="tempQtExtractorAutoRun" />
          {{ $t('advanced.qtExtractor.autoRun') }}
        </label>
        <label class="checkbox-label" :class="{ 'checkbox-label-disabled': !tempQtExtractorAutoRun }">
          <input
            type="checkbox"
            v-model="tempQtExtractorAutoPostProcess"
            :disabled="!tempQtExtractorAutoRun"
          />
          {{ $t('advanced.qtExtractor.autoPostProcess') }}
        </label>
      </div>
    </div>

    <!-- Extractor binary path -->
    <div class="setting-item">
      <div class="setting-label-with-reset">
        <label class="setting-label">{{ $t('advanced.qtExtractor.section') }}</label>
        <div
          class="extractor-status-line"
          :class="{
            ok: qtExtractorStatusOk,
            error: !qtExtractorStatusOk && !!qtExtractorStatusError,
            unknown: !qtExtractorStatusOk && !qtExtractorStatusError
          }"
          :title="qtExtractorStatusError || ''"
        >
          <span class="extractor-status-dot"></span>
          <span v-if="qtExtractorStatusOk">
            {{ $t('advanced.qtExtractor.statusReady') }}<span v-if="qtExtractorStatusVersion"> · v{{ qtExtractorStatusVersion }}</span>
          </span>
          <span v-else-if="qtExtractorStatusError">{{ $t('advanced.qtExtractor.statusMissing') }}</span>
          <span v-else>{{ $t('advanced.qtExtractor.statusUnknown') }}</span>
        </div>
      </div>
      <div class="setting-description extractor-description">
        {{ $t('advanced.qtExtractor.sectionDescription') }}
        <a
          href="https://github.com/bit-admin/AutoSlides-Extractor"
          class="external-link"
          @click.prevent="openExtractorRepository"
        >
          {{ $t('advanced.qtExtractor.sourceLink') }}
        </a>
      </div>

      <div class="extractor-config-box">
        <div class="extractor-reference">
          <div class="extractor-reference-header">
            {{ $t('advanced.qtExtractor.defaultExecutables') }}
          </div>
          <div class="extractor-platform-list">
            <div class="extractor-platform-row">
              <span class="extractor-platform-name">{{ $t('advanced.qtExtractor.platformMacOS') }}</span>
              <code>/Applications/AutoSlides Extractor.app/Contents/MacOS/AutoSlidesExtractor</code>
            </div>
            <div class="extractor-platform-row">
              <span class="extractor-platform-name">{{ $t('advanced.qtExtractor.platformWindows') }}</span>
              <div class="extractor-path-stack">
                <code>C:\Program Files\AutoSlides Extractor\AutoSlidesExtractor.exe</code>
                <code>C:\Program Files (x86)\AutoSlides Extractor\AutoSlidesExtractor.exe</code>
              </div>
            </div>
            <div class="extractor-platform-row">
              <span class="extractor-platform-name">{{ $t('advanced.qtExtractor.platformLinux') }}</span>
              <span class="extractor-linux-note">{{ $t('advanced.qtExtractor.linuxBuildFromSource') }}</span>
            </div>
          </div>
        </div>

        <div class="extractor-path-row">
          <input
            type="text"
            class="extractor-path-input"
            :value="qtExtractorResolvedPath || qtExtractorBinaryPath"
            :placeholder="$t('advanced.qtExtractor.pathPlaceholder')"
            :title="qtExtractorResolvedPath || qtExtractorBinaryPath"
            readonly
          />
          <button
            type="button"
            class="extractor-refresh-btn"
            :title="qtExtractorVerifying ? $t('advanced.qtExtractor.refreshing') : $t('advanced.qtExtractor.refresh')"
            :disabled="qtExtractorVerifying"
            @click="qtExtractorVerify"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              :class="{ spinning: qtExtractorVerifying }"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M3 21v-5h5"/>
            </svg>
          </button>
          <button type="button" class="secondary-btn" @click="qtExtractorBrowseBinary">
            {{ $t('advanced.qtExtractor.browse') }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.download') }}</h4>
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.concurrentDownloadLimit') }}</label>
      <div class="setting-description">{{ $t('advanced.concurrentDownloadDescription') }}</div>
      <select
        v-model="tempMaxConcurrentDownloads"
        class="select-field"
        @change="updateMaxConcurrentDownloads"
      >
        <option v-for="i in 10" :key="i" :value="i">{{ i }}</option>
      </select>
    </div>
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.downloadMaxWorkers') }}</label>
      <div class="setting-description">{{ $t('advanced.downloadMaxWorkersDescription') }}</div>
      <select
        v-model="tempDownloadMaxWorkers"
        class="select-field"
        @change="updateDownloadMaxWorkers"
      >
        <option v-for="v in [1, 2, 4, 8, 16, 32]" :key="v" :value="v">{{ v }}</option>
      </select>
    </div>
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.downloadNumRetries') }}</label>
      <select
        v-model="tempDownloadNumRetries"
        class="select-field"
        @change="updateDownloadNumRetries"
      >
        <option v-for="v in [5, 10, 15, 20, 30]" :key="v" :value="v">{{ v }}</option>
      </select>
    </div>
  </div>

  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.videoPlayback') }}</h4>
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.videoErrorRetryCount') }}</label>
      <div class="setting-description">{{ $t('advanced.videoErrorDescription') }}</div>
      <select
        v-model="tempVideoRetryCount"
        class="select-field"
        @change="updateVideoRetryCount"
      >
        <option v-for="i in 6" :key="i" :value="i + 4">{{ i + 4 }}</option>
      </select>
    </div>
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.showMorePlaybackSpeed') }}</label>
      <div class="setting-description">{{ $t('advanced.showMorePlaybackSpeedDescription') }}</div>
      <div class="prevent-sleep-control">
        <label class="checkbox-label">
          <input
            type="checkbox"
            v-model="tempShowMorePlaybackSpeed"
          />
          {{ $t('advanced.enableShowMorePlaybackSpeed') }}
        </label>
      </div>
    </div>
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.preventSystemSleep') }}</label>
      <div class="setting-description">{{ $t('advanced.preventSystemSleepDescription') }}</div>
      <div class="prevent-sleep-control">
        <label class="checkbox-label">
          <input
            type="checkbox"
            v-model="tempPreventSystemSleep"
          />
          {{ $t('advanced.enablePreventSleep') }}
        </label>
      </div>
    </div>
  </div>

  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.homePreviewTitle') }}</h4>
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.homePreviewFromVideo') }}</label>
      <div class="setting-description">{{ $t('advanced.homePreviewFromVideoDescription') }}</div>
      <div class="prevent-sleep-control">
        <label class="checkbox-label">
          <input type="checkbox" v-model="tempPreviewFromVideo" />
          {{ $t('advanced.homePreviewEnableFromVideo') }}
        </label>
      </div>
    </div>
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.homePreviewSeek') }}</label>
      <div class="setting-description">{{ $t('advanced.homePreviewSeekDescription') }}</div>
      <select
        v-model="tempPreviewSeekSeconds"
        class="select-field"
        :disabled="!tempPreviewFromVideo"
      >
        <option v-for="v in [30, 60, 90, 120, 150, 180, 240, 300]" :key="v" :value="v">{{ v }}s</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createLogger } from '@shared/utils/logger';
const log = createLogger('PlaybackSettingsTab');
import { useSettingsContext } from '@features/settings/settingsContext'

const { advanced } = useSettingsContext()

const {
  tempShowMorePlaybackSpeed,
  tempPreventSystemSleep,
  tempQtExtractorAutoRun,
  tempQtExtractorAutoPostProcess,
  qtExtractorStatusOk,
  qtExtractorStatusVersion,
  qtExtractorStatusError,
  qtExtractorVerifying,
  qtExtractorBinaryPath,
  qtExtractorResolvedPath,
  qtExtractorVerify,
  qtExtractorBrowseBinary,
  openExtractorInstallModal,
  tempMaxConcurrentDownloads,
  tempDownloadMaxWorkers,
  tempDownloadNumRetries,
  tempVideoRetryCount,
  tempPreviewFromVideo,
  tempPreviewSeekSeconds,
  updateMaxConcurrentDownloads,
  updateDownloadMaxWorkers,
  updateDownloadNumRetries,
  updateVideoRetryCount,
} = advanced

const openExtractorRepository = async () => {
  try {
    await window.electronAPI.shell.openExternal('https://github.com/bit-admin/AutoSlides-Extractor')
  } catch (error) {
    log.error('Failed to open AutoSlides Extractor repository:', error)
  }
}
</script>

<style scoped>
.checkbox-label-disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.checkbox-label-disabled input[type="checkbox"] {
  cursor: not-allowed;
}

/* Section header with a right-aligned action button (e.g. Install Extractor).
   Sits at the top of an .advanced-setting-section in place of a bare h4.
   The h4's usual bottom-border separator is moved onto this wrapper so it
   runs full width below both the title and the action pill. */
.section-header-with-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}
.section-header-with-action h4 {
  margin: 0;
  padding: 0;
  border-bottom: none;
}
.section-help-text {
  margin: 0 0 12px 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.extractor-description .external-link {
  white-space: nowrap;
}

.extractor-config-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-subtle);
}

.extractor-reference {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.extractor-reference-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.extractor-platform-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.extractor-platform-row {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  align-items: start;
  gap: 8px;
  font-size: 11px;
  line-height: 1.4;
}

.extractor-platform-name {
  color: var(--text-secondary);
  font-weight: 600;
}

.extractor-platform-row code,
.extractor-linux-note {
  min-width: 0;
  color: var(--text-primary);
}

.extractor-platform-row code {
  display: block;
  padding: 2px 5px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-input);
  border-radius: 4px;
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 10.5px;
  overflow-wrap: anywhere;
}

.extractor-path-stack {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

/* Round pill button next to a section title — modelled on .variant-badge
   (AI Prompts → Distinguish 3 classes) but white/neutral and clickable. */
.section-action-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  background-color: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s, color 0.2s;
  white-space: nowrap;
}
.section-action-pill:hover {
  background-color: var(--bg-hover);
  border-color: var(--accent);
}

/* Single-row layout: [path input ............] [↻ icon] [Browse] */
.extractor-path-row {
  display: flex;
  align-items: stretch;
  gap: 6px;
}
.extractor-path-input {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 12px;
  background: var(--bg-input);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* SVG icon button — combined auto-detect + verify. Mirrors the .refresh-btn
   used in the AI builtin model display, but styled as a bordered control to
   sit between the path input and Browse button. */
.extractor-refresh-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--border-color);
  background: var(--bg-input);
  color: var(--text-primary);
  border-radius: 4px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.2s, border-color 0.2s, color 0.2s;
}
.extractor-refresh-btn:hover:not(:disabled) {
  background-color: var(--bg-hover);
  border-color: var(--accent);
}
.extractor-path-input::placeholder {
  color: var(--text-muted);
}

.extractor-refresh-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.extractor-refresh-btn .spinning {
  animation: spin 0.8s linear infinite;
}

/* Inline status text on the right of the "Extractor binary" label row. */
.extractor-status-line {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}
.extractor-status-line .extractor-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--border-strong);
  flex-shrink: 0;
}
.extractor-status-line.ok { color: var(--success); }
.extractor-status-line.ok .extractor-status-dot { background-color: var(--success); }
.extractor-status-line.error { color: var(--danger); }
.extractor-status-line.error .extractor-status-dot { background-color: var(--danger); }
.extractor-status-line.unknown .extractor-status-dot { background-color: var(--border-strong); }
</style>
