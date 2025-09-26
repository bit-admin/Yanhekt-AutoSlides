import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { MainAuthService } from './main/authService';
import { MainApiClient } from './main/apiClient';
import { ConfigService } from './main/configService';
import { IntranetMappingService } from './main/intranetMappingService';
import { VideoProxyService } from './main/videoProxyService';
import { FFmpegService } from './main/ffmpegService';

// Declare Vite dev server variables that are injected during build
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools only in development
  if (process.env.NODE_ENV === 'development') {
    // mainWindow.webContents.openDevTools();
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Initialize services
const authService = new MainAuthService();
const apiClient = new MainApiClient();
const configService = new ConfigService();
const intranetMappingService = new IntranetMappingService(configService);
const videoProxyService = new VideoProxyService(apiClient, intranetMappingService);
const ffmpegService = new FFmpegService();

// IPC handlers for authentication
ipcMain.handle('auth:login', async (event, username: string, password: string) => {
  return await authService.loginAndGetToken(username, password);
});

ipcMain.handle('auth:verifyToken', async (event, token: string) => {
  return await apiClient.verifyToken(token);
});

// IPC handlers for config
ipcMain.handle('config:get', async () => {
  return configService.getConfig();
});

ipcMain.handle('config:setOutputDirectory', async (event, directory: string) => {
  configService.setOutputDirectory(directory);
  return configService.getConfig();
});

ipcMain.handle('config:selectOutputDirectory', async () => {
  const selectedPath = await configService.selectOutputDirectory();
  return selectedPath ? configService.getConfig() : null;
});

ipcMain.handle('config:setConnectionMode', async (event, mode: 'internal' | 'external') => {
  configService.setConnectionMode(mode);
  // Update intranet mode based on connection mode
  intranetMappingService.setEnabled(mode === 'internal');
  return configService.getConfig();
});

ipcMain.handle('config:setMaxConcurrentDownloads', async (event, count: number) => {
  configService.setMaxConcurrentDownloads(count);
  return configService.getConfig();
});

// IPC handlers for intranet mapping
ipcMain.handle('intranet:setEnabled', async (event, enabled: boolean) => {
  intranetMappingService.setEnabled(enabled);
  return intranetMappingService.getNetworkStatus();
});

ipcMain.handle('intranet:getStatus', async () => {
  return intranetMappingService.getNetworkStatus();
});

// IPC handlers for live streams
ipcMain.handle('api:getPersonalLiveList', async (event, token: string, page?: number, pageSize?: number) => {
  return await apiClient.getPersonalLiveList(token, page, pageSize);
});

ipcMain.handle('api:searchLiveList', async (event, token: string, keyword: string, page?: number, pageSize?: number) => {
  return await apiClient.searchLiveList(token, keyword, page, pageSize);
});

// IPC handlers for recorded courses
ipcMain.handle('api:getCourseList', async (event, token: string, options: any) => {
  return await apiClient.getCourseList(token, options);
});

ipcMain.handle('api:getPersonalCourseList', async (event, token: string, options: any) => {
  return await apiClient.getPersonalCourseList(token, options);
});

ipcMain.handle('api:getCourseInfo', async (event, courseId: string, token: string) => {
  return await apiClient.getCourseInfo(courseId, token);
});

ipcMain.handle('api:getAvailableSemesters', async () => {
  return MainApiClient.getAvailableSemesters();
});

// IPC handlers for video proxy
ipcMain.handle('video:getLiveStreamUrls', async (event, stream: any, token: string) => {
  try {
    return await videoProxyService.getLiveStreamUrls(stream, token);
  } catch (error) {
    console.error('Failed to get live stream URLs:', error);
    throw error;
  }
});

ipcMain.handle('video:getVideoPlaybackUrls', async (event, session: any, token: string) => {
  try {
    return await videoProxyService.getVideoPlaybackUrls(session, token);
  } catch (error) {
    console.error('Failed to get video playback URLs:', error);
    throw error;
  }
});

// IPC handlers for FFmpeg
ipcMain.handle('ffmpeg:getPath', async () => {
  return ffmpegService.getFfmpegPath();
});

ipcMain.handle('ffmpeg:isAvailable', async () => {
  return ffmpegService.isAvailable();
});

ipcMain.handle('ffmpeg:getPlatformInfo', async () => {
  return ffmpegService.getPlatformInfo();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
