// Baked-in extraction + post-processing configuration for the web version.
// Sources: autoslides/src/main/platform/config/defaults.ts
// (defaultSlideExtractionConfig) and
// autoslides/src/renderer/shared/services/ssimThresholdService.ts
// (SSIM_PRESET_VALUES + classroom-based adaptive rule).
//
// The web version has no extraction settings UI this round — everything runs
// with the desktop defaults below. Values (including the four preset exclusion
// pHashes) are copied verbatim; do not tweak them independently of desktop.

export interface ExtractionDefaults {
  checkInterval: number;
  enableDoubleVerification: boolean;
  verificationCount: number;
  ssimThreshold: number;
  enableDownsampling: boolean;
  downsampleWidth: number;
  downsampleHeight: number;
}

export const EXTRACTION_DEFAULTS: ExtractionDefaults = {
  checkInterval: 2000,
  enableDoubleVerification: true,
  verificationCount: 2,
  ssimThreshold: 0.9987,
  enableDownsampling: true,
  downsampleWidth: 480,
  downsampleHeight: 270,
};

export interface ExclusionPreset {
  id: string;
  name: string;
  pHash: string;
  createdAt: number;
  isPreset: boolean;
  isEnabled: boolean;
}

export interface PostProcessingDefaults {
  pHashThreshold: number;
  enableDuplicateRemoval: boolean;
  enableExclusionList: boolean;
  enableAIFiltering: boolean;
  pHashExclusionList: ExclusionPreset[];
}

export const POST_PROCESSING_DEFAULTS: PostProcessingDefaults = {
  pHashThreshold: 10,
  enableDuplicateRemoval: true,
  enableExclusionList: true,
  // AI filtering is not available in the web version.
  enableAIFiltering: false,
  pHashExclusionList: [
    {
      id: 'preset_no_signal',
      name: 'No Signal',
      pHash: '4ccccccc33333333cccccccc33333333cccccccccccc333333336666ccccdccc',
      createdAt: 0,
      isPreset: true,
      isEnabled: true,
    },
    {
      id: 'preset_no_input',
      name: 'No Input',
      pHash: '4ccc33333333ccc933338ccccc73666399cc9999ce633333cccccccc3333999c',
      createdAt: 0,
      isPreset: true,
      isEnabled: true,
    },
    {
      id: 'preset_black_screen',
      name: 'Black Screen',
      pHash: '4118adfc4b08ba71510bbf680718b166c99a96d6d718cee474f3fcb52a1c7d4a',
      createdAt: 0,
      isPreset: true,
      isEnabled: true,
    },
    {
      id: 'preset_desktop',
      name: 'Desktop',
      pHash: '5555f4f43d0a1f0b3b8ec4f1c2e43f070932f0fcc07c3c093d0bcf07c3969b93',
      createdAt: 0,
      isPreset: true,
      isEnabled: true,
    },
  ],
};

// SSIM preset values, kept for parity with the desktop service.
export const SSIM_PRESET_VALUES = {
  adaptive: 0.9987,
  strict: 0.999,
  normal: 0.9987,
  loose: 0.998,
} as const;

/**
 * Resolve the effective SSIM threshold for an extraction ("adaptive" preset).
 * Classroom-location rules from the desktop ssimThresholdService: rooms in
 * 综教 / 理教 / 研楼 buildings get the loose threshold; otherwise normal.
 */
export function resolveSsimThreshold(classrooms?: { name: string }[] | null): number {
  if (classrooms && classrooms.length > 0) {
    const names = classrooms.map((c) => c.name).join(' ');
    if (names.includes('综教') || names.includes('理教') || names.includes('研楼')) {
      return SSIM_PRESET_VALUES.loose;
    }
  }
  return SSIM_PRESET_VALUES.normal;
}
