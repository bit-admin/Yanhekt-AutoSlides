// Temporary relabel for a Yanhekt live-server mix-up (2026-10-19).
//
// Each label plays whichever server response the setting points at. The
// default is the rotation the server was doing that day:
//
//   label we show    server response
//   Screen           Camera
//   Camera           Room Camera
//   Room Camera      Screen
//
// The stored object keeps `version`, so a later mix-up is not applied by an
// old saved order. Recordings and Yanhe 2.0 never go through here. An identity
// order (each label plays the server's own response) does nothing.

export const YANHEKT_LIVE_WORKAROUND_VERSION = 1

export type YanhektLiveStreamKind = 'camera' | 'screen' | 'room'

export const YANHEKT_LIVE_STREAM_KINDS = ['screen', 'camera', 'room'] as const

export interface YanhektLiveWorkaroundConfig {
  version: number
  /** Off leaves every live response on the label the server gave it. */
  enabled: boolean
  /** Which server response the Screen label plays. */
  screen: YanhektLiveStreamKind
  /** Which server response the Camera label plays. */
  camera: YanhektLiveStreamKind
  /** Which server response the Room Camera label plays. */
  room: YanhektLiveStreamKind
}

const NAMES: Record<YanhektLiveStreamKind, string> = {
  camera: '课堂摄像头',
  screen: '屏幕录制',
  room: '教室摄像头',
}

const KIND_SET = new Set<string>(YANHEKT_LIVE_STREAM_KINDS)

export function isLiveStreamKind(value: unknown): value is YanhektLiveStreamKind {
  return typeof value === 'string' && KIND_SET.has(value)
}

/** The rotation the server was serving on 2026-10-19. On. */
export function defaultYanhektLiveWorkaround(): YanhektLiveWorkaroundConfig {
  return { version: YANHEKT_LIVE_WORKAROUND_VERSION, enabled: true, screen: 'camera', camera: 'room', room: 'screen' }
}

/** Each label plays the response the server gave it. */
export function identityYanhektLiveWorkaround(): YanhektLiveWorkaroundConfig {
  return { version: YANHEKT_LIVE_WORKAROUND_VERSION, enabled: true, screen: 'screen', camera: 'camera', room: 'room' }
}

function isPermutation(screen: unknown, camera: unknown, room: unknown): boolean {
  return isLiveStreamKind(screen) && isLiveStreamKind(camera) && isLiveStreamKind(room)
    && new Set([screen, camera, room]).size === 3
}

/**
 * A usable order for this build. A legacy `1` is the default rotation, on, and
 * a legacy `0` is that same order switched off. Anything this build does not
 * understand becomes the default rotation, so a broken value cannot drop a stream.
 */
export function normalizeYanhektLiveWorkaround(value: unknown): YanhektLiveWorkaroundConfig {
  if (value === 0) return { ...defaultYanhektLiveWorkaround(), enabled: false }
  if (value === 1 || value == null) return defaultYanhektLiveWorkaround()
  if (typeof value === 'object') {
    const stored = value as Partial<YanhektLiveWorkaroundConfig>
    const { screen, camera, room } = stored
    if (stored.version === YANHEKT_LIVE_WORKAROUND_VERSION && isLiveStreamKind(screen) && isLiveStreamKind(camera) && isLiveStreamKind(room) && new Set([screen, camera, room]).size === 3) {
      return { version: YANHEKT_LIVE_WORKAROUND_VERSION, enabled: stored.enabled !== false, screen, camera, room }
    }
  }
  return defaultYanhektLiveWorkaround()
}

export function sameYanhektLiveWorkaround(a: YanhektLiveWorkaroundConfig, b: YanhektLiveWorkaroundConfig): boolean {
  return a.enabled === b.enabled && a.screen === b.screen && a.camera === b.camera && a.room === b.room
}

/**
 * The documented live names: `target` is Video1, `target_vga` is VGA,
 * `target_room` is Video2. Every address that arrived has to carry its own
 * name. One that carries a different name, or none, is not a confirmed answer,
 * and the workaround may still run.
 */
export function yanhektLiveUrlsMatchContract(urls: {
  target?: string
  target_vga?: string
  target_room?: string
}): boolean {
  const present: [YanhektLiveStreamKind, string][] = []
  if (urls.target) present.push(['camera', urls.target])
  if (urls.target_vga) present.push(['screen', urls.target_vga])
  if (urls.target_room) present.push(['room', urls.target_room])
  if (present.length === 0) return false
  return present.every(([kind, url]) => liveUrlKind(url) === kind)
}

/** The stream a live playlist name declares, or null when the name says nothing. */
function liveUrlKind(url: string): YanhektLiveStreamKind | null {
  let path = url
  try {
    path = new URL(url).pathname
  } catch {
    // Not an absolute URL. Test the text as given.
  }
  const file = path.split('/').pop() ?? path
  if (/_video1(?:\.|$)/i.test(file)) return 'camera'
  if (/_video2(?:\.|$)/i.test(file)) return 'room'
  if (/_vga(?:\.|$)/i.test(file)) return 'screen'
  return null
}

/** Point one label at a server response, and give its previous response to whoever held the new one. */
export function reassignLiveWorkaround(
  config: YanhektLiveWorkaroundConfig,
  shown: YanhektLiveStreamKind,
  source: YanhektLiveStreamKind,
): YanhektLiveWorkaroundConfig {
  const next: YanhektLiveWorkaroundConfig = { ...config, version: YANHEKT_LIVE_WORKAROUND_VERSION }
  if (next[shown] === source) return next
  const other = YANHEKT_LIVE_STREAM_KINDS.find((kind) => kind !== shown && next[kind] === source)
  const previous = next[shown]
  next[shown] = source
  if (other) next[other] = previous
  return next
}

export function relabelYanhektLiveStreams<T extends { type: YanhektLiveStreamKind; name: string }>(
  streams: Record<string, T>,
  config: YanhektLiveWorkaroundConfig,
): Record<string, T> {
  if (!config.enabled || config.version !== YANHEKT_LIVE_WORKAROUND_VERSION || !isPermutation(config.screen, config.camera, config.room)) {
    return streams
  }
  if (config.screen === 'screen' && config.camera === 'camera' && config.room === 'room') return streams
  // Server response → the label that plays it. A permutation, so each key is written once.
  const shownOf: Record<YanhektLiveStreamKind, YanhektLiveStreamKind> = { screen: 'screen', camera: 'camera', room: 'room' }
  shownOf[config.screen] = 'screen'
  shownOf[config.camera] = 'camera'
  shownOf[config.room] = 'room'
  const out: Record<string, T> = {}
  for (const stream of Object.values(streams)) {
    const kind = shownOf[stream.type]
    if (!kind) {
      out[stream.type] = stream
      continue
    }
    out[kind] = { ...stream, type: kind, name: NAMES[kind] }
  }
  return out
}
