<template>
  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.intranetInterface') }}</h4>
    <div class="setting-item">
      <div class="setting-description">{{ $t('advanced.intranetInterfaceDescription') }}</div>
      <div class="intranet-interface-row">
        <select v-model="tempIntranetInterfaceIp" class="intranet-interface-select">
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
        <button type="button" class="refresh-button" @click="refreshNetworkInterfaces">
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
</template>

<script setup lang="ts">
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
} = advanced
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
  box-sizing: border-box;
  height: 28px;
  padding: 0 6px;
  font-size: 12px;
  line-height: 1;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background-color: var(--bg-input);
}

.intranet-interface-row .refresh-button {
  box-sizing: border-box;
  height: 28px;
  padding: 0 10px;
  font-size: 11px;
  line-height: 1;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background-color: var(--bg-input);
  cursor: pointer;
}

.intranet-interface-row .refresh-button:hover {
  background-color: var(--bg-hover);
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
  background-color: #e3f2fd;
  color: #1976d2;
}

.type-badge.loadbalance {
  background-color: #f3e5f5;
  color: #7b1fa2;
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
  color: var(--text-secondary);
  display: inline-block;
  white-space: nowrap;
  line-height: 1.2;
}
</style>
