<template>
  <!-- Auto Extraction After Download -->
  <div class="advanced-setting-section">
    <div class="flex items-center justify-between gap-3 mb-4 pb-2 border-b border-border">
      <h4 class="m-0 p-0 border-none">{{ $t('advanced.qtExtractor.title') }}</h4>
      <button type="button" class="inline-flex items-center py-0.5 px-2.5 rounded-xl text-[11px] font-medium bg-surface text-text border border-border-input cursor-pointer whitespace-nowrap transition-colors hover:bg-hover hover:border-border-strong" @click="openExtractorInstallModal">
        {{ $t('advanced.qtExtractor.install') }}
      </button>
    </div>
    <p class="setting-description m-0 mb-3">{{ $t('advanced.qtExtractor.titleDescription') }}</p>

    <div class="setting-item">
      <div class="auto-post-processing-control">
        <label class="checkbox-label">
          <input type="checkbox" v-model="tempQtExtractorAutoRun" />
          {{ $t('advanced.qtExtractor.autoRun') }}
        </label>
        <label class="checkbox-label" :class="{ 'opacity-55 cursor-not-allowed [&_input]:cursor-not-allowed': !tempQtExtractorAutoRun }">
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
          class="inline-flex items-center gap-1.5 text-[11px] whitespace-nowrap"
          :class="{
            'text-success [&_.extractor-status-dot]:bg-success': qtExtractorStatusOk,
            'text-danger [&_.extractor-status-dot]:bg-danger': !qtExtractorStatusOk && !!qtExtractorStatusError,
            'text-text-secondary [&_.extractor-status-dot]:bg-border-strong': !qtExtractorStatusOk && !qtExtractorStatusError
          }"
          :title="qtExtractorStatusError || ''"
        >
          <span class="extractor-status-dot w-1.5 h-1.5 rounded-full shrink-0 bg-border-strong"></span>
          <span v-if="qtExtractorStatusOk">
            {{ $t('advanced.qtExtractor.statusReady') }}<span v-if="qtExtractorStatusVersion"> · v{{ qtExtractorStatusVersion }}</span>
          </span>
          <span v-else-if="qtExtractorStatusError">{{ $t('advanced.qtExtractor.statusMissing') }}</span>
          <span v-else>{{ $t('advanced.qtExtractor.statusUnknown') }}</span>
        </div>
      </div>
      <div class="setting-description">
        {{ $t('advanced.qtExtractor.sectionDescription') }}
        <a
          href="https://github.com/bit-admin/AutoSlides-Extractor"
          class="external-link whitespace-nowrap"
          @click.prevent="openExtractorRepository"
        >
          {{ $t('advanced.qtExtractor.sourceLink') }}
        </a>
      </div>

      <div class="flex flex-col gap-2.5 p-2.5 border border-border rounded-md bg-subtle">
        <div class="flex flex-col gap-2 pb-2 border-b border-border">
          <div class="text-xs font-semibold text-text">
            {{ $t('advanced.qtExtractor.defaultExecutables') }}
          </div>
          <div class="flex flex-col gap-1.5">
            <div class="grid grid-cols-[68px_minmax(0,1fr)] items-start gap-2 text-[11px] leading-snug">
              <span class="text-text-secondary font-semibold">{{ $t('advanced.qtExtractor.platformMacOS') }}</span>
              <code class="block py-0.5 px-[5px] bg-surface/80 border border-border rounded text-[10.5px] font-mono break-words">/Applications/AutoSlides Extractor.app/Contents/MacOS/AutoSlidesExtractor</code>
            </div>
            <div class="grid grid-cols-[68px_minmax(0,1fr)] items-start gap-2 text-[11px] leading-snug">
              <span class="text-text-secondary font-semibold">{{ $t('advanced.qtExtractor.platformWindows') }}</span>
              <div class="flex flex-col gap-1 min-w-0">
                <code class="block py-0.5 px-[5px] bg-surface/80 border border-border rounded text-[10.5px] font-mono break-words">C:\Program Files\AutoSlides Extractor\AutoSlidesExtractor.exe</code>
                <code class="block py-0.5 px-[5px] bg-surface/80 border border-border rounded text-[10.5px] font-mono break-words">C:\Program Files (x86)\AutoSlides Extractor\AutoSlidesExtractor.exe</code>
              </div>
            </div>
            <div class="grid grid-cols-[68px_minmax(0,1fr)] items-start gap-2 text-[11px] leading-snug">
              <span class="text-text-secondary font-semibold">{{ $t('advanced.qtExtractor.platformLinux') }}</span>
              <span class="text-text">{{ $t('advanced.qtExtractor.linuxBuildFromSource') }}</span>
            </div>
          </div>
        </div>

        <div class="flex items-stretch gap-1.5">
          <input
            type="text"
            class="flex-1 min-w-0 py-1.5 px-2 border border-border-input rounded text-xs bg-surface text-text overflow-hidden text-ellipsis whitespace-nowrap focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
            :value="qtExtractorResolvedPath || qtExtractorBinaryPath"
            :placeholder="$t('advanced.qtExtractor.pathPlaceholder')"
            :title="qtExtractorResolvedPath || qtExtractorBinaryPath"
            readonly
          />
          <button
            type="button"
            class="inline-flex items-center justify-center w-[30px] h-[30px] p-0 border border-border-input bg-surface text-text rounded cursor-pointer shrink-0 transition-colors hover:bg-hover hover:border-border-strong disabled:opacity-55 disabled:cursor-not-allowed"
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
              :class="{ 'animate-spin-slow': qtExtractorVerifying }"
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
        class="concurrent-select"
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
        class="concurrent-select"
        @change="updateDownloadMaxWorkers"
      >
        <option v-for="v in [1, 2, 4, 8, 16, 32]" :key="v" :value="v">{{ v }}</option>
      </select>
    </div>
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.downloadNumRetries') }}</label>
      <select
        v-model="tempDownloadNumRetries"
        class="concurrent-select"
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
        class="concurrent-select"
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
            v-model="showMorePlaybackSpeed"
            @change="setShowMorePlaybackSpeed"
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
            v-model="preventSystemSleep"
            @change="setPreventSystemSleep"
          />
          {{ $t('advanced.enablePreventSleep') }}
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettingsContext } from '@features/settings/settingsContext'

const { settings, advanced } = useSettingsContext()

const {
  showMorePlaybackSpeed,
  setShowMorePlaybackSpeed,
  preventSystemSleep,
  setPreventSystemSleep,
} = settings

const {
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
  updateMaxConcurrentDownloads,
  updateDownloadMaxWorkers,
  updateDownloadNumRetries,
  updateVideoRetryCount,
} = advanced

const openExtractorRepository = async () => {
  try {
    await window.electronAPI.shell.openExternal('https://github.com/bit-admin/AutoSlides-Extractor')
  } catch (error) {
    console.error('Failed to open AutoSlides Extractor repository:', error)
  }
}
</script>

<style scoped>
/* Spin animation for the refresh icon */
@keyframes extractor-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.animate-spin-slow {
  animation: extractor-spin 0.8s linear infinite;
}
</style>
