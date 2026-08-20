import { computed, ref } from 'vue'
import { compareSemver } from '@common/semver'
import {
  QT_EXTRACTOR_FEATURES,
  qtFeatureSupported,
  qtSupportsWriteTimeline,
} from '@common/qtExtractorFeatures'
import { overrides } from '@shared/overrideRegistry'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('ExtractorSettings');

export function useExtractorSettings() {
  const qtExtractorAutoRun = ref(false)
  const tempQtExtractorAutoRun = ref(false)
  const qtExtractorAutoPostProcess = ref(true)
  const tempQtExtractorAutoPostProcess = ref(true)
  const qtExtractorBinaryPath = ref('')
  const qtExtractorResolvedPath = ref('')
  const qtExtractorStatusOk = ref(false)
  const qtExtractorStatusVersion = ref('')
  const qtExtractorStatusError = ref('')
  const qtExtractorVerifying = ref(false)
  const checkingForExtractorUpdates = ref(false)
  const showExtractorInstallModal = ref(false)

  /** True when a verified binary is present — use "Check for Updates" vs "Install". */
  const qtExtractorInstalled = computed(() => qtExtractorStatusOk.value)

  const qtSupportsTimeline = computed(() =>
    qtSupportsWriteTimeline(qtExtractorStatusVersion.value || null)
  )

  const qtFeatureRows = computed(() =>
    QT_EXTRACTOR_FEATURES.map(feature => ({
      id: feature.id,
      labelKey: feature.labelKey,
      minVersion: feature.minVersion,
      supported: qtFeatureSupported(feature, qtExtractorStatusVersion.value || null),
    }))
  )

  const applyQtStatus = (status: { ok: boolean; path: string; resolvedPath: string; version?: string; error?: string }) => {
    qtExtractorStatusOk.value = !!status.ok
    qtExtractorStatusVersion.value = status.version || ''
    qtExtractorStatusError.value = status.error || ''
    qtExtractorBinaryPath.value = status.path || ''
    qtExtractorResolvedPath.value = status.resolvedPath || ''
  }

  const loadQtExtractorConfig = async () => {
    try {
      const cfg = await window.electronAPI.config.get()
      const block = cfg.qtExtractor
      const savedBinaryPath = block?.binaryPath || ''
      if (savedBinaryPath !== qtExtractorBinaryPath.value) {
        qtExtractorResolvedPath.value = ''
        qtExtractorStatusOk.value = false
        qtExtractorStatusVersion.value = ''
        qtExtractorStatusError.value = ''
      }
      if (block) {
        qtExtractorAutoRun.value = !!block.autoRunAfterDownload
        qtExtractorAutoPostProcess.value = block.autoPostProcessAfter !== false
      }
      qtExtractorBinaryPath.value = savedBinaryPath
      tempQtExtractorAutoRun.value = qtExtractorAutoRun.value
      tempQtExtractorAutoPostProcess.value = qtExtractorAutoPostProcess.value
    } catch (error) {
      log.error('Failed to load Qt extractor config:', error)
    }
  }

  const qtExtractorVerify = async () => {
    if (qtExtractorVerifying.value) return

    qtExtractorVerifying.value = true
    try {
      if (overrides.qtExtractorStatus) {
        const demo = overrides.qtExtractorStatus
        applyQtStatus({
          ok: demo.ok,
          version: demo.version,
          path: demo.path || qtExtractorBinaryPath.value || '/Applications/AutoSlides Extractor.app',
          resolvedPath: demo.resolvedPath || demo.path || '/Applications/AutoSlides Extractor.app',
        })
        return
      }
      const status = await window.electronAPI.qtExtractor.verify(qtExtractorBinaryPath.value || undefined)
      applyQtStatus(status)
      // Reuse the snapshot we just obtained to refresh the extraction queue's
      // cached readiness — no second IPC verification probe.
      const { ExtractionQueue } = await import('@shared/services/extractionQueueService')
      ExtractionQueue.applyExtractorStatus(status)
    } catch (error) {
      log.error('Failed to verify extractor binary:', error)
      qtExtractorStatusOk.value = false
      qtExtractorStatusError.value = error instanceof Error ? error.message : String(error)
    } finally {
      qtExtractorVerifying.value = false
    }
  }

  const qtExtractorBrowseBinary = async () => {
    try {
      const picked = await window.electronAPI.qtExtractor.selectBinary()
      if (!picked) return
      await window.electronAPI.qtExtractor.setBinaryPath(picked)
      qtExtractorBinaryPath.value = picked
      await qtExtractorVerify()
    } catch (error) {
      log.error('Failed to browse for extractor binary:', error)
    }
  }

  const openExtractorInstallModal = () => {
    showExtractorInstallModal.value = true
  }
  const closeExtractorInstallModal = () => {
    showExtractorInstallModal.value = false
    // Re-verify after modal closes — the install may have just finished
    void qtExtractorVerify()
  }

  /**
   * Check for Extractor updates via GitHub releases.
   * Compares the latest GitHub release tag against the verified installed version.
   */
  const checkForExtractorUpdates = async (
    t?: (key: string, values?: Record<string, unknown>) => string
  ) => {
    if (checkingForExtractorUpdates.value) return
    checkingForExtractorUpdates.value = true

    try {
      const res = await window.electronAPI.extractorInstaller.checkLatest()
      if (!res.success) {
        if (window.electronAPI.dialog?.showMessageBox && t) {
          await window.electronAPI.dialog.showMessageBox({
            type: 'error',
            title: t('advanced.qtExtractor.updateCheckFailedTitle'),
            message: t('advanced.qtExtractor.updateCheckFailedMessage'),
            detail: t('advanced.qtExtractor.updateCheckFailedDetail', {
              error: res.error || 'Unknown error',
            }),
            buttons: [t('titlebar.ok')],
            defaultId: 0,
            cancelId: 0,
          })
        }
        return
      }

      const latestVersion = (res.tagName || '').replace(/^v/, '')
      const currentVersion = qtExtractorStatusVersion.value || ''
      const hasUpdate = compareSemver(latestVersion, currentVersion) > 0

      if (hasUpdate || !qtExtractorInstalled.value) {
        openExtractorInstallModal()
      } else if (window.electronAPI.dialog?.showMessageBox && t) {
        await window.electronAPI.dialog.showMessageBox({
          type: 'info',
          title: t('advanced.qtExtractor.noUpdateTitle'),
          message: t('advanced.qtExtractor.noUpdateMessage'),
          detail: t('advanced.qtExtractor.noUpdateDetail', {
            currentVersion: currentVersion || latestVersion,
          }),
          buttons: [t('titlebar.ok')],
          defaultId: 0,
          cancelId: 0,
        })
      }
    } catch (error) {
      log.error('Failed to check for extractor updates:', error)
    } finally {
      checkingForExtractorUpdates.value = false
    }
  }

  const load = async () => {
    await loadQtExtractorConfig()
  }

  const save = async () => {
    // Path is saved inline by the Browse / Auto-detect actions; here we save the toggles.
    await window.electronAPI.qtExtractor.setAutoRun(tempQtExtractorAutoRun.value)
    qtExtractorAutoRun.value = tempQtExtractorAutoRun.value
    await window.electronAPI.qtExtractor.setAutoPostProcess(tempQtExtractorAutoPostProcess.value)
    qtExtractorAutoPostProcess.value = tempQtExtractorAutoPostProcess.value
  }

  const resetTemp = () => {
    tempQtExtractorAutoRun.value = qtExtractorAutoRun.value
    tempQtExtractorAutoPostProcess.value = qtExtractorAutoPostProcess.value
  }

  return {
    qtExtractorAutoRun,
    tempQtExtractorAutoRun,
    qtExtractorAutoPostProcess,
    tempQtExtractorAutoPostProcess,
    qtExtractorBinaryPath,
    qtExtractorResolvedPath,
    qtExtractorStatusOk,
    qtExtractorStatusVersion,
    qtExtractorStatusError,
    qtExtractorVerifying,
    checkingForExtractorUpdates,
    showExtractorInstallModal,
    qtExtractorInstalled,
    qtSupportsTimeline,
    qtFeatureRows,

    load,
    save,
    resetTemp,

    loadQtExtractorConfig,
    qtExtractorVerify,
    qtExtractorBrowseBinary,
    openExtractorInstallModal,
    closeExtractorInstallModal,
    checkForExtractorUpdates,
  }
}

export type UseExtractorSettingsReturn = ReturnType<typeof useExtractorSettings>
