/**
 * Shared hls.js config for live vs recorded playback.
 * Used by useVideoPlayer / useDualStreamPlayer and the Lectures hybrid dual path.
 */
export function getHlsConfig(hlsMode: 'live' | 'recorded') {
  const baseConfig = {
    enableWorker: true,
    debug: false,
    startFragPrefetch: true,
    testBandwidth: false,
    progressive: false,
    maxBufferHole: 0.5,
    nudgeOffset: 0.1,
    nudgeMaxRetry: 3,
    maxFragLookUpTolerance: 0.25,
    minAutoBitrate: 0,
  }

  if (hlsMode === 'live') {
    return {
      ...baseConfig,
      lowLatencyMode: true,
      backBufferLength: 10,
      maxBufferLength: 10,
      maxMaxBufferLength: 20,
      maxBufferSize: 20 * 1000 * 1000,
      liveSyncDuration: 3,
      liveMaxLatencyDuration: 10,
      liveDurationInfinity: true,
      fragLoadingTimeOut: 8000,
      fragLoadingMaxRetry: 3,
      fragLoadingRetryDelay: 500,
      fragLoadingMaxRetryTimeout: 16000,
      levelLoadingTimeOut: 5000,
      levelLoadingMaxRetry: 3,
      levelLoadingRetryDelay: 500,
      levelLoadingMaxRetryTimeout: 16000,
      manifestLoadingTimeOut: 5000,
      manifestLoadingMaxRetry: 3,
      manifestLoadingRetryDelay: 500,
      manifestLoadingMaxRetryTimeout: 16000,
      highBufferWatchdogPeriod: 1,
      maxStarvationDelay: 2,
      maxLoadingDelay: 2,
    }
  }

  return {
    ...baseConfig,
    lowLatencyMode: false,
    backBufferLength: 30,
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    maxBufferSize: 60 * 1000 * 1000,
    fragLoadingTimeOut: 20000,
    fragLoadingMaxRetry: 6,
    fragLoadingRetryDelay: 1000,
    fragLoadingMaxRetryTimeout: 64000,
    levelLoadingTimeOut: 10000,
    levelLoadingMaxRetry: 4,
    levelLoadingRetryDelay: 1000,
    levelLoadingMaxRetryTimeout: 64000,
    manifestLoadingTimeOut: 10000,
    manifestLoadingMaxRetry: 6,
    manifestLoadingRetryDelay: 1000,
    manifestLoadingMaxRetryTimeout: 64000,
    highBufferWatchdogPeriod: 2,
    maxStarvationDelay: 4,
    maxLoadingDelay: 4,
  }
}
