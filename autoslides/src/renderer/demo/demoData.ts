// Demo mode: fabricated account + course data for clean screenshots.
//
// Enabled by launching with `npm run demo` (sets DEMO_MODE=1, read in the
// preload as `window.electronAPI.isDemoMode`). The demo bootstrap
// (./bootstrap.ts) registers these factories into the generic override registry
// (@shared/overrideRegistry), so the renderer renders as a made-up Math student
// ("Kate") with a believable course list. Nothing here is persisted, and no
// production code imports this file — the dependency points the other way.

import type {
  UserData,
  SemesterOption,
  CourseData,
  CourseListResponse,
  LiveStream,
  LiveListResponse,
  SessionData,
  CourseInfoResponse,
} from '@shared/services/apiClient'
import type {
  EditorJsBlock,
  NoteGroup,
  NoteSummary,
  NoteDetail,
  NoteListResult,
  IndexStats,
  IndexLecture,
  IndexVersion,
  IndexRecentFile,
  IndexLectureDetail,
  ShareImportResult,
} from '@common/notesTypes'
import {
  MANAGED_GROUP_NAME,
  USER_GROUP_NAME,
  README_NOTE_TITLE,
  EDITORJS_DOC_VERSION,
  buildManagedNoteTitle,
  managedNoteDisplayName,
} from '@common/notesTypes'
import type { SlideMetadata } from '@common/slideMetadataTypes'
import { SLIDE_METADATA_VERSION } from '@common/slideMetadataTypes'
import type { SlideTimeline } from '@common/sidecars'
import { SLIDE_TIMELINE_VERSION } from '@common/sidecars'
import type { StoredAccount } from '@common/types'

export const DEMO_TOKEN = 'DEMO_MODE_TOKEN'

export const DEMO_USER_BADGE = '2022140137'

export function demoUser(): UserData {
  return {
    badge: DEMO_USER_BADGE,
    nickname: 'Kate',
    gender: 2,
  }
}

/** Extra remembered accounts so the AccountSwitcher flyout is populated. */
export function demoStoredAccounts(): StoredAccount[] {
  const now = Date.now()
  return [
    {
      badge: '2021140888',
      nickname: 'Alex Chen',
      displayName: 'Alex Chen',
      token: 'DEMO_MODE_TOKEN_ALEX',
      addedAt: now - 14 * 24 * 60 * 60 * 1000,
      lastUsedAt: now - 3 * 24 * 60 * 60 * 1000,
    },
    {
      badge: '2019140221',
      nickname: 'Jordan Park',
      displayName: 'Jordan Park',
      token: 'DEMO_MODE_TOKEN_JORDAN',
      addedAt: now - 40 * 24 * 60 * 60 * 1000,
      lastUsedAt: now - 10 * 24 * 60 * 60 * 1000,
    },
  ]
}

/** Digit-only session id: course 501 week 9 → `50109`. Required by parseLectureIds. */
export function demoSessionId(courseId: string, week: number): string {
  return `${courseId}${String(week).padStart(2, '0')}`
}

// Greeting name. The real greeting reads config.userDisplayName /
// userOriginalNickname (persisted from the real account) — in demo mode that
// would leak the real student's name, so useGreeting substitutes this instead.
export const DEMO_DISPLAY_NAME = 'Kate'

// Home page "Saved Courses" cards. The real values live in
// config.savedSearchesLive / savedSearchesRecorded, but demo mode loads the
// real (possibly empty) config, so savedSearches.ts short-circuits to these.
export function demoSavedSearchesLive(): string[] {
  return ['Functional Analysis', 'Complex Analysis']
}

export function demoSavedSearchesRecorded(): string[] {
  return ['Real Analysis', 'Abstract Algebra', 'Topology']
}

// Pinned recorded courses (sidebar Pinned list + Home pinned cards). ids match
// DEMO_COURSES so opening a pinned card lands on a real demo sessions page.
export function demoPinnedCourses(): Array<{ id: string; title: string }> {
  return [
    { id: '501', title: 'Functional Analysis' },
    { id: '505', title: 'Point-Set Topology' },
  ]
}

export function demoSemesters(): SemesterOption[] {
  return [
    { id: 1, label: '2024-2025 Fall', labelEn: '2024-2025 Fall', schoolYear: 2024, semester: 1 },
    { id: 2, label: '2024-2025 Spring', labelEn: '2024-2025 Spring', schoolYear: 2024, semester: 2 },
    { id: 3, label: '2023-2024 Fall', labelEn: '2023-2024 Fall', schoolYear: 2023, semester: 1 },
  ]
}

const COLLEGE = 'School of Mathematical Sciences'

// Each entry: title, professor, room, semester ('1' Fall / '2' Spring), enrolled.
const DEMO_COURSES: Array<{
  id: string
  title: string
  professor: string
  room: string
  semester: string
  enrolled: number
}> = [
  { id: '501', title: 'Functional Analysis', professor: 'Dr. Helena Whitcombe', room: 'Science Hall 301', semester: '1', enrolled: 42 },
  { id: '401', title: 'Real Analysis', professor: 'Dr. Marcus Lindqvist', room: 'Science Hall 214', semester: '1', enrolled: 58 },
  { id: '402', title: 'Abstract Algebra', professor: 'Dr. Priya Narayan', room: 'Whitman Building 110', semester: '1', enrolled: 47 },
  { id: '505', title: 'Point-Set Topology', professor: 'Dr. Theo Brandt', room: 'Science Hall 305', semester: '2', enrolled: 36 },
  { id: '512', title: 'Measure Theory', professor: 'Dr. Helena Whitcombe', room: 'Science Hall 301', semester: '2', enrolled: 29 },
  { id: '410', title: 'Complex Analysis', professor: 'Dr. Sofia Renault', room: 'Whitman Building 204', semester: '2', enrolled: 51 },
  { id: '520', title: 'Differential Geometry', professor: 'Dr. Anton Vasiliev', room: 'Science Hall 218', semester: '1', enrolled: 33 },
  { id: '530', title: 'Partial Differential Equations', professor: 'Dr. Marcus Lindqvist', room: 'Engineering Annex 140', semester: '2', enrolled: 44 },
  { id: '460', title: 'Number Theory', professor: 'Dr. Priya Narayan', room: 'Whitman Building 110', semester: '1', enrolled: 39 },
  { id: '470', title: 'Probability Theory', professor: 'Dr. Sofia Renault', room: 'Science Hall 214', semester: '1', enrolled: 62 },
]

export function demoRecordedCourses(): CourseListResponse {
  const data: CourseData[] = DEMO_COURSES.map((c) => ({
    id: c.id,
    name_zh: c.title,
    professors: [c.professor],
    classrooms: [{ name: c.room }],
    school_year: '2024-2025',
    semester: c.semester,
    college_name: COLLEGE,
    participant_count: c.enrolled,
  }))

  return {
    data,
    current_page: 1,
    last_page: 1,
    per_page: data.length,
    total: data.length,
  }
}

// Build an ISO datetime relative to now, offset by `dayOffset` days, at a fixed hour.
function isoAt(dayOffset: number, hour: number, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export function demoLiveCourses(): LiveListResponse {
  const data: LiveStream[] = [
    {
      id: '50112',
      title: 'Functional Analysis — Lecture 12',
      subtitle: 'Spectral Theory of Compact Operators',
      status: 1, // live now
      schedule_started_at: isoAt(0, 10, 0),
      schedule_ended_at: isoAt(0, 11, 30),
      participant_count: 38,
      session: { course_id: '501', professor: { name: 'Dr. Helena Whitcombe' }, section_group_title: 'Science Hall 301' },
    },
    {
      id: '41009',
      title: 'Complex Analysis — Lecture 9',
      subtitle: 'The Residue Theorem',
      status: 2, // upcoming
      schedule_started_at: isoAt(0, 14, 0),
      schedule_ended_at: isoAt(0, 15, 30),
      participant_count: 0,
      session: { course_id: '410', professor: { name: 'Dr. Sofia Renault' }, section_group_title: 'Whitman Building 204' },
    },
    {
      id: '40111',
      title: 'Real Analysis — Lecture 11',
      subtitle: 'Sequences of Functions and Uniform Convergence',
      status: 0, // ended
      schedule_started_at: isoAt(-1, 9, 0),
      schedule_ended_at: isoAt(-1, 10, 30),
      participant_count: 55,
      session: { course_id: '401', professor: { name: 'Dr. Marcus Lindqvist' }, section_group_title: 'Science Hall 214' },
    },
  ]

  return {
    data,
    current_page: 1,
    last_page: 1,
    per_page: data.length,
    total: data.length,
  }
}

// Lecture-title pools keyed by course id so each course shows topical sessions.
const SESSION_TOPICS: Record<string, string[]> = {
  '501': [
    'Normed Vector Spaces', 'Banach Spaces', 'Bounded Linear Operators', 'The Hahn–Banach Theorem',
    'Dual Spaces', 'The Open Mapping Theorem', 'The Closed Graph Theorem', 'Hilbert Spaces',
    'Orthonormal Bases', 'The Riesz Representation Theorem', 'Compact Operators', 'Spectral Theory',
    'The Spectral Theorem', 'Applications to Integral Equations',
  ],
  '401': [
    'The Real Number System', 'Sequences and Limits', 'Series', 'Continuity', 'Differentiation',
    'The Riemann Integral', 'Sequences of Functions', 'Uniform Convergence', 'Power Series',
    'Metric Spaces', 'Compactness', 'Connectedness', 'The Stone–Weierstrass Theorem', 'Review',
  ],
}

const GENERIC_TOPICS = [
  'Foundations and Motivation', 'Core Definitions', 'Fundamental Theorems', 'Key Constructions',
  'Worked Examples', 'Structural Results', 'Advanced Techniques', 'Important Counterexamples',
  'Applications I', 'Applications II', 'Connections to Other Fields', 'Selected Topics',
  'Synthesis', 'Review and Outlook',
]

export function demoCourseInfo(courseId: string): CourseInfoResponse {
  const course = DEMO_COURSES.find((c) => c.id === courseId)
  const title = course?.title ?? 'Functional Analysis'
  const professor = course?.professor ?? 'Dr. Helena Whitcombe'
  const topics = SESSION_TOPICS[courseId] ?? GENERIC_TOPICS

  const videos: SessionData[] = topics.map((topic, i) => {
    const week = i + 1
    // Spread lectures back in time, one per week.
    const dayOffset = -(topics.length - i) * 7
    return {
      id: demoSessionId(courseId, week),
      session_id: demoSessionId(courseId, week),
      video_id: `${demoSessionId(courseId, week)}0`,
      title: `Lecture ${week}: ${topic}`,
      duration: 5400, // 90 minutes
      week_number: week,
      day: 2, // Tuesday
      started_at: isoAt(dayOffset, 10, 0),
      ended_at: isoAt(dayOffset, 11, 30),
      main_url: '',
      vga_url: '',
    }
  })

  return {
    course_id: courseId,
    title,
    professor,
    videos,
  }
}

// --- Fake playback surfaces ------------------------------------------------
// The demo player has no real video. We paint these SVGs onto the <video>
// poster so the playback page looks like a live screen-share (math solution)
// next to a camera feed (an illustrated lecturer).

const SCREEN_POSTER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#fbfbf9"/>
  <rect width="1280" height="92" fill="#1f2937"/>
  <text x="56" y="59" font-family="Georgia, serif" font-size="34" fill="#ffffff">Functional Analysis · Lecture 12</text>
  <text x="1224" y="59" text-anchor="end" font-family="Georgia, serif" font-size="22" fill="#9ca3af">Spectral Theory</text>
  <text x="56" y="178" font-family="Georgia, serif" font-size="40" fill="#111827">Spectral Theorem (compact, self-adjoint)</text>
  <line x1="56" y1="198" x2="742" y2="198" stroke="#2563eb" stroke-width="4"/>
  <text x="56" y="278" font-family="Georgia, serif" font-size="30" fill="#374151">Let  T : H → H  be compact and self-adjoint.</text>
  <text x="56" y="346" font-family="Georgia, serif" font-size="30" fill="#374151">∃ orthonormal basis  {eₙ}  with   T eₙ = λₙ eₙ ,   λₙ ∈ ℝ</text>
  <text x="56" y="414" font-family="Georgia, serif" font-size="30" fill="#374151">Eigenvalues accumulate only at 0:    λₙ → 0</text>
  <text x="56" y="500" font-family="Georgia, serif" font-size="30" fill="#374151">Spectral decomposition, for every  x ∈ H :</text>
  <text x="120" y="572" font-family="Georgia, serif" font-size="38" fill="#1d4ed8">T x  =  Σₙ λₙ ⟨x, eₙ⟩ eₙ</text>
  <text x="56" y="654" font-family="Georgia, serif" font-size="30" fill="#374151">Operator norm:    ‖T‖ = supₙ |λₙ| = max |λₙ|</text>
</svg>`

const CAMERA_POSTER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#eef2ff"/><stop offset="1" stop-color="#dbe2ff"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <rect x="150" y="64" width="980" height="356" rx="14" fill="#13524a"/>
  <rect x="150" y="64" width="980" height="356" rx="14" fill="none" stroke="#0e3f39" stroke-width="10"/>
  <text x="196" y="150" font-family="Georgia, serif" font-size="40" fill="#a7d3c9" opacity="0.75">‖Tx‖ ≤ ‖T‖·‖x‖</text>
  <text x="196" y="232" font-family="Georgia, serif" font-size="40" fill="#a7d3c9" opacity="0.6">⟨x, eₙ⟩</text>
  <line x1="196" y1="300" x2="540" y2="300" stroke="#a7d3c9" stroke-width="4" opacity="0.5"/>
  <rect x="0" y="600" width="1280" height="120" fill="#c4ccf5"/>
  <ellipse cx="640" cy="780" rx="240" ry="190" fill="#3b5bdb"/>
  <path d="M600 628 h80 l-12 70 h-56 z" fill="#dbe2ff" opacity="0.5"/>
  <rect x="612" y="468" width="56" height="80" rx="20" fill="#f1c6a7"/>
  <circle cx="640" cy="414" r="86" fill="#2f2620"/>
  <circle cx="640" cy="424" r="78" fill="#f3c9a9"/>
  <circle cx="616" cy="416" r="7" fill="#2b2b2b"/>
  <circle cx="664" cy="416" r="7" fill="#2b2b2b"/>
  <path d="M614 452 q26 22 52 0" stroke="#c08457" stroke-width="5" fill="none" stroke-linecap="round"/>
</svg>`

export function demoPosterDataUri(kind: 'screen' | 'camera'): string {
  const svg = kind === 'screen' ? SCREEN_POSTER_SVG : CAMERA_POSTER_SVG
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// --- Fake Results View / PDF Maker content ---------------------------------
// Demo mode also fakes the tools-window Results View (trash tab) and PDF Maker
// so screenshots show believable extracted slides without reading the real
// output directory. The renderer read sites (resultsDataLoader, useResultsView,
// useCropEditor, usePdfMaker) short-circuit to the factories below.
//
// Slides are drawn as SVGs (like the playback posters). Each SVG declares an
// explicit width/height so an <img> loading it reports a reliable
// naturalWidth/Height (1280×720) — the crop editor needs that for its math.

// Inner slide-canvas rect inside powerpointEditSvg(), in the 1280×720 space.
// Seeds the crop box so it frames the actual slide inside the PowerPoint chrome.
export const DEMO_EDIT_SLIDE_RECT = { x: 320, y: 150, width: 760, height: 470 }

const DEMO_OUTPUT_ROOT = '~/Downloads/AutoSlides'

function slideSvg(title: string, page: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#fbfbf9"/>
  <rect width="1280" height="92" fill="#1f2937"/>
  <text x="56" y="59" font-family="Georgia, serif" font-size="32" fill="#ffffff">Functional Analysis · Lecture 9</text>
  <text x="1224" y="59" text-anchor="end" font-family="Georgia, serif" font-size="22" fill="#9ca3af">${page}</text>
  <text x="56" y="184" font-family="Georgia, serif" font-size="44" fill="#111827">${title}</text>
  <line x1="56" y1="206" x2="720" y2="206" stroke="#2563eb" stroke-width="4"/>
  <text x="56" y="296" font-family="Georgia, serif" font-size="30" fill="#374151">Let  T : H → H  be a bounded linear operator.</text>
  <text x="56" y="364" font-family="Georgia, serif" font-size="30" fill="#374151">For all  x, y ∈ H :   ⟨T x, y⟩ = ⟨x, T* y⟩</text>
  <text x="56" y="432" font-family="Georgia, serif" font-size="30" fill="#374151">If  T = T*,  then  T  is self-adjoint.</text>
  <text x="120" y="540" font-family="Georgia, serif" font-size="38" fill="#1d4ed8">‖T‖ = sup₍‖x‖=1₎ ‖T x‖</text>
  <text x="56" y="628" font-family="Georgia, serif" font-size="26" fill="#6b7280">Spectrum  σ(T) ⊂ { λ : |λ| ≤ ‖T‖ }</text>
</svg>`
}

const SLIDE_TITLES: Array<[string, string]> = [
  ['Bounded Linear Operators', '3 / 14'],
  ['The Adjoint Operator', '5 / 14'],
  ['Self-Adjoint Operators', '7 / 14'],
  ['The Spectrum σ(T)', '9 / 14'],
  ['Compact Operators', '11 / 14'],
  ['Orthonormal Bases', '13 / 14'],
]

function slideByName(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  const [title, page] = SLIDE_TITLES[h % SLIDE_TITLES.length]
  return slideSvg(title, page)
}

// A non-slide frame: a projector/HDMI "NO SIGNAL" screen (faint colour bars).
function noSignalSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#0b0f17"/>
  <g opacity="0.16">
    <rect x="0" y="0" width="160" height="720" fill="#c0392b"/>
    <rect x="160" y="0" width="160" height="720" fill="#e67e22"/>
    <rect x="320" y="0" width="160" height="720" fill="#f1c40f"/>
    <rect x="480" y="0" width="160" height="720" fill="#2ecc71"/>
    <rect x="640" y="0" width="160" height="720" fill="#1ab9c4"/>
    <rect x="800" y="0" width="160" height="720" fill="#3498db"/>
    <rect x="960" y="0" width="160" height="720" fill="#9b59b6"/>
    <rect x="1120" y="0" width="160" height="720" fill="#7f8c8d"/>
  </g>
  <text x="640" y="372" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="88" font-weight="bold" fill="#e5e7eb" letter-spacing="8">NO SIGNAL</text>
  <text x="640" y="430" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#9ca3af">Check input source · HDMI 1</text>
</svg>`
}

// A slide shown inside PowerPoint's edit view (ribbon + thumbnail rail + the
// white slide canvas at DEMO_EDIT_SLIDE_RECT) — the may_be_slide_edit case.
function powerpointEditSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#f3f3f3"/>
  <rect x="0" y="0" width="1280" height="34" fill="#b7472a"/>
  <text x="640" y="23" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="15" fill="#ffffff">Lecture 09 — Functional Analysis.pptx  ·  PowerPoint</text>
  <rect x="0" y="34" width="1280" height="28" fill="#c75b3f"/>
  <text x="20" y="53" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#ffe9e2">File   Home   Insert   Draw   Design   Transitions   Animations   Slide Show   Review   View</text>
  <rect x="0" y="62" width="1280" height="74" fill="#efefef"/>
  <g fill="#cfcfcf">
    <rect x="20" y="78" width="44" height="44" rx="4"/>
    <rect x="80" y="78" width="44" height="44" rx="4"/>
    <rect x="140" y="78" width="30" height="44" rx="4"/>
    <rect x="186" y="78" width="30" height="44" rx="4"/>
    <rect x="232" y="78" width="30" height="44" rx="4"/>
  </g>
  <line x1="0" y1="136" x2="1280" y2="136" stroke="#d6d6d6" stroke-width="1"/>
  <rect x="0" y="136" width="150" height="584" fill="#e8e8e8"/>
  <g font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="#8a8a8a">
    <text x="14" y="170">1</text><rect x="30" y="156" width="104" height="58" fill="#ffffff" stroke="#cccccc"/>
    <text x="14" y="246">2</text><rect x="30" y="232" width="104" height="58" fill="#ffffff" stroke="#2563eb" stroke-width="2"/>
    <text x="14" y="322">3</text><rect x="30" y="308" width="104" height="58" fill="#ffffff" stroke="#cccccc"/>
    <text x="14" y="398">4</text><rect x="30" y="384" width="104" height="58" fill="#ffffff" stroke="#cccccc"/>
  </g>
  <rect x="150" y="136" width="1130" height="560" fill="#d9d9d9"/>
  <rect x="320" y="150" width="760" height="470" fill="#ffffff" stroke="#bdbdbd"/>
  <text x="360" y="232" font-family="Georgia, serif" font-size="40" fill="#111827">The Spectral Theorem</text>
  <line x1="360" y1="252" x2="800" y2="252" stroke="#2563eb" stroke-width="4"/>
  <text x="360" y="330" font-family="Georgia, serif" font-size="26" fill="#374151">• Compact self-adjoint  T  on a Hilbert space  H</text>
  <text x="360" y="382" font-family="Georgia, serif" font-size="26" fill="#374151">• Orthonormal eigenbasis {eₙ},  eigenvalues λₙ ∈ ℝ</text>
  <text x="360" y="434" font-family="Georgia, serif" font-size="26" fill="#374151">• λₙ → 0  as  n → ∞</text>
  <text x="400" y="524" font-family="Georgia, serif" font-size="34" fill="#1d4ed8">T x = Σₙ λₙ ⟨x, eₙ⟩ eₙ</text>
  <rect x="0" y="696" width="1280" height="24" fill="#b7472a"/>
  <text x="20" y="712" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#ffffff">Slide 2 of 4    English (United States)</text>
</svg>`
}

// Pick an SVG for a Results View item based on its removal reason / name.
// Accepts a minimal structural shape so this stays in `shared` without importing
// the `ResultsItem` type from `features/`.
export function demoResultImageDataUri(item: { reason?: string; name?: string }): string {
  let svg: string
  if (item.reason === 'ai_filtered_edit') svg = powerpointEditSvg()
  else if (item.reason === 'ai_filtered') svg = noSignalSvg()
  else if (item.reason === 'duplicate') svg = slideSvg('Compact Operators', '11 / 14')
  else svg = slideByName(item.name ?? '')
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// Fake extracted slides for the playback-page slide gallery (the screen-recording
// view). Reuses the slide SVGs. `timestamp` is an ISO string (the gallery renders
// it via formatSlideTime → toLocaleTimeString). `imageData` is a throwaway
// placeholder — the gallery shows `dataUrl`; imageData only matters to real
// extraction/post-processing, which never runs in demo mode.
export function demoGallerySlides(): Array<{
  id: string
  title: string
  timestamp: string
  imageData: ImageData
  dataUrl: string
  aiDecision: 'slide'
}> {
  const placeholder = new ImageData(2, 2)
  return SLIDE_TITLES.map(([title, page], i) => ({
    id: `demo-slide-${i + 1}`,
    title,
    timestamp: isoAt(0, 10, 6 + i * 7),
    imageData: placeholder,
    dataUrl: `data:image/svg+xml,${encodeURIComponent(slideSvg(title, page))}`,
    aiDecision: 'slide' as const,
  }))
}

// Folder list. English titles plus `__c<course>s<session>` so parseLectureIds
// (Lectures strip, managed titles) can match folders to sessions. The first
// folder is the "rich" one carrying the removed + cropped demo items.
function demoFolderName(title: string, week: number, courseId: string): string {
  return `slides_${title} - Lecture ${week}__c${courseId}s${demoSessionId(courseId, week)}`
}

const DEMO_RESULT_FOLDERS: Array<{
  name: string
  activeCount: number
  courseId: string
  week: number
  title: string
}> = [
  { name: demoFolderName('Functional Analysis', 9, '501'), activeCount: 5, courseId: '501', week: 9, title: 'Functional Analysis' },
  { name: demoFolderName('Functional Analysis', 10, '501'), activeCount: 4, courseId: '501', week: 10, title: 'Functional Analysis' },
  { name: demoFolderName('Real Analysis', 11, '401'), activeCount: 6, courseId: '401', week: 11, title: 'Real Analysis' },
  { name: demoFolderName('Complex Analysis', 9, '410'), activeCount: 4, courseId: '410', week: 9, title: 'Complex Analysis' },
]

const DEMO_RICH_FOLDER = DEMO_RESULT_FOLDERS[0].name
const richFolderPath = `${DEMO_OUTPUT_ROOT}/${DEMO_RICH_FOLDER}`
const pad3 = (n: number) => String(n).padStart(3, '0')

export function demoResultFolders(): Array<{ name: string; path: string; imageCount: number }> {
  return DEMO_RESULT_FOLDERS.map((f) => ({
    name: f.name,
    path: `${DEMO_OUTPUT_ROOT}/${f.name}`,
    imageCount: f.activeCount,
  }))
}

export function demoResultImages(folderPath: string): Array<{ name: string; path: string }> {
  const folder = DEMO_RESULT_FOLDERS.find((f) => `${DEMO_OUTPUT_ROOT}/${f.name}` === folderPath)
  const count = folder?.activeCount ?? 0
  return Array.from({ length: count }, (_, i) => {
    const name = `Slide_${pad3(i + 1)}.png`
    return { name, path: `${folderPath}/${name}` }
  })
}

// Removed (trashed) items — all in the rich folder: a duplicate, two "NO SIGNAL"
// not_slide frames, and one may_be_slide_edit (PowerPoint edit view). The
// ai_filtered_edit entry carries originalPath + trashPath (both required to
// enter crop mode on a removed item).
export function demoTrashEntries(): Array<{
  id: string
  filename: string
  originalPath: string
  originalParentFolder: string
  trashPath: string
  reason: string
  reasonDetails?: string
  trashedAt: string
}> {
  const mk = (n: number, reason: string) => {
    const filename = `Slide_${pad3(n)}.png`
    return {
      id: `demo-trash-${n}`,
      filename,
      originalPath: `${richFolderPath}/${filename}`,
      originalParentFolder: DEMO_RICH_FOLDER,
      trashPath: `${richFolderPath}/.autoslidesTrash/${filename}`,
      reason,
      trashedAt: isoAt(-1, 10, n),
    }
  }
  return [
    mk(6, 'duplicate'),
    mk(7, 'ai_filtered'),
    mk(8, 'ai_filtered_edit'),
    mk(9, 'ai_filtered'),
  ]
}

// One crop entry so an active slide in the rich folder shows the Cropped badge.
export function demoCropEntries(): Array<{
  filename: string
  originalPath: string
  originalParentFolder: string
  cropPath: string
  rect: { x: number; y: number; width: number; height: number }
  croppedAt: string
  autoCropped?: boolean
}> {
  const filename = 'Slide_002.png'
  return [
    {
      filename,
      originalPath: `${richFolderPath}/${filename}`,
      originalParentFolder: DEMO_RICH_FOLDER,
      cropPath: `${richFolderPath}/.autoslidesCrop/${filename}`,
      rect: { ...DEMO_EDIT_SLIDE_RECT },
      croppedAt: isoAt(-1, 11, 0),
      autoCropped: false,
    },
  ]
}

// ── Cloud Notes ────────────────────────────────────────────────────────────
// Fabricated Yanhekt notes so the Cloud Notes page renders offline. The managed
// (AutoSlides-exported) notes embed the SAME slide images as Slides Export —
// their Editor.js content is built exactly like a real imported-slides note
// (useNoteImport.buildContent): a header + intro paragraphs + slide image blocks
// whose file.url is a slide SVG data URI.

const DEMO_NOTE_GROUPS: NoteGroup[] = [
  { id: 1, name: MANAGED_GROUP_NAME }, // AutoSlides-managed (ASnote import)
  { id: 3, name: USER_GROUP_NAME }, // AutoSlides-managed (ASuser watch-mode)
  { id: 2, name: 'Math' }, // a user group (≤ 6 chars)
  { id: 0, name: '' }, // implicit default (Ungrouped)
]

interface DemoNoteSpec {
  id: number
  title: string
  groupId: number
  kind: 'readme' | 'managed' | 'plain'
  /** managed: number of slide image blocks. */
  slides?: number
  /** readme/plain: body paragraphs. */
  body?: string[]
}

// Order = display order (server sorts by created time; README pinned on top).
const DEMO_NOTES: DemoNoteSpec[] = [
  { id: 101, title: README_NOTE_TITLE, groupId: 0, kind: 'readme' },
  { id: 102, title: buildManagedNoteTitle('Functional Analysis - Lecture 9', { courseId: '501', sessionId: demoSessionId('501', 9) }), groupId: 1, kind: 'managed', slides: 4 },
  { id: 103, title: buildManagedNoteTitle('Real Analysis - Lecture 11', { courseId: '401', sessionId: demoSessionId('401', 11) }), groupId: 1, kind: 'managed', slides: 3 },
  { id: 104, title: buildManagedNoteTitle('Complex Analysis - Lecture 9', { courseId: '410', sessionId: demoSessionId('410', 9) }), groupId: 1, kind: 'managed', slides: 3 },
  { id: 108, title: buildManagedNoteTitle('Functional Analysis - Lecture 12', { courseId: '501', liveId: '50112' }), groupId: 3, kind: 'managed', slides: 3 },
  {
    id: 105,
    title: 'Spectral theory — reading list',
    groupId: 2,
    kind: 'plain',
    body: [
      'Reed & Simon, Vol. I — Ch. VII (spectral theorem for bounded self-adjoint operators).',
      'Compare the multiplication-operator form with the projection-valued measure form before the midterm.',
    ],
  },
  {
    id: 106,
    title: 'Office hours & exam dates',
    groupId: 0,
    kind: 'plain',
    body: [
      'Office hours: Tue 13:00–14:30, Science Hall 508E.',
      'Final exam: closed book; bring the one-page formula sheet.',
    ],
  },
  {
    id: 107,
    title: 'Problem set 4 — scratch work',
    groupId: 2,
    kind: 'plain',
    body: ['Show every compact self-adjoint operator has an orthonormal eigenbasis (use the spectral theorem).'],
  },
]

function slideDataUri(title: string, page: string): string {
  return `data:image/svg+xml,${encodeURIComponent(slideSvg(title, page))}`
}

function demoNoteBlocks(spec: DemoNoteSpec): EditorJsBlock[] {
  if (spec.kind === 'managed') {
    const count = spec.slides ?? 3
    const picks = SLIDE_TITLES.slice(0, count)
    return [
      { type: 'header', data: { text: managedNoteDisplayName(spec.title), level: 2 } },
      { type: 'paragraph', data: { text: `${count} slides · imported from AutoSlides` } },
      { type: 'paragraph', data: { text: 'Note: Yanhekt stores note images in public storage.' } },
      ...picks.map(([title, page], i): EditorJsBlock => ({
        type: 'image',
        data: {
          file: { url: slideDataUri(title, page) },
          caption: `Slide ${i + 1}`,
          withBorder: false,
          stretched: false,
          withBackground: false,
        },
      })),
    ]
  }
  if (spec.kind === 'readme') {
    return [
      { type: 'header', data: { text: 'AutoSlides Cloud Storage', level: 2 } },
      { type: 'paragraph', data: { text: 'This AutoSlides Database group (named ASnote on Yanhekt) holds slide decks AutoSlides exported to your Yanhekt notes. Each note keeps the slides from one lecture.' } },
      { type: 'paragraph', data: { text: 'Please don’t rename or delete the ASnote group — AutoSlides looks it up by that reserved name.' } },
    ]
  }
  return [
    { type: 'header', data: { text: spec.title, level: 2 } },
    ...(spec.body ?? []).map((text): EditorJsBlock => ({ type: 'paragraph', data: { text } })),
  ]
}

function demoNoteSummary(spec: DemoNoteSpec, index: number): NoteSummary {
  const created = isoAt(-2, 9, index * 3)
  return {
    id: spec.id,
    uuid: `demo-note-${spec.id}`,
    type: 0,
    relevant_id: 0,
    root_id: 0,
    title: spec.title,
    note_group_id: spec.groupId,
    deleted: 0,
    version: 1,
    created_at: created,
    updated_at: isoAt(0, 10, index * 3),
  }
}

export function demoNoteGroups(): NoteGroup[] {
  return DEMO_NOTE_GROUPS.map((g) => ({ ...g }))
}

export function demoNotesList(): NoteListResult {
  const data = DEMO_NOTES.map((spec, i) => demoNoteSummary(spec, i))
  return {
    current_page: 1,
    data,
    total: data.length,
    per_page: '500',
    last_page: 1,
  }
}

export function demoNoteDetail(id: number): NoteDetail {
  const index = DEMO_NOTES.findIndex((s) => s.id === id)
  const spec = index >= 0 ? DEMO_NOTES[index] : DEMO_NOTES[0]
  const summary = demoNoteSummary(spec, Math.max(0, index))
  const group = DEMO_NOTE_GROUPS.find((g) => g.id === spec.groupId)
  return {
    ...summary,
    content: JSON.stringify({ time: Date.now(), blocks: demoNoteBlocks(spec), version: EDITORJS_DOC_VERSION }),
    client_time: Date.now(),
    content_updated_time: summary.updated_at,
    note_group_name: group?.name || undefined,
  }
}

/** Next id handed out by the demo create() (so new notes don't collide). */
let demoNextNoteId = 1000
export function demoNextNoteIdValue(): number {
  return ++demoNextNoteId
}

// ── Cloud Index (Drive page index mode) ─────────────────────────────────────
// A fabricated public index over the same demo courses, so index mode renders
// offline: stats/recently-added, search → course/session browse, and share
// resolution into the right-panel slide viewer (the same slide SVGs as
// everywhere else). All instructors share one college, so only the term and
// instructor filter dropdowns appear — matching a typical small search result.

interface DemoIndexSession {
  courseId: string
  week: number
  versions: Array<{ imageCount: number; reviewed: boolean; edited?: boolean; hasTimeline?: boolean }>
}

const DEMO_INDEX_SESSIONS: DemoIndexSession[] = [
  { courseId: '501', week: 9, versions: [{ imageCount: 6, reviewed: true, hasTimeline: true }, { imageCount: 5, reviewed: false, edited: true, hasTimeline: true }] },
  { courseId: '501', week: 10, versions: [{ imageCount: 5, reviewed: true, hasTimeline: true }] },
  { courseId: '501', week: 11, versions: [{ imageCount: 4, reviewed: false }] },
  { courseId: '501', week: 12, versions: [{ imageCount: 6, reviewed: true, hasTimeline: true }] },
  { courseId: '401', week: 7, versions: [{ imageCount: 5, reviewed: true }] },
  { courseId: '401', week: 8, versions: [{ imageCount: 4, reviewed: false }] },
  { courseId: '401', week: 11, versions: [{ imageCount: 6, reviewed: true, hasTimeline: true }] },
  { courseId: '410', week: 9, versions: [{ imageCount: 4, reviewed: false, hasTimeline: true }] },
  { courseId: '410', week: 10, versions: [{ imageCount: 5, reviewed: true }] },
]

const indexShareId = (s: DemoIndexSession, i: number): string =>
  `demo-${s.courseId}-w${s.week}-v${i + 1}`

function indexCourseOf(s: DemoIndexSession): { title: string; professor: string; semester: string } {
  const c = DEMO_COURSES.find((x) => x.id === s.courseId)
  return c ?? { title: 'Functional Analysis', professor: 'Dr. Helena Whitcombe', semester: '1' }
}

function indexTopicOf(s: DemoIndexSession): string {
  const topics = SESSION_TOPICS[s.courseId] ?? GENERIC_TOPICS
  return topics[(s.week - 1) % topics.length]
}

function indexLectureOf(s: DemoIndexSession): IndexLecture {
  const c = indexCourseOf(s)
  return {
    courseId: s.courseId,
    sessionId: demoSessionId(s.courseId, s.week),
    courseTitle: c.title,
    sessionTitle: `Lecture ${s.week}: ${indexTopicOf(s)}`,
    instructor: c.professor,
    semester: c.semester,
    schoolYear: '2024-2025',
    college: COLLEGE,
    weekNumber: s.week,
    day: 2,
    versionCount: s.versions.length,
    updatedAt: isoAt(-(16 - s.week), 12, 0),
  }
}

function indexVersionsOf(s: DemoIndexSession): IndexVersion[] {
  const c = indexCourseOf(s)
  return s.versions.map((v, i) => ({
    shareId: indexShareId(s, i),
    title: `${c.title} - Lecture ${s.week}`,
    imageCount: v.imageCount,
    reviewed: v.reviewed,
    edited: v.edited ?? false,
    hasTimeline: v.hasTimeline ?? false,
    createdAt: isoAt(-(16 - s.week) + i, 15, 30),
  }))
}

export function demoIndexStats(): IndexStats {
  const recent: IndexRecentFile[] = DEMO_INDEX_SESSIONS.flatMap((s) => {
    const lec = indexLectureOf(s)
    return indexVersionsOf(s).map((v): IndexRecentFile => ({
      shareId: v.shareId,
      courseId: lec.courseId,
      sessionId: lec.sessionId,
      courseTitle: lec.courseTitle,
      sessionTitle: lec.sessionTitle,
      instructor: lec.instructor,
      semester: lec.semester,
      schoolYear: lec.schoolYear,
      college: lec.college,
      imageCount: v.imageCount,
      createdAt: v.createdAt,
    }))
  })
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, 8)
  const versionCount = DEMO_INDEX_SESSIONS.reduce((n, s) => n + s.versions.length, 0)
  return {
    courseCount: new Set(DEMO_INDEX_SESSIONS.map((s) => s.courseId)).size,
    lectureCount: DEMO_INDEX_SESSIONS.length,
    versionCount,
    recent,
    colleges: [{ college: COLLEGE, count: versionCount }],
    updatedAt: isoAt(0, 8, 0),
  }
}

export function demoIndexSearch(term: string): IndexLecture[] {
  const q = term.trim().toLowerCase()
  return DEMO_INDEX_SESSIONS.map(indexLectureOf).filter(
    (l) =>
      !q ||
      [l.courseTitle, l.sessionTitle, l.instructor, l.college].some((f) =>
        f?.toLowerCase().includes(q),
      ),
  )
}

export function demoIndexLecture(courseId: string, sessionId: string): IndexLectureDetail | null {
  const s = DEMO_INDEX_SESSIONS.find(
    (x) => x.courseId === courseId && demoSessionId(x.courseId, x.week) === sessionId,
  )
  return s ? { lecture: indexLectureOf(s), versions: indexVersionsOf(s) } : null
}

function folderSpecByPath(folderPath: string) {
  return DEMO_RESULT_FOLDERS.find((f) => `${DEMO_OUTPUT_ROOT}/${f.name}` === folderPath)
    ?? DEMO_RESULT_FOLDERS.find((f) => folderPath.endsWith(f.name))
    ?? null
}

function demoTimelineForCount(slideCount: number, createdAt: string): SlideTimeline {
  const events: SlideTimeline['events'] = []
  const resolutions: SlideTimeline['resolutions'] = {}
  for (let i = 0; i < slideCount; i++) {
    const id = `evt_${i + 1}`
    const changeAt = i * 180
    events.push({
      id,
      changeAt,
      confirmedAt: changeAt + 2.4,
      initialFile: `Slide_${pad3(i + 1)}.png`,
    })
    resolutions[id] = { state: 'canonical', file: `Slide_${pad3(i + 1)}.png` }
  }
  if (slideCount >= 3) {
    const dupId = 'evt_dup'
    events.push({
      id: dupId,
      changeAt: 185,
      confirmedAt: 187,
      initialFile: `Slide_${pad3(slideCount + 1)}.png`,
    })
    resolutions[dupId] = { state: 'duplicate', duplicateOf: 'Slide_001.png' }
  }
  if (slideCount >= 4) {
    const gapId = 'evt_gap'
    events.push({
      id: gapId,
      changeAt: 700,
      confirmedAt: 740,
      initialFile: null,
    })
    resolutions[gapId] = { state: 'gap', gapReason: 'ai_filtered' }
  }
  events.sort((a, b) => a.changeAt - b.changeAt)
  return {
    version: SLIDE_TIMELINE_VERSION,
    kind: 'recorded',
    extractor: 'builtin',
    createdAt,
    updatedAt: createdAt,
    events,
    resolutions,
  }
}

export function demoMetadata(folderPath: string): SlideMetadata | null {
  const spec = folderSpecByPath(folderPath)
  if (!spec) return null
  const course = DEMO_COURSES.find((c) => c.id === spec.courseId)
  const sessionId = demoSessionId(spec.courseId, spec.week)
  const createdAt = isoAt(-(16 - spec.week), 12, 0)
  const reviewed = spec.week !== 11
  const edited = spec === DEMO_RESULT_FOLDERS[0]
  return {
    version: SLIDE_METADATA_VERSION,
    kind: 'recorded',
    source: {
      courseId: spec.courseId,
      courseTitle: spec.title,
      sessionId,
      sessionTitle: `Lecture ${spec.week}: ${(SESSION_TOPICS[spec.courseId] ?? GENERIC_TOPICS)[spec.week - 1] ?? 'Lecture'}`,
      instructor: course?.professor,
      professors: course ? [course.professor] : undefined,
      semester: course?.semester,
      schoolYear: '2024-2025',
      college: COLLEGE,
      classrooms: course ? [course.room] : undefined,
      weekNumber: spec.week,
      day: 2,
    },
    extraction: {
      extractor: 'builtin',
      ssimThreshold: 0.92,
      extractedAt: createdAt,
      trigger: 'auto',
    },
    postProcessing: {
      ran: true,
      duplicateRemoval: true,
      exclusionList: true,
      aiFiltering: true,
      aiClassifierMode: 'llm',
      completedAt: isoAt(-(16 - spec.week), 12, 18),
    },
    review: {
      reviewed,
      reviewedAt: reviewed ? isoAt(-(16 - spec.week) + 1, 9, 0) : null,
      edited,
      editedAt: edited ? isoAt(-(16 - spec.week) + 1, 9, 12) : null,
      cropped: edited,
    },
    createdAt,
    updatedAt: isoAt(-(16 - spec.week) + 1, 9, 12),
  }
}

export function demoTimeline(folderPath: string): SlideTimeline | null {
  const spec = folderSpecByPath(folderPath)
  if (!spec) return null
  return demoTimelineForCount(spec.activeCount, isoAt(-(16 - spec.week), 12, 0))
}

export function demoLectureVideos(): Array<{ name: string; path: string; size: number; mtimeMs: number }> {
  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000
  const mk = (
    title: string,
    week: number,
    courseId: string,
    videoType: 'screen' | 'camera',
    opts?: { ascomp?: 'tiny' | 'small' | 'readable'; daysAgo?: number; mb?: number },
  ) => {
    const sessionId = demoSessionId(courseId, week)
    const semester = DEMO_COURSES.find((c) => c.id === courseId)?.semester === '2' ? 'S02' : 'S01'
    const ep = String(week).padStart(2, '0')
    const tags = [
      `[yhid=c${courseId}s${sessionId}]`,
      `[vtype=${videoType}]`,
      opts?.ascomp ? `[ascomp=${opts.ascomp}]` : '',
    ].filter(Boolean).join(' ')
    const name = `${title} - ${semester}E${ep} - Lecture ${week} ${tags}.mp4`
    return {
      name,
      path: `${DEMO_OUTPUT_ROOT}/${name}`,
      size: Math.round((opts?.mb ?? (videoType === 'screen' ? 420 : 280)) * 1024 * 1024),
      mtimeMs: now - (opts?.daysAgo ?? week) * DAY,
    }
  }
  return [
    mk('Functional Analysis', 9, '501', 'screen', { daysAgo: 14, mb: 510 }),
    mk('Functional Analysis', 9, '501', 'camera', { daysAgo: 14, mb: 260 }),
    mk('Functional Analysis', 10, '501', 'screen', { daysAgo: 7, mb: 488 }),
    mk('Functional Analysis', 12, '501', 'screen', { ascomp: 'small', daysAgo: 1, mb: 96 }),
    mk('Functional Analysis', 12, '501', 'camera', { daysAgo: 1, mb: 240 }),
    mk('Real Analysis', 11, '401', 'screen', { daysAgo: 10, mb: 402 }),
    mk('Real Analysis', 11, '401', 'camera', { daysAgo: 10, mb: 218 }),
    mk('Complex Analysis', 9, '410', 'screen', { daysAgo: 21, mb: 377 }),
  ]
}

/** Resolve a `/v1/s/<shareId>` link minted from the demo index into slide URLs. */
export function demoResolveIndexShare(link: string): ShareImportResult | null {
  const shareId = link.match(/\/v1\/s\/([^/?#]+)/)?.[1] ?? link.trim()
  for (const s of DEMO_INDEX_SESSIONS) {
    const i = s.versions.findIndex((_, vi) => indexShareId(s, vi) === shareId)
    if (i < 0) continue
    const c = indexCourseOf(s)
    const count = Math.min(s.versions[i].imageCount, SLIDE_TITLES.length)
    const sessionId = demoSessionId(s.courseId, s.week)
    const folderName = demoFolderName(c.title, s.week, s.courseId)
    const folderPath = `${DEMO_OUTPUT_ROOT}/${folderName}`
    const metadata = demoMetadata(folderPath) ?? {
      version: SLIDE_METADATA_VERSION,
      kind: 'recorded' as const,
      source: {
        courseId: s.courseId,
        courseTitle: c.title,
        sessionId,
        sessionTitle: `Lecture ${s.week}`,
        instructor: c.professor,
        semester: c.semester,
        schoolYear: '2024-2025',
        college: COLLEGE,
        weekNumber: s.week,
        day: 2,
      },
      extraction: {
        extractor: 'builtin' as const,
        extractedAt: isoAt(-(16 - s.week), 12, 0),
        trigger: 'auto' as const,
      },
      review: {
        reviewed: s.versions[i].reviewed,
        reviewedAt: s.versions[i].reviewed ? isoAt(-(16 - s.week) + 1, 9, 0) : null,
        edited: s.versions[i].edited ?? false,
        editedAt: s.versions[i].edited ? isoAt(-(16 - s.week) + 1, 9, 12) : null,
        cropped: false,
      },
      createdAt: isoAt(-(16 - s.week), 12, 0),
      updatedAt: isoAt(-(16 - s.week), 12, 0),
    }
    return {
      title: buildManagedNoteTitle(`${c.title} - Lecture ${s.week}`, { courseId: s.courseId, sessionId }),
      identity: { courseId: s.courseId, sessionId },
      urls: SLIDE_TITLES.slice(0, count).map(([title, page]) => slideDataUri(title, page)),
      missing: 0,
      metadata,
      timeline: s.versions[i].hasTimeline ? demoTimelineForCount(count, isoAt(-(16 - s.week), 12, 0)) : null,
      lectureMeta: { courseTitle: c.title, sessionTitle: `Lecture ${s.week}` },
    }
  }
  return null
}
