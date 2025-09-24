/// <reference types="vite/client" />

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
      }>;
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
    }>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}