<template>
  <!-- Auto Extraction After Download -->
  <div class="advanced-setting-section">
    <div class="mb-4 flex items-center justify-between gap-3 border-b border-line pb-2">
      <h4 class="m-0 border-b-0 p-0 text-sm font-semibold text-fg">{{ $t('advanced.qtExtractor.title') }}</h4>
      <button type="button" class="inline-flex cursor-pointer items-center whitespace-nowrap rounded-xl border border-line bg-white px-2.5 py-0.5 text-[11px] font-medium text-fg transition-colors hover:border-[#ccc] hover:bg-[#f0f0f0] dark:bg-[#2d2d2d] dark:hover:border-accent dark:hover:bg-[#3d3d3d]" @click="openExtractorInstallModal">
        {{ $t('advanced.qtExtractor.install') }}
      </button>
    </div>
    <p class="mb-3 text-xs leading-normal text-fg-secondary">{{ $t('advanced.qtExtractor.titleDescription') }}</p>

    <div class="setting-item">
      <div class="auto-post-processing-control">
        <label class="checkbox-label">
          <input type="checkbox" v-model="tempQtExtractorAutoRun" />
          {{ $t('advanced.qtExtractor.autoRun') }}
        </label>
        <label class="checkbox-label" :class="{ 'cursor-not-allowed opacity-[0.55]': !tempQtExtractorAutoRun }">
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
          class="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px]"
          :class="qtExtractorStatusOk ? 'text-[#1a7f37] dark:text-[#4ade80]'
            : qtExtractorStatusError ? 'text-[#b1361e] dark:text-[#f87171]'
            : 'text-fg-secondary'"
          :title="qtExtractorStatusError || ''"
        >
          <span
            class="h-1.5 w-1.5 flex-shrink-0 rounded-full"
            :class="qtExtractorStatusOk ? 'bg-[#2ea44f] dark:bg-[#4ade80]'
              : qtExtractorStatusError ? 'bg-[#d73a49] dark:bg-[#f87171]'
              : 'bg-[#adb5bd] dark:bg-[#6e6e6e]'"
          ></span>
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

      <div class="flex flex-col gap-2.5 rounded-md border border-line bg-subtle p-2.5">
        <div class="flex flex-col gap-2 border-b border-line pb-2">
          <div class="text-xs font-semibold text-fg">
            {{ $t('advanced.qtExtractor.defaultExecutables') }}
          </div>
          <div class="flex flex-col gap-1.5">
            <div class="grid grid-cols-[68px_minmax(0,1fr)] items-start gap-2 text-[11px] leading-[1.4]">
              <span class="font-semibold text-fg-secondary">{{ $t('advanced.qtExtractor.platformMacOS') }}</span>
              <code :class="platformCodeCls">/Applications/AutoSlides Extractor.app/Contents/MacOS/AutoSlidesExtractor</code>
            </div>
            <div class="grid grid-cols-[68px_minmax(0,1fr)] items-start gap-2 text-[11px] leading-[1.4]">
              <span class="font-semibold text-fg-secondary">{{ $t('advanced.qtExtractor.platformWindows') }}</span>
              <div class="flex min-w-0 flex-col gap-1">
                <code :class="platformCodeCls">C:\Program Files\AutoSlides Extractor\AutoSlidesExtractor.exe</code>
                <code :class="platformCodeCls">C:\Program Files (x86)\AutoSlides Extractor\AutoSlidesExtractor.exe</code>
              </div>
            </div>
            <div class="grid grid-cols-[68px_minmax(0,1fr)] items-start gap-2 text-[11px] leading-[1.4]">
              <span class="font-semibold text-fg-secondary">{{ $t('advanced.qtExtractor.platformLinux') }}</span>
              <span class="min-w-0 text-fg">{{ $t('advanced.qtExtractor.linuxBuildFromSource') }}</span>
            </div>
          </div>
        </div>

        <div class="flex items-stretch gap-1.5">
          <input
            type="text"
            class="min-w-0 flex-1 truncate rounded border border-line bg-white px-2 py-1.5 text-xs text-fg dark:bg-[#1e1e1e] dark:placeholder:text-[#888]"
            :value="qtExtractorResolvedPath || qtExtractorBinaryPath"
            :placeholder="$t('advanced.qtExtractor.pathPlaceholder')"
            :title="qtExtractorResolvedPath || qtExtractorBinaryPath"
            readonly
          />
          <button
            type="button"
            class="inline-flex h-[30px] w-[30px] flex-shrink-0 cursor-pointer items-center justify-center rounded border border-line bg-white text-fg transition-colors enabled:hover:border-[#ccc] enabled:hover:bg-[#f0f0f0] disabled:cursor-not-allowed disabled:opacity-[0.55] dark:bg-[#2d2d2d] dark:enabled:hover:border-accent dark:enabled:hover:bg-[#3d3d3d]"
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
              :class="{ 'animate-spin': qtExtractorVerifying }"
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

// Monospace path chips in the default-executables reference box.
const platformCodeCls =
  'block min-w-0 rounded border border-[rgba(0,0,0,0.08)] bg-white/80 px-[5px] py-0.5 font-mono text-[10.5px] text-fg [overflow-wrap:anywhere] dark:border-[#404040] dark:bg-black/[0.22]'

const openExtractorRepository = async () => {
  try {
    await window.electronAPI.shell.openExternal('https://github.com/bit-admin/AutoSlides-Extractor')
  } catch (error) {
    console.error('Failed to open AutoSlides Extractor repository:', error)
  }
}
</script>

