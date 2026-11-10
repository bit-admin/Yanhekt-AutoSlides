import { compareSemver } from '@common/semver'
import { overrides } from '@shared/overrideRegistry'

export type ExtractorUpdateCheck =
  | { status: 'notInstalled' }
  | { status: 'upToDate'; currentVersion: string }
  | { status: 'hasUpdate'; currentVersion: string; latestVersion: string }
  | { status: 'failed'; error: string }

/**
 * Compares the installed Qt extractor with its latest GitHub release.
 * A missing or unverifiable extractor is `notInstalled`: the app update check
 * never offers a first install, only Settings does.
 */
export async function checkExtractorUpdate(): Promise<ExtractorUpdateCheck> {
  try {
    const installed = overrides.qtExtractorStatus ?? await window.electronAPI.qtExtractor.getStatus()
    const currentVersion = installed.ok ? installed.version || '' : ''
    if (!currentVersion) return { status: 'notInstalled' }

    const res = await window.electronAPI.extractorInstaller.checkLatest()
    if (!res.success) return { status: 'failed', error: res.error || 'Unknown error' }

    const latestVersion = (res.tagName || '').replace(/^v/, '')
    if (latestVersion && compareSemver(latestVersion, currentVersion) > 0) {
      return { status: 'hasUpdate', currentVersion, latestVersion }
    }
    return { status: 'upToDate', currentVersion }
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : String(error) }
  }
}
