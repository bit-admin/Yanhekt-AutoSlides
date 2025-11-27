import { ref, type Ref, type ShallowRef, type ComputedRef } from 'vue'
import type Hls from 'hls.js'

export interface UsePerformanceOptimizationOptions {
  mode: 'live' | 'recorded'
  videoPlayer: Ref<HTMLVideoElement | null>
  hls: ShallowRef<Hls | null>
  currentPlaybackRate: Ref<number>
  shouldVideoMute: ComputedRef<boolean>
}

export interface UsePerformanceOptimizationReturn {
  // State
  isDocumentVisible: Ref<boolean>
  preventSystemSleep: Ref<boolean>
  keepAliveInterval: Ref<NodeJS.Timeout | null>
  wakeLock: Ref<WakeLockSentinel | null>
  performanceMonitorInterval: Ref<NodeJS.Timeout | null>
  silentAudioContext: Ref<AudioContext | null>
  silentAudioSource: Ref<AudioBufferSourceNode | null>
  silentAudioGain: Ref<GainNode | null>

  // Methods
  handleVisibilityChange: () => void
  startKeepAlive: () => void
  stopKeepAlive: () => void
  startPerformanceMonitoring: () => void
  stopPerformanceMonitoring: () => void
  requestWakeLock: () => Promise<void>
  releaseWakeLock: () => void
  requestPowerManagement: () => Promise<void>
  releasePowerManagement: () => Promise<void>
  createSilentAudio: () => { audioContext: AudioContext; source: AudioBufferSourceNode; gainNode: GainNode } | null
  startSilentAudio: () => void
  stopSilentAudio: () => void
  setupEventListeners: () => void
  removeEventListeners: () => void
  cleanupAll: () => Promise<void>
  initConfig: () => Promise<void>
}

export function usePerformanceOptimization(options: UsePerformanceOptimizationOptions): UsePerformanceOptimizationReturn {
  const { mode, videoPlayer, hls, currentPlaybackRate, shouldVideoMute } = options

  // State
  const isDocumentVisible = ref(true)
  const preventSystemSleep = ref(false)
  const keepAliveInterval = ref<NodeJS.Timeout | null>(null)
  const wakeLock = ref<WakeLockSentinel | null>(null)
  const performanceMonitorInterval = ref<NodeJS.Timeout | null>(null)
  const silentAudioContext = ref<AudioContext | null>(null)
  const silentAudioSource = ref<AudioBufferSourceNode | null>(null)
  const silentAudioGain = ref<GainNode | null>(null)

  // Visibility change handler
  const handleVisibilityChange = () => {
    isDocumentVisible.value = !document.hidden

    if (document.hidden) {
      console.log('Page hidden - maintaining video performance with enhanced monitoring')
      startPerformanceMonitoring()
    } else {
      console.log('Page visible - normal operation')
      stopPerformanceMonitoring()
    }
  }

  // Keep-alive mechanism to prevent browser throttling
  const startKeepAlive = () => {
    if (!preventSystemSleep.value) {
      console.log('Keep-alive mechanism disabled (preventSystemSleep is off)')
      return
    }

    if (keepAliveInterval.value) return

    console.log('Starting keep-alive mechanism for background playback')
    keepAliveInterval.value = setInterval(() => {
      if (videoPlayer.value && !videoPlayer.value.paused) {
        const currentTime = videoPlayer.value.currentTime
        const expectedRate = currentPlaybackRate.value

        // Check if playback rate has been throttled
        if (Math.abs(videoPlayer.value.playbackRate - expectedRate) > 0.01) {
          console.log(`Playback rate drift detected: ${videoPlayer.value.playbackRate} vs expected ${expectedRate}, correcting...`)
          videoPlayer.value.playbackRate = expectedRate
        }

        // Light activity to prevent throttling
        if (currentTime > 0) {
          performance.mark(`keepalive-${Date.now()}`)
        }
      }
    }, 3000)
  }

  const stopKeepAlive = () => {
    if (keepAliveInterval.value) {
      clearInterval(keepAliveInterval.value)
      keepAliveInterval.value = null
      console.log('Keep-alive mechanism stopped')
    }
  }

  // Enhanced performance monitoring for background playback
  const startPerformanceMonitoring = () => {
    if (!preventSystemSleep.value) {
      console.log('Enhanced performance monitoring disabled (preventSystemSleep is off)')
      return
    }

    if (performanceMonitorInterval.value) return

    console.log('Starting enhanced performance monitoring')
    performanceMonitorInterval.value = setInterval(() => {
      if (videoPlayer.value && !videoPlayer.value.paused) {
        const video = videoPlayer.value
        const currentTime = video.currentTime
        const buffered = video.buffered

        // Check buffering health
        let bufferedAhead = 0
        for (let i = 0; i < buffered.length; i++) {
          if (buffered.start(i) <= currentTime && buffered.end(i) > currentTime) {
            bufferedAhead = buffered.end(i) - currentTime
            break
          }
        }

        // Log performance metrics when in background
        if (document.hidden) {
          console.log(`Background playback status: time=${currentTime.toFixed(1)}s, rate=${video.playbackRate}x, buffered=${bufferedAhead.toFixed(1)}s ahead`)

          // If buffer is getting low in background, this might indicate throttling
          if (bufferedAhead < 10 && hls.value) {
            console.log('Low buffer detected in background, requesting more data')
            try {
              hls.value.startLoad()
            } catch (e) {
              // Ignore errors, this is just a hint to HLS
            }
          }
        }
      }
    }, 10000)
  }

  const stopPerformanceMonitoring = () => {
    if (performanceMonitorInterval.value) {
      clearInterval(performanceMonitorInterval.value)
      performanceMonitorInterval.value = null
      console.log('Enhanced performance monitoring stopped')
    }
  }

  // Wake Lock API support for preventing screen sleep
  const requestWakeLock = async () => {
    if (!preventSystemSleep.value) {
      console.log('Wake lock disabled (preventSystemSleep is off)')
      return
    }

    try {
      if ('wakeLock' in navigator && !wakeLock.value) {
        wakeLock.value = await (navigator as any).wakeLock.request('screen')
        console.log('Wake lock acquired to prevent screen sleep')

        wakeLock.value?.addEventListener('release', () => {
          console.log('Wake lock released')
          wakeLock.value = null
        })
      }
    } catch (err) {
      console.log('Wake lock request failed (not supported or denied):', err)
    }
  }

  const releaseWakeLock = () => {
    if (wakeLock.value) {
      wakeLock.value.release()
      wakeLock.value = null
      console.log('Wake lock manually released')
    }
  }

  // Power management integration
  const requestPowerManagement = async () => {
    if (!preventSystemSleep.value) {
      console.log('System sleep prevention disabled (preventSystemSleep is off)')
      return
    }

    try {
      await window.electronAPI.powerManagement?.preventSleep?.()
      console.log('System sleep prevention requested')
    } catch (err) {
      console.log('Power management request failed:', err)
    }
  }

  const releasePowerManagement = async () => {
    try {
      await window.electronAPI.powerManagement?.allowSleep?.()
      console.log('System sleep prevention released')
    } catch (err) {
      console.log('Power management release failed:', err)
    }
  }

  // Silent audio stream management to prevent Chrome throttling
  const createSilentAudio = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

      const sampleRate = audioContext.sampleRate
      const buffer = audioContext.createBuffer(1, sampleRate, sampleRate)

      const source = audioContext.createBufferSource()
      source.buffer = buffer
      source.loop = true

      const gainNode = audioContext.createGain()
      gainNode.gain.value = 0

      source.connect(gainNode)
      gainNode.connect(audioContext.destination)

      return { audioContext, source, gainNode }
    } catch (error) {
      console.error('Failed to create silent audio:', error)
      return null
    }
  }

  const startSilentAudio = () => {
    if (!shouldVideoMute.value) {
      return
    }

    if (silentAudioContext.value && silentAudioSource.value) {
      return
    }

    try {
      const audioSetup = createSilentAudio()
      if (!audioSetup) {
        return
      }

      const { audioContext, source, gainNode } = audioSetup

      silentAudioContext.value = audioContext
      silentAudioSource.value = source
      silentAudioGain.value = gainNode

      source.start()

      console.log(`Started silent audio stream to prevent Chrome throttling in ${mode} mode`)
    } catch (error) {
      console.error('Failed to start silent audio:', error)
    }
  }

  const stopSilentAudio = () => {
    try {
      if (silentAudioSource.value) {
        silentAudioSource.value.stop()
        silentAudioSource.value = null
      }

      if (silentAudioContext.value) {
        silentAudioContext.value.close()
        silentAudioContext.value = null
      }

      silentAudioGain.value = null

      console.log('Stopped silent audio stream')
    } catch (error) {
      console.error('Failed to stop silent audio:', error)
    }
  }

  const setupEventListeners = () => {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  const removeEventListeners = () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }

  const cleanupAll = async () => {
    stopKeepAlive()
    stopPerformanceMonitoring()
    releaseWakeLock()
    await releasePowerManagement()
    stopSilentAudio()
    removeEventListeners()
  }

  const initConfig = async () => {
    try {
      const config = await window.electronAPI.config.get()
      preventSystemSleep.value = config.preventSystemSleep !== undefined ? config.preventSystemSleep : true
      console.log('Performance optimization setting (preventSystemSleep):', preventSystemSleep.value)
    } catch (error) {
      console.error('Failed to load performance optimization config:', error)
    }
  }

  return {
    // State
    isDocumentVisible,
    preventSystemSleep,
    keepAliveInterval,
    wakeLock,
    performanceMonitorInterval,
    silentAudioContext,
    silentAudioSource,
    silentAudioGain,

    // Methods
    handleVisibilityChange,
    startKeepAlive,
    stopKeepAlive,
    startPerformanceMonitoring,
    stopPerformanceMonitoring,
    requestWakeLock,
    releaseWakeLock,
    requestPowerManagement,
    releasePowerManagement,
    createSilentAudio,
    startSilentAudio,
    stopSilentAudio,
    setupEventListeners,
    removeEventListeners,
    cleanupAll,
    initConfig
  }
}
