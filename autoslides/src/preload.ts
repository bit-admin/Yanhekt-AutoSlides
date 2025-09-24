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
  },
  api: {
    getPersonalLiveList: (token: string, page?: number, pageSize?: number) =>
      ipcRenderer.invoke('api:getPersonalLiveList', token, page, pageSize),
    searchLiveList: (token: string, keyword: string, page?: number, pageSize?: number) =>
      ipcRenderer.invoke('api:searchLiveList', token, keyword, page, pageSize),
  },
});
