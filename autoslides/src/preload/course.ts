import { ipcRenderer } from 'electron';
import type { ElectronAPI, CourseListOptions, PersonalCourseListOptions } from './electronApi';

export const api: ElectronAPI['api'] = {
  getPersonalLiveList: (token: string, page?: number, pageSize?: number) =>
    ipcRenderer.invoke('api:getPersonalLiveList', token, page, pageSize),
  searchLiveList: (token: string, keyword: string, page?: number, pageSize?: number) =>
    ipcRenderer.invoke('api:searchLiveList', token, keyword, page, pageSize),
  getCourseList: (token: string, options: CourseListOptions) =>
    ipcRenderer.invoke('api:getCourseList', token, options),
  getPersonalCourseList: (token: string, options: PersonalCourseListOptions) =>
    ipcRenderer.invoke('api:getPersonalCourseList', token, options),
  getSubscriptionList: (token: string, options?: { page?: number; pageSize?: number }) =>
    ipcRenderer.invoke('api:getSubscriptionList', token, options),
  subscribeCourse: (token: string, courseId: string) =>
    ipcRenderer.invoke('api:subscribeCourse', token, courseId),
  unsubscribeCourse: (token: string, courseId: string) =>
    ipcRenderer.invoke('api:unsubscribeCourse', token, courseId),
  getCourseInfo: (courseId: string, token: string) =>
    ipcRenderer.invoke('api:getCourseInfo', courseId, token),
  getAvailableSemesters: () => ipcRenderer.invoke('api:getAvailableSemesters'),
};
