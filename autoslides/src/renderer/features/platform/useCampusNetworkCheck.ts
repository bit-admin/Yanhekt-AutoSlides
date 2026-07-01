import { ref } from 'vue'
import { configStore } from '@shared/services/configStore'
import { createLogger } from '@shared/utils/logger'
import type { CampusProbeResult } from '@common/types'

const log = createLogger('CampusNetworkCheck')

export type CampusCheckStatus = 'idle' | 'checking' | 'ok' | 'warning'

// Module-singleton state so any surface can read the latest result (same pattern
// as navigationStore). Today only the Home page consumes it.
const status = ref<CampusCheckStatus>('idle')
const result = ref<CampusProbeResult | null>(null)

// Right after switching to a freshly-associated interface (e.g. flipping to a
// campus Wi-Fi IP and restarting), the OS can report the interface as up
// before routing to the portal actually works (802.1x/EAP handshake, DHCP,
// and route-table settling all take a beat). A single 5s-timeout probe can
// lose that race and get stuck on a false 'warning' with nothing to clear it.
// Retry unreachable (transport error/timeout) results a couple of times
// before concluding the network really is unreachable. A reachable-but-not-
// authenticated result is a real state (needs portal login), not a race, so
// it is not retried.
const RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = 2000

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Probe the campus portal to confirm the device is actually on the campus
 * network — but only while internal network mode is active, since that's the
 * only mode whose intranet IP rewriting requires campus connectivity. In
 * external mode there is nothing to warn about, so we stay 'idle'.
 *
 * Non-blocking and never throws: any failure leaves a 'warning' (when the portal
 * is unreachable / reports offline) or is swallowed.
 */
const runCampusCheck = async (): Promise<void> => {
  if (configStore.connectionMode !== 'internal') {
    status.value = 'idle'
    result.value = null
    return
  }

  status.value = 'checking'
  try {
    let res: CampusProbeResult = await window.electronAPI.intranet.checkCampusConnection()
    for (let attempt = 1; attempt < RETRY_ATTEMPTS && !res.reachable; attempt++) {
      await delay(RETRY_DELAY_MS)
      res = await window.electronAPI.intranet.checkCampusConnection()
    }
    result.value = res
    status.value = (!res.reachable || res.online === false) ? 'warning' : 'ok'
  } catch (err) {
    // A failed IPC call shouldn't surface a scary banner on its own; log and
    // leave the prior state untouched rather than forcing a false warning.
    log.debug('Campus connection check failed:', err)
    status.value = 'idle'
  }
}

export function useCampusNetworkCheck() {
  return {
    campusCheckStatus: status,
    campusCheckResult: result,
    runCampusCheck,
  }
}
