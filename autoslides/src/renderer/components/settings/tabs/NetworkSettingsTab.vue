<template>
  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.intranetInterface') }}</h4>
    <div class="setting-item">
      <div class="setting-description">{{ $t('advanced.intranetInterfaceDescription') }}</div>
      <div class="intranet-interface-row">
        <select v-model="tempIntranetInterfaceIp" class="select-field intranet-interface-select">
          <option value="">{{ $t('advanced.intranetInterfaceSystemDefault') }}</option>
          <option
            v-for="iface in availableNetworkInterfaces"
            :key="iface.name + '-' + iface.address"
            :value="iface.address"
          >
            {{ iface.name }} — {{ iface.address }}
          </option>
          <option
            v-if="tempIntranetInterfaceIp && !availableNetworkInterfaces.some(i => i.address === tempIntranetInterfaceIp)"
            :value="tempIntranetInterfaceIp"
          >
            {{ tempIntranetInterfaceIp }}
          </option>
        </select>
        <button type="button" class="btn btn--sm" @click="refreshNetworkInterfaces">
          {{ $t('advanced.intranetInterfaceRefresh') }}
        </button>
      </div>
      <div
        v-if="tempIntranetInterfaceIp && !availableNetworkInterfaces.some(i => i.address === tempIntranetInterfaceIp)"
        class="intranet-interface-warning"
      >
        {{ $t('advanced.intranetInterfaceNotFound') }}
      </div>
    </div>
  </div>
  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.intranetMapping') }}</h4>
    <div class="setting-item">
      <div class="setting-description">{{ $t('advanced.intranetMappingDescription') }}</div>
      <div class="mapping-toolbar">
        <div class="mapping-toolbar-note">
          <template v-if="intranetTestMeta">
            {{ intranetTestMeta.resolvedByCampusDns ? $t('advanced.intranetSourceCampusDns') : $t('advanced.intranetSourceBuiltIn') }}
            <span class="mapping-toolbar-meta">
              ·
              <template v-if="intranetTestMeta.interfaceIp">
                {{ $t('advanced.intranetTestedFrom', { address: intranetTestMeta.interfaceIp }) }} ·
              </template>
              {{ intranetTestMeta.at }}
            </span>
          </template>
          <template v-else>{{ $t('advanced.intranetTestHint') }}</template>
        </div>
        <button type="button" class="btn btn--sm mapping-test-btn" :disabled="intranetTesting" @click="testIntranetAddresses">
          <span v-if="intranetTesting" class="mapping-test-spinner" aria-hidden="true"></span>
          {{ intranetTesting ? $t('advanced.intranetTesting') : $t('advanced.intranetTest') }}
        </button>
      </div>
      <div class="intranet-mapping-list">
        <div
          v-for="(mapping, domain, index) in intranetMappings"
          :key="String(domain)"
          class="mapping-item"
          :style="{ '--row': index }"
        >
          <div class="mapping-header" @click="toggleMappingExpanded(String(domain))">
            <div class="mapping-domain">{{ domain }}</div>
            <div v-if="intranetTests[domain]" class="mapping-probe" aria-live="polite">
              <span v-if="intranetTests[domain].pending" class="probe-waiting" aria-hidden="true">
                <i></i><i></i><i></i>
              </span>
              <span v-else class="probe-result" :class="`probe-result--${summarize(intranetTests[domain].results).tone}`">
                <span class="probe-dot" aria-hidden="true"></span>
                {{ summarize(intranetTests[domain].results).text }}
              </span>
            </div>
            <div class="mapping-type">
              <span class="type-badge" :class="mapping.type">
                {{ mapping.type === 'single' ? $t('advanced.singleIP') : $t('advanced.loadBalance') }}
              </span>
            </div>
            <div class="mapping-expand-icon" :class="{ expanded: expandedMappings[String(domain)] }">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
            </div>
          </div>
          <div v-if="expandedMappings[String(domain)]" class="mapping-details">
            <div v-if="mapping.type !== 'single'" class="detail-row">
              <span class="detail-label">{{ $t('advanced.strategy') }}:</span>
              <span class="detail-value">
                {{ getStrategyDisplayName(mapping.strategy) }}
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">{{ $t('advanced.ipAddresses') }}:</span>
              <div class="ip-list">
                <span
                  v-for="ip in addressesOf(mapping)"
                  :key="ip"
                  class="ip-item"
                  :class="{ 'ip-item--silent': addressResult(String(domain), ip)?.ms === null }"
                >
                  {{ ip }}
                  <span v-if="addressResult(String(domain), ip)" class="ip-latency">
                    {{ addressLatency(String(domain), ip) }}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.preferAnonymousApiRequests') }}</h4>
    <div class="setting-item">
      <div class="setting-description">{{ $t('advanced.preferAnonymousApiRequestsDescription') }}</div>
      <div class="auto-post-processing-control">
        <label class="checkbox-label">
          <input type="checkbox" v-model="tempPreferAnonymousApiRequests" />
          {{ $t('advanced.preferAnonymousApiRequestsEnable') }}
        </label>
      </div>
    </div>
  </div>

  <!-- Local LAN relay: Worker-compatible /playlist + /segment for external clients.
       Developer-mode only (Settings → General). Body grays out when the server
       is off, and the whitelist body grays out when the whitelist itself is off. -->
  <div v-if="tempDeveloperMode" class="advanced-setting-section">
    <h4>{{ $t('advanced.localRelay') }}</h4>
    <div class="setting-item">
      <div class="setting-description">{{ $t('advanced.localRelayDescription') }}</div>
      <div class="auto-post-processing-control">
        <label class="checkbox-label">
          <input type="checkbox" v-model="tempLocalRelayEnabled" />
          {{ $t('advanced.localRelayEnable') }}
        </label>
      </div>
    </div>

    <div class="local-relay-body" :class="{ 'is-disabled': !tempLocalRelayEnabled }">
      <div class="setting-item">
        <div class="reachable-header">
          <label class="setting-label">{{ $t('advanced.localRelayReachableAt') }}</label>
          <div class="reachable-controls">
            <label class="port-inline-label">
              <span>{{ $t('advanced.localRelayPort') }}</span>
              <input
                v-model.number="tempLocalRelayPort"
                type="number"
                min="1024"
                max="65535"
                step="1"
                class="text-input local-relay-port-input"
                :disabled="!tempLocalRelayEnabled"
              />
            </label>
            <button
              type="button"
              class="btn btn--sm"
              :disabled="!tempLocalRelayEnabled"
              @click="refreshNetworkInterfaces"
            >
              {{ $t('advanced.localRelayRefreshAddresses') }}
            </button>
          </div>
        </div>
        <div v-if="reachableUrls.length" class="reachable-list">
          <code v-for="url in reachableUrls" :key="url" class="reachable-url">{{ url }}</code>
        </div>
        <div v-else class="setting-description">{{ $t('advanced.localRelayNoAddresses') }}</div>
        <div class="relay-status" :class="statusClass">
          <template v-if="localRelayStatus?.error">
            {{ $t('advanced.localRelayStatusError') }}: {{ localRelayStatus.error }}
          </template>
          <template v-else-if="localRelayStatus?.running">
            {{ $t('advanced.localRelayStatusRunning') }} ({{ localRelayStatus.port }})
          </template>
          <template v-else>
            {{ $t('advanced.localRelayStatusStopped') }}
          </template>
        </div>
      </div>

      <div class="setting-item">
        <div class="auto-post-processing-control">
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="tempLocalRelayWhitelistEnabled"
              :disabled="!tempLocalRelayEnabled"
            />
            {{ $t('advanced.localRelayWhitelistEnable') }}
          </label>
        </div>
        <div class="setting-description">{{ $t('advanced.localRelayWhitelistEnableDescription') }}</div>
      </div>

      <div
        class="local-relay-whitelist-body"
        :class="{ 'is-disabled': !tempLocalRelayEnabled || !tempLocalRelayWhitelistEnabled }"
      >
        <div class="setting-item">
          <div class="auto-post-processing-control">
            <label class="checkbox-label">
              <input
                type="checkbox"
                v-model="tempLocalRelayIncludeCurrentToken"
                :disabled="!tempLocalRelayEnabled || !tempLocalRelayWhitelistEnabled"
              />
              {{ $t('advanced.localRelayIncludeCurrentToken') }}
            </label>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">{{ $t('advanced.localRelayWhitelistTitle') }}</label>
          <div class="token-whitelist">
            <!-- Pinned current-token row -->
            <div
              class="token-row token-row--current"
              :class="{ 'token-row--excluded': !tempLocalRelayIncludeCurrentToken }"
            >
              <span class="token-badge">{{ $t('advanced.localRelayCurrentTokenBadge') }}</span>
              <code class="token-value">{{ formatTokenDisplay(currentAuthToken) }}</code>
              <span v-if="!tempLocalRelayIncludeCurrentToken" class="token-excluded-hint">
                {{ $t('advanced.localRelayTokenExcludedHint') }}
              </span>
              <span v-else-if="!currentAuthToken" class="token-excluded-hint">
                {{ $t('advanced.localRelayNoCurrentToken') }}
              </span>
            </div>
            <!-- Extra tokens -->
            <div
              v-for="token in tempLocalRelayTokenWhitelist"
              :key="token"
              class="token-row"
            >
              <code class="token-value">{{ formatTokenDisplay(token) }}</code>
              <button
                type="button"
                class="btn btn--sm btn--ghost"
                :disabled="!tempLocalRelayEnabled || !tempLocalRelayWhitelistEnabled"
                @click="removeWhitelistToken(token)"
              >
                {{ $t('advanced.localRelayRemoveToken') }}
              </button>
            </div>
          </div>
          <div class="token-add-row">
            <input
              v-model="newWhitelistToken"
              type="text"
              class="text-input token-add-input"
              :placeholder="$t('advanced.localRelayWhitelistPlaceholder')"
              spellcheck="false"
              autocomplete="off"
              :disabled="!tempLocalRelayEnabled || !tempLocalRelayWhitelistEnabled"
              @keyup.enter="addWhitelistToken"
            />
            <button
              type="button"
              class="btn btn--sm"
              :disabled="!tempLocalRelayEnabled || !tempLocalRelayWhitelistEnabled"
              @click="addWhitelistToken"
            >
              {{ $t('advanced.localRelayWhitelistAdd') }}
            </button>
          </div>
          <div v-if="whitelistAddError" class="intranet-interface-warning">
            {{ whitelistAddError }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsContext } from '@features/settings/settingsContext'
import { useI18n } from 'vue-i18n'
import type { IntranetAddressResult, IntranetMapping } from '@features/settings/settingsTypes'

const { advanced } = useSettingsContext()

const { tempDeveloperMode } = advanced.general

const {
  tempIntranetInterfaceIp,
  availableNetworkInterfaces,
  intranetMappings,
  expandedMappings,
  intranetTests,
  intranetTesting,
  intranetTestMeta,
  testIntranetAddresses,
  refreshNetworkInterfaces,
  toggleMappingExpanded,
  getStrategyDisplayName,
  tempPreferAnonymousApiRequests,
  tempLocalRelayEnabled,
  tempLocalRelayPort,
  tempLocalRelayWhitelistEnabled,
  tempLocalRelayIncludeCurrentToken,
  tempLocalRelayTokenWhitelist,
  newWhitelistToken,
  whitelistAddError,
  localRelayStatus,
  currentAuthToken,
  reachableUrls,
  addWhitelistToken,
  removeWhitelistToken,
  formatTokenDisplay,
} = advanced.network

const { t } = useI18n()

const addressesOf = (mapping: IntranetMapping): string[] =>
  mapping.type === 'single' ? (mapping.ip ? [mapping.ip] : []) : (mapping.ips ?? [])

const addressResult = (domain: string, ip: string): IntranetAddressResult | undefined => {
  const test = intranetTests.value[domain]
  return test && !test.pending ? test.results.find((r) => r.ip === ip) : undefined
}

const addressLatency = (domain: string, ip: string): string => {
  const ms = addressResult(domain, ip)?.ms
  return ms == null ? t('advanced.intranetTestNoAnswer') : `${ms} ms`
}

/** One line for a row: how many addresses answered and the quickest of them. */
const summarize = (results: IntranetAddressResult[]): { tone: 'ok' | 'partial' | 'none'; text: string } => {
  const times = results.flatMap((r) => (r.ms === null ? [] : [r.ms]))
  if (times.length === 0) return { tone: 'none', text: t('advanced.intranetTestNoAnswer') }
  const fastest = `${Math.min(...times)} ms`
  if (results.length === 1) return { tone: 'ok', text: fastest }
  return {
    tone: times.length === results.length ? 'ok' : 'partial',
    text: `${times.length}/${results.length} · ${fastest}`,
  }
}

const statusClass = computed(() => {
  if (localRelayStatus.value?.error) return 'relay-status--error'
  if (localRelayStatus.value?.running) return 'relay-status--running'
  return 'relay-status--stopped'
})
</script>

<style scoped>
.intranet-interface-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
  margin-top: 6px;
}

.intranet-interface-select {
  flex: 1;
  min-width: 0;
}

.intranet-interface-row .btn {
  min-height: var(--control-height);
}

.intranet-interface-warning {
  margin-top: 4px;
  font-size: 11px;
  color: var(--warning);
}

.mapping-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 6px 0;
}

.mapping-toolbar-note {
  min-width: 0;
  font-size: 11px;
  color: var(--text-secondary);
}

.mapping-toolbar-meta {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.mapping-test-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.mapping-test-spinner {
  width: 10px;
  height: 10px;
  border: 1.5px solid var(--border-strong);
  border-top-color: var(--text-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* A row's test outcome, between the domain and its type chip. Each row
   resolves on its own; --row staggers them into a short top-to-bottom sweep. */
.mapping-probe {
  margin-right: 10px;
  font-size: 10px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.probe-waiting {
  display: inline-flex;
  gap: 3px;
}

.probe-waiting i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background-color: var(--text-muted);
  animation: probe-wait 0.9s ease-in-out infinite;
  animation-delay: calc(var(--row) * 40ms);
}

.probe-waiting i:nth-child(2) {
  animation-delay: calc(var(--row) * 40ms + 0.15s);
}

.probe-waiting i:nth-child(3) {
  animation-delay: calc(var(--row) * 40ms + 0.3s);
}

.probe-result {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-secondary);
  animation: probe-in 0.28s ease-out both;
  animation-delay: calc(var(--row) * 40ms);
}

.probe-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--success);
}

.probe-result--partial .probe-dot {
  background-color: var(--warning);
}

.probe-result--none .probe-dot {
  background-color: var(--danger);
}

@keyframes probe-wait {
  0%, 80%, 100% { opacity: 0.25; }
  40% { opacity: 1; }
}

@keyframes probe-in {
  from { opacity: 0; transform: translateX(4px); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .probe-waiting i,
  .probe-result,
  .mapping-test-spinner {
    animation: none;
  }
}

.intranet-mapping-list {
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
  background-color: var(--bg-elevated);
  font-size: 11px;
}

.mapping-item {
  border-bottom: 1px solid var(--border-color);
}

.mapping-item:last-child {
  border-bottom: none;
}

.mapping-header {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  background-color: var(--bg-surface);
  min-height: 28px;
}

.mapping-header:hover {
  background-color: var(--bg-elevated);
}

.mapping-domain {
  flex: 1;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-primary);
  font-family: 'Courier New', monospace;
  line-height: 1.2;
}

.mapping-type {
  margin-right: 8px;
}

.type-badge {
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 9px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  line-height: 1;
}

.type-badge.single,
.type-badge.loadbalance {
  background-color: var(--bg-selected);
  color: var(--text-secondary);
}

.mapping-expand-icon {
  transition: transform 0.2s ease;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.mapping-expand-icon.expanded {
  transform: rotate(180deg);
}

.mapping-expand-icon svg {
  width: 10px;
  height: 10px;
}

.mapping-details {
  padding: 8px 10px;
  background-color: var(--bg-elevated);
  border-top: 1px solid var(--border-color);
}

.detail-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 4px;
  font-size: 10px;
  line-height: 1.3;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.detail-label {
  font-weight: 500;
  color: var(--text-secondary);
  min-width: 60px;
  margin-right: 8px;
  flex-shrink: 0;
}

.detail-value {
  color: var(--text-primary);
  font-family: 'Courier New', monospace;
  font-size: 10px;
}

.ip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  align-items: flex-start;
}

.ip-item {
  padding: 2px 6px;
  background-color: var(--bg-hover);
  border-radius: 3px;
  font-size: 9px;
  font-family: 'Courier New', monospace;
  color: var(--text-primary);
  display: inline-block;
  white-space: nowrap;
  line-height: 1.2;
}

.ip-latency {
  margin-left: 5px;
  color: var(--text-secondary);
  font-family: inherit;
  font-variant-numeric: tabular-nums;
}

.ip-item--silent {
  color: var(--text-muted);
}

.ip-item--silent .ip-latency {
  color: var(--danger);
}

/* Gray-out shells for nested option groups. pointer-events still blocked on
   individual controls via :disabled — the opacity is purely visual. */
.local-relay-body.is-disabled,
.local-relay-whitelist-body.is-disabled {
  opacity: 0.5;
}

.reachable-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.reachable-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.port-inline-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* Override .text-input's 30px --control-height so Port matches .btn--sm
   (min-height:0 + 4px pad + 11px type). */
.local-relay-port-input {
  width: 72px;
  max-width: 72px;
  margin: 0;
  text-align: center;
  min-height: 0;
  height: 24px;
  padding: 0 8px;
  font-size: 11px;
  line-height: 22px;
  box-sizing: border-box;
}

.reachable-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
}

.reachable-url {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  color: var(--text-primary);
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 4px 8px;
  user-select: all;
}

.relay-status {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-secondary);
}

.relay-status--running {
  color: var(--success);
}

.relay-status--error {
  color: var(--danger);
}

.relay-status--stopped {
  color: var(--text-muted);
}

.token-whitelist {
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
  background-color: var(--bg-elevated);
  margin-top: 6px;
}

.token-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-color);
  min-height: 28px;
  background-color: var(--bg-surface);
}

.token-row:last-child {
  border-bottom: none;
}

.token-row--current {
  background-color: var(--bg-elevated);
}

.token-row--excluded {
  opacity: 0.55;
}

.token-badge {
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 9px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  background-color: var(--bg-selected);
  color: var(--text-secondary);
  flex-shrink: 0;
}

.token-value {
  flex: 1;
  min-width: 0;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.token-excluded-hint {
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.token-add-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
  margin-top: 8px;
}

.token-add-input {
  flex: 1;
  min-width: 0;
  font-family: 'Courier New', monospace;
  font-size: 11px;
}
</style>
