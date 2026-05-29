<template>
  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.intranetInterface') }}</h4>
    <div class="setting-item">
      <div class="setting-description">{{ $t('advanced.intranetInterfaceDescription') }}</div>
      <div class="mt-1.5 flex items-stretch gap-2">
        <select v-model="tempIntranetInterfaceIp" class="h-7 min-w-0 flex-1 rounded border border-line-input bg-field px-1.5 text-xs leading-none text-fg">
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
        <button type="button" class="h-7 cursor-pointer rounded border border-line-input bg-field px-2.5 text-[11px] leading-none text-fg transition-colors hover:bg-hover" @click="refreshNetworkInterfaces">
          {{ $t('advanced.intranetInterfaceRefresh') }}
        </button>
      </div>
      <div
        v-if="tempIntranetInterfaceIp && !availableNetworkInterfaces.some(i => i.address === tempIntranetInterfaceIp)"
        class="mt-1 text-[11px] text-[#b45309] dark:text-[#f5b971]"
      >
        {{ $t('advanced.intranetInterfaceNotFound') }}
      </div>
    </div>
  </div>
  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.intranetMapping') }}</h4>
    <div class="setting-item">
      <div class="setting-description">{{ $t('advanced.intranetMappingDescription') }}</div>
      <div class="overflow-hidden rounded border border-line bg-elevated text-[11px]">
        <div v-for="(mapping, domain) in intranetMappings" :key="String(domain)" class="border-b border-line last:border-b-0">
          <div class="flex min-h-[28px] cursor-pointer items-center bg-modal px-2.5 py-1.5 transition-colors hover:bg-elevated" @click="toggleMappingExpanded(String(domain))">
            <div class="flex-1 font-mono text-[11px] font-medium leading-[1.2] text-fg">{{ domain }}</div>
            <div class="mr-2">
              <span
                class="rounded-lg px-1.5 py-0.5 text-[9px] font-medium uppercase leading-none tracking-[0.3px]"
                :class="mapping.type === 'single'
                  ? 'bg-[#e3f2fd] text-[#1976d2] dark:bg-[#1a2332] dark:text-[#64b5f6]'
                  : 'bg-[#f3e5f5] text-[#7b1fa2] dark:bg-[#2d1b2e] dark:text-[#ba68c8]'"
              >
                {{ mapping.type === 'single' ? $t('advanced.singleIP') : $t('advanced.loadBalance') }}
              </span>
            </div>
            <div class="flex h-4 w-4 items-center justify-center text-fg-secondary transition-transform" :class="{ 'rotate-180': expandedMappings[String(domain)] }">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
            </div>
          </div>
          <div v-if="expandedMappings[String(domain)]" class="border-t border-line bg-elevated px-2.5 py-2">
            <div v-if="mapping.type === 'single'">
              <div class="detail-row">
                <span class="mr-2 min-w-[60px] flex-shrink-0 font-medium text-fg-secondary">{{ $t('advanced.ipAddresses') }}:</span>
                <span class="font-mono text-[10px] text-fg">{{ mapping.ip }}</span>
              </div>
            </div>
            <div v-else>
              <div class="detail-row">
                <span class="mr-2 min-w-[60px] flex-shrink-0 font-medium text-fg-secondary">{{ $t('advanced.strategy') }}:</span>
                <span class="font-mono text-[10px] text-fg">
                  {{ getStrategyDisplayName(mapping.strategy) }}
                </span>
              </div>
              <div class="detail-row">
                <span class="mr-2 min-w-[60px] flex-shrink-0 font-medium text-fg-secondary">{{ $t('advanced.ipAddresses') }}:</span>
                <div class="flex flex-wrap items-start gap-[3px]">
                  <span v-for="ip in mapping.ips" :key="ip" class="inline-block whitespace-nowrap rounded-[3px] bg-hover px-1.5 py-0.5 font-mono text-[9px] leading-[1.2] text-[#495057] dark:text-[#e0e0e0]">
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

