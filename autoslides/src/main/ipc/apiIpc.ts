import { ipcMain } from 'electron';
import type { IpcServices } from './types';

export function registerApiIpcHandlers(services: IpcServices): void {
  const { apiClient, courseLookup, courseIndex, courseIndexUpdater } = services;

  // Course index search in one term (Settings → General → Search picks the source).
  ipcMain.handle('api:searchCourseIndex', async (_event, term: unknown, keyword: unknown, page?: unknown, pageSize?: unknown) => {
    return courseLookup.search(String(term), String(keyword ?? ''), Number(page) || 1, Math.min(Number(pageSize) || 16, 100));
  });

  // Settings: what the course index on this computer holds, and its updates.
  const indexStatus = async () => {
    const [terms, generatedAt, update] = await Promise.all([
      courseIndex.terms(),
      courseIndex.generatedAt(),
      courseIndexUpdater.getState(),
    ]);
    return { hasKey: courseIndex.passphrase !== null, terms, generatedAt, ...update };
  };
  ipcMain.handle('courseIndex:getStatus', indexStatus);
  ipcMain.handle('courseIndex:update', async () => {
    await courseIndexUpdater.check();
    return indexStatus();
  });

  ipcMain.handle('api:getPersonalLiveList', async (_event, token: string, page?: number, pageSize?: number) => {
    return await apiClient.getPersonalLiveList(token, page, pageSize);
  });

  ipcMain.handle('api:searchLiveList', async (_event, token: string, keyword: string, page?: number, pageSize?: number) => {
    return await apiClient.searchLiveList(token, keyword, page, pageSize);
  });

  ipcMain.handle('api:getCourseList', async (_event, token: string, options: Record<string, unknown>) => {
    return await apiClient.getCourseList(token, options);
  });

  ipcMain.handle('api:getPersonalCourseList', async (_event, token: string, options: Record<string, unknown>) => {
    return await apiClient.getPersonalCourseList(token, options);
  });

  ipcMain.handle('api:getSubscriptionList', async (_event, token: string, options?: { page?: number; pageSize?: number }) => {
    return await apiClient.getSubscriptionList(token, options);
  });

  ipcMain.handle('api:subscribeCourse', async (_event, token: string, courseId: string) => {
    return await apiClient.subscribeCourse(token, courseId);
  });

  ipcMain.handle('api:unsubscribeCourse', async (_event, token: string, courseId: string) => {
    return await apiClient.unsubscribeCourse(token, courseId);
  });

  ipcMain.handle('api:getCourseNames', async (_event, courseId: string, token: string) => {
    return await apiClient.getCourseNames(courseId, token);
  });

  ipcMain.handle('api:getLiveSessionId', async (_event, liveId: string, token: string) => {
    return await apiClient.getLiveSessionId(liveId, token);
  });

  ipcMain.handle('api:getCourseDetail', async (_event, courseId: string, token: string) => {
    return await apiClient.getCourseDetail(String(courseId), token);
  });

  ipcMain.handle('api:getCourseInfo', async (_event, courseId: string, token: string) => {
    return await apiClient.getCourseInfo(courseId, token);
  });

  ipcMain.handle('api:getVideoAssets', async (_event, videoId: string, token: string) => {
    return apiClient.getVideoAssets(videoId, token);
  });

  ipcMain.handle('api:getSessionDownloadInfo', async (_event, sessionId: string, token: string) => {
    return apiClient.getSessionDownloadInfo(sessionId, token);
  });

  ipcMain.handle('api:getSessionProgress', async (_event, sessionId: string, token: string) => {
    return apiClient.getSessionProgress(sessionId, token);
  });

  ipcMain.handle('api:reportSessionProgress', async (_event, sessionId: string, seconds: number, token: string) => {
    return apiClient.reportSessionProgress(sessionId, seconds, token);
  });

  ipcMain.handle('api:getAvailableSemesters', async () => {
    return await apiClient.getAvailableSemesters();
  });
}
