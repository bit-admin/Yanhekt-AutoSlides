// Work that writes into the output folder, counted by the renderer, which owns
// every queue (downloads, the Extractor runs that follow them, tasks,
// post-processing, Lectures slide videos) and every running extraction. Changing the output folder is
// refused while any of it is unfinished: a job fixes its folder at different
// moments (a download when it starts, its Extractor run when it was queued, a
// cleanup when it runs), so a change in between splits one lecture across two
// folders or leaves temp files behind.
//
// IPC drops custom error fields, so a refusal crosses as a marker in the
// message (same idea as `sessionLookupProblem.ts`), with the counts as JSON.

export interface OutputFolderWork {
  /** Download panel rows not finished yet, and rows whose Extractor run is pending or running. */
  downloads: number
  /** Extractions running in a player tab or Web Capture. */
  extractions: number
  /** Tasks queued or running. */
  tasks: number
  /** Post-processing jobs queued or running. */
  postProcessing: number
  /** Lectures slide videos queued or being made (written beside their slides folders). */
  slideVideos: number
}

export const NO_OUTPUT_FOLDER_WORK: OutputFolderWork = { downloads: 0, extractions: 0, tasks: 0, postProcessing: 0, slideVideos: 0 }

/** How many unfinished things the counts add up to. */
export const outputFolderWorkTotal = (work: OutputFolderWork): number =>
  work.downloads + work.extractions + work.tasks + work.postProcessing + work.slideVideos

export const hasOutputFolderWork = (work: OutputFolderWork): boolean => outputFolderWorkTotal(work) > 0

const MARKER = 'AUTOSLIDES_OUTPUT_FOLDER_BUSY'

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`

/** English, for the command line and the log: "2 downloads and 1 extraction". */
export function describeOutputFolderWork(work: OutputFolderWork): string {
  const parts = [
    work.downloads && plural(work.downloads, 'download', 'downloads'),
    work.extractions && plural(work.extractions, 'extraction', 'extractions'),
    work.tasks && plural(work.tasks, 'task', 'tasks'),
    work.postProcessing && plural(work.postProcessing, 'post-processing job', 'post-processing jobs'),
    work.slideVideos && plural(work.slideVideos, 'slide video', 'slide videos'),
  ].filter((part): part is string => !!part)
  if (parts.length <= 1) return parts[0] ?? 'nothing'
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

export class OutputFolderBusyError extends Error {
  constructor(readonly work: OutputFolderWork) {
    super(`${MARKER}:${JSON.stringify(work)}: the output folder cannot change while ${describeOutputFolderWork(work)} ${
      outputFolderWorkTotal(work) === 1 ? 'is' : 'are'
    } unfinished`)
    this.name = 'OutputFolderBusyError'
  }
}

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0)

/** The counts when the error (raw or IPC-wrapped) is a refusal, else null. */
export function parseOutputFolderBusy(error: unknown): OutputFolderWork | null {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const match = new RegExp(`${MARKER}:(\\{[^}]*\\}):`).exec(message)
  if (!match) return null
  try {
    const raw = JSON.parse(match[1]) as Record<string, unknown>
    return {
      downloads: count(raw.downloads),
      extractions: count(raw.extractions),
      tasks: count(raw.tasks),
      postProcessing: count(raw.postProcessing),
      slideVideos: count(raw.slideVideos),
    }
  } catch {
    return null
  }
}
