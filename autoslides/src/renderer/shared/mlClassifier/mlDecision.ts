import type { MlClassifierThresholds } from '@common/types'
import type { ClassificationValue } from '@shared/postProcessing/types'
import type { ClassifierClass } from '@shared/workers/slideClassifier.worker'

export type MlThresholdValues = MlClassifierThresholds

/**
 * Pure policy function — decide the final class for a single ML inference result,
 * applying the configurable threshold bands and the distinguishMaybeSlide flag.
 */
export function applyMlDecision(
  probabilities: Record<ClassifierClass, number>,
  predictedClass: ClassifierClass,
  confidence: number,
  thresholds: MlThresholdValues,
  distinguishMaybeSlide: boolean,
): ClassificationValue {
  if (predictedClass === 'slide') return 'slide'

  const mapRemoval = (): ClassificationValue => {
    if (predictedClass === 'not_slide') return 'not_slide'
    return distinguishMaybeSlide ? 'may_be_slide_edit' : 'not_slide'
  }

  if (confidence < thresholds.trustLow) {
    return 'slide'
  }
  if (confidence > thresholds.trustHigh) {
    return mapRemoval()
  }
  const slideProb = probabilities.slide
  if (slideProb < thresholds.slideCheckLow) return mapRemoval()
  return 'slide'
}
