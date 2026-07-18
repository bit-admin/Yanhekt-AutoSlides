import { computed, ref } from 'vue'
import type { IntranetMapping, NetworkInterfaceInfo } from './settingsTypes'
import { configStore } from '@shared/services/configStore'
import { tokenManager } from '@shared/services/authService'
import { createLogger } from '@shared/utils/logger'
const log = createLogger('NetworkSettings')

const LOGIN_TOKEN_RE = /^[0-9a-f]{32}$/i

export interface LocalRelayStatusView {
  enabled: boolean
  running: boolean
  port: number
  bindAddresses: string[]
  error: string | null
}

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

  // ---- Local relay (buffered; applied on Save) -----------------------------
  const localRelayEnabled = ref(false)
  const localRelayPort = ref(8787)
  const localRelayWhitelistEnabled = ref(true)
  const localRelayIncludeCurrentToken = ref(true)
  const localRelayTokenWhitelist = ref<string[]>([])

  const tempLocalRelayEnabled = ref(false)
  const tempLocalRelayPort = ref(8787)
  const tempLocalRelayWhitelistEnabled = ref(true)
  const tempLocalRelayIncludeCurrentToken = ref(true)
  const tempLocalRelayTokenWhitelist = ref<string[]>([])
  const newWhitelistToken = ref('')
  const whitelistAddError = ref<string | null>(null)

  const localRelayStatus = ref<LocalRelayStatusView | null>(null)

  // Plain ref, not computed: tokenManager's cache isn't reactive, so a
  // computed would freeze at its first read. Refreshed on every settings load.
  const currentAuthToken = ref<string | null>(tokenManager.getToken())

  const reachableUrls = computed(() => {
    const port = tempLocalRelayPort.value
    return availableNetworkInterfaces.value
      .filter((i) => i.family === 'IPv4' && !i.internal)
      .map((i) => `http://${i.address}:${port}`)
  })

  const loadIntranetMappings = async () => {
    try {
      const mappings = await window.electronAPI.intranet.getMappings()
      intranetMappings.value = mappings
    } catch (error) {
      log.error('Failed to load intranet mappings:', error)
    }
  }

  const loadNetworkInterfaces = async () => {
    try {
      const list = await window.electronAPI.intranet.getNetworkInterfaces()
      availableNetworkInterfaces.value = list ?? []
    } catch (error) {
      log.error('Failed to load network interfaces:', error)
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
      log.error('Failed to load intranet interface IP:', error)
    }
  }

  const loadLocalRelayFromConfig = () => {
    currentAuthToken.value = tokenManager.getToken()
    const cfg = configStore
    localRelayEnabled.value = !!cfg.localRelayEnabled
    localRelayPort.value = cfg.localRelayPort ?? 8787
    localRelayWhitelistEnabled.value = cfg.localRelayWhitelistEnabled !== false
    localRelayIncludeCurrentToken.value = cfg.localRelayIncludeCurrentToken !== false
    localRelayTokenWhitelist.value = [...(cfg.localRelayTokenWhitelist ?? [])]
  }

  const loadLocalRelayStatus = async () => {
    try {
      localRelayStatus.value = await window.electronAPI.localRelay.getStatus()
    } catch (error) {
      log.error('Failed to load local relay status:', error)
      localRelayStatus.value = null
    }
  }

  const load = async () => {
    loadLocalRelayFromConfig()
    resetTemp()
    await Promise.all([
      loadIntranetMappings(),
      loadNetworkInterfaces(),
      loadIntranetInterfaceIp(),
      loadLocalRelayStatus()
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

    // Deep-clone whitelist so IPC never sees a Vue reactive proxy.
    const tokenWhitelist = JSON.parse(
      JSON.stringify(tempLocalRelayTokenWhitelist.value)
    ) as string[]
    const port = Math.max(1024, Math.min(65535, Math.round(Number(tempLocalRelayPort.value)) || 8787))
    tempLocalRelayPort.value = port

    try {
      const result = await window.electronAPI.config.setLocalRelayConfig({
        enabled: tempLocalRelayEnabled.value,
        port,
        whitelistEnabled: tempLocalRelayWhitelistEnabled.value,
        includeCurrentToken: tempLocalRelayIncludeCurrentToken.value,
        tokenWhitelist
      })
      localRelayEnabled.value = !!result.config.localRelayEnabled
      localRelayPort.value = result.config.localRelayPort ?? port
      localRelayWhitelistEnabled.value = result.config.localRelayWhitelistEnabled !== false
      localRelayIncludeCurrentToken.value = result.config.localRelayIncludeCurrentToken !== false
      localRelayTokenWhitelist.value = [...(result.config.localRelayTokenWhitelist ?? [])]
      localRelayStatus.value = result.status
      // Re-sync temp to committed (normalized) values.
      resetTempLocalRelay()
    } catch (error) {
      log.error('Failed to save local relay config:', error)
      throw error
    }
  }

  const resetTempLocalRelay = () => {
    tempLocalRelayEnabled.value = localRelayEnabled.value
    tempLocalRelayPort.value = localRelayPort.value
    tempLocalRelayWhitelistEnabled.value = localRelayWhitelistEnabled.value
    tempLocalRelayIncludeCurrentToken.value = localRelayIncludeCurrentToken.value
    tempLocalRelayTokenWhitelist.value = [...localRelayTokenWhitelist.value]
    newWhitelistToken.value = ''
    whitelistAddError.value = null
  }

  const resetTemp = () => {
    tempIntranetInterfaceIp.value = intranetInterfaceIp.value
    intranetInterfaceWarning.value = null
    resetTempLocalRelay()
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

  const addWhitelistToken = () => {
    const translate = t || ((key: string) => key)
    const raw = newWhitelistToken.value.trim().toLowerCase()
    whitelistAddError.value = null
    if (!LOGIN_TOKEN_RE.test(raw)) {
      whitelistAddError.value = translate('advanced.localRelayWhitelistInvalid')
      return
    }
    const current = currentAuthToken.value?.toLowerCase() ?? null
    if (current && raw === current) {
      // Covered by the pinned current-token row when include-current is on.
      whitelistAddError.value = translate('advanced.localRelayWhitelistIsCurrent')
      return
    }
    if (tempLocalRelayTokenWhitelist.value.includes(raw)) {
      whitelistAddError.value = translate('advanced.localRelayWhitelistDuplicate')
      return
    }
    tempLocalRelayTokenWhitelist.value = [...tempLocalRelayTokenWhitelist.value, raw]
    newWhitelistToken.value = ''
  }

  const removeWhitelistToken = (token: string) => {
    const normalized = token.toLowerCase()
    tempLocalRelayTokenWhitelist.value = tempLocalRelayTokenWhitelist.value.filter(
      (t) => t !== normalized
    )
  }

  const formatTokenDisplay = (token: string | null | undefined): string => {
    if (!token) return '—'
    if (token.length <= 12) return token
    return `${token.slice(0, 6)}…${token.slice(-6)}`
  }

  return {
    intranetMappings,
    expandedMappings,
    availableNetworkInterfaces,
    intranetInterfaceIp,
    tempIntranetInterfaceIp,
    intranetInterfaceWarning,

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

    load,
    save,
    resetTemp,

    loadIntranetMappings,
    refreshNetworkInterfaces,
    toggleMappingExpanded,
    getStrategyDisplayName,
    addWhitelistToken,
    removeWhitelistToken,
    formatTokenDisplay,
    loadLocalRelayStatus
  }
}

export type UseNetworkSettingsReturn = ReturnType<typeof useNetworkSettings>
