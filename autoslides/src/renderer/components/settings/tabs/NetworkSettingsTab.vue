<template>
  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.intranetInterface') }}</h4>
    <div class="setting-item">
      <div class="setting-description">{{ $t('advanced.intranetInterfaceDescription') }}</div>
      <div class="flex items-stretch gap-2 mt-1.5">
        <select v-model="tempIntranetInterfaceIp" class="concurrent-select">
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
        <button type="button" class="secondary-btn" @click="refreshNetworkInterfaces">
          {{ $t('advanced.intranetInterfaceRefresh') }}
        </button>
      </div>
      <div
        v-if="tempIntranetInterfaceIp && !availableNetworkInterfaces.some(i => i.address === tempIntranetInterfaceIp)"
        class="mt-1 text-[11px] text-warning"
      >
        {{ $t('advanced.intranetInterfaceNotFound') }}
      </div>
    </div>
  </div>
  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.intranetMapping') }}</h4>
    <div class="setting-item">
      <div class="setting-description">{{ $t('advanced.intranetMappingDescription') }}</div>
      <div class="border border-border rounded overflow-hidden bg-elevated text-[11px]">
        <div v-for="(mapping, domain) in intranetMappings" :key="String(domain)" class="border-b border-border last:border-b-0">
          <div class="flex items-center py-1.5 px-2.5 cursor-pointer transition-colors bg-surface min-h-[28px] hover:bg-elevated" @click="toggleMappingExpanded(String(domain))">
            <div class="flex-1 text-[11px] font-medium text-text font-mono leading-snug">{{ domain }}</div>
            <div class="mr-2">
              <span class="py-0.5 px-1.5 rounded-lg text-[9px] font-medium uppercase tracking-[0.3px] leading-none" :class="mapping.type === 'single' ? 'bg-accent/10 text-[#1976d2] dark:bg-[#1a2332] dark:text-[#64b5f6]' : 'bg-[#f3e5f5] text-[#7b1fa2] dark:bg-[#2d1b2e] dark:text-[#ba68c8]'">
                {{ mapping.type === 'single' ? $t('advanced.singleIP') : $t('advanced.loadBalance') }}
              </span>
            </div>
            <div class="transition-transform text-text-secondary flex items-center justify-center w-4 h-4" :class="{ 'rotate-180': expandedMappings[String(domain)] }">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
            </div>
          </div>
          <div v-if="expandedMappings[String(domain)]" class="py-2 px-2.5 bg-elevated border-t border-border">
            <div v-if="mapping.type === 'single'">
              <div class="flex items-start mb-1 text-[10px] leading-snug">
                <span class="font-medium text-text-secondary min-w-[60px] mr-2 shrink-0 text-[12px]">{{ $t('advanced.ipAddresses') }}:</span>
                <span class="text-text font-mono text-[10px]">{{ mapping.ip }}</span>
              </div>
            </div>
            <div v-else>
              <div class="flex items-start mb-1 text-[10px] leading-snug">
                <span class="font-medium text-text-secondary min-w-[60px] mr-2 shrink-0 text-[12px]">{{ $t('advanced.strategy') }}:</span>
                <span class="text-text font-mono text-[10px]">
                  {{ getStrategyDisplayName(mapping.strategy) }}
                </span>
              </div>
              <div class="flex items-start mb-1 text-[10px] leading-snug">
                <span class="font-medium text-text-secondary min-w-[60px] mr-2 shrink-0 text-[12px]">{{ $t('advanced.ipAddresses') }}:</span>
                <div class="flex flex-wrap gap-1 items-start">
                  <span v-for="ip in mapping.ips" :key="ip" class="py-0.5 px-1.5 bg-hover rounded-sm text-[9px] font-mono text-text-secondary whitespace-nowrap leading-snug">
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
