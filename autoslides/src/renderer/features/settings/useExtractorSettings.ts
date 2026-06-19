import { ref } from 'vue'
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
  const showExtractorInstallModal = ref(false)

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
    showExtractorInstallModal,

    load,
    save,
    resetTemp,

    loadQtExtractorConfig,
    qtExtractorVerify,
    qtExtractorBrowseBinary,
    openExtractorInstallModal,
    closeExtractorInstallModal
  }
}

export type UseExtractorSettingsReturn = ReturnType<typeof useExtractorSettings>
