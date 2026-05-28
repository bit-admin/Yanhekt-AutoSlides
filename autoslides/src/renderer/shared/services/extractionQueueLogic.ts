import type { DownloadItem } from './downloadService'
import { SSIM_PRESET_VALUES } from './ssimThresholdService'

// Pure decision/mapping logic for the extraction queue, separated from the
// reactive ExtractionQueue shell (which owns IPC, the worker loop, and reactive
// DownloadItem mutation). These functions have no side effects and no IPC — they
// are the transport-agnostic part of NN.7. The worker-loop / runOne state machine
// itself stays in the shell pending live verification.

type SsimPresetMode = 'adaptive' | 'strict' | 'normal' | 'loose' | 'custom' | undefined

/**
 * Resolve the SSIM threshold to pass to the CLI given the current preset mode.
 * Adaptive mode uses the static normal default (0.9987) per user direction — the
 * CLI receives a fixed numeric threshold, no per-session classroom lookup.
 */
export function resolveSsimThreshold(presetMode: SsimPresetMode, customValue: number): number {
  switch (presetMode) {
    case 'custom':
      return customValue
    case 'strict':
      return SSIM_PRESET_VALUES.strict
    case 'loose':
      return SSIM_PRESET_VALUES.loose
    case 'normal':
      return SSIM_PRESET_VALUES.normal
    case 'adaptive':
    default:
      return SSIM_PRESET_VALUES.normal
  }
}

/** DownloadItem with all extractor-required params guaranteed present. */
export type ExtractionReadyItem = DownloadItem & {
  ssimThreshold: number
  extractionEnableDownsampling: boolean
  extractionDownsampleWidth: number
  extractionDownsampleHeight: number
  extractorOutputDir: string
}

/**
 * Type guard: true when an item carries all parameters the extractor CLI needs.
 * Mirrors (and narrows for) the guard at the top of ExtractionQueue.runOne.
 */
export function hasRequiredExtractionParams(item: DownloadItem): item is ExtractionReadyItem {
  return (
    item.ssimThreshold != null &&
    item.extractionEnableDownsampling != null &&
    item.extractionDownsampleWidth != null &&
    item.extractionDownsampleHeight != null &&
    !!item.extractorOutputDir
  )
}

/** Config shape consumed when deciding whether/how to mark an item pending. */
export interface ExtractionConfigSnapshot {
  outputDirectory: string
  qtExtractor?: {
    autoRunAfterDownload?: boolean
    autoPostProcessAfter?: boolean
  }
  slideExtraction?: {
    ssimPresetMode?: 'adaptive' | 'strict' | 'normal' | 'loose' | 'custom'
    ssimThreshold: number
    enableDownsampling: boolean
    downsampleWidth: number
    downsampleHeight: number
  }
}

/** The DownloadItem fields written when an item becomes pending for extraction. */
export type PendingExtractionFields = Pick<
  DownloadItem,
  | 'extractionStatus'
  | 'extractionProgress'
  | 'ssimThreshold'
  | 'extractionEnableDownsampling'
  | 'extractionDownsampleWidth'
  | 'extractionDownsampleHeight'
  | 'autoPostProcessAfter'
  | 'extractorOutputDir'
>

/**
 * Compute the pending-extraction fields for an item given the current config, or
 * null when auto-extract does not apply (no autoRun toggle, or no slide config).
 * Pure — the caller is responsible for assigning the result onto the reactive
 * DownloadItem and waking the worker. Mirrors the body of markPendingIfApplicable.
 */
export function computePendingExtractionFields(
  cfg: ExtractionConfigSnapshot
): PendingExtractionFields | null {
  const qtCfg = cfg.qtExtractor
  const slideCfg = cfg.slideExtraction
  if (!qtCfg?.autoRunAfterDownload) return null
  if (!slideCfg) return null

  return {
    extractionStatus: 'pending',
    extractionProgress: 0,
    ssimThreshold: resolveSsimThreshold(slideCfg.ssimPresetMode, slideCfg.ssimThreshold),
    extractionEnableDownsampling: slideCfg.enableDownsampling,
    extractionDownsampleWidth: slideCfg.downsampleWidth,
    extractionDownsampleHeight: slideCfg.downsampleHeight,
    autoPostProcessAfter: !!qtCfg.autoPostProcessAfter,
    extractorOutputDir: cfg.outputDirectory
  }
}
