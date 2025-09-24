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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}