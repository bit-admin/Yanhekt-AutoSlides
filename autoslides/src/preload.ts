import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  auth: {
    login: (username: string, password: string) => ipcRenderer.invoke('auth:login', username, password),
    verifyToken: (token: string) => ipcRenderer.invoke('auth:verifyToken', token),
  },
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    setOutputDirectory: (directory: string) => ipcRenderer.invoke('config:setOutputDirectory', directory),
    selectOutputDirectory: () => ipcRenderer.invoke('config:selectOutputDirectory'),
    setConnectionMode: (mode: 'internal' | 'external') => ipcRenderer.invoke('config:setConnectionMode', mode),
    setMaxConcurrentDownloads: (count: number) => ipcRenderer.invoke('config:setMaxConcurrentDownloads', count),
    setMuteMode: (mode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded') => ipcRenderer.invoke('config:setMuteMode', mode),
    setVideoRetryCount: (count: number) => ipcRenderer.invoke('config:setVideoRetryCount', count),
  },
  api: {
    getPersonalLiveList: (token: string, page?: number, pageSize?: number) =>
      ipcRenderer.invoke('api:getPersonalLiveList', token, page, pageSize),
    searchLiveList: (token: string, keyword: string, page?: number, pageSize?: number) =>
      ipcRenderer.invoke('api:searchLiveList', token, keyword, page, pageSize),
    getCourseList: (token: string, options: any) =>
      ipcRenderer.invoke('api:getCourseList', token, options),
    getPersonalCourseList: (token: string, options: any) =>
      ipcRenderer.invoke('api:getPersonalCourseList', token, options),
    getCourseInfo: (courseId: string, token: string) =>
      ipcRenderer.invoke('api:getCourseInfo', courseId, token),
    getAvailableSemesters: () =>
      ipcRenderer.invoke('api:getAvailableSemesters'),
  },
  intranet: {
    setEnabled: (enabled: boolean) => ipcRenderer.invoke('intranet:setEnabled', enabled),
    getStatus: () => ipcRenderer.invoke('intranet:getStatus'),
  },
  video: {
    getLiveStreamUrls: (stream: any, token: string) =>
      ipcRenderer.invoke('video:getLiveStreamUrls', stream, token),
    getVideoPlaybackUrls: (session: any, token: string) =>
      ipcRenderer.invoke('video:getVideoPlaybackUrls', session, token),
    stopProxy: () => ipcRenderer.invoke('video:stopProxy'),
  },
  ffmpeg: {
    getPath: () => ipcRenderer.invoke('ffmpeg:getPath'),
    isAvailable: () => ipcRenderer.invoke('ffmpeg:isAvailable'),
    getPlatformInfo: () => ipcRenderer.invoke('ffmpeg:getPlatformInfo'),
  },
  download: {
    start: (downloadId: string, m3u8Url: string, outputName: string) =>
      ipcRenderer.invoke('download:start', downloadId, m3u8Url, outputName),
    cancel: (downloadId: string) => ipcRenderer.invoke('download:cancel', downloadId),
    isActive: (downloadId: string) => ipcRenderer.invoke('download:isActive', downloadId),
    onProgress: (callback: (downloadId: string, progress: { current: number; total: number; phase: number }) => void) =>
      ipcRenderer.on('download:progress', (_, downloadId, progress) => callback(downloadId, progress)),
    onCompleted: (callback: (downloadId: string) => void) =>
      ipcRenderer.on('download:completed', (_, downloadId) => callback(downloadId)),
    onError: (callback: (downloadId: string, error: string) => void) =>
      ipcRenderer.on('download:error', (_, downloadId, error) => callback(downloadId, error)),
  },
});
