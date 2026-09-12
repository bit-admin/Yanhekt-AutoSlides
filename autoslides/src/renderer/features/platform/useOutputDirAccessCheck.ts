import { ref } from 'vue'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('OutputDirAccessCheck')

// Module-singleton like useCampusNetworkCheck. Holds the marker-carrying error
// (see @common/outputDirAccess) while the output folder is denied, missing or
// unreachable, else null.
const problemError = ref<string | null>(null)

/**
 * Probe the output folder. Otherwise a macOS privacy refusal (~/Downloads is
 * the default location) or a disconnected drive only shows up once the user
 * opens Slides or Lectures. Never throws; a failed probe clears the warning.
 */
const runOutputDirCheck = async (): Promise<void> => {
  try {
    const result = await window.electronAPI.config.probeOutputDirectory()
    problemError.value = result.ok ? null : result.error
  } catch (error) {
    log.debug('Output folder probe failed:', error)
    problemError.value = null
  }
}

export function useOutputDirAccessCheck() {
  return {
    outputDirProblemError: problemError,
    runOutputDirCheck,
  }
}
