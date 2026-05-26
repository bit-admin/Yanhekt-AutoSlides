export type AdvancedTabId = 'general' | 'imageProcessing' | 'playback' | 'network' | 'ai'

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

export interface NetworkInterfaceInfo {
  name: string
  address: string
  family: 'IPv4' | 'IPv6'
  internal: boolean
  mac?: string
  cidr: string | null
}
