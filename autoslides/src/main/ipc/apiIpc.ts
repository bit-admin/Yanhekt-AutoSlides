import { ipcMain } from 'electron';
import type { IpcServices } from './types';

export function registerApiIpcHandlers(services: IpcServices): void {
  const { apiClient } = services;

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

  ipcMain.handle('api:getCourseInfo', async (_event, courseId: string, token: string) => {
    return await apiClient.getCourseInfo(courseId, token);
  });

  ipcMain.handle('api:getAvailableSemesters', async () => {
    return await apiClient.getAvailableSemesters();
  });
}
