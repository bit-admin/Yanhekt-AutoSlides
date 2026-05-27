import { ipcRenderer } from 'electron';

export const api = {
  getPersonalLiveList: (token: string, page?: number, pageSize?: number) =>
    ipcRenderer.invoke('api:getPersonalLiveList', token, page, pageSize),
  searchLiveList: (token: string, keyword: string, page?: number, pageSize?: number) =>
    ipcRenderer.invoke('api:searchLiveList', token, keyword, page, pageSize),
  getCourseList: (token: string, options: Record<string, unknown>) =>
    ipcRenderer.invoke('api:getCourseList', token, options),
  getPersonalCourseList: (token: string, options: Record<string, unknown>) =>
    ipcRenderer.invoke('api:getPersonalCourseList', token, options),
  getCourseInfo: (courseId: string, token: string) =>
    ipcRenderer.invoke('api:getCourseInfo', courseId, token),
  getAvailableSemesters: () => ipcRenderer.invoke('api:getAvailableSemesters'),
};
