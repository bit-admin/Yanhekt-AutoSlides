import { ref, computed, type Ref, type ComputedRef } from "vue";
import { getCourseInfo, type SessionData, type CourseInfoResponse } from "../lib/api";
import { authStore } from "../stores/authStore";
import type { Course } from "./useCourseList";

// Ported from the desktop app's features/course/useSessionPage.ts with the
// download/task-queue plumbing stripped (web step 1 is playback only).

/** The slice of `Course` the sessions page consumes. */
export type SessionCourse = Pick<
  Course,
  | "id"
  | "title"
  | "instructor"
  | "time"
  | "classrooms"
  | "college_name"
  | "participant_count"
  | "professors"
  | "school_year"
  | "semester"
>;

export type Session = SessionData;

export interface UseSessionPageOptions {
  course: Ref<SessionCourse | null>;
  t: (key: string, params?: Record<string, unknown>) => string;
  onSessionSelected: (session: Session) => void;
  onBackToCourses: () => void;
}

export interface UseSessionPageReturn {
  sessions: Ref<Session[]>;
  courseInfo: Ref<CourseInfoResponse | null>;
  courseDetails: ComputedRef<SessionCourse | null>;
  isLoading: Ref<boolean>;
  errorMessage: Ref<string>;
  showCourseDetails: Ref<boolean>;
  goBack: () => void;
  selectSession: (session: Session) => void;
  toggleCourseDetails: () => void;
  loadCourseSessions: () => Promise<void>;
  formatDuration: (seconds: number) => string;
  getDayName: (day: number) => string;
  formatDate: (dateString: string) => string;
}

export function useSessionPage(options: UseSessionPageOptions): UseSessionPageReturn {
  const { course, t, onSessionSelected, onBackToCourses } = options;

  const sessions = ref<Session[]>([]);
  const courseInfo = ref<CourseInfoResponse | null>(null);
  const isLoading = ref(false);
  const errorMessage = ref("");
  const showCourseDetails = ref(false);

  // Rich course fields fetched via getCourseInfo (filled in loadCourseSessions).
  // Lets a thin course gain instructor / professors / academic term / college.
  const fetchedCourseInfo = ref<Partial<SessionCourse>>({});

  // The incoming course merged with fetched fields. Incoming values win (the
  // course-grid path already has everything); fetched values fill the gaps.
  const courseDetails = computed<SessionCourse | null>(() => {
    const base = course.value;
    if (!base) return null;
    const extra = fetchedCourseInfo.value;
    return {
      ...base,
      instructor: base.instructor || extra.instructor || "",
      professors: base.professors && base.professors.length > 0 ? base.professors : extra.professors,
      college_name: base.college_name || extra.college_name,
      school_year: base.school_year || extra.school_year,
      semester: base.semester || extra.semester,
      time: base.time || extra.time || "",
    };
  });

  const goBack = (): void => {
    onBackToCourses();
  };

  const selectSession = (session: Session): void => {
    onSessionSelected(session);
  };

  const toggleCourseDetails = (): void => {
    showCourseDetails.value = !showCourseDetails.value;
  };

  const loadCourseSessions = async (): Promise<void> => {
    if (!course.value) {
      errorMessage.value = t("sessions.noCourseSelected");
      return;
    }

    const token = authStore.token.value;
    if (!token) {
      errorMessage.value = t("sessions.pleaseLoginFirst");
      return;
    }

    isLoading.value = true;
    errorMessage.value = "";

    try {
      const response = await getCourseInfo(course.value.id, token);
      courseInfo.value = response;
      sessions.value = response.videos;

      // semester is a number here (vs a string from the course list) —
      // normalize to string. Derive a display term matching useCourseList.
      const semesterStr = response.semester != null ? String(response.semester) : undefined;
      fetchedCourseInfo.value = {
        instructor: response.professor,
        professors: response.professors,
        college_name: response.college_name,
        school_year: response.school_year,
        semester: semesterStr,
        time: response.school_year
          ? `${response.school_year} ${Number(response.semester) === 1 ? "Fall" : "Spring"}`
          : undefined,
      };
    } catch (error: unknown) {
      console.error("Failed to load course sessions:", error);
      errorMessage.value = error instanceof Error ? error.message : t("sessions.failedToLoadSessions");
      sessions.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds === 0) return "N/A";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const getDayName = (day: number): string => {
    const dayNames = [
      "",
      "sessions.monday",
      "sessions.tuesday",
      "sessions.wednesday",
      "sessions.thursday",
      "sessions.friday",
      "sessions.saturday",
      "sessions.sunday",
    ];
    const dayKey = dayNames[day];
    if (dayKey) {
      return t(dayKey);
    }
    return `${t("sessions.day")} ${day}`;
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return {
    sessions,
    courseInfo,
    courseDetails,
    isLoading,
    errorMessage,
    showCourseDetails,
    goBack,
    selectSession,
    toggleCourseDetails,
    loadCourseSessions,
    formatDuration,
    getDayName,
    formatDate,
  };
}
