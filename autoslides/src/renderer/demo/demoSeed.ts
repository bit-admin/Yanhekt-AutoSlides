// Demo mode: seed the Task List and Download list with believable fake items so
// the right panel looks alive in screenshots. Nothing runs — we push directly
// into the services' reactive arrays (bypassing the queue processors), so no
// extraction or download is ever started. Called once from the demo bootstrap
// (./bootstrap.ts) when `isDemoMode()` is true, after config load and before mount.

import { watch } from 'vue'
import { TaskQueue, type TaskItem } from '@shared/services/taskQueueService'
import { DownloadService, type DownloadItem } from '@shared/services/downloadService'
import { PostProcessingService, type PostProcessJob } from '@shared/services/postProcessingService'
import { tabStore } from '@features/course/tabStore'
import { seedWatchNoteEntry } from '@features/cloudNotes/watchNotesStore'
import { EDITORJS_DOC_VERSION } from '@common/notesTypes'
import { demoResultImageDataUri, demoSessionId } from './demoData'

let seeded = false
let watchNotesSeeded = false

const MIN = 60_000

// A finished 3-phase post-processing job (all bars complete).
function completedJob(id: string, taskId: string, total: number, dup: number, exc: number, ai: number, aiEdit: number, mode: 'llm' | 'ml'): PostProcessJob {
  const now = Date.now()
  return {
    id,
    taskId,
    outputPath: `~/Downloads/AutoSlides/slides_${taskId}`,
    imageFiles: [],
    status: 'completed',
    progress: {
      phase: 'completed',
      currentIndex: total,
      total,
      duplicatesRemoved: dup,
      excludedRemoved: exc,
      aiFiltered: ai,
      aiFilteredEdit: aiEdit,
      failed: 0,
      retrying: 0,
    },
    errors: [],
    createdAt: now - 8 * MIN,
    startedAt: now - 7 * MIN,
    completedAt: now - 6 * MIN,
    classifierMode: mode,
  }
}

export function seedDemoQueues(): void {
  seedWatchNotesForOpenTabs()
  if (seeded) return
  if (TaskQueue.tasks.length || DownloadService.downloadItems.length) {
    seeded = true
    return
  }
  seeded = true

  const now = Date.now()

  // --- Task list -----------------------------------------------------------
  PostProcessingService.jobs.push(
    completedJob('demo-pp-task-1', 'demo-task-1', 38, 4, 1, 3, 1, 'llm'),
  )

  const tasks: TaskItem[] = [
    {
      id: 'demo-task-1',
      name: 'Functional Analysis · Lecture 9',
      courseTitle: 'Functional Analysis',
      sessionTitle: 'Lecture 9: Orthonormal Bases',
      sessionId: demoSessionId('501', 9),
      courseId: '501',
      status: 'completed',
      progress: 100,
      createdAt: now - 9 * MIN,
      startedAt: now - 8 * MIN,
      completedAt: now - 6 * MIN,
      postProcessJobId: 'demo-pp-task-1',
      outputPath: '~/Downloads/AutoSlides/slides_Functional Analysis - Lecture 9__c501s50109',
    },
    {
      id: 'demo-task-2',
      name: 'Real Analysis · Lecture 11',
      courseTitle: 'Real Analysis',
      sessionTitle: 'Lecture 11: Compactness',
      sessionId: demoSessionId('401', 11),
      courseId: '401',
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
      sessionId: demoSessionId('402', 8),
      courseId: '402',
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
    completedJob('demo-pp-dl-4', 'demo-dl-4', 51, 6, 0, 4, 2, 'ml'),
  )

  const downloads: DownloadItem[] = [
    {
      id: 'demo-dl-1',
      name: 'Functional Analysis · Lecture 12 — Screen',
      courseTitle: 'Functional Analysis',
      sessionTitle: 'Lecture 12: Spectral Theory',
      sessionId: demoSessionId('501', 12),
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
      sessionId: demoSessionId('501', 12),
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
      sessionId: demoSessionId('401', 11),
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
      sessionId: demoSessionId('410', 9),
      videoType: 'screen',
      status: 'completed',
      progress: 100,
      addedAt: now - 15 * MIN,
      completedAt: now - 13 * MIN,
      extractionStatus: 'completed',
      extractionProgress: 100,
      slidesDir: '~/Downloads/AutoSlides/slides_Complex Analysis - Lecture 9__c410s41009',
      postProcessJobId: 'demo-pp-dl-4',
    },
  ]
  DownloadService.downloadItems.push(...downloads)
}

function seedWatchNotesForOpenTabs(): void {
  if (watchNotesSeeded) return
  watchNotesSeeded = true
  watch(
    () => tabStore.state.tabs.map((t) => t.id).join(','),
    () => {
      for (const tab of tabStore.state.tabs) {
        if (tab.origin !== 'manual') continue
        seedWatchNoteEntry({
          tabId: tab.id,
          instanceId: `demo-${tab.id}`,
          noteId: 108,
          displayName: tab.title || 'Functional Analysis · Lecture 9',
          content: {
            time: Date.now(),
            version: EDITORJS_DOC_VERSION,
            blocks: [
              {
                type: 'header',
                data: { text: tab.title || 'Functional Analysis · Lecture 9', level: 2 },
              },
              {
                type: 'paragraph',
                data: { text: 'Slides captured while watching. Yanhekt stores note images in public storage.' },
              },
              {
                type: 'image',
                data: {
                  file: { url: demoResultImageDataUri({ name: 'Slide_001.png' }) },
                  caption: 'Slide 1',
                  withBorder: false,
                  stretched: false,
                  withBackground: false,
                },
              },
              {
                type: 'image',
                data: {
                  file: { url: demoResultImageDataUri({ name: 'Slide_002.png' }) },
                  caption: 'Slide 2',
                  withBorder: false,
                  stretched: false,
                  withBackground: false,
                },
              },
            ],
          },
        })
      }
    },
    { immediate: true },
  )
}
