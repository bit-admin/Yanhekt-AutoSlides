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
  loose: 0.998
}

/**
 * SSIM Threshold Service
 */
export class SsimThresholdService {
  private static instance: SsimThresholdService
  private currentClassrooms: { name: string }[] | null = null

  private constructor() {
    // Private constructor for singleton pattern
  }

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
   * Note: This method should primarily be used for user input validation,
   * not for determining the current preset mode from config.
   *
   * Adaptive mode must be explicitly selected by the user and cannot be
   * automatically matched from input values.
   */
  public getPresetFromValue(value: number): SsimPresetType {
    // Check exact matches with fixed presets first
    // Adaptive mode is never auto-matched - it must be explicitly selected
    if (value === SSIM_PRESET_VALUES.strict) {
      return 'strict'
    }
    if (value === SSIM_PRESET_VALUES.normal) {
      return 'normal'
    }
    if (value === SSIM_PRESET_VALUES.loose) {
      return 'loose'
    }

    // If no exact match with fixed presets, it's custom
    // Note: We don't check adaptive values here because adaptive mode
    // must be explicitly selected by the user, not auto-detected from values
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
   * Implements classroom-based rules and other adaptive logic:
   * - Classroom location-based rules (priority order)
   * - Video quality
   * - Network conditions
   * - Historical performance
   * - User preferences
   */
  private calculateAdaptiveThreshold(): number {
    // Apply classroom-based rules first (highest priority)
    const classroomThreshold = this.getClassroomBasedThreshold(this.currentClassrooms || undefined)
    if (classroomThreshold !== null) {
      return classroomThreshold
    }

    // If no classroom rules match, return normal value as fallback
    return SSIM_PRESET_VALUES.normal

    // Future implementation might consider:
    // - Current video resolution
    // - Network stability
    // - Previous detection accuracy
    // - Time of day / system load
    // - User's historical preferences
  }

  /**
   * Get threshold based on classroom location rules
   * Rules are applied in order, first match wins
   *
   * @param classrooms - Array of classroom objects with name property
   * @returns threshold value or null if no rules match
   */
  public getClassroomBasedThreshold(classrooms?: { name: string }[]): number | null {
    if (!classrooms || classrooms.length === 0) {
      return null
    }

    // Combine all classroom names for rule checking
    const classroomNames = classrooms.map(c => c.name).join(' ')

    // Rule 1: If classrooms contain "综教", return loose value
    if (classroomNames.includes('综教')) {
      return SSIM_PRESET_VALUES.loose
    }

    // Rule 2: If classrooms contain "理教", return loose value
    if (classroomNames.includes('理教')) {
      return SSIM_PRESET_VALUES.loose
    }

    // Rule 3: If classrooms contain "研楼", return loose value
    if (classroomNames.includes('研楼')) {
      return SSIM_PRESET_VALUES.loose
    }

    // No rules matched
    return null
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
   * Update the adaptive threshold value dynamically
   * This method should be called when adaptive mode needs to adjust the threshold
   * based on runtime conditions (for future implementation)
   */
  public updateAdaptiveThreshold(newValue: number): void {
    if (this.isValidThreshold(newValue)) {
      SSIM_PRESET_VALUES.adaptive = newValue
      console.log(`Adaptive threshold updated to: ${newValue}`)
    } else {
      console.warn(`Invalid adaptive threshold value: ${newValue}`)
    }
  }

  /**
   * Set current classroom information for adaptive threshold calculation
   *
   * @param classrooms - Array of classroom objects with name property
   */
  public setCurrentClassrooms(classrooms: { name: string }[] | null): void {
    this.currentClassrooms = classrooms
    console.log('Updated classroom context for SSIM threshold:', classrooms?.map(c => c.name).join(', ') || 'none')

    // If adaptive mode is being used, notify UI components about the threshold change
    this.notifyAdaptiveThresholdChange()
  }

  /**
   * Notify UI components about adaptive threshold changes
   * This triggers programmatic updates in LeftPanel.vue
   */
  private notifyAdaptiveThresholdChange(): void {
    // Dispatch a custom event to notify components about adaptive threshold changes
    const event = new CustomEvent('adaptiveThresholdChanged', {
      detail: {
        newThreshold: this.calculateAdaptiveThreshold(),
        classrooms: this.currentClassrooms
      }
    })
    window.dispatchEvent(event)
  }

  /**
   * Get current classroom information
   */
  public getCurrentClassrooms(): { name: string }[] | null {
    return this.currentClassrooms
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