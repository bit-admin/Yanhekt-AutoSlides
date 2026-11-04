<template>
  <div class="sso-lab">
    <!-- Same frame as the API tab: switch + one request line, list on the left,
         a settings panel and a details panel on the right. -->
    <header class="sso-toolbar">
      <slot name="switcher" />
      <form class="run-bar" @submit.prevent="start">
        <div class="field-group">
          <select v-model="target" class="target-select" :disabled="active" :aria-label="$t('developer.sso.target')">
            <option value="yanhekt">{{ $t('developer.sso.targets.yanhekt') }}</option>
            <option value="both">{{ $t('developer.sso.targets.both') }}</option>
            <option value="yanhe2">{{ $t('developer.sso.targets.yanhe2') }}</option>
          </select>
          <input
            v-model="username"
            class="group-input user-input"
            type="text"
            autocomplete="off"
            spellcheck="false"
            :disabled="active"
            :placeholder="$t('developer.sso.username')"
            :aria-label="$t('developer.sso.username')"
          />
          <input
            v-model="password"
            class="group-input"
            type="password"
            autocomplete="off"
            :disabled="active"
            :placeholder="$t('developer.sso.password')"
            :aria-label="$t('developer.sso.password')"
          />
        </div>
        <button v-if="status === 'running'" type="button" class="btn" :disabled="busy || snapshot?.pauseRequested" @click="control('pause')">
          {{ snapshot?.pauseRequested ? $t('developer.sso.pausing') : $t('developer.sso.pause') }}
        </button>
        <template v-if="status === 'paused'">
          <button type="button" class="btn" :disabled="busy" @click="control('step')">{{ $t('developer.sso.step') }}</button>
          <button type="button" class="btn" :disabled="busy" @click="control('resume')">{{ $t('developer.sso.resume') }}</button>
        </template>
        <button v-if="active" type="button" class="btn btn--danger-outline" :disabled="busy" @click="control('stop')">
          {{ $t('developer.sso.stop') }}
        </button>
        <button
          type="submit"
          class="btn run-btn"
          :class="{ 'btn--primary': !active }"
          :disabled="busy || !username.trim() || !password"
        >
          {{ snapshot?.runId ? $t('developer.sso.restart') : $t('developer.sso.start') }}
        </button>
      </form>
    </header>

    <div class="sso-body">
      <aside class="step-pane custom-scrollbar">
        <p v-if="!steps.length" class="pane-empty">{{ $t('developer.sso.emptyTimeline') }}</p>
        <section v-for="(step, i) in steps" :key="i" class="step-group" :data-state="step.state">
          <button
            type="button"
            class="step-head"
            :class="{ active: selection?.step === i && selection.exchange === null }"
            @click="selectStep(i)"
          >
            <span class="step-dot" aria-hidden="true" />
            <span class="section-label step-name">{{ stepLabel(step.id) }}</span>
            <span class="step-time">{{ formatClock(step.reachedAt) }}</span>
          </button>
          <button
            v-for="ex in step.exchanges"
            :key="ex.id"
            type="button"
            class="ex-row"
            :class="{ active: selection?.exchange === ex.id }"
            :title="ex.url"
            @click="selectExchange(i, ex.id)"
          >
            <span class="method-tag">{{ ex.method }}</span>
            <span class="ex-path">{{ shortUrl(ex.url) }}</span>
            <span class="ex-status" :class="statusClass(ex)">{{ ex.status ?? 'ERR' }}</span>
          </button>
          <p v-if="step.state === 'waiting' && !step.exchanges.length" class="step-waiting">
            {{ status === 'awaiting_sms_send' ? $t('developer.sso.status.awaiting_sms_send') : $t('developer.sso.status.paused') }}
          </p>
        </section>
      </aside>

      <div class="work-pane custom-scrollbar">
        <section class="panel run-panel">
          <div class="panel-strip">
            <div class="strip-left">
              <span class="section-label">{{ $t('developer.sso.run') }}</span>
              <span class="run-status" :data-status="status">
                {{ $t(`developer.sso.status.${status}`) }}
                <template v-if="status === 'paused' && pausedStep"> · {{ $t('developer.sso.before', { step: stepLabel(pausedStep) }) }}</template>
              </span>
              <span v-if="snapshot?.startedAt" class="stat">{{ elapsed }}</span>
            </div>
            <div class="run-options">
              <select v-if="savedLogins.length" class="text-input compact saved-select" :disabled="active" :aria-label="$t('developer.sso.fillSaved')" @change="fillSavedLogin(($event.target as HTMLSelectElement).value)">
                <option value="">{{ $t('developer.sso.fillSaved') }}</option>
                <option v-for="row in savedLogins" :key="row.badge" :value="row.badge">{{ row.username }}</option>
              </select>
              <label class="check" :title="$t('developer.sso.trustedDeviceHint')">
                <input v-model="useTrustedDevice" type="checkbox" :disabled="active" />
                <span>{{ $t('developer.sso.trustedDeviceShort', { count: snapshot?.storedTrustedCookies ?? 0 }) }}</span>
              </label>
              <label class="check">
                <input :checked="stepMode" type="checkbox" :disabled="busy" @change="setStepMode(($event.target as HTMLInputElement).checked)" />
                <span>{{ $t('developer.sso.stepModeShort') }}</span>
              </label>
              <label class="check">
                <input :checked="reveal" type="checkbox" :disabled="busy" @change="setReveal(($event.target as HTMLInputElement).checked)" />
                <span>{{ $t('developer.sso.revealShort') }}</span>
              </label>
            </div>
          </div>
          <p v-if="reveal" class="strip-notice">{{ $t('developer.sso.revealWarning') }}</p>
          <p v-if="error" class="strip-notice strip-notice--bad">{{ error }}</p>

          <div class="run-body">
            <template v-if="status === 'awaiting_sms_send'">
              <p class="run-text">{{ $t('developer.sso.smsGateText', { phone: snapshot?.phoneHint || '—' }) }}</p>
              <div class="run-actions">
                <button type="button" class="btn btn--primary" :disabled="busy" @click="sendSms('send')">{{ $t('developer.sso.sendCode') }}</button>
                <button type="button" class="btn" :disabled="busy" @click="sendSms('skip')">{{ $t('developer.sso.haveCode') }}</button>
              </div>
            </template>

            <form v-else-if="status === 'awaiting_code'" class="run-actions" @submit.prevent="submitCode">
              <span v-if="snapshot?.phoneHint" class="run-text">{{ $t('developer.sso.codeSentTo', { phone: snapshot.phoneHint }) }}</span>
              <input
                v-model="code"
                class="text-input compact mono code-input"
                inputmode="numeric"
                autocomplete="one-time-code"
                spellcheck="false"
                :placeholder="$t('developer.sso.codePlaceholder')"
              />
              <button type="submit" class="btn btn--primary" :disabled="busy || !code.trim()">{{ $t('developer.sso.submitCode') }}</button>
            </form>

            <p v-else-if="snapshot?.error" class="run-text">
              <span class="tag tag--bad">{{ snapshot.error.reason }}</span>
              <span class="bad">{{ snapshot.error.message }}</span>
            </p>

            <dl v-else-if="snapshot?.result" class="kv-list">
              <div><dt>{{ $t('developer.sso.yanhektToken') }}</dt><dd>{{ snapshot.result.yanhekt ?? '—' }}</dd></div>
              <div v-if="snapshot.target !== 'yanhekt'"><dt>{{ $t('developer.sso.yanhe2Token') }}</dt><dd>{{ snapshot.result.yanhe2 ?? '—' }}</dd></div>
              <div v-for="c in snapshot.result.durableCookies" :key="c.host + c.name">
                <dt>{{ $t('developer.sso.durableCookie') }}</dt>
                <dd>{{ c.name }}<template v-if="c.value !== null">={{ c.value }}</template> · {{ c.host }} · {{ formatDate(c.expiresAt) }}</dd>
              </div>
              <div><dt>{{ $t('developer.sso.seeded') }}</dt><dd>{{ snapshot.seededCookies }}</dd></div>
            </dl>

            <p v-else class="hint">{{ $t('developer.sso.nothingStored') }}</p>
          </div>
        </section>

        <section class="panel detail">
          <div class="panel-strip">
            <div class="sub-tabs" role="tablist">
              <span class="section-label strip-label">{{ $t('developer.sso.details') }}</span>
              <button
                v-for="tab in detailTabs"
                :key="tab"
                type="button"
                class="sub-tab"
                :class="{ active: shownTab === tab }"
                :disabled="tab !== 'step' && !selectedExchange"
                @click="detailTab = tab"
              >
                {{ $t(`developer.sso.detail.${tab}`) }}
              </button>
            </div>
            <div class="detail-stats">
              <template v-if="selectedExchange">
                <span class="stat" :class="statusClass(selectedExchange)">{{ selectedExchange.status ?? 'ERR' }} {{ selectedExchange.statusText }}</span>
                <span class="stat">{{ selectedExchange.durationMs }} ms</span>
              </template>
              <button type="button" class="btn btn--sm" :disabled="!snapshot?.runId" @click="copyReport">{{ $t('developer.sso.copyReport') }}</button>
            </div>
          </div>

          <div v-if="!selectedStep" class="detail-empty">{{ $t('developer.sso.emptyDetail') }}</div>
          <div v-else class="detail-scroll custom-scrollbar">
            <template v-if="shownTab === 'step'">
              <p class="sent-line">{{ stepLabel(selectedStep.id) }} · {{ formatClock(selectedStep.reachedAt) }}</p>
              <dl v-if="Object.keys(selectedStep.notes).length" class="header-list">
                <div v-for="(value, key) in selectedStep.notes" :key="key"><dt>{{ key }}</dt><dd>{{ value }}</dd></div>
              </dl>
              <p v-else class="hint">{{ $t('developer.sso.noNotes') }}</p>
            </template>
            <template v-else-if="selectedExchange">
              <p class="sent-line">{{ selectedExchange.method }} {{ selectedExchange.url }}</p>
              <p v-if="selectedExchange.error" class="sent-line bad">{{ selectedExchange.error }}</p>
              <template v-if="shownTab === 'request'">
                <dl class="header-list">
                  <div v-for="(value, key) in selectedExchange.requestHeaders" :key="key"><dt>{{ key }}</dt><dd>{{ value }}</dd></div>
                </dl>
                <pre v-if="selectedExchange.requestBody" class="sent-body">{{ selectedExchange.requestBody }}</pre>
              </template>
              <dl v-else-if="shownTab === 'response'" class="header-list">
                <div v-for="(value, key) in selectedExchange.responseHeaders" :key="key"><dt>{{ key }}</dt><dd>{{ value }}</dd></div>
              </dl>
              <template v-else>
                <p v-if="selectedExchange.responseBodyTruncatedFrom" class="hint">
                  {{ $t('developer.sso.truncated', { shown: selectedExchange.responseBody.length, total: selectedExchange.responseBodyTruncatedFrom }) }}
                </p>
                <pre class="response-pre">{{ selectedExchange.responseBody || $t('developer.sso.noBody') }}</pre>
              </template>
            </template>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DevSsoExchange, DevSsoStepId } from '@common/devSso'
import { useSsoLab } from '@features/developer/useSsoLab'

const { t } = useI18n()

const {
  snapshot,
  username,
  password,
  target,
  useTrustedDevice,
  stepMode,
  code,
  busy,
  error,
  status,
  active,
  steps,
  savedLogins,
  selection,
  selectedStep,
  selectedExchange,
  selectStep,
  selectExchange,
  start,
  control,
  sendSms,
  submitCode,
  setStepMode,
  reveal,
  setReveal,
  fillSavedLogin,
  copyReport,
} = useSsoLab()

const detailTabs = ['step', 'request', 'response', 'body'] as const
type DetailTab = (typeof detailTabs)[number]
const detailTab = ref<DetailTab>('response')
/** A step without a picked request can only show what the step found. */
const shownTab = computed<DetailTab>(() => (selectedExchange.value ? detailTab.value : 'step'))

const pausedStep = computed(() => {
  const last = steps.value.at(-1)
  return last && last.state === 'waiting' ? last.id : null
})

function stepLabel(id: DevSsoStepId): string {
  return t(`developer.sso.steps.${id}`)
}

function statusClass(ex: DevSsoExchange): string {
  if (ex.status == null || ex.status >= 400) return 'bad'
  if (ex.status >= 300) return 'redirect'
  return 'ok'
}

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname.replace(/\.(bit\.edu|yanhekt)\.cn$/, '')}${parsed.pathname}`
  } catch {
    return url
  }
}

const formatClock = (ms: number) => new Date(ms).toLocaleTimeString()
const formatDate = (ms: number) => new Date(ms).toLocaleString()

// Elapsed since the run started, ticking only while it is active.
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null
watch(active, (on) => {
  if (timer) clearInterval(timer)
  timer = on ? setInterval(() => { now.value = Date.now() }, 1000) : null
  now.value = Date.now()
}, { immediate: true })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

const elapsed = computed(() => {
  const s = snapshot.value
  if (!s?.startedAt) return ''
  const seconds = Math.max(0, Math.round(((s.finishedAt ?? now.value) - s.startedAt) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})
</script>

<style scoped>
/* Mirrors ApiLabPanel: controls 4px, panels 6px, tags 4px hairline boxes. */
.sso-lab {
  --lab-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-page);
  color: var(--text-primary);
}

.mono {
  font-family: var(--lab-mono);
}

.hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-muted);
}

.section-label {
  margin: 0;
  font-family: var(--lab-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.ok {
  color: var(--success);
}

.redirect {
  color: var(--text-secondary);
}

.bad {
  color: var(--danger);
}

/* Toolbar */
.sso-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.run-bar {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: stretch;
  gap: 8px;
}

/* Target, student id and password read as one field, like method + URL. */
.field-group {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: stretch;
  min-height: var(--control-height);
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background: var(--bg-input);
  transition: border-color 0.2s;
}

.field-group:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.target-select,
.group-input {
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-family: var(--lab-mono);
  font-size: 12px;
}

.target-select {
  flex: 0 0 auto;
  padding: 0 6px 0 10px;
  border-right: 1px solid var(--border-color);
  border-radius: 4px 0 0 4px;
  font-weight: 700;
  cursor: pointer;
}

.group-input {
  flex: 1;
  min-width: 0;
  padding: 0 10px;
}

.user-input {
  border-right: 1px solid var(--border-color);
}

.group-input:disabled,
.target-select:disabled {
  color: var(--text-secondary);
  cursor: default;
}

.run-btn {
  min-width: 76px;
}

.sso-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

/* Steps on the left, like the request list: a step is a group, its requests are rows. */
.step-pane {
  flex: 0 0 272px;
  width: 272px;
  min-height: 0;
  overflow: auto;
  border-right: 1px solid var(--border-color);
  padding: 12px 8px 16px;
}

.pane-empty {
  margin: 4px 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-muted);
}

.step-group {
  padding: 4px 0 6px;
}

.step-head,
.ex-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.step-head {
  padding: 5px 8px 4px;
}

.ex-row {
  padding: 5px 8px;
}

.step-head:hover,
.ex-row:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.step-head.active,
.ex-row.active {
  background: var(--bg-selected);
  color: var(--text-primary);
}

.step-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: 1px solid var(--border-strong);
  flex-shrink: 0;
}

.step-group[data-state='running'] .step-dot {
  background: var(--control-accent);
  border-color: var(--control-accent);
}

.step-group[data-state='waiting'] .step-dot {
  background: var(--warning);
  border-color: var(--warning);
}

.step-group[data-state='done'] .step-dot {
  background: var(--success);
  border-color: var(--success);
}

.step-group[data-state='failed'] .step-dot {
  background: var(--danger);
  border-color: var(--danger);
}

.step-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-head.active .step-name {
  color: var(--text-primary);
}

.step-time {
  flex-shrink: 0;
  font-family: var(--lab-mono);
  font-size: 10px;
  color: var(--text-muted);
}

.method-tag {
  flex: 0 0 42px;
  font-family: var(--lab-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.ex-path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--lab-mono);
  font-size: 12px;
}

.ex-status {
  flex-shrink: 0;
  font-family: var(--lab-mono);
  font-size: 11px;
}

.step-waiting {
  margin: 2px 8px 0 22px;
  font-size: 12px;
  color: var(--warning);
}

/* Right side */
.work-pane {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 20px 18px;
  overflow: auto;
}

.panel {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-surface);
  overflow: hidden;
}

.run-panel {
  flex-shrink: 0;
}

.panel-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 0 10px 0 8px;
  border-bottom: 1px solid var(--border-color);
  min-height: 38px;
}

.strip-left {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 4px;
}

.run-status {
  font-size: 12px;
  color: var(--text-secondary);
}

.run-status[data-status='succeeded'] {
  color: var(--success);
}

.run-status[data-status='failed'] {
  color: var(--danger);
}

.run-status[data-status='paused'],
.run-status[data-status='awaiting_sms_send'],
.run-status[data-status='awaiting_code'] {
  color: var(--warning);
}

.run-options,
.detail-stats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-left: auto;
  padding: 5px 0;
}

.text-input.compact {
  min-height: 26px;
  padding: 3px 8px;
}

.saved-select {
  max-width: 200px;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  cursor: pointer;
}

.check input {
  accent-color: var(--control-accent);
}

.strip-notice {
  margin: 0;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--warning-bg);
  font-size: 12px;
  color: var(--warning);
}

.strip-notice--bad {
  background: var(--danger-bg);
  color: var(--danger);
}

.run-body {
  padding: 10px 12px;
}

.run-text {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}

.run-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

form.run-actions {
  margin-top: 0;
}

.code-input {
  width: 140px;
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 0 6px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-family: var(--lab-mono);
  font-size: 11px;
  line-height: 18px;
  white-space: nowrap;
}

.tag--bad {
  border-color: var(--danger-border);
  color: var(--danger);
}

.kv-list {
  margin: 0;
}

.kv-list div,
.header-list div {
  display: grid;
  grid-template-columns: minmax(140px, 200px) 1fr;
  gap: 12px;
  padding: 3px 0;
}

.kv-list dt,
.header-list dt {
  font-size: 12px;
  color: var(--text-muted);
}

.header-list dt {
  font-family: var(--lab-mono);
}

.kv-list dd,
.header-list dd {
  margin: 0;
  font-family: var(--lab-mono);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  user-select: text;
}

.header-list {
  margin: 0;
}

/* Details */
.detail {
  flex: 1;
  min-height: 240px;
}

.sub-tabs {
  display: flex;
  align-items: stretch;
  align-self: stretch;
  flex-shrink: 0;
  gap: 2px;
}

/* A strip with tabs stays on one line, or the tabs' underline would float
   above its bottom border. */
.detail .panel-strip {
  flex-wrap: nowrap;
}

.detail .detail-stats {
  flex-wrap: nowrap;
  min-width: 0;
}

.detail-stats > * {
  flex-shrink: 0;
}

.strip-label {
  align-self: center;
  padding: 0 8px 0 4px;
}

.sub-tab {
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.sub-tab:hover:not(:disabled) {
  color: var(--text-primary);
}

.sub-tab.active {
  color: var(--text-primary);
  border-bottom-color: var(--accent);
}

.sub-tab:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.stat {
  font-family: var(--lab-mono);
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.stat.ok {
  color: var(--success);
}

.stat.bad {
  color: var(--danger);
}

.detail-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  font-size: 12px;
  color: var(--text-muted);
}

.detail-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 10px 12px;
}

.sent-line {
  margin: 0 0 8px;
  font-family: var(--lab-mono);
  font-size: 12px;
  word-break: break-all;
  user-select: text;
}

.sent-body,
.response-pre {
  margin: 10px 0 0;
  font-family: var(--lab-mono);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-primary);
  user-select: text;
}

.response-pre {
  margin: 0;
}
</style>
