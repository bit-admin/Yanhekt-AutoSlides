import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { MainAuthService } from './main/authService';
import { MainApiClient } from './main/apiClient';
import { ConfigService } from './main/configService';
import { IntranetMappingService } from './main/intranetMappingService';
import { VideoProxyService } from './main/videoProxyService';
import { FFmpegService } from './main/ffmpegService';
import { M3u8DownloadService } from './main/m3u8DownloadService';
import { slideExtractionService } from './main/slideExtractionService';

// Declare Vite dev server variables that are injected during build
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Set app name
app.setName('AutoSlides');

// Create macOS menu template
const createMenuTemplate = () => {
  const template: Electron.MenuItemConstructorOptions[] = [
    { label: app.name, submenu: [
      { role: 'about' },
      {
        label: 'Terms and Conditions',
        click: () => {
          // In development, use the source directory; in production, use the app directory
          const termsPath = app.isPackaged
            ? path.join(process.resourcesPath, 'terms/terms.rtf')
            : path.join(__dirname, '../../resources/terms/terms.rtf');
          shell.openPath(termsPath);
        }
      },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ] },
    { label: 'File', submenu: [{ label: 'New', accelerator: 'CmdOrCtrl+N', enabled: false }, { label: 'Open', accelerator: 'CmdOrCtrl+O', enabled: false }, { type: 'separator' }, { role: 'close' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'close' }, { type: 'separator' }, { role: 'front' }] },
    { label: 'Help', role: 'help', submenu: [
      { label: 'Visit GitHub Repository', click: () => { shell.openExternal('https://github.com/bit-admin/Yanhekt-AutoSlides'); } },
      { label: 'SSIM Test', click: () => { shell.openExternal('https://learn.ruc.edu.kg/test'); } },
      { type: 'separator' },
      { label: 'Web Version', click: () => { shell.openExternal('https://learn.ruc.edu.kg'); } },
      { label: 'IT Center Software List', click: () => { shell.openExternal('https://it.ruc.edu.kg/zh/software'); } }
    ] }
  ];
  return template;
};

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
app.on('ready', () => {
  // Set up the menu
  const menu = Menu.buildFromTemplate(createMenuTemplate());
  Menu.setApplicationMenu(menu);

  createWindow();
});

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
const m3u8DownloadService = new M3u8DownloadService(ffmpegService, configService, intranetMappingService, apiClient);

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

ipcMain.handle('config:setMuteMode', async (event, mode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded') => {
  configService.setMuteMode(mode);
  return configService.getConfig();
});
ipcMain.handle('config:setVideoRetryCount', async (event, count: number) => {
  configService.setVideoRetryCount(count);
  return configService.getConfig();
});

ipcMain.handle('config:setTaskSpeed', async (event, speed: number) => {
  configService.setTaskSpeed(speed);
  return configService.getConfig();
});

// IPC handlers for slide extraction configuration
ipcMain.handle('config:getSlideExtractionConfig', async () => {
  return configService.getSlideExtractionConfig();
});

ipcMain.handle('config:setSlideCheckInterval', async (event, interval: number) => {
  configService.setSlideCheckInterval(interval);
  return configService.getSlideExtractionConfig();
});

ipcMain.handle('config:setSlideDoubleVerification', async (event, enabled: boolean, count?: number) => {
  configService.setSlideDoubleVerification(enabled, count);
  return configService.getSlideExtractionConfig();
});

ipcMain.handle('config:setSlideImageProcessingParams', async (event, params: {
  hammingThresholdLow?: number;
  hammingThresholdUp?: number;
  ssimThreshold?: number;
}) => {
  configService.setSlideImageProcessingParams(params);
  return configService.getSlideExtractionConfig();
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

ipcMain.handle('video:registerClient', async () => {
  try {
    const clientId = videoProxyService.registerClient();
    console.log('Video proxy client registered:', clientId);
    return clientId;
  } catch (error) {
    console.error('Failed to register video proxy client:', error);
    throw error;
  }
});

ipcMain.handle('video:unregisterClient', async (event, clientId: string) => {
  try {
    videoProxyService.unregisterClient(clientId);
    console.log('Video proxy client unregistered:', clientId);
  } catch (error) {
    console.error('Failed to unregister video proxy client:', error);
    throw error;
  }
});

ipcMain.handle('video:stopProxy', async () => {
  try {
    videoProxyService.stopVideoProxy();
    console.log('Video proxy stopped');
  } catch (error) {
    console.error('Failed to stop video proxy:', error);
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

// IPC handlers for download functionality
ipcMain.handle('download:start', async (event, downloadId: string, m3u8Url: string, outputName: string, loginToken: string) => {
  const progressCallback = (progress: { current: number; total: number; phase: number }) => {
    event.sender.send('download:progress', downloadId, progress);
  };

  try {
    await m3u8DownloadService.startDownload(downloadId, m3u8Url, outputName, progressCallback, loginToken);
    event.sender.send('download:completed', downloadId);
  } catch (error) {
    console.error(`Download failed for ${downloadId}:`, error);
    event.sender.send('download:error', downloadId, error instanceof Error ? error.message : 'Unknown error');
  }
});

ipcMain.handle('download:cancel', async (event, downloadId: string) => {
  m3u8DownloadService.cancelDownload(downloadId);
});

ipcMain.handle('download:isActive', async (event, downloadId: string) => {
  return m3u8DownloadService.isDownloadActive(downloadId);
});

// IPC handlers for slide extraction
ipcMain.handle('slideExtraction:saveSlide', async (event, outputPath: string, filename: string, imageBuffer: Uint8Array) => {
  try {
    await slideExtractionService.saveSlide(outputPath, filename, imageBuffer);
    return { success: true };
  } catch (error) {
    console.error('Failed to save slide:', error);
    throw error;
  }
});

ipcMain.handle('slideExtraction:ensureDirectory', async (event, path: string) => {
  try {
    await slideExtractionService.ensureDirectory(path);
    return { success: true };
  } catch (error) {
    console.error('Failed to ensure directory:', error);
    throw error;
  }
});

ipcMain.handle('slideExtraction:deleteSlide', async (event, outputPath: string, filename: string) => {
  try {
    await slideExtractionService.deleteSlide(outputPath, filename);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete slide:', error);
    throw error;
  }
});

// IPC handlers for dialog functionality
ipcMain.handle('dialog:showMessageBox', async (event, options: any) => {
  try {
    const result = await dialog.showMessageBox(options);
    return result;
  } catch (error) {
    console.error('Failed to show message box:', error);
    throw error;
  }
});

ipcMain.handle('dialog:showErrorBox', async (event, title: string, content: string) => {
  try {
    dialog.showErrorBox(title, content);
    return { success: true };
  } catch (error) {
    console.error('Failed to show error box:', error);
    throw error;
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
