/**
 * Unified display-state shape for the 3-phase post-processing progress bar.
 *
 * `PlaybackPage.vue` reads from a flat `postProcessStatus` reactive object;
 * `RightPanel.vue` reads from a `PostProcessJob` returned by the queue service.
 * The two shapes are not directly compatible — this module adapts both into a
 * single canonical `PostProcessingDisplayState` so a shared `PostProcessingProgressBar.vue`
 * can render either source without coupling.
 */

export type PhaseStatus = 'idle' | 'active' | 'completed' | 'skipped'

export interface PhaseDisplay {
  /** Phase status — drives bar fill (active vs completed vs idle) and label. */
  status: PhaseStatus
  /** Current item index within the phase (0 when idle/completed). */
  current: number
  /** Total items in the phase (0 when not yet started). */
  total: number
  /** Count of items removed by this phase (shown as "-N" after completion). */
  removed: number
}

export interface PostProcessingDisplayState {
  phase1: PhaseDisplay
  phase2: PhaseDisplay
  phase3: PhaseDisplay
  /**
   * Phase-3-specific overlay state for the in-progress AI batch.
   * Both `completed` and `inProgress` are item counts (not percentages).
   * When `total` is 0 the phase hasn't started; the consumer should not render the overlay.
   */
  ai: {
    completed: number
    total: number
    inProgress: number
  }
}

// === PlaybackPage adapter ===

export interface PlaybackPostProcessStatus {
  currentPhase: 'idle' | 'phase1' | 'phase2' | 'phase3' | 'completed'
  phase1Skipped: boolean
  phase2Skipped: boolean
  phase3Skipped: boolean
  currentIndex: number
  totalCount: number
  duplicatesRemoved: number
  excludedRemoved: number
  aiFiltered: number
  aiCompleted: number
  aiTotal: number
  aiInProgress: number
}

function phaseAfter(currentPhase: PlaybackPostProcessStatus['currentPhase'], target: 'phase1' | 'phase2' | 'phase3'): boolean {
  const order = ['idle', 'phase1', 'phase2', 'phase3', 'completed']
  return order.indexOf(currentPhase) > order.indexOf(target)
}

export function fromPlaybackStatus(s: PlaybackPostProcessStatus): PostProcessingDisplayState {
  const phaseStatus = (
    skipped: boolean,
    target: 'phase1' | 'phase2' | 'phase3'
  ): PhaseStatus => {
    if (skipped) return 'skipped'
    if (s.currentPhase === target) return 'active'
    if (phaseAfter(s.currentPhase, target)) return 'completed'
    return 'idle'
  }

  return {
    phase1: {
      status: phaseStatus(s.phase1Skipped, 'phase1'),
      current: s.currentPhase === 'phase1' ? s.currentIndex : 0,
      total: s.currentPhase === 'phase1' ? s.totalCount : 0,
      removed: s.duplicatesRemoved
    },
    phase2: {
      status: phaseStatus(s.phase2Skipped, 'phase2'),
      current: s.currentPhase === 'phase2' ? s.currentIndex : 0,
      total: s.currentPhase === 'phase2' ? s.totalCount : 0,
      removed: s.excludedRemoved
    },
    phase3: {
      status: phaseStatus(s.phase3Skipped, 'phase3'),
      current: s.aiCompleted,
      total: s.aiTotal,
      removed: s.aiFiltered
    },
    ai: {
      completed: s.aiCompleted,
      total: s.aiTotal,
      inProgress: s.aiInProgress
    }
  }
}

// === Job-based adapter (RightPanel via PostProcessingService.getJobByTaskId) ===

export interface JobProgressLike {
  phase: 'phase1' | 'phase2' | 'phase3' | 'completed' | 'cancelled' | 'error' | 'idle'
  currentIndex: number
  total: number
  duplicatesRemoved: number
  excludedRemoved: number
  aiFiltered: number
  aiFilteredEdit?: number
  /** Optional per-batch retry size visualised as the blue overlay on phase 3. */
  retrying?: number
}

export interface JobLike {
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: JobProgressLike
}

export function fromJobProgress(job: JobLike): PostProcessingDisplayState {
  const p = job.progress
  const phaseStatus = (target: 'phase1' | 'phase2' | 'phase3'): PhaseStatus => {
    if (p.phase === target) return 'active'
    // Job's phase ordering: phase1 → phase2 → phase3 → completed
    const order = ['idle', 'phase1', 'phase2', 'phase3', 'completed']
    if (order.indexOf(p.phase) > order.indexOf(target)) return 'completed'
    return 'idle'
  }

  const phase3Removed = p.aiFiltered + (p.aiFilteredEdit ?? 0)

  return {
    phase1: {
      status: phaseStatus('phase1'),
      current: p.phase === 'phase1' ? p.currentIndex : 0,
      total: p.phase === 'phase1' ? p.total : 0,
      removed: p.duplicatesRemoved
    },
    phase2: {
      status: phaseStatus('phase2'),
      current: p.phase === 'phase2' ? p.currentIndex : 0,
      total: p.phase === 'phase2' ? p.total : 0,
      removed: p.excludedRemoved
    },
    phase3: {
      status: phaseStatus('phase3'),
      current: p.phase === 'phase3' ? p.currentIndex : 0,
      total: p.phase === 'phase3' ? p.total : 0,
      removed: phase3Removed
    },
    ai: {
      completed: p.phase === 'phase3' ? p.currentIndex : 0,
      total: p.phase === 'phase3' ? p.total : 0,
      inProgress: p.retrying ?? 0
    }
  }
}
