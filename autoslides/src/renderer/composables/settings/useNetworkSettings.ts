import { ref } from 'vue'
import type { IntranetMapping, NetworkInterfaceInfo } from './types'

export interface UseNetworkSettingsOptions {
  t?: (key: string) => string
}

export function useNetworkSettings(options: UseNetworkSettingsOptions = {}) {
  const { t } = options

  const intranetMappings = ref<{ [domain: string]: IntranetMapping }>({})
  const expandedMappings = ref<{ [domain: string]: boolean }>({})

  const availableNetworkInterfaces = ref<NetworkInterfaceInfo[]>([])
  const intranetInterfaceIp = ref<string>('')
  const tempIntranetInterfaceIp = ref<string>('')
  const intranetInterfaceWarning = ref<string | null>(null)

  const loadIntranetMappings = async () => {
    try {
      const mappings = await window.electronAPI.intranet.getMappings()
      intranetMappings.value = mappings
    } catch (error) {
      console.error('Failed to load intranet mappings:', error)
    }
  }

  const loadNetworkInterfaces = async () => {
    try {
      const list = await window.electronAPI.intranet.getNetworkInterfaces()
      availableNetworkInterfaces.value = list ?? []
    } catch (error) {
      console.error('Failed to load network interfaces:', error)
      availableNetworkInterfaces.value = []
    }
  }

  const refreshNetworkInterfaces = async () => {
    await loadNetworkInterfaces()
  }

  const loadIntranetInterfaceIp = async () => {
    try {
      const ip = await window.electronAPI.intranet.getInterfaceIp()
      intranetInterfaceIp.value = ip ?? ''
      tempIntranetInterfaceIp.value = intranetInterfaceIp.value
    } catch (error) {
      console.error('Failed to load intranet interface IP:', error)
    }
  }

  const load = async () => {
    await Promise.all([
      loadIntranetMappings(),
      loadNetworkInterfaces(),
      loadIntranetInterfaceIp()
    ])
  }

  const save = async () => {
    if (tempIntranetInterfaceIp.value !== intranetInterfaceIp.value) {
      const resp = await window.electronAPI.intranet.setInterfaceIp(
        tempIntranetInterfaceIp.value === '' ? null : tempIntranetInterfaceIp.value
      )
      intranetInterfaceIp.value = tempIntranetInterfaceIp.value
      intranetInterfaceWarning.value = resp?.warning ?? null
    } else {
      intranetInterfaceWarning.value = null
    }
  }

  const resetTemp = () => {
    tempIntranetInterfaceIp.value = intranetInterfaceIp.value
    intranetInterfaceWarning.value = null
  }

  const toggleMappingExpanded = (domain: string) => {
    expandedMappings.value[domain] = !expandedMappings.value[domain]
  }

  const getStrategyDisplayName = (strategy?: string) => {
    const translate = t || ((key: string) => key)
    switch (strategy) {
      case 'round_robin':
        return translate('advanced.roundRobin')
      case 'random':
        return translate('advanced.random')
      case 'first_available':
        return translate('advanced.firstAvailable')
      default:
        return strategy || translate('advanced.roundRobin')
    }
  }

  return {
    intranetMappings,
    expandedMappings,
    availableNetworkInterfaces,
    intranetInterfaceIp,
    tempIntranetInterfaceIp,
    intranetInterfaceWarning,

    load,
    save,
    resetTemp,

    loadIntranetMappings,
    refreshNetworkInterfaces,
    toggleMappingExpanded,
    getStrategyDisplayName
  }
}

export type UseNetworkSettingsReturn = ReturnType<typeof useNetworkSettings>
