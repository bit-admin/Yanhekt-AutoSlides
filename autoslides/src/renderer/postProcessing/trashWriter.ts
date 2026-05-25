// Typed wrapper around the moveToInAppTrash IPC. Centralises the four trash
// reason strings so renames flow through one place, and gives callers a single
// log line per failure rather than three near-identical ones.

import type { TrashReason } from './types'

export interface MoveToTrashOptions {
  outputPath: string
  filename: string
  reason: TrashReason
  reasonDetails: string
}

export async function moveToTrash(opts: MoveToTrashOptions): Promise<boolean> {
  try {
    await window.electronAPI.slideExtraction.moveToInAppTrash(opts.outputPath, opts.filename, {
      reason: opts.reason,
      reasonDetails: opts.reasonDetails
    })
    return true
  } catch (error) {
    console.error(
      `[PostProcessing] Failed to move ${opts.filename} to trash (reason=${opts.reason}):`,
      error
    )
    return false
  }
}

export function trashReasonDetailsForAI(
  classification: 'not_slide' | 'may_be_slide_edit'
): string {
  return classification === 'may_be_slide_edit'
    ? 'AI classified as may_be_slide_edit'
    : 'AI classified as not_slide'
}

export function trashReasonForAI(
  classification: 'not_slide' | 'may_be_slide_edit'
): TrashReason {
  return classification === 'may_be_slide_edit' ? 'ai_filtered_edit' : 'ai_filtered'
}
