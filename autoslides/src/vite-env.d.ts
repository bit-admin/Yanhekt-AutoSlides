/// <reference types="vite/client" />
/// <reference types="electron" />

import type { ElectronAPI } from './preload/electronApi';

declare const _MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const _MAIN_WINDOW_VITE_NAME: string;

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    __liveProxyWarmedUp?: boolean;
  }
}

export {};
