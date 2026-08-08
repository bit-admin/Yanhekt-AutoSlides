/**
 * Feature gates for AutoSlides Extractor (Qt) CLI capabilities by version.
 * Add rows here as new CLI flags or capabilities require a minimum extractor version.
 */
import { semverGte } from './semver';

/** Minimum version for basic extraction. */
export const QT_FEATURE_BASIC_EXTRACTION_MIN = '1.2.1';

/** Minimum version for `--write-timeline` (timeline.json with media PTS). */
export const QT_FEATURE_WRITE_TIMELINE_MIN = '2.0.0';

export interface QtExtractorFeature {
  /** Stable id for UI / logs. */
  id: 'basic-extraction' | 'write-timeline';
  /** i18n key under advanced.qtExtractor.features.* */
  labelKey: string;
  minVersion: string;
}

/** Ordered list for the settings capability panel. */
export const QT_EXTRACTOR_FEATURES: readonly QtExtractorFeature[] = [
  {
    id: 'basic-extraction',
    labelKey: 'advanced.qtExtractor.features.basicExtraction',
    minVersion: QT_FEATURE_BASIC_EXTRACTION_MIN,
  },
  {
    id: 'write-timeline',
    labelKey: 'advanced.qtExtractor.features.writeTimeline',
    minVersion: QT_FEATURE_WRITE_TIMELINE_MIN,
  },
] as const;

export function qtSupportsWriteTimeline(version: string | null | undefined): boolean {
  return !!version && semverGte(version, QT_FEATURE_WRITE_TIMELINE_MIN);
}

export function qtFeatureSupported(
  feature: QtExtractorFeature,
  version: string | null | undefined
): boolean {
  return !!version && semverGte(version, feature.minVersion);
}
