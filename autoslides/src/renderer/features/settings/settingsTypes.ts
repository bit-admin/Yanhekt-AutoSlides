export type AdvancedTabId = 'general' | 'imageProcessing' | 'playback' | 'network' | 'ai' | 'cloud' | 'addons'

export type AutoCropDetectorMode = 'canny_then_yolo' | 'canny_only' | 'yolo_only'

export interface AutoCropModelInfoView {
  active: 'builtin' | 'custom'
  builtinVersion: string
  builtinExists: boolean
  builtinSizeBytes: number | null
  customName: string | null
  customExists: boolean
  customSizeBytes: number | null
}

export interface DownsamplingPreset {
  key: string
  label: string
  width: number
  height: number
}

export interface IntranetMapping {
  type: 'single' | 'loadbalance'
  ip?: string
  ips?: string[]
  strategy?: 'round_robin' | 'random' | 'first_available'
  currentIndex?: number
}

/** One address of a mapped domain as the Test Addresses button found it. */
export interface IntranetAddressResult {
  ip: string
  /** Milliseconds to answer; null when it did not. */
  ms: number | null
}

/** A mapping row's test state: waiting for its answers, or holding them. */
export interface IntranetDomainTest {
  pending: boolean
  results: IntranetAddressResult[]
}

/** What the last test ran against. */
export interface IntranetTestMeta {
  resolvedByCampusDns: boolean
  interfaceIp: string | null
  at: string
}

export interface NetworkInterfaceInfo {
  name: string
  address: string
  family: 'IPv4' | 'IPv6'
  internal: boolean
  mac?: string
  cidr: string | null
}
