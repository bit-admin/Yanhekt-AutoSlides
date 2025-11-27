// Types for PlaybackPage and related composables

export interface Course {
  id: string
  title: string
  instructor: string
  time: string
  status?: number
  subtitle?: string
  schedule_started_at?: string
  schedule_ended_at?: string
  participant_count?: number
  session?: {
    professor?: {
      name: string
    }
    section_group_title?: string
  }
  target?: string // Camera stream URL
  target_vga?: string // Screen stream URL
  // Record mode specific fields
  professors?: string[]
  classrooms?: { name: string }[]
  school_year?: string
  semester?: string
  college_name?: string
}

export interface Session {
  id: string
  session_id: string
  video_id: string
  title: string
  duration: number
  week_number: number
  day: number
  started_at: string
  ended_at: string
  main_url?: string
  vga_url?: string
}

export interface VideoStream {
  type: 'camera' | 'screen'
  name: string
  url: string
  original_url: string
}

export interface PlaybackData {
  session_id?: string
  stream_id?: string
  video_id?: string
  title: string
  duration?: string
  streams: { [key: string]: VideoStream }
}

export interface AIFilteringError {
  type: 'none' | '403' | '413' | 'http' | 'unknown'
  httpCode?: number
  message?: string
}

export interface PostProcessStatus {
  isProcessing: boolean
  currentPhase: 'idle' | 'phase1' | 'phase2' | 'phase3' | 'completed'
  currentIndex: number
  totalCount: number
  duplicatesRemoved: number
  excludedRemoved: number
  aiFiltered: number
  phase1Skipped: boolean
  phase2Skipped: boolean
  phase3Skipped: boolean
}

export interface SlideExtractionStatus {
  isRunning: boolean
  slideCount: number
  verificationState: string
  currentVerification: number
}

// Post-processing related types
export interface SlideHash {
  slide: import('../services/slideExtractor').ExtractedSlide
  filename: string
  pHash: string
  error?: string
}

export interface DuplicateInfo {
  slide: import('../services/slideExtractor').ExtractedSlide
  filename: string
  pHash: string
  duplicateOf: string
}

export interface PostProcessingConfig {
  pHashThreshold: number
  enableDuplicateRemoval: boolean
  enableExclusionList: boolean
  enableAIFiltering: boolean
  exclusionList: Array<{ name: string; pHash: string }>
}

// Props type for PlaybackPage
export interface PlaybackPageProps {
  course: Course | null
  session?: Session | null
  mode: 'live' | 'recorded'
  streamId?: string
  sessionId?: string
  isVisible?: boolean
}
