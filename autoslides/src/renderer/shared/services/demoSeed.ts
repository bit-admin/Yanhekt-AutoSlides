// Demo mode: seed the Task List and Download list with believable fake items so
// the right panel looks alive in screenshots. Nothing runs — we push directly
// into the services' reactive arrays (bypassing the queue processors), so no
// extraction or download is ever started. Called once from renderer.ts when
// `isDemoMode()` is true, after config load and before mount.

import { TaskQueue, type TaskItem } from './taskQueueService'
import { DownloadService, type DownloadItem } from './downloadService'
import { PostProcessingService, type PostProcessJob } from './postProcessingService'

let seeded = false

const MIN = 60_000

// A finished 3-phase post-processing job (all bars complete).
function completedJob(id: string, taskId: string, total: number, dup: number, exc: number, ai: number, mode: 'llm' | 'ml'): PostProcessJob {
  const now = Date.now()
  return {
    id,
    taskId,
    outputPath: `~/Downloads/AutoSlides/slides_${taskId}`,
    imageFiles: [],
    status: 'completed',
    progress: { phase: 'completed', currentIndex: total, total, duplicatesRemoved: dup, excludedRemoved: exc, aiFiltered: ai, failed: 0, retrying: 0 },
    errors: [],
    createdAt: now - 8 * MIN,
    startedAt: now - 7 * MIN,
    completedAt: now - 6 * MIN,
    classifierMode: mode,
  }
}

export function seedDemoQueues(): void {
  if (seeded) return
  if (TaskQueue.tasks.length || DownloadService.downloadItems.length) return
  seeded = true

  const now = Date.now()

  // --- Task list -----------------------------------------------------------
  PostProcessingService.jobs.push(
    completedJob('demo-pp-task-1', 'demo-task-1', 38, 4, 1, 3, 'llm'),
  )

  const tasks: TaskItem[] = [
    {
      id: 'demo-task-1',
      name: 'Functional Analysis · Lecture 9',
      courseTitle: 'Functional Analysis',
      sessionTitle: 'Lecture 9: Orthonormal Bases',
      sessionId: 'math-501-session-9',
      courseId: 'math-501',
      status: 'completed',
      progress: 100,
      createdAt: now - 9 * MIN,
      startedAt: now - 8 * MIN,
      completedAt: now - 6 * MIN,
      postProcessJobId: 'demo-pp-task-1',
      outputPath: '~/Downloads/AutoSlides/slides_math-501-session-9',
    },
    {
      id: 'demo-task-2',
      name: 'Real Analysis · Lecture 11',
      courseTitle: 'Real Analysis',
      sessionTitle: 'Lecture 11: Compactness',
      sessionId: 'math-401-session-11',
      courseId: 'math-401',
      status: 'in_progress',
      progress: 63,
      createdAt: now - 5 * MIN,
      startedAt: now - 3 * MIN,
    },
    {
      id: 'demo-task-3',
      name: 'Abstract Algebra · Lecture 8',
      courseTitle: 'Abstract Algebra',
      sessionTitle: 'Lecture 8: Quotient Groups',
      sessionId: 'math-402-session-8',
      courseId: 'math-402',
      status: 'queued',
      progress: 0,
      createdAt: now - 2 * MIN,
    },
  ]
  TaskQueue.tasks.push(...tasks)

  // --- Download list -------------------------------------------------------
  // A completed download that was auto-extracted by the C++ extractor, with its
  // post-processing finished (shows the extraction row + 3-phase panel).
  PostProcessingService.jobs.push(
    completedJob('demo-pp-dl-4', 'demo-dl-4', 51, 6, 0, 4, 'ml'),
  )

  const downloads: DownloadItem[] = [
    {
      id: 'demo-dl-1',
      name: 'Functional Analysis · Lecture 12 — Screen',
      courseTitle: 'Functional Analysis',
      sessionTitle: 'Lecture 12: Spectral Theory',
      sessionId: 'math-501-session-12',
      videoType: 'screen',
      status: 'completed',
      progress: 100,
      addedAt: now - 12 * MIN,
      completedAt: now - 10 * MIN,
    },
    {
      id: 'demo-dl-2',
      name: 'Functional Analysis · Lecture 12 — Camera',
      courseTitle: 'Functional Analysis',
      sessionTitle: 'Lecture 12: Spectral Theory',
      sessionId: 'math-501-session-12',
      videoType: 'camera',
      status: 'downloading',
      progress: 47,
      addedAt: now - 4 * MIN,
      startedAt: now - 3 * MIN,
    },
    {
      id: 'demo-dl-3',
      name: 'Real Analysis · Lecture 11 — Screen',
      courseTitle: 'Real Analysis',
      sessionTitle: 'Lecture 11: Compactness',
      sessionId: 'math-401-session-11',
      videoType: 'screen',
      status: 'queued',
      progress: 0,
      addedAt: now - 1 * MIN,
    },
    {
      id: 'demo-dl-4',
      name: 'Complex Analysis · Lecture 9 — Screen',
      courseTitle: 'Complex Analysis',
      sessionTitle: 'Lecture 9: The Residue Theorem',
      sessionId: 'math-410-session-9',
      videoType: 'screen',
      status: 'completed',
      progress: 100,
      addedAt: now - 15 * MIN,
      completedAt: now - 13 * MIN,
      extractionStatus: 'completed',
      extractionProgress: 100,
      slidesDir: '~/Downloads/AutoSlides/slides_math-410-session-9',
      postProcessJobId: 'demo-pp-dl-4',
    },
  ]
  DownloadService.downloadItems.push(...downloads)
}
