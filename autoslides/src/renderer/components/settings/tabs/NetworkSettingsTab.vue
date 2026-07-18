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
      <div class="intranet-mapping-list">
        <div v-for="(mapping, domain) in intranetMappings" :key="String(domain)" class="mapping-item">
          <div class="mapping-header" @click="toggleMappingExpanded(String(domain))">
            <div class="mapping-domain">{{ domain }}</div>
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
            <div v-if="mapping.type === 'single'" class="single-ip-details">
              <div class="detail-row">
                <span class="detail-label">{{ $t('advanced.ipAddresses') }}:</span>
                <span class="detail-value">{{ mapping.ip }}</span>
              </div>
            </div>
            <div v-else class="load-balance-details">
              <div class="detail-row">
                <span class="detail-label">{{ $t('advanced.strategy') }}:</span>
                <span class="detail-value">
                  {{ getStrategyDisplayName(mapping.strategy) }}
                </span>
              </div>
              <div class="detail-row">
                <span class="detail-label">{{ $t('advanced.ipAddresses') }}:</span>
                <div class="ip-list">
                  <span v-for="ip in mapping.ips" :key="ip" class="ip-item">
                    {{ ip }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Local LAN relay: Worker-compatible /playlist + /segment for external clients.
       All options stay visible; body grays out when the server is off, and the
       whitelist body grays out when the whitelist itself is off. -->
  <div class="advanced-setting-section">
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

const { advanced } = useSettingsContext()

const {
  tempIntranetInterfaceIp,
  availableNetworkInterfaces,
  intranetMappings,
  expandedMappings,
  refreshNetworkInterfaces,
  toggleMappingExpanded,
  getStrategyDisplayName,
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

.type-badge.single {
  background-color: var(--blue-badge-bg);
  color: var(--blue-badge-text);
}

.type-badge.loadbalance {
  background-color: var(--purple-badge-bg);
  color: var(--purple-badge-text);
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
  background-color: var(--blue-badge-bg);
  color: var(--blue-badge-text);
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
