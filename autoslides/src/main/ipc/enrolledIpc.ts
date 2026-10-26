import { ipcMain } from 'electron';
import type { IpcServices } from './types';

// The Recorded page's enrolled courses. Main writes the list and broadcasts
// config itself (`EnrolledCoursesService`); a refresh resolves once the current
// term is read, and earlier terms keep filling in the background.
export function registerEnrolledIpcHandlers({ enrolledCoursesService }: IpcServices): void {
  ipcMain.handle('enrolled:refresh', (_event, owner: unknown) =>
    enrolledCoursesService.refresh(typeof owner === 'string' ? owner : ''));
}
