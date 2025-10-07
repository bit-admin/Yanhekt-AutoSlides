/**
 * SSIM Threshold Management Service
 *
 * This service manages SSIM threshold presets and provides adaptive threshold calculation.
 * It centralizes all SSIM threshold logic and provides a clean interface for components.
 */

export type SsimPresetType = 'adaptive' | 'strict' | 'normal' | 'loose' | 'custom'

export interface SsimPresetConfig {
  adaptive: number
  strict: number
  normal: number
  loose: number
}

/**
 * SSIM threshold preset values
 */
export const SSIM_PRESET_VALUES: SsimPresetConfig = {
  adaptive: 0.9987, // Default to normal value, but can be dynamically adjusted
  strict: 0.999,
  normal: 0.9987,
  loose: 0.9982
}

/**
 * SSIM Threshold Service
 */
export class SsimThresholdService {
  private static instance: SsimThresholdService

  private constructor() {}

  public static getInstance(): SsimThresholdService {
    if (!SsimThresholdService.instance) {
      SsimThresholdService.instance = new SsimThresholdService()
    }
    return SsimThresholdService.instance
  }

  /**
   * Get threshold value for a specific preset
   */
  public getThresholdValue(preset: SsimPresetType): number {
    switch (preset) {
      case 'adaptive':
        return this.calculateAdaptiveThreshold()
      case 'strict':
        return SSIM_PRESET_VALUES.strict
      case 'normal':
        return SSIM_PRESET_VALUES.normal
      case 'loose':
        return SSIM_PRESET_VALUES.loose
      case 'custom':
        // Custom values should be handled by the caller
        return SSIM_PRESET_VALUES.normal
      default:
        return SSIM_PRESET_VALUES.normal
    }
  }

  /**
   * Determine which preset matches a given threshold value
   */
  public getPresetFromValue(value: number): SsimPresetType {
    // Check exact matches first
    if (value === SSIM_PRESET_VALUES.strict) {
      return 'strict'
    }
    if (value === SSIM_PRESET_VALUES.normal) {
      return 'normal'
    }
    if (value === SSIM_PRESET_VALUES.loose) {
      return 'loose'
    }

    // For adaptive, check if it matches the current adaptive value
    const adaptiveValue = this.calculateAdaptiveThreshold()
    if (value === adaptiveValue) {
      return 'adaptive'
    }

    // If no exact match, it's custom
    return 'custom'
  }

  /**
   * Get all available preset types in the correct order
   */
  public getPresetOrder(): SsimPresetType[] {
    return ['adaptive', 'strict', 'normal', 'loose', 'custom']
  }

  /**
   * Calculate adaptive threshold based on current conditions
   *
   * TODO: Implement adaptive logic based on:
   * - Video quality
   * - Network conditions
   * - Historical performance
   * - User preferences
   *
   * For now, returns normal value as fallback
   */
  private calculateAdaptiveThreshold(): number {
    // Placeholder for adaptive logic
    // Currently returns normal value
    return SSIM_PRESET_VALUES.normal

    // Future implementation might consider:
    // - Current video resolution
    // - Network stability
    // - Previous detection accuracy
    // - Time of day / system load
    // - User's historical preferences
  }

  /**
   * Update adaptive threshold calculation (for future use)
   */
  public updateAdaptiveContext(context: {
    videoQuality?: string
    networkStability?: number
    detectionAccuracy?: number
    systemLoad?: number
  }): void {
    // TODO: Implement adaptive context updates
    // This will be used to improve adaptive threshold calculation
    console.log('Adaptive context update:', context)
  }

  /**
   * Validate if a threshold value is within acceptable range
   */
  public isValidThreshold(value: number): boolean {
    return value >= 0.9 && value <= 1.0
  }

  /**
   * Get recommended threshold based on use case
   */
  public getRecommendedThreshold(useCase: 'presentation' | 'lecture' | 'animation' | 'general'): number {
    switch (useCase) {
      case 'presentation':
        return SSIM_PRESET_VALUES.strict // High precision for static slides
      case 'lecture':
        return SSIM_PRESET_VALUES.normal // Balanced for typical lectures
      case 'animation':
        return SSIM_PRESET_VALUES.loose // More tolerant for animated content
      case 'general':
      default:
        return this.calculateAdaptiveThreshold() // Use adaptive for general use
    }
  }
}

// Export singleton instance
export const ssimThresholdService = SsimThresholdService.getInstance()