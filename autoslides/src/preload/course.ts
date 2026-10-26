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
  getCourseNames: (courseId: string, token: string) =>
    invoke('api:getCourseNames', courseId, token),
  getLiveDetail: (liveId: string, token: string) =>
    invoke('api:getLiveDetail', liveId, token),
  getCourseDetail: (courseId: string, token: string) =>
    invoke('api:getCourseDetail', courseId, token),
  searchCourseIndex: (token: string, term: string, keyword: string, page?: number, pageSize?: number) =>
    invoke('api:searchCourseIndex', token, term, keyword, page, pageSize),
  getCourseIndexStatus: () => invoke('courseIndex:getStatus'),
  updateCourseIndex: () => invoke('courseIndex:update'),
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

export const pins: ElectronAPI['pins'] = {
  sync: (owner) => invoke('pins:sync', owner),
  toggle: (owner, request) => invoke('pins:toggle', owner, request),
  remove: (owner, key) => invoke('pins:remove', owner, key),
  upgrade: (owner, request) => invoke('pins:upgrade', owner, request),
};
