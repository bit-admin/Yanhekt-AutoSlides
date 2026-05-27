import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

export interface CacheStats {
  totalSize: number
  tempFiles: number
}

export interface UseCacheManagementReturn {
  // State
  cacheStats: Ref<CacheStats>
  isRefreshingCache: Ref<boolean>
  isClearingCache: Ref<boolean>
  isResettingData: Ref<boolean>
  cacheOperationStatus: Ref<{ type: 'success' | 'error' | 'warning'; message: string } | null>

  // Methods
  refreshCacheStats: () => Promise<void>
  clearCache: () => Promise<void>
  resetAllData: () => Promise<void>
  formatCacheSize: (bytes: number) => string
  resetOperationStatus: () => void
}

export function useCacheManagement(): UseCacheManagementReturn {
  const { t } = useI18n()

  // State
  const cacheStats = ref<CacheStats>({
    totalSize: 0,
    tempFiles: 0
  })
  const isRefreshingCache = ref(false)
  const isClearingCache = ref(false)
  const isResettingData = ref(false)
  const cacheOperationStatus = ref<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null)

  // Format cache size
  const formatCacheSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Reset operation status
  const resetOperationStatus = () => {
    cacheOperationStatus.value = null
  }

  // Refresh cache statistics
  const refreshCacheStats = async () => {
    isRefreshingCache.value = true
    cacheOperationStatus.value = null

    try {
      const stats = await window.electronAPI.cache?.getStats?.()
      if (stats) {
        cacheStats.value = {
          totalSize: stats.totalSize || 0,
          tempFiles: stats.tempFiles || 0
        }
      }
    } catch (error) {
      console.error('Failed to refresh cache stats:', error)
      cacheOperationStatus.value = {
        type: 'error',
        message: t('advanced.cacheStatsError')
      }
    } finally {
      isRefreshingCache.value = false
    }
  }

  // Clear cache
  const clearCache = async () => {
    const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
      type: 'question',
      buttons: [t('advanced.cancel'), t('advanced.clearCache')],
      defaultId: 1,
      cancelId: 0,
      title: t('advanced.clearCacheTitle'),
      message: t('advanced.clearCacheMessage'),
      detail: t('advanced.clearCacheDetail')
    })

    if (confirmed?.response !== 1) {
      return
    }

    isClearingCache.value = true
    cacheOperationStatus.value = null

    try {
      const result = await window.electronAPI.cache?.clear?.()
      if (result?.success) {
        cacheOperationStatus.value = {
          type: 'success',
          message: t('advanced.cacheClearSuccess')
        }
        await refreshCacheStats()
      } else {
        throw new Error(result?.error || 'Unknown error')
      }
    } catch (error) {
      console.error('Failed to clear cache:', error)
      cacheOperationStatus.value = {
        type: 'error',
        message: t('advanced.cacheClearError')
      }
    } finally {
      isClearingCache.value = false
    }
  }

  // Reset all data
  const resetAllData = async () => {
    // First confirmation
    const confirmed = await window.electronAPI.dialog?.showMessageBox?.({
      type: 'warning',
      buttons: [t('advanced.cancel'), t('advanced.resetAllData')],
      defaultId: 0,
      cancelId: 0,
      title: t('advanced.resetAllDataTitle'),
      message: t('advanced.resetAllDataMessage'),
      detail: t('advanced.resetAllDataDetail')
    })

    if (confirmed?.response !== 1) {
      return
    }

    // Second confirmation
    const doubleConfirmed = await window.electronAPI.dialog?.showMessageBox?.({
      type: 'error',
      buttons: [t('advanced.cancel'), t('advanced.confirmReset')],
      defaultId: 0,
      cancelId: 0,
      title: t('advanced.finalConfirmation'),
      message: t('advanced.finalConfirmationMessage'),
      detail: t('advanced.finalConfirmationDetail')
    })

    if (doubleConfirmed?.response !== 1) {
      return
    }

    isResettingData.value = true
    cacheOperationStatus.value = null

    try {
      const result = await window.electronAPI.cache?.resetAllData?.()
      if (result?.success) {
        cacheOperationStatus.value = {
          type: 'success',
          message: t('advanced.resetSuccess')
        }

        // Show restart dialog
        const shouldRestart = await window.electronAPI.dialog?.showMessageBox?.({
          type: 'info',
          buttons: [t('advanced.restartLater'), t('advanced.restartNow')],
          defaultId: 1,
          title: t('advanced.restartRequired'),
          message: t('advanced.restartRequiredMessage'),
          detail: t('advanced.restartRequiredDetail')
        })

        if (shouldRestart?.response === 1) {
          await window.electronAPI.app?.restart?.()
        }
      } else {
        throw new Error(result?.error || 'Unknown error')
      }
    } catch (error) {
      console.error('Failed to reset all data:', error)
      cacheOperationStatus.value = {
        type: 'error',
        message: t('advanced.resetError')
      }
    } finally {
      isResettingData.value = false
    }
  }

  return {
    // State
    cacheStats,
    isRefreshingCache,
    isClearingCache,
    isResettingData,
    cacheOperationStatus,

    // Methods
    refreshCacheStats,
    clearCache,
    resetAllData,
    formatCacheSize,
    resetOperationStatus
  }
}
