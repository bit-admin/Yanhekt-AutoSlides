// Issue #45: a lecture that is already done is skipped when it is queued
// again, unless the student asks for a fresh run. "Done" depends on what the
// queue would do:
//
//   - Add to Tasks (built-in extraction): the lecture has a finished
//     extraction (metadata.json records one and the folder has slides).
//   - Screen download that the Qt Extractor will extract: the same. A video
//     that exists without a finished extraction is not downloaded again; the
//     row uses that file and goes straight to extraction.
//   - Any other download: the file already exists.
//
// A fresh run moves the old slides folder (with its trash and crop backups),
// or the old file, to the system trash first, so the Extractor never appends
// to an old timeline.json. Share records follow the lecture to its new folder
// (main keeps them); upload records do not.
import type { LectureOutputState } from '@common/lectureOutputs'
import { buildDownloadFileName } from './downloadNaming'
import { ExtractionQueue } from './extractionQueueService'

export type QueueKind = 'task' | 'camera' | 'screen' | 'audio'

export interface GateLecture {
  key: string
  courseId?: string
  sessionId: string
  /** The finished file's name in the output folder, for downloads. */
  videoFile?: string
}

/** How to enqueue: download the stream, or use the video already on disk. */
export type EnqueueMode = 'download' | 'existing'

export type GateDecision =
  | { action: 'queue'; mode: EnqueueMode }
  | { action: 'skip'; reason: 'extracted' | 'downloaded' }

export function decideQueue(kind: QueueKind, extracts: boolean, state: LectureOutputState | undefined): GateDecision {
  const extracted = !!state?.slides?.extracted
  if (kind === 'task') return extracted ? { action: 'skip', reason: 'extracted' } : { action: 'queue', mode: 'download' }
  if (kind === 'screen' && extracts) {
    if (extracted) return { action: 'skip', reason: 'extracted' }
    return { action: 'queue', mode: state?.videoExists ? 'existing' : 'download' }
  }
  return state?.videoExists ? { action: 'skip', reason: 'downloaded' } : { action: 'queue', mode: 'download' }
}

/** What a fresh run moves aside, and how it then enqueues. */
export function redoPlan(
  reason: 'extracted' | 'downloaded',
  kind: QueueKind,
  lecture: GateLecture,
  state: LectureOutputState | undefined,
): { retire: { slidesFolders: string[]; videoFiles: string[] }; mode: EnqueueMode } {
  if (reason === 'downloaded') {
    return { retire: { slidesFolders: [], videoFiles: lecture.videoFile ? [lecture.videoFile] : [] }, mode: 'download' }
  }
  return {
    retire: { slidesFolders: [...(state?.slides?.folders ?? [])], videoFiles: [] },
    // A re-extraction keeps the video it already has.
    mode: kind === 'screen' && state?.videoExists ? 'existing' : 'download',
  }
}

type Translate = (key: string, params?: Record<string, unknown>) => string

/** The facts a student weighs before re-extracting, one per line. */
export function describeExisting(t: Translate, reason: 'extracted' | 'downloaded', state: LectureOutputState | undefined): string {
  const slides = state?.slides
  if (reason === 'downloaded' || !slides) return t('lectureOutputs.downloadAgainDetail')
  const lines = [t('lectureOutputs.slideCount', { count: slides.slideCount })]
  if (slides.cropped) lines.push(t('lectureOutputs.cropped'))
  if (slides.reviewed || slides.edited) lines.push(t('lectureOutputs.reviewed'))
  if (slides.uploaded > 0) lines.push(t('lectureOutputs.uploaded', { count: slides.uploaded }))
  if (slides.shares > 0) lines.push(t('lectureOutputs.shares', { count: slides.shares }))
  if (slides.slideVideo) lines.push(t('lectureOutputs.slideVideo'))
  lines.push('', t('lectureOutputs.reextractDetail'))
  return lines.join('\n')
}

export interface GateDeps<R extends { added: boolean }> {
  t: Translate
  /** Whether a screen download queued now would be extracted afterwards. */
  willAutoExtract: () => Promise<boolean>
  probe: (lectures: GateLecture[]) => Promise<LectureOutputState[]>
  retire: (target: { slidesFolders: string[]; videoFiles: string[] }) => Promise<{ removed: number; failed: number }>
  ask: (options: { title: string; message: string; detail?: string; buttons: string[]; defaultId: number; cancelId: number }) => Promise<number>
  enqueue: (lecture: GateLecture, mode: EnqueueMode) => R
  /** The queue row this lecture would replace: still running, or finished. */
  queue: GateQueue
}

/** What a fresh run needs from the queue it goes into. */
export interface GateQueue {
  /** A row for this lecture will still write, so its output must not be moved. */
  isBusy: (lecture: GateLecture) => boolean
  /** Remove this lecture's finished rows; they would refuse the new attempt. */
  dropFinished: (lecture: GateLecture) => void
}

async function stateOf<R extends { added: boolean }>(deps: GateDeps<R>, lecture: GateLecture): Promise<LectureOutputState | undefined> {
  try {
    return (await deps.probe([lecture]))[0]
  } catch {
    // Cannot tell: queue as before rather than block the student.
    return undefined
  }
}

/**
 * One lecture: queue it, or ask Skip / Re-extract (Download Again) when it is
 * already done. Null = skipped, or the old outputs could not be moved.
 */
export async function gateOne<R extends { added: boolean }>(
  deps: GateDeps<R>,
  kind: QueueKind,
  lecture: GateLecture,
): Promise<R | null> {
  const extracts = kind === 'screen' && await deps.willAutoExtract()
  const state = await stateOf(deps, lecture)
  const decision = decideQueue(kind, extracts, state)
  if (decision.action === 'queue') return deps.enqueue(lecture, decision.mode)

  const { t } = deps
  const again = decision.reason === 'extracted' ? t('lectureOutputs.reextract') : t('lectureOutputs.downloadAgain')
  const answer = await deps.ask({
    title: decision.reason === 'extracted' ? t('lectureOutputs.extractedTitle') : t('lectureOutputs.downloadedTitle'),
    message: decision.reason === 'extracted' ? t('lectureOutputs.extractedMessage') : t('lectureOutputs.downloadedMessage'),
    detail: describeExisting(t, decision.reason, state),
    buttons: [t('lectureOutputs.skip'), again],
    defaultId: 0,
    cancelId: 0,
  })
  if (answer !== 1) return null
  const outcome = await redo(deps, decision.reason, kind, lecture, state)
  if (outcome.status === 'queued') return outcome.result
  await deps.ask({
    title: t('lectureOutputs.redoFailedTitle'),
    message: t(REDO_PROBLEM[outcome.status], { count: 1 }),
    buttons: [t('lectureOutputs.ok')],
    defaultId: 0,
    cancelId: 0,
  })
  return null
}

type RedoOutcome<R> =
  | { status: 'queued'; result: R }
  /** Still in the queue: nothing was moved. */
  | { status: 'busy' }
  /** The old output could not be moved, so nothing was queued. */
  | { status: 'retire-failed' }
  /** The old output is in the system bin, but the new run was not queued. */
  | { status: 'not-queued' }

const REDO_PROBLEM = {
  busy: 'lectureOutputs.redoBusy',
  'retire-failed': 'lectureOutputs.retireFailed',
  'not-queued': 'lectureOutputs.redoNotQueued',
} as const

// A redo holds its lecture from before the move until the new row exists, so
// a second click cannot move or queue the same output meanwhile.
const redoing = new Set<string>()

async function redo<R extends { added: boolean }>(
  deps: GateDeps<R>,
  reason: 'extracted' | 'downloaded',
  kind: QueueKind,
  lecture: GateLecture,
  state: LectureOutputState | undefined,
): Promise<RedoOutcome<R>> {
  const slot = `${kind}:${lecture.key}`
  if (redoing.has(slot) || deps.queue.isBusy(lecture)) return { status: 'busy' }
  redoing.add(slot)
  try {
    const plan = redoPlan(reason, kind, lecture, state)
    const moved = await deps.retire(plan.retire).catch(() => null)
    if (!moved || moved.failed > 0) return { status: 'retire-failed' }
    deps.queue.dropFinished(lecture)
    const result = deps.enqueue(lecture, plan.mode)
    return result.added ? { status: 'queued', result } : { status: 'not-queued' }
  } catch {
    return { status: 'not-queued' }
  } finally {
    redoing.delete(slot)
  }
}

export interface GateManyResult {
  added: number
  /** Already in the queue. */
  queued: number
  /** Already done and left alone. */
  skipped: number
  /** Already done, then redone at the student's request. */
  redone: number
  /** Could not be moved aside, so not redone. */
  failed: number
  /** Still in the queue, so left unchanged. */
  busy: number
  /** Moved to the system bin, but the new run was not queued. */
  notQueued: number
}

/**
 * Many lectures: queue the ones that are not done without asking, then one
 * summary that offers to redo the skipped ones.
 */
export async function gateMany<R extends { added: boolean }>(
  deps: GateDeps<R>,
  kind: QueueKind,
  lectures: GateLecture[],
  summary: (result: GateManyResult) => { title: string; message: string },
): Promise<GateManyResult> {
  const extracts = kind === 'screen' && await deps.willAutoExtract()
  let states: LectureOutputState[] = []
  try {
    states = await deps.probe(lectures)
  } catch { /* cannot tell: queue everything as before */ }
  const byKey = new Map(states.map((s) => [s.key, s]))

  const result: GateManyResult = { added: 0, queued: 0, skipped: 0, redone: 0, failed: 0, busy: 0, notQueued: 0 }
  const skipped: Array<{ lecture: GateLecture; reason: 'extracted' | 'downloaded' }> = []
  for (const lecture of lectures) {
    const decision = decideQueue(kind, extracts, byKey.get(lecture.key))
    if (decision.action === 'skip') {
      skipped.push({ lecture, reason: decision.reason })
      continue
    }
    if (deps.enqueue(lecture, decision.mode).added) result.added++
    else result.queued++
  }
  result.skipped = skipped.length
  if (skipped.length === 0) return result

  const { t } = deps
  const extractedSkips = skipped.some((s) => s.reason === 'extracted')
  const text = summary(result)
  const answer = await deps.ask({
    title: text.title,
    message: text.message,
    detail: t(extractedSkips ? 'lectureOutputs.batchReextractDetail' : 'lectureOutputs.batchDownloadAgainDetail', { count: skipped.length }),
    buttons: [t('lectureOutputs.ok'), t(extractedSkips ? 'lectureOutputs.reextractThese' : 'lectureOutputs.downloadTheseAgain')],
    defaultId: 0,
    cancelId: 0,
  })
  if (answer !== 1) return result

  for (const { lecture, reason } of skipped) {
    const outcome = await redo(deps, reason, kind, lecture, byKey.get(lecture.key))
    result.skipped--
    if (outcome.status === 'queued') result.redone++
    else if (outcome.status === 'busy') result.busy++
    else if (outcome.status === 'retire-failed') result.failed++
    else result.notQueued++
  }
  return result
}

// ── App wiring ──────────────────────────────────────────────────────────────

/** The finished file of a download row, as the downloader names it. */
export function downloadFileOf(
  item: { name: string; courseId?: string; sessionId?: string },
  videoType: Exclude<QueueKind, 'task'>,
): string {
  return `${buildDownloadFileName(item)}.${videoType === 'audio' ? 'aac' : 'mp4'}`
}

/** A download row's runner that keeps the video already on disk (it then extracts as usual). */
export const keepExistingVideo = async (): Promise<void> => {}

/** Words for the redo outcomes a batch reports after its summary dialog. */
export function describeRedoProblems(t: Translate, result: GateManyResult): string[] {
  return [
    result.failed > 0 ? t(REDO_PROBLEM['retire-failed'], { count: result.failed }) : '',
    result.busy > 0 ? t(REDO_PROBLEM.busy, { count: result.busy }) : '',
    result.notQueued > 0 ? t(REDO_PROBLEM['not-queued'], { count: result.notQueued }) : '',
  ].filter(Boolean)
}

/** The gate's real dependencies: main for state and the trash, the app dialog for questions. */
export function appGateDeps<R extends { added: boolean }>(
  t: Translate,
  enqueue: (lecture: GateLecture, mode: EnqueueMode) => R,
  queue: GateQueue,
): GateDeps<R> {
  return {
    t,
    enqueue,
    queue,
    willAutoExtract: () => ExtractionQueue.willAutoExtract(),
    probe: (lectures) => window.electronAPI.lectureOutputs.probe(lectures.map((l) => ({
      key: String(l.key),
      courseId: l.courseId != null ? String(l.courseId) : undefined,
      sessionId: String(l.sessionId),
      videoFile: l.videoFile,
    }))),
    retire: (target) => window.electronAPI.lectureOutputs.retire(target),
    ask: async (options) => (await window.electronAPI.dialog.showMessageBox({ type: 'question', noLink: true, ...options })).response,
  }
}
