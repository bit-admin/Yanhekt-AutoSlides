<template>
  <!-- Command line wrappers on PATH. Install / Remove act at once (they write
       files, not settings), so nothing here waits for the page's Save.
       Laid out like the Extractor box in Download & Playback. -->
  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.addons.cliTitle') }}</h4>
    <div class="setting-item">
      <div class="setting-description">{{ $t('advanced.addons.cliDescription') }}</div>

      <!-- A setting, unlike Install / Remove: it waits for the page's Save. -->
      <div class="cli-allow">
        <div class="prevent-sleep-control">
          <label class="checkbox-label">
            <input type="checkbox" v-model="tempAllowCliControl" />
            {{ $t('advanced.addons.cliAllowControl') }}
          </label>
        </div>
        <div class="setting-description">{{ $t('advanced.addons.cliAllowControlDescription') }}</div>
      </div>

      <div class="cli-box">
        <div class="cli-group">
          <div class="cli-group-title">{{ $t('advanced.addons.cliStatusTitle') }}</div>
          <div class="cli-status-row">
            <div class="cli-status-line" :class="overallState">
              <span class="cli-status-dot"></span>
              <span>{{ $t(STATE_KEYS[overallState]) }}</span>
              <code v-if="status && anyOurs" class="cli-status-path" :title="status.binDir">{{ status.binDir }}</code>
            </div>
            <div class="cli-actions">
              <button
                v-if="overallState !== 'installed'"
                type="button"
                class="btn btn--sm"
                :disabled="busy || !canInstall"
                @click="run('install')"
              >
                {{ overallState === 'outdated' ? $t('advanced.addons.cliUpdate') : $t('advanced.addons.cliInstall') }}
              </button>
              <button
                v-if="anyOurs"
                type="button"
                class="btn btn--sm btn--danger-outline"
                :disabled="busy"
                @click="run('uninstall')"
              >
                {{ $t('advanced.addons.cliRemove') }}
              </button>
            </div>
          </div>
        </div>

        <!-- The agent skill the app ships (main/platform/cliInstall/skillBundle.ts).
             The prompt starts folded; Copy Prompt is the whole job. -->
        <div v-if="status?.skill" class="cli-group">
          <div class="cli-group-title">{{ $t('advanced.addons.cliSkillTitle') }}</div>
          <div class="setting-description">{{ $t('advanced.addons.cliSkillDescription') }}</div>
          <div class="cli-status-row">
            <code class="cli-status-path" :title="status.skill.path">{{ status.skill.path }}</code>
            <div class="cli-actions">
              <button type="button" class="btn btn--sm" @click="copySkillPrompt">
                {{ promptCopied ? $t('advanced.addons.cliSkillCopied') : $t('advanced.addons.cliSkillCopy') }}
              </button>
            </div>
          </div>
          <button
            type="button"
            class="cli-group-title cli-usage-toggle"
            :aria-expanded="promptOpen"
            aria-controls="cli-skill-prompt"
            @click="promptOpen = !promptOpen"
          >
            <svg
              class="cli-usage-chevron"
              :class="{ 'is-open': promptOpen }"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            {{ $t('advanced.addons.cliSkillPrompt') }}
          </button>
          <pre v-show="promptOpen" id="cli-skill-prompt" class="cli-skill-prompt">{{ status.skill.prompt }}</pre>
        </div>

        <!-- The same ground `yhdl --help` covers, so the page doubles as the manual.
             Long, so it starts folded. -->
        <div class="cli-group">
          <button
            type="button"
            class="cli-group-title cli-usage-toggle"
            :aria-expanded="usageOpen"
            aria-controls="cli-usage-table"
            @click="usageOpen = !usageOpen"
          >
            <svg
              class="cli-usage-chevron"
              :class="{ 'is-open': usageOpen }"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            {{ $t('advanced.addons.cliUsageTitle') }}
          </button>
          <div v-show="usageOpen" id="cli-usage-table" class="cli-table">
            <div class="cli-table-header">
              <span>{{ $t('advanced.addons.cliColCommand') }}</span>
              <span>{{ $t('advanced.addons.cliColDescription') }}</span>
            </div>
            <div v-for="row in USAGE_ROWS" :key="row.code" :class="['cli-table-row', { 'is-option': row.option }]">
              <span class="cli-usage">
                <code>{{ row.code }}</code>
                <span v-if="row.argKey" class="cli-arg">&lt;{{ $t(row.argKey) }}&gt;</span>
                <span v-else-if="row.arg" class="cli-arg">&lt;{{ row.arg }}&gt;</span>
              </span>
              <span class="cli-usage-description">{{ $t(row.descriptionKey) }}</span>
            </div>
          </div>
        </div>
      </div>

      <template v-if="status">
        <div v-if="status.reason" class="cli-notice" role="status">
          {{ $t(UNSUPPORTED_KEYS[status.reason]) }}
        </div>

        <div v-for="name in foreignNames" :key="name" class="cli-notice" role="status">
          {{ $t('advanced.addons.cliForeign', { name }) }}
        </div>

        <div v-if="error" class="cli-notice cli-notice--error" role="alert">
          {{ $t('advanced.addons.cliError', { error }) }}
        </div>

        <!-- Only once something is installed: before that the hint is noise. -->
        <QuarantineNotice
          v-if="anyOurs && status.onPath !== true"
          :message="$t(pathHintKey)"
          :command="status.pathCommand"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { CliInstallStatus, CliUnsupportedReason } from '@common/cliCommands'
import { createLogger } from '@shared/utils/logger'
import { useSettingsContext } from '@features/settings/settingsContext'
import QuarantineNotice from '../shell/QuarantineNotice.vue'

const log = createLogger('CliCommands')

const { tempAllowCliControl } = useSettingsContext().advanced.addons

// One line for the pair: the two wrappers are installed and removed together.
type OverallState = 'installed' | 'not_installed' | 'outdated'

const STATE_KEYS: Record<OverallState, string> = {
  installed: 'advanced.addons.cliStateInstalled',
  not_installed: 'advanced.addons.cliStateNotInstalled',
  outdated: 'advanced.addons.cliStateOutdated',
}

interface UsageRow {
  code: string
  /** Placeholder shown as `<…>`: translated (`argKey`) or literal (`arg`). */
  argKey?: string
  arg?: string
  descriptionKey: string
  /** An option of the command above it; indented. */
  option?: boolean
}

// Keep in step with the command table in main/cli (each command's `options`
// and `help.ts`); `yhdl <command> --help` is the full manual.
const USAGE_ROWS: UsageRow[] = [
  { code: 'yhdl search', argKey: 'advanced.addons.cliArgKeyword', descriptionKey: 'advanced.addons.cliUsageSearch' },
  { code: 'yhdl mine', descriptionKey: 'advanced.addons.cliUsageMine' },
  { code: 'yhdl course', argKey: 'advanced.addons.cliArgCourse', descriptionKey: 'advanced.addons.cliUsageCourse' },
  { code: '--token', argKey: 'advanced.addons.cliArgToken', descriptionKey: 'advanced.addons.cliOptToken', option: true },
  { code: 'yhdl session', argKey: 'advanced.addons.cliArgSession', descriptionKey: 'advanced.addons.cliUsageSession' },
  { code: 'yhdl download', argKey: 'advanced.addons.cliArgSession', descriptionKey: 'advanced.addons.cliUsageDownload' },
  { code: '-s, --stream', arg: 'screen|camera|both', descriptionKey: 'advanced.addons.cliOptStream', option: true },
  { code: '-o, --output', argKey: 'advanced.addons.cliArgFolder', descriptionKey: 'advanced.addons.cliOptOutput', option: true },
  { code: '--course', argKey: 'advanced.addons.cliArgCourse', descriptionKey: 'advanced.addons.cliOptCourse', option: true },
  { code: '-f, --force', descriptionKey: 'advanced.addons.cliOptForce', option: true },
  { code: 'yhdl', argKey: 'advanced.addons.cliArgLink', descriptionKey: 'advanced.addons.cliUsageLink' },
  { code: 'yhdl', argKey: 'advanced.addons.cliArgCommand', descriptionKey: 'advanced.addons.cliUsageCommon' },
  { code: '--json', descriptionKey: 'advanced.addons.cliOptJson', option: true },
  { code: '--intranet', descriptionKey: 'advanced.addons.cliOptIntranet', option: true },
  { code: '--interface', argKey: 'advanced.addons.cliArgInterface', descriptionKey: 'advanced.addons.cliOptInterface', option: true },
  { code: 'autoslides', argKey: 'advanced.addons.cliArgCommand', descriptionKey: 'advanced.addons.cliUsageUmbrella' },
  { code: 'autoslides download', argKey: 'advanced.addons.cliArgSession', descriptionKey: 'advanced.addons.cliUsageAppDownload' },
  { code: '--no-wait', descriptionKey: 'advanced.addons.cliOptNoWait', option: true },
  { code: 'autoslides downloads', arg: 'wait|cancel|retry|clear', descriptionKey: 'advanced.addons.cliUsageAppDownloads' },
  { code: 'autoslides config', argKey: 'advanced.addons.cliArgSettingKey', descriptionKey: 'advanced.addons.cliUsageAppConfig' },
]

const UNSUPPORTED_KEYS: Record<CliUnsupportedReason, string> = {
  dev: 'advanced.addons.cliUnsupportedDev',
  translocated: 'advanced.addons.cliUnsupportedTranslocated',
}

const usageOpen = ref(false)
const promptOpen = ref(false)
const promptCopied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null
const status = ref<CliInstallStatus | null>(null)
const busy = ref(false)
const error = ref('')

const wrappers = computed(() => status.value?.wrappers ?? [])
const anyOurs = computed(() => wrappers.value.some((w) => w.state === 'installed' || w.state === 'outdated'))
// A pair that is only half there (one wrapper missing or stale) needs the same
// fix as a stale one: install again.
const overallState = computed<OverallState>(() => {
  if (!anyOurs.value) return 'not_installed'
  return wrappers.value.every((w) => w.state === 'installed' || w.state === 'foreign') ? 'installed' : 'outdated'
})
const canInstall = computed(
  () => !!status.value?.supported && wrappers.value.some((w) => w.state === 'not_installed' || w.state === 'outdated')
)
const foreignNames = computed(() => wrappers.value.filter((w) => w.state === 'foreign').map((w) => w.name))
const isWindows = computed(() => !!status.value?.binDir.includes('\\'))
const pathHintKey = computed(() => {
  if (isWindows.value) return 'advanced.addons.cliPathHintWindows'
  return status.value?.onPath === false ? 'advanced.addons.cliPathHint' : 'advanced.addons.cliPathUnknown'
})

const run = async (action: 'install' | 'uninstall'): Promise<void> => {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const result = await window.electronAPI.cli[action]()
    status.value = result.status
    // An unsupported build already has its own notice.
    if (!result.success && !result.status.reason) error.value = result.error || ''
  } catch (e) {
    log.error(`Command line ${action} failed:`, e)
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

const copySkillPrompt = async (): Promise<void> => {
  const prompt = status.value?.skill?.prompt
  if (!prompt) return
  try {
    await navigator.clipboard.writeText(prompt)
  } catch (e) {
    log.warn('Failed to copy the skill prompt:', e)
    return
  }
  promptCopied.value = true
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    promptCopied.value = false
  }, 2000)
}

onUnmounted(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})

onMounted(async () => {
  try {
    status.value = await window.electronAPI.cli.getStatus()
  } catch (e) {
    log.error('Failed to read command line status:', e)
  }
})
</script>

<style scoped>
/* Mirrors the Extractor box (PlaybackSettingsTab `.extractor-*`). */
.cli-allow {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.cli-box {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-subtle);
}

.cli-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cli-group-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.cli-usage-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.cli-usage-toggle:hover {
  color: var(--text-secondary);
}

.cli-usage-toggle:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--focus-ring);
  border-radius: 4px;
}

.cli-usage-chevron {
  flex-shrink: 0;
  color: var(--text-muted);
  transition: transform 0.15s ease;
}

.cli-usage-chevron.is-open {
  transform: rotate(90deg);
}

.cli-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-elevated);
}

.cli-status-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
}

.cli-status-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--border-strong);
}

.cli-status-line.installed .cli-status-dot { background-color: var(--success); }
.cli-status-line.outdated .cli-status-dot { background-color: var(--warning); }

.cli-status-path {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-secondary);
  user-select: text;
}

.cli-actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}

.cli-table {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-elevated);
  overflow: hidden;
}

.cli-table-header,
.cli-table-row {
  display: grid;
  grid-template-columns: minmax(200px, 2fr) 3fr;
  gap: 12px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border-color);
}

.cli-table-header {
  align-items: center;
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-muted);
}

.cli-table-row {
  align-items: baseline;
  font-size: 11px;
  line-height: 1.4;
}

.cli-table-row:last-child {
  border-bottom: none;
}

.cli-usage {
  min-width: 0;
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  color: var(--text-primary);
  user-select: text;
}

.cli-usage code {
  font: inherit;
  font-weight: 600;
}

.cli-table-row.is-option .cli-usage {
  padding-left: 14px;
}

.cli-table-row.is-option .cli-usage code {
  font-weight: 400;
}

.cli-arg {
  margin-left: 6px;
  color: var(--text-secondary);
}

.cli-usage-description {
  color: var(--text-secondary);
}

.cli-skill-prompt {
  margin: 0;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-elevated);
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-secondary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  user-select: text;
}

.cli-notice {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--warning);
}

.cli-notice--error {
  color: var(--danger);
}
</style>
