// Demo mode: seed the Task List and Download list with believable fake items so
// the right panel looks alive in screenshots. Nothing runs — we push directly
// into the services' reactive arrays (bypassing the queue processors), so no
// extraction or download is ever started. Called once from the demo bootstrap
// (./bootstrap.ts) when `isDemoMode()` is true, after config load and before mount.

import { watch } from 'vue'
import { configStore } from '@shared/services/configStore'
import { TaskQueue, type TaskItem } from '@shared/services/taskQueueService'
import { DownloadService, type DownloadItem } from '@shared/services/downloadService'
import { PostProcessingService, type PostProcessJob } from '@shared/services/postProcessingService'
import { tabStore, type PlaybackTab } from '@features/course/tabStore'
import { seedWatchNoteEntry } from '@features/cloudNotes/watchNotesStore'
import type { WatchNoteEntry, WatchQueueItem, WatchQueueStatus } from '@features/cloudNotes/watchNotesTypes'
import { EDITORJS_DOC_VERSION, buildManagedNoteTitle } from '@common/notesTypes'
import type { LectureIdentity } from '@common/lectureNaming'
import type { WatchNotesProviderId } from '@common/watchNotesProviders'
import { demoGallerySlides, demoResultImageDataUri, demoSessionId } from './demoData'

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

// Which watch-notes provider the demo Notes tab shows. Yanhekt by default (the
// live editor); the screenshot script switches to Obsidian / Notion to capture
// the append queue, then back.
let demoWatchProvider: WatchNotesProviderId = 'yanhekt'

// Renderer-only config for the external providers, never persisted: the Notes
// panel reads these, and nothing is written through their bridges until a
// button is clicked. A config broadcast would reset them, so callers switch
// back to Yanhekt right after capturing.
const DEMO_VAULT_PATH = '/Users/kate/Documents/Mathematics'
const DEMO_NOTION_WORKSPACE = "Kate's Notion"

/** Switch the demo Notes tab to another provider and reseed every open watch tab. */
export function setDemoWatchNotesProvider(provider: WatchNotesProviderId): void {
  demoWatchProvider = provider
  configStore.watchNotesProvider = provider
  configStore.obsidianVaultPath = provider === 'obsidian' ? DEMO_VAULT_PATH : ''
  configStore.notionConnected = provider === 'notion'
  configStore.notionWorkspaceName = provider === 'notion' ? DEMO_NOTION_WORKSPACE : ''
  seedOpenTabs()
}

function seedWatchNotesForOpenTabs(): void {
  if (watchNotesSeeded) return
  watchNotesSeeded = true
  watch(() => tabStore.state.tabs.map((t) => t.id).join(','), seedOpenTabs, { immediate: true })
}

function seedOpenTabs(): void {
  for (const tab of tabStore.state.tabs) {
    if (tab.origin !== 'manual') continue
    seedWatchNoteEntry(demoWatchEntry(tab))
  }
}

function demoWatchEntry(tab: PlaybackTab): WatchNoteEntry {
  const displayName = tab.title || 'Functional Analysis · Lecture 9'
  // Same ids watchNotesStore derives for a recorded tab.
  const session = tab.session as { session_id?: string | number } | null
  const identity: LectureIdentity = { courseId: tab.course?.id, sessionId: session?.session_id ?? tab.sessionId }
  const base = {
    tabId: tab.id,
    instanceId: `demo-${tab.id}`,
    displayName,
    identity,
    slidesFolderName: 'slides_AutoSlides',
    status: 'ready' as const,
  }
  if (demoWatchProvider === 'obsidian') {
    const noteFile = `${buildManagedNoteTitle(displayName, identity)}.md`
    return {
      ...base,
      provider: 'obsidian',
      target: {
        notePath: `${DEMO_VAULT_PATH}/AutoSlides/${noteFile}`,
        displayPath: `AutoSlides/${noteFile}`,
        vaultPath: DEMO_VAULT_PATH,
        vaultName: 'Mathematics',
      },
      // Four in the note, one being written, one waiting behind it.
      items: demoQueueItems(['appended', 'appended', 'appended', 'appended', 'appending', 'queued']),
      paused: false,
      lastError: null,
    }
  }
  if (demoWatchProvider === 'notion') {
    return {
      ...base,
      provider: 'notion',
      target: {
        pageId: 'demo-notion-page',
        title: 'Functional Analysis',
        emoji: '📐',
        url: 'https://www.notion.so/demo',
      },
      // Paused by the student: three written, three waiting for Resume.
      items: demoQueueItems(['appended', 'appended', 'appended', 'queued', 'queued', 'queued']),
      paused: true,
      lastError: null,
    }
  }
  return {
    ...base,
    provider: 'yanhekt',
    noteId: 108,
    content: {
      time: Date.now(),
      version: EDITORJS_DOC_VERSION,
      blocks: [
        {
          type: 'header',
          data: { text: displayName, level: 2 },
        },
        {
          type: 'paragraph',
          data: { text: 'T is compact and self-adjoint, so it has an orthonormal eigenbasis. Eigenvalues can accumulate only at 0.' },
        },
        {
          type: 'image',
          data: {
            file: { url: demoResultImageDataUri({ name: 'Slide_001.png' }) },
            caption: 'Spectral theorem — compact self-adjoint',
            withBorder: false,
            stretched: false,
            withBackground: false,
          },
        },
        {
          type: 'paragraph',
          data: { text: 'The operator norm equals the spectral radius: ‖T‖ = supₙ |λₙ|. Proof sketch: pick the eigenvector for the largest |λ|.' },
        },
        {
          type: 'image',
          data: {
            file: { url: demoResultImageDataUri({ name: 'Slide_002.png' }) },
            caption: 'Operator norm as max |λ|',
            withBorder: false,
            stretched: false,
            withBackground: false,
          },
        },
      ],
    },
  }
}

// Queue rows over the gallery's slides, in capture order, a few minutes apart.
function demoQueueItems(statuses: WatchQueueStatus[]): WatchQueueItem[] {
  const slides = demoGallerySlides()
  const start = Date.now() - statuses.length * 4 * MIN
  return statuses.map((status, i) => ({
    id: 9000 + i,
    index: i + 1,
    pngFilename: `Slide_${String(i + 1).padStart(3, '0')}.png`,
    status,
    thumb: slides[i % slides.length].dataUrl,
    queuedAt: start + i * 4 * MIN,
  }))
}
