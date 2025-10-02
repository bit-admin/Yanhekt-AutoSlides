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
      maxConcurrentDownloads: number;
      muteMode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded';
      videoRetryCount: number;
      videoRetryCount: number;
    }>;
    setOutputDirectory: (directory: string) => Promise<{
      outputDirectory: string;
      connectionMode: 'internal' | 'external';
      maxConcurrentDownloads: number;
      muteMode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded';
      videoRetryCount: number;
    }>;
    selectOutputDirectory: () => Promise<{
      outputDirectory: string;
      connectionMode: 'internal' | 'external';
      maxConcurrentDownloads: number;
      muteMode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded';
      videoRetryCount: number;
    } | null>;
    setConnectionMode: (mode: 'internal' | 'external') => Promise<{
      outputDirectory: string;
      connectionMode: 'internal' | 'external';
      maxConcurrentDownloads: number;
      muteMode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded';
      videoRetryCount: number;
    }>;
    setMaxConcurrentDownloads: (count: number) => Promise<{
      outputDirectory: string;
      connectionMode: 'internal' | 'external';
      maxConcurrentDownloads: number;
      muteMode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded';
      videoRetryCount: number;
    }>;
    setMuteMode: (mode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded') => Promise<{
      outputDirectory: string;
      connectionMode: 'internal' | 'external';
      maxConcurrentDownloads: number;
      muteMode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded';
      videoRetryCount: number;
    }>;
    setVideoRetryCount: (count: number) => Promise<{
      outputDirectory: string;
      connectionMode: 'internal' | 'external';
      maxConcurrentDownloads: number;
      muteMode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded';
      videoRetryCount: number;
    }>;
    // Slide extraction configuration
    getSlideExtractionConfig: () => Promise<{
      checkInterval: number;
      enableDoubleVerification: boolean;
      verificationCount: number;
      hammingThresholdLow: number;
      hammingThresholdUp: number;
      ssimThreshold: number;
    }>;
    setSlideCheckInterval: (interval: number) => Promise<{
      checkInterval: number;
      enableDoubleVerification: boolean;
      verificationCount: number;
      hammingThresholdLow: number;
      hammingThresholdUp: number;
      ssimThreshold: number;
    }>;
    setSlideDoubleVerification: (enabled: boolean, count?: number) => Promise<{
      checkInterval: number;
      enableDoubleVerification: boolean;
      verificationCount: number;
      hammingThresholdLow: number;
      hammingThresholdUp: number;
      ssimThreshold: number;
    }>;
    setSlideImageProcessingParams: (params: {
      hammingThresholdLow?: number;
      hammingThresholdUp?: number;
      ssimThreshold?: number;
    }) => Promise<{
      checkInterval: number;
      enableDoubleVerification: boolean;
      verificationCount: number;
      hammingThresholdLow: number;
      hammingThresholdUp: number;
      ssimThreshold: number;
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
  intranet: {
    setEnabled: (enabled: boolean) => Promise<{
      mode: string;
      enabled: boolean;
      mappingCount: number;
    }>;
    getStatus: () => Promise<{
      mode: string;
      enabled: boolean;
      mappingCount: number;
    }>;
  };
  video: {
    getLiveStreamUrls: (stream: any, token: string) => Promise<{
      stream_id?: string;
      title: string;
      streams: {
        [key: string]: {
          type: 'camera' | 'screen';
          name: string;
          url: string;
          original_url: string;
        };
      };
    }>;
    getVideoPlaybackUrls: (session: any, token: string) => Promise<{
      session_id?: string;
      video_id?: string;
      title: string;
      duration?: string;
      streams: {
        [key: string]: {
          type: 'camera' | 'screen';
          name: string;
          url: string;
          original_url: string;
        };
      };
    }>;
    registerClient: () => Promise<string>;
    unregisterClient: (clientId: string) => Promise<void>;
    stopProxy: () => Promise<void>;
  };
  ffmpeg: {
    getPath: () => Promise<string | null>;
    isAvailable: () => Promise<boolean>;
    getPlatformInfo: () => Promise<{
      platform: string;
      ffmpegPath: string | null;
      isPackaged: boolean;
    }>;
  };
  download: {
    start: (downloadId: string, m3u8Url: string, outputName: string) => Promise<void>;
    cancel: (downloadId: string) => Promise<void>;
    isActive: (downloadId: string) => Promise<boolean>;
    onProgress: (callback: (downloadId: string, progress: { current: number; total: number; phase: number }) => void) => void;
    onCompleted: (callback: (downloadId: string) => void) => void;
    onError: (callback: (downloadId: string, error: string) => void) => void;
  };
  slideExtraction: {
    saveSlide: (outputPath: string, filename: string, imageBuffer: Uint8Array) => Promise<{ success: boolean }>;
    ensureDirectory: (path: string) => Promise<{ success: boolean }>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};