import { invoke } from './invoke';
import type { ElectronAPI, CourseListOptions, PersonalCourseListOptions } from './electronApi';

export const api: ElectronAPI['api'] = {
  getPersonalLiveList: (token: string, page?: number, pageSize?: number) =>
    invoke('api:getPersonalLiveList', token, page, pageSize),
  searchLiveList: (token: string, keyword: string, page?: number, pageSize?: number) =>
    invoke('api:searchLiveList', token, keyword, page, pageSize),
  getCourseList: (token: string, options: CourseListOptions) =>
    invoke('api:getCourseList', token, options),
  getPersonalCourseList: (token: string, options: PersonalCourseListOptions) =>
    invoke('api:getPersonalCourseList', token, options),
  getSubscriptionList: (token: string, options?: { page?: number; pageSize?: number }) =>
    invoke('api:getSubscriptionList', token, options),
  subscribeCourse: (token: string, courseId: string) =>
    invoke('api:subscribeCourse', token, courseId),
  unsubscribeCourse: (token: string, courseId: string) =>
    invoke('api:unsubscribeCourse', token, courseId),
  getCourseNames: (courseId: string, token: string) =>
    invoke('api:getCourseNames', courseId, token),
  getLiveSessionId: (liveId: string, token: string) =>
    invoke('api:getLiveSessionId', liveId, token),
  getCourseDetail: (courseId: string, token: string) =>
    invoke('api:getCourseDetail', courseId, token),
  getCourseInfo: (courseId: string, token: string) =>
    invoke('api:getCourseInfo', courseId, token),
  getVideoAssets: (videoId: string, token: string) =>
    invoke('api:getVideoAssets', videoId, token),
  getSessionDownloadInfo: (sessionId: string, token: string) =>
    invoke('api:getSessionDownloadInfo', sessionId, token),
  getSessionProgress: (sessionId: string, token: string) =>
    invoke('api:getSessionProgress', sessionId, token),
  reportSessionProgress: (sessionId: string, seconds: number, token: string) =>
    invoke('api:reportSessionProgress', sessionId, seconds, token),
  getAvailableSemesters: () => invoke('api:getAvailableSemesters'),
};
