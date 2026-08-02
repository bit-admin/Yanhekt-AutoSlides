import { ref, computed, type Ref, type ComputedRef } from "vue";
import {
  getPersonalLiveList,
  getPersonalCourseList,
  getSubscriptionList,
  type LiveStream,
  type CourseData,
  type SubscriptionCourseRow,
} from "../lib/api";
import { authStore } from "../stores/authStore";
import { openCourse } from "./courseSelection";

// Ported from the desktop app's features/course/useCourseList.ts with the
// Electron ApiClient/tokenManager swapped for the web data layer.

export interface Course {
  /**
   * Recorded: the course id. **Live: the BROADCAST id.** Use `courseId` when
   * you need the actual course.
   */
  id: string;
  /** The real course id; only set for live, where `id` is a broadcast id. */
  courseId?: string;
  title: string;
  instructor: string;
  time: string;
  status?: number;
  subtitle?: string;
  schedule_started_at?: string;
  schedule_ended_at?: string;
  participant_count?: number;
  session?: {
    course_id?: number | string;
    professor?: {
      name: string;
    };
    section_group_title?: string;
  };
  target?: string;
  target_vga?: string;
  professors?: string[];
  classrooms?: { name: string }[];
  school_year?: string;
  semester?: string;
  college_name?: string;
}

// Transform functions (shared by the course grid, Home page rows, and Search page)
export const transformLiveStreamToCourse = (stream: LiveStream): Course => {
  const startTime = new Date(stream.schedule_started_at).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = new Date(stream.schedule_ended_at).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    // Runtime ids are numbers despite the declared string types — normalize
    // so route params and stash keys (always strings) compare reliably.
    id: String(stream.id || stream.live_id || ""),
    // Broadcast id above; the real course id rides alongside so slide folders
    // group by course while staying unique per broadcast.
    courseId: stream.session?.course_id != null ? String(stream.session.course_id) : undefined,
    title: stream.title || "Untitled",
    instructor: stream.session?.professor?.name || "Unknown",
    time: `${startTime} - ${endTime}`,
    status: stream.status,
    subtitle: stream.subtitle,
    schedule_started_at: stream.schedule_started_at,
    schedule_ended_at: stream.schedule_ended_at,
    participant_count: stream.participant_count,
    session: stream.session,
    target: stream.target,
    target_vga: stream.target_vga,
  };
};

export const transformCourseDataToCourse = (courseData: CourseData): Course => {
  const professors = courseData.professors ? courseData.professors.join(", ") : "Unknown";

  const semesterText = courseData.semester === "1" ? "Fall" : "Spring";
  const timeInfo = `${courseData.school_year} ${semesterText}`;

  return {
    id: String(courseData.id),
    title: courseData.name_zh,
    instructor: professors,
    time: timeInfo,
    professors: courseData.professors,
    classrooms: courseData.classrooms,
    school_year: courseData.school_year,
    semester: courseData.semester,
    college_name: courseData.college_name,
    participant_count: courseData.participant_count,
  };
};

/** Map a subscription list row into the shared Course card shape. */
export const transformSubscriptionRowToCourse = (row: SubscriptionCourseRow): Course => {
  // Keep professor resolution inlined (same rules as subscribedCourses) so this
  // module does not import that composable (it imports Course from here).
  let professors: string[] = [];
  if (Array.isArray(row.professor_names) && row.professor_names.length) {
    professors = row.professor_names.map(String).map((s) => s.trim()).filter(Boolean);
  } else if (Array.isArray(row.professors)) {
    professors = row.professors
      .map((p) => (typeof p === "string" ? p : (p?.name ?? "")))
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const schoolYear = row.school_year != null ? String(row.school_year) : undefined;
  const semester = row.semester != null ? String(row.semester) : undefined;
  const semesterText = semester === "1" ? "Fall" : semester === "2" ? "Spring" : "";
  const timeInfo =
    schoolYear && semesterText
      ? `${schoolYear} ${semesterText}`
      : schoolYear || semesterText || "";

  return {
    id: String(row.id),
    title: row.name_zh || "Untitled",
    instructor: professors.length ? professors.join(", ") : "Unknown",
    time: timeInfo,
    professors: professors.length ? professors : undefined,
    classrooms: row.classrooms
      ?.map((c) => ({ name: c.name }))
      .filter((c) => !!c.name),
    school_year: schoolYear,
    semester,
    college_name: row.college_name || row.college?.name,
    participant_count: row.participant_count,
  };
};

// Status helpers (shared by every surface that renders live course cards)
export const getCourseStatusClass = (status?: number): string => {
  switch (status) {
    case 0:
      return "status-ended";
    case 1:
      return "status-live";
    case 2:
      return "status-upcoming";
    default:
      return "status-unknown";
  }
};

export const getCourseStatusText = (status: number | undefined, t: (key: string) => string): string => {
  switch (status) {
    case 0:
      return t("courses.status.ended");
    case 1:
      return t("courses.status.live");
    case 2:
      return t("courses.status.upcoming");
    default:
      return t("courses.status.unknown");
  }
};

export type CourseListMode = "live" | "recorded" | "subscriptions";

export interface UseCourseListOptions {
  mode: Ref<CourseListMode>;
  t: (key: string) => string;
}

export interface UseCourseListReturn {
  isLoading: Ref<boolean>;
  courses: Ref<Course[]>;
  currentPage: Ref<number>;
  totalPages: Ref<number>;
  errorMessage: Ref<string>;
  paginatedCourses: ComputedRef<Course[]>;
  fetchPersonalCourses: () => Promise<void>;
  loadMore: () => Promise<void>;
  selectCourse: (course: Course) => void;
  getStatusClass: (status?: number) => string;
  getStatusText: (status?: number) => string;
}

export function useCourseList(options: UseCourseListOptions): UseCourseListReturn {
  const { mode, t } = options;

  const coursesPerPage = 16;

  const isLoading = ref(false);
  const courses = ref<Course[]>([]);
  const currentPage = ref(1);
  const totalPages = ref(1);
  const errorMessage = ref("");

  const paginatedCourses = computed(() => courses.value);

  const fetchPersonalCourses = async (resetPage = true) => {
    const token = authStore.token.value;
    if (!token) {
      errorMessage.value = "Please login first";
      return;
    }

    isLoading.value = true;
    errorMessage.value = "";

    if (resetPage) {
      currentPage.value = 1;
    }

    try {
      if (mode.value === "live") {
        const response = await getPersonalLiveList(token, currentPage.value, coursesPerPage);
        const transformed = response.data.map(transformLiveStreamToCourse);
        if (resetPage) {
          courses.value = transformed;
        } else {
          courses.value = [...courses.value, ...transformed];
        }
        totalPages.value = response.last_page;
        currentPage.value = response.current_page;
      } else if (mode.value === "subscriptions") {
        // Same grid as Recordings; source is the Yanhekt subscription list.
        const response = await getSubscriptionList(token, {
          page: currentPage.value,
          pageSize: coursesPerPage,
        });
        const transformed = (response.data ?? []).map(transformSubscriptionRowToCourse);
        if (resetPage) {
          courses.value = transformed;
        } else {
          courses.value = [...courses.value, ...transformed];
        }
        totalPages.value = Number(response.last_page) || 1;
        currentPage.value = Number(response.current_page) || currentPage.value;
      } else {
        const response = await getPersonalCourseList(token, {
          page: currentPage.value,
          pageSize: coursesPerPage,
        });
        const transformed = response.data.map(transformCourseDataToCourse);
        if (resetPage) {
          courses.value = transformed;
        } else {
          courses.value = [...courses.value, ...transformed];
        }
        totalPages.value = response.last_page;
        currentPage.value = response.current_page;
      }
    } catch (error: unknown) {
      console.error("Failed to fetch personal courses:", error);
      errorMessage.value = (error instanceof Error && error.message) || "Failed to fetch personal courses";
      if (resetPage) {
        courses.value = [];
      }
    } finally {
      isLoading.value = false;
    }
  };

  const loadMore = async () => {
    if (isLoading.value || currentPage.value >= totalPages.value) return;
    currentPage.value += 1;
    await fetchPersonalCourses(false);
  };

  const getStatusClass = (status?: number): string => getCourseStatusClass(status);
  const getStatusText = (status?: number): string => getCourseStatusText(status, t);

  const selectCourse = (course: Course) => {
    // Subscriptions are always recorded courses.
    openCourse(mode.value === "subscriptions" ? "recorded" : mode.value, course);
  };

  return {
    isLoading,
    courses,
    currentPage,
    totalPages,
    errorMessage,
    paginatedCourses,
    fetchPersonalCourses,
    loadMore,
    selectCourse,
    getStatusClass,
    getStatusText,
  };
}
