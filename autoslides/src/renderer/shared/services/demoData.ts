// Demo mode: fabricated account + course data for clean screenshots.
//
// Enabled by launching with `npm run demo` (sets DEMO_MODE=1, read in the
// preload as `window.electronAPI.isDemoMode`). When active, the renderer-side
// `ApiClient` and `TokenManager` short-circuit to the factories below instead
// of hitting the network — so the whole UI renders as a made-up Math student
// ("Kate") with a believable course list. Nothing here is persisted.

import type {
  UserData,
  SemesterOption,
  CourseData,
  CourseListResponse,
  LiveStream,
  LiveListResponse,
  SessionData,
  CourseInfoResponse,
} from './apiClient'

export const DEMO_TOKEN = 'DEMO_MODE_TOKEN'

export function isDemoMode(): boolean {
  return window.electronAPI?.isDemoMode === true
}

export function demoUser(): UserData {
  return {
    badge: '2022140137',
    nickname: 'Kate',
    gender: 2,
  }
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
  { id: 'math-501', title: 'Functional Analysis', professor: 'Dr. Helena Whitcombe', room: 'Science Hall 301', semester: '1', enrolled: 42 },
  { id: 'math-401', title: 'Real Analysis', professor: 'Dr. Marcus Lindqvist', room: 'Science Hall 214', semester: '1', enrolled: 58 },
  { id: 'math-402', title: 'Abstract Algebra', professor: 'Dr. Priya Narayan', room: 'Whitman Building 110', semester: '1', enrolled: 47 },
  { id: 'math-505', title: 'Point-Set Topology', professor: 'Dr. Theo Brandt', room: 'Science Hall 305', semester: '2', enrolled: 36 },
  { id: 'math-512', title: 'Measure Theory', professor: 'Dr. Helena Whitcombe', room: 'Science Hall 301', semester: '2', enrolled: 29 },
  { id: 'math-410', title: 'Complex Analysis', professor: 'Dr. Sofia Renault', room: 'Whitman Building 204', semester: '2', enrolled: 51 },
  { id: 'math-520', title: 'Differential Geometry', professor: 'Dr. Anton Vasiliev', room: 'Science Hall 218', semester: '1', enrolled: 33 },
  { id: 'math-530', title: 'Partial Differential Equations', professor: 'Dr. Marcus Lindqvist', room: 'Engineering Annex 140', semester: '2', enrolled: 44 },
  { id: 'math-460', title: 'Number Theory', professor: 'Dr. Priya Narayan', room: 'Whitman Building 110', semester: '1', enrolled: 39 },
  { id: 'math-470', title: 'Probability Theory', professor: 'Dr. Sofia Renault', room: 'Science Hall 214', semester: '1', enrolled: 62 },
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
      id: 'live-math-501',
      title: 'Functional Analysis — Lecture 12',
      subtitle: 'Spectral Theory of Compact Operators',
      status: 1, // live now
      schedule_started_at: isoAt(0, 10, 0),
      schedule_ended_at: isoAt(0, 11, 30),
      participant_count: 38,
      session: { professor: { name: 'Dr. Helena Whitcombe' }, section_group_title: 'Science Hall 301' },
    },
    {
      id: 'live-math-410',
      title: 'Complex Analysis — Lecture 9',
      subtitle: 'The Residue Theorem',
      status: 2, // upcoming
      schedule_started_at: isoAt(0, 14, 0),
      schedule_ended_at: isoAt(0, 15, 30),
      participant_count: 0,
      session: { professor: { name: 'Dr. Sofia Renault' }, section_group_title: 'Whitman Building 204' },
    },
    {
      id: 'live-math-401',
      title: 'Real Analysis — Lecture 11',
      subtitle: 'Sequences of Functions and Uniform Convergence',
      status: 0, // ended
      schedule_started_at: isoAt(-1, 9, 0),
      schedule_ended_at: isoAt(-1, 10, 30),
      participant_count: 55,
      session: { professor: { name: 'Dr. Marcus Lindqvist' }, section_group_title: 'Science Hall 214' },
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
  'math-501': [
    'Normed Vector Spaces', 'Banach Spaces', 'Bounded Linear Operators', 'The Hahn–Banach Theorem',
    'Dual Spaces', 'The Open Mapping Theorem', 'The Closed Graph Theorem', 'Hilbert Spaces',
    'Orthonormal Bases', 'The Riesz Representation Theorem', 'Compact Operators', 'Spectral Theory',
    'The Spectral Theorem', 'Applications to Integral Equations',
  ],
  'math-401': [
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
      id: `${courseId}-s${week}`,
      session_id: `${courseId}-session-${week}`,
      video_id: `${courseId}-video-${week}`,
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
