import { ref, computed, type Ref, type ComputedRef } from "vue";
import {
  getPersonalLiveList,
  getPersonalCourseList,
  type LiveStream,
  type CourseData,
} from "../lib/api";
import { authStore } from "../stores/authStore";
import { openCourse } from "./courseSelection";

// Ported from the desktop app's features/course/useCourseList.ts with the
// Electron ApiClient/tokenManager swapped for the web data layer.

export interface Course {
  id: string;
  title: string;
  instructor: string;
  time: string;
  status?: number;
  subtitle?: string;
  schedule_started_at?: string;
  schedule_ended_at?: string;
  participant_count?: number;
  session?: {
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
    id: stream.id || stream.live_id || "",
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
    id: courseData.id,
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

export interface UseCourseListOptions {
  mode: Ref<"live" | "recorded">;
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
    openCourse(mode.value, course);
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
