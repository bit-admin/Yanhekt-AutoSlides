/// <reference types="vite/client" />
/// <reference types="electron" />

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

interface ElectronAPI {
  auth: {
    login: (username: string, password: string) => Promise<{
      success: boolean;
      token?: string;
      error?: string;
    }>;
    verifyToken: (token: string) => Promise<{
      valid: boolean;
      userData: {
        badge: string;
        nickname: string;
        gender?: number;
        phone?: string;
      } | null;
      networkError?: boolean;
    }>;
  };
  config: {
    get: () => Promise<{
      outputDirectory: string;
      connectionMode: 'internal' | 'external';
    }>;
    setOutputDirectory: (directory: string) => Promise<{
      outputDirectory: string;
      connectionMode: 'internal' | 'external';
    }>;
    selectOutputDirectory: () => Promise<{
      outputDirectory: string;
      connectionMode: 'internal' | 'external';
    } | null>;
    setConnectionMode: (mode: 'internal' | 'external') => Promise<{
      outputDirectory: string;
      connectionMode: 'internal' | 'external';
    }>;
  };
  api: {
    getPersonalLiveList: (token: string, page?: number, pageSize?: number) => Promise<{
      data: Array<{
        id: string;
        live_id?: string;
        title: string;
        subtitle?: string;
        status: number;
        schedule_started_at: string;
        schedule_ended_at: string;
        participant_count?: number;
        session?: {
          professor?: {
            name: string;
          };
          section_group_title?: string;
        };
        target?: string;
        target_vga?: string;
      }>;
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
    }>;
    searchLiveList: (token: string, keyword: string, page?: number, pageSize?: number) => Promise<{
      data: Array<{
        id: string;
        live_id?: string;
        title: string;
        subtitle?: string;
        status: number;
        schedule_started_at: string;
        schedule_ended_at: string;
        participant_count?: number;
        session?: {
          professor?: {
            name: string;
          };
          section_group_title?: string;
        };
        target?: string;
        target_vga?: string;
      }>;
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
    }>;
    getCourseList: (token: string, options: any) => Promise<{
      data: Array<{
        id: string;
        name_zh: string;
        professors: string[];
        classrooms: { name: string }[];
        school_year: string;
        semester: string;
        college_name: string;
        participant_count: number;
      }>;
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
    }>;
    getPersonalCourseList: (token: string, options: any) => Promise<{
      data: Array<{
        id: string;
        name_zh: string;
        professors: string[];
        classrooms: { name: string }[];
        school_year: string;
        semester: string;
        college_name: string;
        participant_count: number;
      }>;
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
    }>;
    getCourseInfo: (courseId: string, token: string) => Promise<{
      course_id: string;
      title: string;
      professor: string;
      videos: Array<{
        id: string;
        session_id: string;
        video_id: string;
        title: string;
        duration: number;
        week_number: number;
        day: number;
        started_at: string;
        ended_at: string;
        main_url?: string;
        vga_url?: string;
      }>;
    }>;
    getAvailableSemesters: () => Promise<Array<{
      id: number;
      label: string;
      labelEn: string;
      schoolYear: number;
      semester: number;
    }>>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};