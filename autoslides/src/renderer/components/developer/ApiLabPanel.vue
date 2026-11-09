<template>
  <div class="api-lab">
    <header class="api-toolbar">
      <slot name="switcher" />
      <form class="request-bar" @submit.prevent="send">
        <div class="url-group">
          <select
            class="method-select"
            :value="method"
            :aria-label="$t('developer.api.method')"
            @change="setMethod(($event.target as HTMLSelectElement).value as DevApiMethod)"
          >
            <option v-for="m in DEV_API_METHODS" :key="m" :value="m">{{ m }}</option>
          </select>
          <input
            class="url-input"
            type="text"
            spellcheck="false"
            :value="urlText"
            :aria-label="$t('developer.api.url')"
            :placeholder="urlPlaceholder"
            @input="onUrlInput(($event.target as HTMLInputElement).value)"
          />
        </div>
        <button class="btn btn--primary send-btn" type="submit" :disabled="state.running || !urlText.trim()">
          {{ state.running ? $t('developer.api.sending') : $t('developer.api.send') }}
        </button>
      </form>
    </header>

    <div class="api-body">
      <aside class="preset-pane custom-scrollbar">
        <div class="platform-switch" role="tablist" :aria-label="$t('developer.api.platform')">
          <button
            v-for="p in PLATFORM_TABS"
            :key="p.id"
            type="button"
            role="tab"
            class="platform-pill"
            :class="{ active: platform === p.id }"
            :aria-selected="platform === p.id"
            @click="setPlatform(p.id)"
          >
            {{ $t(p.label) }}
          </button>
        </div>
        <div class="preset-search">
          <input
            v-model="filter"
            class="text-input"
            type="search"
            :placeholder="$t('developer.api.filterPlaceholder')"
          />
        </div>
        <section v-for="group in visibleGroups" :key="group.id" class="preset-group">
          <h3 class="section-label">{{ $t(`developer.api.groups.${group.id}`) }}</h3>
          <button
            v-for="item in group.items"
            :key="item.id"
            type="button"
            class="preset-row"
            :class="{ active: presetId === item.id }"
            :title="item.note"
            @click="applyPreset(item)"
          >
            <span class="method-tag" :data-method="item.method">{{ item.method }}</span>
            <span class="preset-path">{{ item.path }}</span>
            <span v-if="item.auth === 'auth'" class="preset-lock" :title="$t('developer.api.needsToken')" aria-hidden="true">●</span>
          </button>
        </section>
        <p v-if="!visibleGroups.length" class="preset-empty">{{ $t('developer.api.noPresets') }}</p>
      </aside>

      <div class="work-pane custom-scrollbar">
        <p v-if="preset" class="preset-note">
          <span class="tag">{{ preset.auth === 'auth' ? $t('developer.api.needsToken') : $t('developer.api.anonymous') }}</span>
          <span v-if="preset.write" class="tag tag--write">{{ $t('developer.api.writes') }}</span>
          <span class="preset-note-text">{{ preset.note }}</span>
        </p>

        <section class="panel request-editor">
          <div class="panel-strip">
            <div class="sub-tabs" role="tablist">
              <button type="button" class="sub-tab" :class="{ active: requestTab === 'params' }" @click="requestTab = 'params'">
                {{ $t('developer.api.params') }}<span v-if="enabledParams" class="count">{{ enabledParams }}</span>
              </button>
              <button type="button" class="sub-tab" :class="{ active: requestTab === 'headers' }" @click="requestTab = 'headers'">
                {{ $t('developer.api.headers') }}<span v-if="enabledHeaders" class="count">{{ enabledHeaders }}</span>
              </button>
              <button type="button" class="sub-tab" :class="{ active: requestTab === 'body' }" :disabled="!hasBody" @click="requestTab = 'body'">
                {{ $t('developer.api.body') }}
              </button>
            </div>
            <div class="auth-controls">
              <label class="field-label" for="dev-api-token">{{ $t('developer.api.token') }}</label>
              <select id="dev-api-token" v-model="tokenSource" class="text-input compact token-select">
                <option value="active">
                  <template v-if="platform === 'yanhe2'">
                    {{ activeTokenLabel ? $t('developer.api.tokenActiveYanhe2', { time: activeTokenLabel }) : $t('developer.api.tokenActiveNoneYanhe2') }}
                  </template>
                  <template v-else>
                    {{ activeTokenLabel ? $t('developer.api.tokenActive', { token: activeTokenLabel }) : $t('developer.api.tokenActiveNone') }}
                  </template>
                </option>
                <option v-for="opt in accountOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}<template v-if="opt.masked"> ({{ opt.masked }})</template>
                </option>
                <option value="custom">{{ $t('developer.api.tokenCustom') }}</option>
                <option value="none">{{ $t('developer.api.tokenNone') }}</option>
              </select>
              <input
                v-if="tokenSource === 'custom'"
                v-model="customToken"
                class="text-input compact mono token-input"
                type="password"
                autocomplete="off"
                spellcheck="false"
                :placeholder="platform === 'yanhe2' ? $t('developer.api.tokenPlaceholderYanhe2') : $t('developer.api.tokenPlaceholder')"
              />
              <label class="client-headers" :title="platform === 'yanhe2' ? $t('developer.api.clientHeadersHintYanhe2') : $t('developer.api.clientHeadersHint')">
                <input v-model="clientHeaders" type="checkbox" />
                <span>{{ $t('developer.api.clientHeaders') }}</span>
              </label>
            </div>
          </div>
          <p v-if="tokenSource !== 'none' && !hasToken" class="auth-warning">{{ $t('developer.api.noToken') }}</p>

          <div v-if="requestTab === 'params'" class="kv-table">
            <div v-for="(row, i) in params" :key="i" class="kv-row">
              <input v-model="row.enabled" type="checkbox" :aria-label="$t('developer.api.enabled')" @change="syncUrlFromParams" />
              <input v-model="row.key" class="text-input compact mono" spellcheck="false" :placeholder="$t('developer.api.key')" @input="syncUrlFromParams" />
              <input v-model="row.value" class="text-input compact mono" spellcheck="false" :placeholder="row.hint ?? $t('developer.api.value')" @input="syncUrlFromParams" />
              <button type="button" class="btn btn--icon remove-btn" :aria-label="$t('developer.api.remove')" @click="removeParam(i)">✕</button>
            </div>
            <button type="button" class="btn btn--sm add-row" @click="addParam">{{ $t('developer.api.addParam') }}</button>
          </div>

          <div v-else-if="requestTab === 'headers'" class="kv-table">
            <p class="hint">{{ $t('developer.api.headersHint') }}</p>
            <div v-for="(row, i) in headers" :key="i" class="kv-row">
              <input v-model="row.enabled" type="checkbox" :aria-label="$t('developer.api.enabled')" />
              <input v-model="row.key" class="text-input compact mono" spellcheck="false" :placeholder="$t('developer.api.key')" />
              <input v-model="row.value" class="text-input compact mono" spellcheck="false" :placeholder="$t('developer.api.value')" />
              <button type="button" class="btn btn--icon remove-btn" :aria-label="$t('developer.api.remove')" @click="removeHeader(i)">✕</button>
            </div>
            <button type="button" class="btn btn--sm add-row" @click="addHeader">{{ $t('developer.api.addHeader') }}</button>
          </div>

          <div v-else class="body-editor">
            <textarea v-model="body" class="text-input mono body-input" spellcheck="false" placeholder="{ }" />
            <div class="body-foot">
              <span v-if="bodyError" class="body-error">{{ $t('developer.api.bodyNotJson') }}</span>
              <span v-else class="hint">{{ $t('developer.api.bodyHint') }}</span>
              <button type="button" class="btn btn--sm" :disabled="!!bodyError || !body.trim()" @click="formatBody">{{ $t('developer.api.format') }}</button>
            </div>
          </div>
        </section>

        <section class="panel response">
          <div class="panel-strip">
            <div class="sub-tabs">
              <span class="section-label strip-label">{{ $t('developer.api.response') }}</span>
              <template v-if="state.response">
                <button type="button" class="sub-tab" :class="{ active: responseTab === 'body' && state.response.ok }" :disabled="!state.response.ok" @click="responseTab = 'body'">
                  {{ $t('developer.api.body') }}
                </button>
                <button type="button" class="sub-tab" :class="{ active: responseTab === 'headers' && state.response.ok }" :disabled="!state.response.ok" @click="responseTab = 'headers'">
                  {{ $t('developer.api.headers') }}
                </button>
                <button type="button" class="sub-tab" :class="{ active: responseTab === 'request' || !state.response.ok }" @click="responseTab = 'request'">
                  {{ $t('developer.api.sentRequest') }}
                </button>
              </template>
            </div>
            <div v-if="state.response" class="response-stats">
              <template v-if="state.response.ok">
                <span class="stat" :class="statusClass">{{ state.response.status }} {{ state.response.statusText }}</span>
                <span class="stat">{{ state.response.durationMs }} ms</span>
                <span class="stat">{{ formatSize(state.response.size) }}</span>
                <span v-if="envelope" class="stat stat--envelope" :class="envelope.ok ? 'ok' : 'bad'" :title="envelope.meaning ? `${envelope.code} · ${envelope.meaning}\n${envelope.message}` : envelope.message">
                  code {{ envelope.code }}<template v-if="envelope.meaning"> · {{ envelope.meaning }}</template>
                </span>
              </template>
              <span v-else class="stat bad">{{ $t('developer.api.failed') }}</span>
              <button type="button" class="btn btn--sm" :disabled="!state.response.ok" @click="copy(prettyBody)">{{ $t('developer.api.copyBody') }}</button>
            </div>
          </div>

          <div v-if="!state.response" class="response-empty">
            {{ state.running ? $t('developer.api.sending') : $t('developer.api.emptyResponse') }}
          </div>
          <template v-else>
            <p v-if="!state.response.ok" class="response-error">{{ state.response.error }}</p>
            <pre v-if="responseTab === 'body' && state.response.ok" class="response-pre custom-scrollbar">{{ prettyBody }}</pre>
            <dl v-else-if="responseTab === 'headers' && state.response.ok" class="header-list custom-scrollbar">
              <div v-for="(value, key) in state.response.headers" :key="key">
                <dt>{{ key }}</dt>
                <dd>{{ value }}</dd>
              </div>
            </dl>
            <div v-else class="header-list custom-scrollbar">
              <p class="sent-line mono">{{ state.sentMethod }} {{ state.sentUrl }}</p>
              <dl>
                <div v-for="(value, key) in state.response.sentHeaders" :key="key">
                  <dt>{{ key }}</dt>
                  <dd>{{ value }}</dd>
                </div>
              </dl>
              <pre v-if="state.sentBody.trim()" class="sent-body mono">{{ state.sentBody }}</pre>
            </div>
          </template>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { DEV_API_METHODS, type DevApiMethod, type DevApiPlatform } from '@common/devApi'
import { useApiLab } from '@features/developer/useApiLab'

const PLATFORM_TABS: Array<{ id: DevApiPlatform; label: string }> = [
  { id: 'yanhekt', label: 'developer.api.platforms.yanhekt' },
  { id: 'yanhe2', label: 'developer.api.platforms.yanhe2' },
]

const {
  platform,
  setPlatform,
  platformOrigin,
  presetGroups,
  filteredPresets,
  filter,
  preset,
  presetId,
  method,
  urlText,
  params,
  headers,
  body,
  bodyError,
  hasBody,
  requestTab,
  tokenSource,
  customToken,
  clientHeaders,
  activeTokenLabel,
  accountOptions,
  hasToken,
  state,
  responseTab,
  envelope,
  prettyBody,
  applyPreset,
  setMethod,
  onUrlInput,
  syncUrlFromParams,
  addParam,
  removeParam,
  addHeader,
  removeHeader,
  formatBody,
  send,
  copy,
} = useApiLab()

const urlPlaceholder = computed(() =>
  platform.value === 'yanhe2' ? `${platformOrigin.value}/userapi/v1/infosimple` : `${platformOrigin.value}/v1/user`,
)

const visibleGroups = computed(() =>
  presetGroups.value.map((id) => ({ id, items: filteredPresets.value.filter((p) => p.group === id) })).filter((g) => g.items.length),
)

const enabledParams = computed(() => params.value.filter((r) => r.enabled && r.key.trim()).length)
const enabledHeaders = computed(() => headers.value.filter((r) => r.enabled && r.key.trim()).length)

const statusClass = computed(() => {
  const res = state.response
  if (!res?.ok) return 'bad'
  return res.status >= 200 && res.status < 300 ? 'ok' : 'bad'
})

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
</script>

<style scoped>
/* Shapes, one rule each: controls 4px (the app's .btn / .text-input),
   framed panels 6px, switches the app's segmented control, tags 4px
   hairline boxes. No pills, no square corners. */
.api-lab {
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

/* Toolbar: page switch where Image Lab has it, then the request line. */
.api-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.request-bar {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: stretch;
  gap: 8px;
}

/* Method and URL read as one field. */
.url-group {
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

.url-group:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.method-select,
.url-input {
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-family: var(--lab-mono);
  font-size: 12px;
}

.method-select {
  flex: 0 0 auto;
  padding: 0 6px 0 10px;
  border-right: 1px solid var(--border-color);
  border-radius: 4px 0 0 4px;
  font-weight: 700;
  cursor: pointer;
}

.url-input {
  flex: 1;
  min-width: 0;
  padding: 0 10px;
}

.send-btn {
  min-width: 76px;
}

.api-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

/* Preset list */
.preset-pane {
  flex: 0 0 272px;
  width: 272px;
  min-height: 0;
  overflow: auto;
  border-right: 1px solid var(--border-color);
  padding: 12px 8px 16px;
}

/* A smaller copy of the page's segmented control (DeveloperTabSwitch). */
.platform-switch {
  display: flex;
  margin: 0 4px 8px;
  padding: 2px;
  border-radius: 8px;
  background: var(--bg-page-alt);
  border: 1px solid var(--border-color);
}

.platform-pill {
  flex: 1;
  padding: 3px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
  transition: all 0.15s;
}

.platform-pill:hover {
  color: var(--text-primary);
}

.platform-pill.active {
  background: var(--bg-surface);
  border-color: var(--border-strong);
  color: var(--text-primary);
  box-shadow: 0 1px 2px var(--shadow-sm);
}

.preset-search {
  padding: 0 4px 6px;
}

.preset-search .text-input {
  width: 100%;
}

.preset-group {
  padding: 8px 0 2px;
}

.preset-group .section-label {
  padding: 0 8px 4px;
}

.preset-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.preset-row:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.preset-row.active {
  background: var(--bg-selected);
  color: var(--text-primary);
}

.method-tag {
  flex: 0 0 42px;
  font-family: var(--lab-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.method-tag[data-method='DELETE'] {
  color: var(--danger);
}

.preset-path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--lab-mono);
  font-size: 12px;
}

.preset-lock {
  flex-shrink: 0;
  font-size: 7px;
  color: var(--text-muted);
}

.preset-empty {
  margin: 12px 8px;
  font-size: 12px;
  color: var(--text-muted);
}

/* Request + response */
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

.preset-note {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-muted);
  flex-shrink: 0;
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 0 6px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 11px;
  line-height: 18px;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
}

.tag--write {
  border-color: var(--danger-border);
  color: var(--danger);
}

.panel {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-surface);
  overflow: hidden;
}

.request-editor {
  flex-shrink: 0;
}

/* One line, always: if the strip wrapped, the tabs' underline would float
   above the strip's bottom border. The right-hand group shrinks instead. */
.panel-strip {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 12px;
  padding: 0 10px 0 8px;
  border-bottom: 1px solid var(--border-color);
  min-height: 38px;
}

.sub-tabs {
  display: flex;
  align-items: stretch;
  align-self: stretch;
  flex-shrink: 0;
  gap: 2px;
}

.strip-label {
  align-self: center;
  padding: 0 8px 0 4px;
}

.sub-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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

.count {
  padding: 0 5px;
  border-radius: 4px;
  background: var(--bg-selected);
  font-size: 10px;
  line-height: 16px;
}

.auth-controls,
.response-stats {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: 8px;
  min-width: 0;
  margin-left: auto;
  padding: 5px 0;
}

.auth-controls > *,
.response-stats > * {
  flex-shrink: 0;
}

.text-input.compact {
  min-height: 26px;
  padding: 3px 8px;
}

.auth-controls > .token-select {
  flex-shrink: 1;
  min-width: 120px;
  max-width: 260px;
}

.auth-controls > .token-input {
  flex: 0 1 220px;
  min-width: 90px;
}

.client-headers {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  cursor: pointer;
}

.client-headers input,
.kv-row input[type='checkbox'] {
  accent-color: var(--control-accent);
}

.auth-warning {
  margin: 0;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--warning-bg);
  font-size: 12px;
  color: var(--warning);
}

.kv-table {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 210px;
  overflow: auto;
  padding: 10px 12px;
}

.kv-row {
  display: grid;
  grid-template-columns: auto 1fr 2fr auto;
  align-items: center;
  gap: 6px;
}

.remove-btn {
  width: 26px;
  height: 26px;
  font-size: 11px;
  color: var(--text-muted);
}

.add-row {
  align-self: flex-start;
}

.body-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
}

.body-input {
  width: 100%;
  min-height: 120px;
  max-height: 240px;
  resize: vertical;
  line-height: 1.5;
}

.body-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.body-error {
  font-size: 12px;
  color: var(--warning);
}

.response {
  flex: 1;
  min-height: 200px;
}

.stat {
  font-family: var(--lab-mono);
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* The cbiz code and its meaning can run long; it gives way first. */
.response-stats > .stat--envelope {
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat.ok {
  color: var(--success);
}

.stat.bad {
  color: var(--danger);
}

.response-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  font-size: 12px;
  color: var(--text-muted);
}

.response-error {
  margin: 10px 12px 0;
  font-family: var(--lab-mono);
  font-size: 12px;
  color: var(--danger);
}

.response-pre,
.header-list {
  flex: 1;
  min-height: 0;
  margin: 0;
  overflow: auto;
  padding: 10px 12px;
}

.response-pre {
  font-family: var(--lab-mono);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-primary);
  user-select: text;
}

.header-list dl {
  margin: 0;
}

.header-list div {
  display: grid;
  grid-template-columns: minmax(140px, 220px) 1fr;
  gap: 12px;
  padding: 3px 0;
}

.header-list dt {
  font-family: var(--lab-mono);
  font-size: 12px;
  color: var(--text-muted);
}

.header-list dd {
  margin: 0;
  font-family: var(--lab-mono);
  font-size: 12px;
  word-break: break-all;
  user-select: text;
}

.sent-line {
  margin: 0 0 8px;
  font-size: 12px;
  word-break: break-all;
  user-select: text;
}

.sent-body {
  margin: 10px 0 0;
  font-size: 12px;
  white-space: pre-wrap;
  user-select: text;
}
</style>
