/**
 * Every fact the demo shows is invented here.
 *
 * The cast matches the desktop app's demo (`autoslides/src/renderer/demo/
 * demoData.ts`) on purpose: the same student, the same fictional courses and
 * teachers, so a reader moving between the two READMEs sees one coherent story.
 * No real lecture, teacher, or account is represented. Documentation
 * screenshots are captured in English, which is why the fabricated content is
 * English even though the README around it is Chinese.
 *
 * Imagery is drawn as inline SVG data URIs rather than shipped as files, so the
 * demo adds no binary weight to the repo and renders identically on every
 * machine. Dates are computed relative to "now" so the live page always has a
 * lecture in progress and the recorded lists never look stale.
 */

import type {
  CourseData,
  CourseListResponse,
  LiveStream,
  LiveListResponse,
  SemesterOption,
  SubscriptionListResponse,
  UserData,
} from "../lib/api";
import type { NoteDetail, NoteGroup, NoteListResult, NoteSummary } from "../lib/notes/notesTypes";
import { MANAGED_GROUP_NAME, USER_GROUP_NAME } from "../lib/notes/notesTypes";

/** A well-formed 32-hex string: the Worker's own gate would accept its shape. */
export const DEMO_TOKEN = "0123456789abcdef0123456789abcdef";
export const DEMO_BADGE = "2022140137";
export const DEMO_NICKNAME = "Kate";

const COLLEGE = "School of Mathematical Sciences";
const SCHOOL_YEAR = "2025-2026";

export function demoUser(): UserData {
  return { badge: DEMO_BADGE, nickname: DEMO_NICKNAME, gender: 2, phone: "138****0137" };
}

// ---------------------------------------------------------------- imagery ---

/** SVG → data URI. `encodeURIComponent`, not base64: the markup carries CJK. */
function svg(markup: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

/**
 * Course cover art: an abstract two-tone card. Deliberately wordless — the app
 * draws the course name over the cover itself, and a title baked into the
 * image would show through it twice.
 */
export function coverSvg(hue: number): string {
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${hue} 32% 42%)"/><stop offset="1" stop-color="hsl(${hue + 24} 38% 26%)"/>
  </linearGradient></defs>
  <rect width="640" height="360" fill="url(#g)"/>
  <g fill="none" stroke="rgba(255,255,255,.14)" stroke-width="1.5">
    <circle cx="516" cy="88" r="150"/><circle cx="516" cy="88" r="96"/><circle cx="516" cy="88" r="42"/>
    <path d="M-20 268h680M-20 300h680"/>
  </g>
</svg>`);
}

/** A lecture slide, 16:9 at 1280×720 (the crop editor reads natural size). */
export function slideSvg(title: string, lines: string[], formula: string): string {
  const body = lines
    .map(
      (line, i) =>
        `<circle cx="118" cy="${292 + i * 62}" r="5" fill="#8a8580"/>` +
        `<text x="146" y="${300 + i * 62}" font-family="${SERIF}" font-size="30" fill="#2f2c28">${line}</text>`,
    )
    .join("");
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#fbfaf8"/>
  <text x="104" y="176" font-family="${SERIF}" font-size="50" fill="#151412">${title}</text>
  <path d="M104 208h420" stroke="#151412" stroke-width="3"/>
  ${body}
  <rect x="104" y="546" width="1072" height="94" fill="#f1efeb"/>
  <text x="140" y="606" font-family="${SERIF}" font-size="36" font-style="italic" fill="#2f2c28">${formula}</text>
</svg>`);
}

/** The "this frame is not a slide" case: a projector between slides. */
export function notSlideSvg(): string {
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#14161a"/>
  <rect x="470" y="300" width="340" height="120" rx="10" fill="none" stroke="#3d434d" stroke-width="4"/>
  <text x="640" y="374" text-anchor="middle" font-family="${FONT}" font-size="42" fill="#5c636e">NO SIGNAL</text>
</svg>`);
}

/** A slide caught mid-edit: the PowerPoint chrome around a smaller canvas. */
export function editFrameSvg(): string {
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#d9d6d1"/>
  <rect width="1280" height="86" fill="#c6c2bb"/>
  <g fill="#8f8a83"><rect x="28" y="30" width="86" height="26" rx="4"/><rect x="134" y="30" width="66" height="26" rx="4"/><rect x="220" y="30" width="66" height="26" rx="4"/></g>
  <rect x="28" y="118" width="240" height="574" fill="#cfcbc4"/>
  <g fill="#b3aea6"><rect x="52" y="146" width="192" height="108" rx="4"/><rect x="52" y="274" width="192" height="108" rx="4"/><rect x="52" y="402" width="192" height="108" rx="4"/></g>
  <rect x="320" y="150" width="760" height="470" fill="#fbfaf8" stroke="#a9a49c" stroke-width="2"/>
  <text x="368" y="266" font-family="${SERIF}" font-size="40" fill="#151412">The Spectrum of a Compact Operator</text>
  <path d="M368 292h300" stroke="#151412" stroke-width="3"/>
  <text x="368" y="366" font-family="${SERIF}" font-size="26" fill="#2f2c28">• 0 is the only possible accumulation point</text>
  <text x="368" y="416" font-family="${SERIF}" font-size="26" fill="#2f2c28">• every non-zero point is an eigenvalue</text>
</svg>`);
}

/** Player poster for the screen-recording stream (what a projector shows). */
export function screenPosterSvg(): string {
  return slideSvg(
    "The Spectrum of a Compact Operator",
    [
      "σ(T) is at most countable",
      "every non-zero spectral point is an eigenvalue",
      "0 is the only possible accumulation point",
    ],
    "σ(T) \\ {0} = { λ : λ is an eigenvalue of T }",
  );
}

/** Player poster for the camera stream (a lecture hall, drawn flat). */
export function cameraPosterSvg(): string {
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#2b2f36"/>
  <rect y="470" width="1280" height="250" fill="#22262c"/>
  <rect x="120" y="150" width="620" height="330" rx="6" fill="#3a4048"/>
  <rect x="150" y="182" width="560" height="266" rx="4" fill="#4a515b"/>
  <g fill="#7d8590"><circle cx="900" cy="330" r="66"/><path d="M796 480c0-58 47-104 104-104s104 46 104 104z"/></g>
  <g fill="#31363d"><rect x="120" y="556" width="300" height="22" rx="6"/><rect x="470" y="556" width="300" height="22" rx="6"/><rect x="820" y="556" width="300" height="22" rx="6"/>
  <rect x="120" y="626" width="300" height="22" rx="6"/><rect x="470" y="626" width="300" height="22" rx="6"/><rect x="820" y="626" width="300" height="22" rx="6"/></g>
</svg>`);
}

// ---------------------------------------------------------------- courses ---

interface DemoCourse {
  id: string;
  title: string;
  professor: string;
  room: string;
  semester: number;
  enrolled: number;
  hue: number;
}

/** The desktop demo's ten courses, ids included. */
export const DEMO_COURSES: DemoCourse[] = [
  { id: "501", title: "Functional Analysis", professor: "Dr. Helena Whitcombe", room: "Science Hall 301", semester: 1, enrolled: 42, hue: 214 },
  { id: "401", title: "Real Analysis", professor: "Dr. Marcus Lindqvist", room: "Science Hall 214", semester: 1, enrolled: 58, hue: 190 },
  { id: "410", title: "Complex Analysis", professor: "Dr. Sofia Renault", room: "Whitman Building 204", semester: 1, enrolled: 51, hue: 340 },
  { id: "402", title: "Abstract Algebra", professor: "Dr. Priya Narayan", room: "Whitman Building 110", semester: 1, enrolled: 47, hue: 262 },
  { id: "520", title: "Differential Geometry", professor: "Dr. Anton Vasiliev", room: "Science Hall 218", semester: 1, enrolled: 33, hue: 240 },
  { id: "460", title: "Number Theory", professor: "Dr. Priya Narayan", room: "Whitman Building 110", semester: 1, enrolled: 39, hue: 292 },
  { id: "470", title: "Probability Theory", professor: "Dr. Sofia Renault", room: "Science Hall 214", semester: 1, enrolled: 62, hue: 120 },
  { id: "505", title: "Point-Set Topology", professor: "Dr. Theo Brandt", room: "Science Hall 305", semester: 2, enrolled: 36, hue: 158 },
  { id: "512", title: "Measure Theory", professor: "Dr. Helena Whitcombe", room: "Science Hall 301", semester: 2, enrolled: 29, hue: 20 },
  { id: "530", title: "Partial Differential Equations", professor: "Dr. Marcus Lindqvist", room: "Engineering Annex 140", semester: 2, enrolled: 44, hue: 176 },
];

export function findCourse(courseId: string): DemoCourse | undefined {
  return DEMO_COURSES.find((c) => c.id === String(courseId));
}

function toCourseData(c: DemoCourse): CourseData {
  return {
    id: c.id,
    name_zh: c.title,
    professors: [c.professor],
    classrooms: [{ name: c.room }],
    school_year: SCHOOL_YEAR,
    semester: String(c.semester),
    college_name: COLLEGE,
    participant_count: c.enrolled,
    image_url: coverSvg(c.hue),
  };
}

/** Which term each semester tag id stands for (see demoTagList). */
const SEMESTER_BY_TAG: Record<number, number> = { 100: 1, 107: 2 };

/**
 * One page of the catalogue, filtered by keyword and semester the way search
 * is. Honouring `semesters[]` matters for the look of the page: without it a
 * course marked "Fall" would sit under a "Spring" filter chip.
 */
export function demoCourseList(
  page: number,
  pageSize: number,
  keyword: string,
  semesterTags: number[] = [],
): CourseListResponse {
  const terms = semesterTags.map((id) => SEMESTER_BY_TAG[id]).filter(Boolean);
  const kw = keyword.trim().toLowerCase();
  const pool = DEMO_COURSES.filter(
    (c) =>
      (terms.length === 0 || terms.includes(c.semester)) &&
      (!kw ||
        c.title.toLowerCase().includes(kw) ||
        c.professor.toLowerCase().includes(kw) ||
        c.id === kw),
  );
  const start = (page - 1) * pageSize;
  return {
    data: pool.slice(start, start + pageSize).map(toCourseData),
    current_page: page,
    last_page: Math.max(1, Math.ceil(pool.length / pageSize)),
    per_page: pageSize,
    total: pool.length,
  };
}

/** The account's own courses — a stable subset, so Home has something to show. */
export function demoPersonalCourseList(page: number, pageSize: number): CourseListResponse {
  const mine = DEMO_COURSES.slice(0, 6);
  const start = (page - 1) * pageSize;
  return {
    data: mine.slice(start, start + pageSize).map(toCourseData),
    current_page: page,
    last_page: Math.max(1, Math.ceil(mine.length / pageSize)),
    per_page: pageSize,
    total: mine.length,
  };
}

/** Yanhekt subscriptions ("Subscribed" in the sidebar). */
export function demoSubscriptionList(): SubscriptionListResponse {
  const subscribed = [DEMO_COURSES[0], DEMO_COURSES[2], DEMO_COURSES[3]];
  return {
    data: subscribed.map((c) => ({
      id: c.id,
      name_zh: c.title,
      professors: [{ name: c.professor }],
      classrooms: [{ name: c.room }],
      participant_count: c.enrolled,
      college_name: COLLEGE,
      school_year: SCHOOL_YEAR,
      semester: String(c.semester),
      image_url: coverSvg(c.hue),
    })),
    current_page: 1,
    last_page: 1,
    per_page: 100,
    total: subscribed.length,
  };
}

// --------------------------------------------------------------- sessions ---

/**
 * "YYYY-MM-DD HH:MM:SS" in local time — the shape Yanhekt returns. Going
 * through `toISOString()` would silently shift every lecture by the timezone
 * offset (a 10:00 lecture showing as 02:00).
 */
function stamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/** Same scheme as the desktop demo: course id + zero-padded week. */
export function demoSessionId(courseId: string, week: number): string {
  return `${courseId}${String(week).padStart(2, "0")}`;
}

const SESSION_TOPICS: Record<string, string[]> = {
  "501": [
    "Normed Vector Spaces", "Banach Spaces", "Bounded Linear Operators", "The Hahn–Banach Theorem",
    "Dual Spaces", "The Open Mapping Theorem", "The Closed Graph Theorem", "Hilbert Spaces",
    "Compact Operators", "Orthonormal Bases", "The Riesz Representation Theorem", "Spectral Theory",
  ],
  "401": [
    "The Real Number System", "Sequences and Limits", "Series", "Continuity", "Differentiation",
    "The Riemann Integral", "Metric Spaces", "Compactness", "Connectedness",
    "Sequences of Functions", "Uniform Convergence", "The Stone–Weierstrass Theorem",
  ],
  "402": [
    "Groups and Subgroups", "Cosets", "Lagrange's Theorem", "Homomorphisms", "Quotient Groups",
    "Group Actions", "The Sylow Theorems", "Rings", "Ideals", "Polynomial Rings",
    "Field Extensions", "Galois Theory",
  ],
  "470": [
    "Sample Spaces", "Conditional Probability", "Random Variables", "Expectation",
    "Common Distributions", "Joint Distributions", "Independence", "Covariance",
    "Moment Generating Functions", "The Law of Large Numbers", "The Central Limit Theorem",
    "Markov Chains",
  ],
};

const GENERIC_TOPICS = [
  "Foundations and Motivation", "Core Definitions", "Fundamental Theorems", "Key Constructions",
  "Worked Examples", "Structural Results", "Advanced Techniques", "Important Counterexamples",
  "Applications I", "Applications II", "Connections to Other Fields", "Selected Topics",
];

export function topicFor(courseId: string, week: number): string {
  const list = SESSION_TOPICS[courseId] ?? GENERIC_TOPICS;
  return list[(week - 1) % list.length];
}

/** The lecture title a session carries, e.g. "Lecture 9: Compact Operators". */
export function sessionTitle(courseId: string, week: number): string {
  return `Lecture ${week}: ${topicFor(courseId, week)}`;
}

/** Raw rows for `/v2/course/session/list` (the app reshapes them itself). */
export function demoSessionRows(courseId: string) {
  const course = findCourse(courseId);
  const weeks = course ? 12 : 0;
  const rows = [];
  for (let week = weeks; week >= 1; week--) {
    const started = new Date(Date.now() - (weeks - week + 1) * 7 * 86400000);
    started.setHours(10, 0, 0, 0);
    const ended = new Date(started.getTime() + 90 * 60000);
    const id = demoSessionId(courseId, week);
    rows.push({
      id,
      title: sessionTitle(courseId, week),
      week_number: week,
      day: 2,
      started_at: stamp(started),
      ended_at: stamp(ended),
      videos: [
        {
          id: `${id}0`,
          duration: "5400",
          main: `https://demo.invalid/${courseId}/${id}/main.m3u8`,
          vga: `https://demo.invalid/${courseId}/${id}/vga.m3u8`,
        },
      ],
    });
  }
  return rows;
}

/** Raw payload for `/v1/course?id=` (course detail, no session list). */
export function demoCourseDetail(courseId: string) {
  const course = findCourse(courseId) ?? DEMO_COURSES[0];
  return {
    name_zh: course.title,
    professors: [{ name: course.professor }],
    school_year: SCHOOL_YEAR,
    semester: course.semester,
    college_name: COLLEGE,
    college: { name: COLLEGE, image_url: coverSvg(course.hue) },
    image_url: coverSvg(course.hue),
  };
}

// ------------------------------------------------------------------- live ---

function minutesFromNow(minutes: number): string {
  return stamp(new Date(Date.now() + minutes * 60000));
}

function liveRow(course: DemoCourse, week: number, status: number, offset: number, watching: number): LiveStream {
  return {
    id: `${course.id}${week}0`,
    title: `${course.title} · ${sessionTitle(course.id, week)}`,
    subtitle: course.room,
    status,
    schedule_started_at: minutesFromNow(offset),
    schedule_ended_at: minutesFromNow(offset + 90),
    participant_count: watching,
    img: coverSvg(course.hue),
    course: { id: course.id },
    session: {
      course_id: course.id,
      professor: { name: course.professor },
      section_group_title: sessionTitle(course.id, week),
    },
    target: `https://demo.invalid/live/${course.id}/camera.m3u8`,
    target_vga: `https://demo.invalid/live/${course.id}/screen.m3u8`,
  };
}

/**
 * Five broadcasts: three in progress, one starting soon, one already finished.
 *
 * Three of them are live at once on purpose — Home's "My Live Streams" row is
 * one card per broadcast, and a single card leaves the row looking broken.
 */
const LIVE_NOW = [
  liveRow(DEMO_COURSES[0], 12, 1, -38, 126),
  liveRow(DEMO_COURSES[3], 12, 1, -22, 74),
  liveRow(DEMO_COURSES[6], 12, 1, -51, 158),
];

const LIVE_ROWS = [
  ...LIVE_NOW,
  liveRow(DEMO_COURSES[2], 9, 2, 96, 0),
  liveRow(DEMO_COURSES[1], 11, 0, -238, 88),
];

export function demoLiveList(keyword: string, personal: boolean): LiveListResponse {
  // The personal list is what Home shows: the lectures happening right now.
  const rows = personal ? LIVE_NOW : LIVE_ROWS;
  const kw = keyword.trim().toLowerCase();
  const data = kw ? rows.filter((r) => r.title.toLowerCase().includes(kw)) : rows;
  return { data, current_page: 1, last_page: 1, per_page: 16, total: data.length };
}

/** The broadcast id of the lecture that is live right now. */
export const DEMO_LIVE_ID = `${DEMO_COURSES[0].id}120`;

// -------------------------------------------------------------- semesters ---

/** Raw `/v1/tag/list` payload; the app parses the labels itself. */
export function demoTagList() {
  return [
    {
      id: 1,
      parent_id: 0,
      name: "学期",
      show_type: 1,
      param: "semesters",
      sort: 1,
      children: [
        { id: 100, parent_id: 1, name: "2025-2026 第一学期", show_type: 1, param: "semester", sort: 7 },
        { id: 107, parent_id: 1, name: "2025-2026 第二学期", show_type: 1, param: "semester", sort: 6 },
        { id: 96, parent_id: 1, name: "2024-2025 第二学期", show_type: 1, param: "semester", sort: 5 },
        { id: 95, parent_id: 1, name: "2024-2025 第一学期", show_type: 1, param: "semester", sort: 4 },
      ],
    },
  ];
}

export function demoSemesters(): SemesterOption[] {
  return [
    { id: 100, label: "2025-2026 第一学期", labelEn: "2025 Fall", schoolYear: 2025, semester: 1 },
    { id: 107, label: "2025-2026 第二学期", labelEn: "2026 Spring", schoolYear: 2025, semester: 2 },
  ];
}

// ------------------------------------------------------------------ notes ---

const NOTE_GROUPS: NoteGroup[] = [
  { id: 1, name: MANAGED_GROUP_NAME },
  { id: 2, name: USER_GROUP_NAME },
  // Group names are capped at 6 characters by the server.
  { id: 3, name: "Study" },
];

export function demoNoteGroups(): NoteGroup[] {
  return NOTE_GROUPS.map((g) => ({ ...g }));
}

interface DemoNote {
  id: number;
  title: string;
  groupId: number;
  blocks: Array<{ type: string; data: Record<string, unknown> }>;
}

function paragraph(text: string) {
  return { type: "paragraph", data: { text } };
}

function header(text: string, level = 2) {
  return { type: "header", data: { text, level } };
}

function image(url: string, caption: string) {
  return { type: "image", data: { file: { url }, caption, withBorder: false, stretched: false, withBackground: false } };
}

/** Title of a note AutoSlides manages, e.g. "c501s50109 · Functional Analysis · Lecture 9". */
function managedTitle(courseId: string, week: number): string {
  const course = findCourse(courseId);
  return `c${courseId}s${demoSessionId(courseId, week)} · ${course?.title} · Lecture ${week}`;
}

const DEMO_NOTES: DemoNote[] = [
  {
    id: 1201,
    title: managedTitle("501", 9),
    groupId: 2,
    blocks: [
      header("Functional Analysis · Lecture 9"),
      paragraph("Watch-mode notes: slides captured while the lecture played."),
      image(
        slideSvg(
          "Compact Operators",
          ["maps bounded sets to relatively compact sets", "a limit of finite-rank operators"],
          "T ∈ K(X, Y)  ⟺  T(B_X) is relatively compact",
        ),
        "Slide 1",
      ),
      image(
        slideSvg(
          "The Fredholm Alternative",
          ["either (I − T)x = y is solvable for every y", "or the homogeneous equation has a non-zero solution"],
          "dim N(I − T) = dim N(I − T*)",
        ),
        "Slide 2",
      ),
    ],
  },
  {
    id: 1202,
    title: managedTitle("401", 11),
    groupId: 2,
    blocks: [
      header("Real Analysis · Lecture 11"),
      image(
        slideSvg(
          "Uniform Convergence",
          ["convergence is uniform in x", "the limit of continuous functions stays continuous"],
          "sup_x |f_n(x) − f(x)| → 0",
        ),
        "Slide 1",
      ),
    ],
  },
  {
    id: 1203,
    title: "Reading list — spectral theory",
    groupId: 3,
    blocks: [
      header("Reading list — spectral theory"),
      paragraph("Conway, <i>A Course in Functional Analysis</i>, chapter 7."),
      paragraph("Reed &amp; Simon, <i>Methods of Modern Mathematical Physics I</i>, chapter 6."),
      paragraph("From class: the spectrum of a compact operator, and Fredholm theory."),
    ],
  },
  {
    id: 1204,
    title: "Midterm review outline",
    groupId: 0,
    blocks: [
      header("Midterm review outline"),
      paragraph("1. Normed spaces and completeness. 2. Bounded operators. 3. Duality and weak convergence."),
      { type: "delimiter", data: {} },
      paragraph("Worked examples are in the <b>Lecture 9</b> watch-mode note."),
    ],
  },
];

const NOW = stamp(new Date());

function toSummary(note: DemoNote): NoteSummary {
  return {
    id: note.id,
    uuid: `demo-${note.id}`,
    type: 1,
    relevant_id: 0,
    root_id: 0,
    title: note.title,
    note_group_id: note.groupId,
    deleted: 0,
    version: 1,
    created_at: NOW,
    updated_at: NOW,
  };
}

export function demoNoteList(keyword: string): NoteListResult {
  const kw = keyword.trim().toLowerCase();
  const pool = kw ? DEMO_NOTES.filter((n) => n.title.toLowerCase().includes(kw)) : DEMO_NOTES;
  return {
    current_page: 1,
    data: pool.map(toSummary),
    total: pool.length,
    per_page: "500",
    last_page: 1,
  };
}

export function demoNoteDetail(id: number): NoteDetail | null {
  const note = DEMO_NOTES.find((n) => n.id === id);
  if (!note) return null;
  return {
    ...toSummary(note),
    content: JSON.stringify({ time: Date.now(), blocks: note.blocks, version: "2.28.2" }),
    client_time: Date.now(),
    content_updated_time: NOW,
    note_group_name: NOTE_GROUPS.find((g) => g.id === note.groupId)?.name,
  };
}

/** The note the README screenshot opens. */
export const DEMO_NOTE_ID = 1201;

// ------------------------------------------------------------ slide decks ---

export interface DemoSlide {
  filename: string;
  dataUrl: string;
  /** Set when the demo should file this frame in the trash instead. */
  trash?: { reason: "duplicate" | "exclusion" | "ai_filtered" | "ai_filtered_edit"; details: string };
}

const SPECTRUM_SLIDE = () =>
  slideSvg(
    "The Spectrum of a Compact Operator",
    ["σ(T) is at most countable", "every non-zero point is an eigenvalue", "0 is the only accumulation point"],
    "σ(T) \\ {0} ⊂ σ_p(T)",
  );

/** The slides of one lecture folder, including the ones post-processing removed. */
export function demoDeck(courseId: string): DemoSlide[] {
  if (courseId === "401") {
    return [
      { filename: "Slide_001.png", dataUrl: slideSvg("Sequences of Functions", ["pointwise vs. uniform convergence", "why pointwise is not enough"], "f_n → f  pointwise on E") },
      { filename: "Slide_002.png", dataUrl: slideSvg("Uniform Convergence", ["convergence is uniform in x", "continuity passes to the limit"], "sup_x |f_n(x) − f(x)| → 0") },
      { filename: "Slide_003.png", dataUrl: slideSvg("Interchanging Limits", ["uniform convergence on a compact set", "limit and integral commute"], "lim ∫ f_n = ∫ lim f_n") },
      { filename: "Slide_004.png", dataUrl: notSlideSvg(), trash: { reason: "ai_filtered", details: "not_slide" } },
    ];
  }
  return [
    { filename: "Slide_001.png", dataUrl: slideSvg("Compact Operators", ["maps bounded sets to relatively compact sets", "a limit of finite-rank operators"], "T ∈ K(X, Y)  ⟺  T(B_X) relatively compact") },
    { filename: "Slide_002.png", dataUrl: SPECTRUM_SLIDE() },
    { filename: "Slide_003.png", dataUrl: slideSvg("The Fredholm Alternative", ["either (I − T)x = y is solvable", "or the homogeneous equation has a non-zero solution"], "dim N(I − T) = dim N(I − T*)") },
    { filename: "Slide_004.png", dataUrl: slideSvg("Self-Adjoint Compact Operators", ["all eigenvalues are real", "the eigenvectors form an orthonormal basis"], "T = Σ λ_n ⟨·, e_n⟩ e_n") },
    { filename: "Slide_005.png", dataUrl: SPECTRUM_SLIDE(), trash: { reason: "duplicate", details: "Slide_002.png" } },
    { filename: "Slide_006.png", dataUrl: editFrameSvg(), trash: { reason: "ai_filtered_edit", details: "may_be_slide_edit" } },
  ];
}

/** Folders the Slides workspace opens with: course id and week. */
export const DEMO_FOLDERS = [
  { courseId: "501", week: 9 },
  { courseId: "501", week: 10 },
  { courseId: "401", week: 11 },
];
