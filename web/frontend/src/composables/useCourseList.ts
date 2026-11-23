import { ref, computed, type Ref, type ComputedRef } from "vue";
import {
  getPersonalLiveList,
  getPersonalCourseList,
  type LiveStream,
  type CourseData,
} from "../lib/api";
import { authStore } from "../stores/authStore";
import { openCourse } from "./courseSelection";
import { localeTag } from "../i18n";
import { getPastEnrolledCourses } from "./pastEnrolledCourses";
import {
  getSubscribedCourse,
  subscribedListIsCurrent,
  subscribedRecordedCourses,
  syncSubscribedCoursesFromServer,
} from "./subscribedCourses";

/** A visit to Subscriptions re-syncs at most this often. */
const SUBSCRIPTIONS_MAX_AGE_MS = 60 * 1000;

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
  /**
   * Live only: the session behind this broadcast, when the row carried it
   * (`GET /v1/live?id=` detail does; list rows do not). Naming resolves a
   * missing one through `liveSessionIds.ts`.
   */
  liveSessionId?: string;
  /**
   * The Chinese course name (`name_zh`). **Canonical** — the IndexedDB folder key,
   * slide metadata `source.courseTitle` and managed note titles all derive from
   * this. Never swap it for a localized string.
   */
  title: string;
  /**
   * The English course name (`name_en`), when Yanhekt supplied one. **Display
   * only** — render it through `courseDisplayTitle()`, never into a folder key.
   */
  titleEn?: string;
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
  /** Course cover URL from Yanhekt; resolve with resolveCourseCover(). */
  imageUrl?: string;
}

/** Non-empty trimmed string, else undefined (API often sends ""). */
const trimImageUrl = (value?: string | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

// Transform functions (shared by the course grid, Home page rows, and Search page)
export const transformLiveStreamToCourse = (stream: LiveStream): Course => {
  const startTime = new Date(stream.schedule_started_at).toLocaleTimeString(localeTag(), {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = new Date(stream.schedule_ended_at).toLocaleTimeString(localeTag(), {
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
    liveSessionId: stream.session?.id != null ? String(stream.session.id) : undefined,
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
    imageUrl: trimImageUrl(stream.img || stream.course?.image_url),
  };
};

export const transformCourseDataToCourse = (courseData: CourseData): Course => {
  const professors = courseData.professors ? courseData.professors.join(", ") : "Unknown";

  const semesterText = courseData.semester === "1" ? "Fall" : "Spring";
  const timeInfo = `${courseData.school_year} ${semesterText}`;

  return {
    id: String(courseData.id),
    title: courseData.name_zh,
    titleEn: courseData.name_en,
    instructor: professors,
    time: timeInfo,
    professors: courseData.professors,
    classrooms: courseData.classrooms,
    school_year: courseData.school_year,
    semester: courseData.semester,
    college_name: courseData.college_name,
    participant_count: courseData.participant_count,
    imageUrl: trimImageUrl(courseData.image_url),
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
    // Re-entrancy guard: infinite scroll and the activeNav watcher can both
    // land while a fetch is running, and two overlapping runs would append the
    // same page twice. loadMore has its own guard; this covers everyone else.
    if (isLoading.value) return;

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
        // The merged list, which also holds earlier terms Yanhekt no longer lists.
        const shown = () =>
          subscribedRecordedCourses.value
            .map((c) => getSubscribedCourse(c.id))
            .filter((c): c is Course => !!c);
        if (subscribedListIsCurrent()) courses.value = shown();
        const ok = await syncSubscribedCoursesFromServer({ maxAgeMs: SUBSCRIPTIONS_MAX_AGE_MS });
        if (authStore.token.value !== token) return;
        courses.value = ok || subscribedListIsCurrent() ? shown() : [];
        totalPages.value = 1;
        currentPage.value = 1;
        if (!ok && !courses.value.length) throw new Error("Failed to fetch subscriptions");
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
        // Earlier terms follow the last page of the current term.
        if (currentPage.value >= totalPages.value) {
          const past = await getPastEnrolledCourses(token);
          if (authStore.token.value !== token || mode.value !== "recorded") return;
          const seen = new Set(courses.value.map((c) => c.id));
          courses.value = [...courses.value, ...past.filter((c) => !seen.has(c.id))];
        }
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
