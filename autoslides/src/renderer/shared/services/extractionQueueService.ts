// Public facade for the extraction queue. The orchestration logic (worker loop,
// IPC, the single-writer state machine) lives in
// @shared/orchestration/extractionOrchestrator — this module just exposes the
// singleton so existing consumers (DownloadService, DownloadQueuePanel,
// useExtractorSettings) keep importing `ExtractionQueue` from here unchanged.
import { ExtractionOrchestrator } from '@shared/orchestration/extractionOrchestrator'

export type { ExtractionStatus } from './downloadService'

export const ExtractionQueue = new ExtractionOrchestrator()
