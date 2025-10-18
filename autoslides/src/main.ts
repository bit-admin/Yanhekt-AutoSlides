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
import { PowerManagementService } from './main/powerManagementService';
import { cacheManagementService } from './main/cacheManagementService';

// Import translation files for main process
import enTranslations from './renderer/i18n/locales/en.json';
import zhTranslations from './renderer/i18n/locales/zh.json';

// Translation function for main process
const getTranslation = (key: string): string => {
  const languageMode = configService.getLanguageMode();
  let locale: 'en' | 'zh' = 'en';

  if (languageMode === 'zh') {
    locale = 'zh';
  } else if (languageMode === 'system') {
    // Detect system language
    const systemLang = app.getLocale();
    locale = systemLang.startsWith('zh') ? 'zh' : 'en';
  }

  const translations = locale === 'zh' ? zhTranslations : enTranslations;
  const keys = key.split('.');
  let result: unknown = translations;

  for (const k of keys) {
    result = (result as Record<string, unknown>)?.[k];
  }

  return (typeof result === 'string' ? result : key);
};

// Declare Vite dev server variables that are injected during build
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Set app name
app.setName('AutoSlides');

// Function to update the application menu
const updateApplicationMenu = () => {
  if (process.platform === 'darwin') {
    const menu = Menu.buildFromTemplate(createMenuTemplate());
    Menu.setApplicationMenu(menu);
  }
};

// Create macOS menu template
const createMenuTemplate = () => {
  const template: Electron.MenuItemConstructorOptions[] = [
    { label: app.name, submenu: [
      { role: 'about' },
      {
        label: 'Legal Notices',
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
      { label: getTranslation('titlebar.visitGitHub'), click: () => { shell.openExternal('https://github.com/bit-admin/Yanhekt-AutoSlides'); } },
      { label: getTranslation('titlebar.itCenterSoftware'), click: () => { shell.openExternal('https://it.ruc.edu.kg/zh/software'); } },
      { type: 'separator' },
      { label: getTranslation('titlebar.webVersion'), click: () => { shell.openExternal('https://learn.ruc.edu.kg'); } },
      { label: getTranslation('titlebar.ssimTest'), click: () => { shell.openExternal('https://learn.ruc.edu.kg/test'); } }
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
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden', // Hide titlebar on all platforms
    frame: false, // Remove frame on all platforms for custom titlebar
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
  // Set up the menu only on macOS, disable on other platforms
  if (process.platform === 'darwin') {
    updateApplicationMenu();
  } else {
    // Disable native menu on non-macOS platforms
    Menu.setApplicationMenu(null);
  }

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
const powerManagementService = new PowerManagementService();

// Initialize power management based on config
const initializePowerManagement = async () => {
  const shouldPreventSleep = configService.getPreventSystemSleep();
  if (shouldPreventSleep) {
    await powerManagementService.preventSleep();
  }
};

// Initialize power management when app is ready
app.whenReady().then(() => {
  initializePowerManagement();
});

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

// IPC handlers for theme configuration
ipcMain.handle('config:setThemeMode', async (event, theme: 'system' | 'light' | 'dark') => {
  configService.setThemeMode(theme);
  return configService.getConfig();
});

ipcMain.handle('config:getThemeMode', async () => {
  return configService.getThemeMode();
});

ipcMain.handle('config:isDarkMode', async () => {
  return configService.isDarkMode();
});

ipcMain.handle('config:getEffectiveTheme', async () => {
  return configService.getEffectiveTheme();
});

// IPC handlers for tour theme management
ipcMain.handle('tour:forceLightTheme', async () => {
  const originalTheme = configService.getThemeMode();
  configService.setThemeMode('light');
  return originalTheme;
});

ipcMain.handle('tour:restoreTheme', async (event, originalTheme: 'system' | 'light' | 'dark') => {
  configService.setThemeMode(originalTheme);
  return configService.getConfig();
});

// IPC handlers for language configuration
ipcMain.handle('config:setLanguageMode', async (event, language: 'system' | 'en' | 'zh') => {
  configService.setLanguageMode(language);
  // Update the application menu with new language
  updateApplicationMenu();
  return configService.getConfig();
});

ipcMain.handle('config:getLanguageMode', async () => {
  return configService.getLanguageMode();
});

ipcMain.handle('config:setPreventSystemSleep', async (event, prevent: boolean) => {
  configService.setPreventSystemSleep(prevent);

  // Apply the power management setting immediately
  if (prevent) {
    await powerManagementService.preventSleep();
  } else {
    await powerManagementService.allowSleep();
  }

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
  ssimPresetMode?: 'adaptive' | 'strict' | 'normal' | 'loose' | 'custom';
  pHashThreshold?: number;
  enableDownsampling?: boolean;
  downsampleWidth?: number;
  downsampleHeight?: number;
}) => {
  configService.setSlideImageProcessingParams(params);
  return configService.getSlideExtractionConfig();
});

// IPC handlers for pHash exclusion list management
ipcMain.handle('config:getPHashExclusionList', async () => {
  return configService.getPHashExclusionList();
});

ipcMain.handle('config:addPHashExclusionItem', async (event, name: string, pHash: string) => {
  return configService.addPHashExclusionItem(name, pHash);
});

ipcMain.handle('config:removePHashExclusionItem', async (event, id: string) => {
  return configService.removePHashExclusionItem(id);
});

ipcMain.handle('config:updatePHashExclusionItemName', async (event, id: string, newName: string) => {
  return configService.updatePHashExclusionItemName(id, newName);
});

ipcMain.handle('config:clearPHashExclusionList', async () => {
  configService.clearPHashExclusionList();
  return configService.getPHashExclusionList();
});

// IPC handler for selecting image file and calculating pHash
ipcMain.handle('config:selectImageForExclusion', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'gif', 'webp'] }
      ],
      title: 'Select Image for Exclusion List'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const imagePath = result.filePaths[0];

      // Read the image file
      const fs = require('fs');
      const imageBuffer = fs.readFileSync(imagePath);

      // Return the image data for pHash calculation in renderer process
      return {
        success: true,
        imagePath,
        imageBuffer: Array.from(imageBuffer), // Convert to array for IPC transfer
        fileName: require('path').basename(imagePath)
      };
    }

    return { success: false, canceled: true };
  } catch (error) {
    console.error('Failed to select image for exclusion:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// IPC handlers for intranet mapping
ipcMain.handle('intranet:setEnabled', async (event, enabled: boolean) => {
  intranetMappingService.setEnabled(enabled);
  return intranetMappingService.getNetworkStatus();
});

ipcMain.handle('intranet:getStatus', async () => {
  return intranetMappingService.getNetworkStatus();
});
ipcMain.handle('intranet:getMappings', async () => {
  return intranetMappingService.getMappings();
});

// IPC handlers for live streams
ipcMain.handle('api:getPersonalLiveList', async (event, token: string, page?: number, pageSize?: number) => {
  return await apiClient.getPersonalLiveList(token, page, pageSize);
});

ipcMain.handle('api:searchLiveList', async (event, token: string, keyword: string, page?: number, pageSize?: number) => {
  return await apiClient.searchLiveList(token, keyword, page, pageSize);
});

// IPC handlers for recorded courses
ipcMain.handle('api:getCourseList', async (event, token: string, options: Record<string, unknown>) => {
  return await apiClient.getCourseList(token, options);
});

ipcMain.handle('api:getPersonalCourseList', async (event, token: string, options: Record<string, unknown>) => {
  return await apiClient.getPersonalCourseList(token, options);
});

ipcMain.handle('api:getCourseInfo', async (event, courseId: string, token: string) => {
  return await apiClient.getCourseInfo(courseId, token);
});

ipcMain.handle('api:getAvailableSemesters', async () => {
  return await apiClient.getAvailableSemesters();
});

// IPC handlers for video proxy
ipcMain.handle('video:getLiveStreamUrls', async (event, stream: Record<string, unknown>, token: string) => {
  try {
    return await videoProxyService.getLiveStreamUrls(stream, token);
  } catch (error) {
    console.error('Failed to get live stream URLs:', error);
    throw error;
  }
});

ipcMain.handle('video:getVideoPlaybackUrls', async (event, session: Record<string, unknown>, token: string) => {
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
ipcMain.handle('dialog:showMessageBox', async (event, options: Electron.MessageBoxOptions) => {
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

// IPC handlers for window controls
ipcMain.handle('window:minimize', async () => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow) {
    focusedWindow.minimize();
    return { success: true };
  }
  return { success: false, error: 'No focused window' };
});

ipcMain.handle('window:maximize', async () => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow) {
    if (focusedWindow.isMaximized()) {
      focusedWindow.unmaximize();
    } else {
      focusedWindow.maximize();
    }
    return { success: true, isMaximized: focusedWindow.isMaximized() };
  }
  return { success: false, error: 'No focused window' };
});

ipcMain.handle('window:close', async () => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow) {
    focusedWindow.close();
    return { success: true };
  }
  return { success: false, error: 'No focused window' };
});

ipcMain.handle('window:isMaximized', async () => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow) {
    return { isMaximized: focusedWindow.isMaximized() };
  }
  return { isMaximized: false };
});

// Shell handlers
ipcMain.handle('shell:openExternal', async (_, url: string) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Failed to open external URL:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Menu handlers for non-macOS platforms
ipcMain.handle('menu:openTermsAndConditions', async () => {
  try {
    const termsPath = app.isPackaged
      ? path.join(process.resourcesPath, 'terms/terms.rtf')
      : path.join(__dirname, '../../resources/terms/terms.rtf');
    await shell.openPath(termsPath);
    return { success: true };
  } catch (error) {
    console.error('Failed to open Terms and Conditions:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('menu:reload', async () => {
  try {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.reload();
      return { success: true };
    }
    return { success: false, error: 'No focused window' };
  } catch (error) {
    console.error('Failed to reload window:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('menu:forceReload', async () => {
  try {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.webContents.reloadIgnoringCache();
      return { success: true };
    }
    return { success: false, error: 'No focused window' };
  } catch (error) {
    console.error('Failed to force reload window:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('menu:toggleDevTools', async () => {
  try {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.webContents.toggleDevTools();
      return { success: true };
    }
    return { success: false, error: 'No focused window' };
  } catch (error) {
    console.error('Failed to toggle dev tools:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('menu:resetZoom', async () => {
  try {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.webContents.setZoomLevel(0);
      return { success: true };
    }
    return { success: false, error: 'No focused window' };
  } catch (error) {
    console.error('Failed to reset zoom:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('menu:zoomIn', async () => {
  try {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      const currentZoom = focusedWindow.webContents.getZoomLevel();
      focusedWindow.webContents.setZoomLevel(currentZoom + 0.5);
      return { success: true };
    }
    return { success: false, error: 'No focused window' };
  } catch (error) {
    console.error('Failed to zoom in:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('menu:zoomOut', async () => {
  try {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      const currentZoom = focusedWindow.webContents.getZoomLevel();
      focusedWindow.webContents.setZoomLevel(currentZoom - 0.5);
      return { success: true };
    }
    return { success: false, error: 'No focused window' };
  } catch (error) {
    console.error('Failed to zoom out:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('menu:toggleFullscreen', async () => {
  try {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
      return { success: true };
    }
    return { success: false, error: 'No focused window' };
  } catch (error) {
    console.error('Failed to toggle fullscreen:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// IPC handlers for power management
ipcMain.handle('powerManagement:preventSleep', async () => {
  try {
    const success = await powerManagementService.preventSleep();
    return { success };
  } catch (error) {
    console.error('Failed to prevent system sleep:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('powerManagement:allowSleep', async () => {
  try {
    const success = await powerManagementService.allowSleep();
    return { success };
  } catch (error) {
    console.error('Failed to allow system sleep:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('powerManagement:isPreventingSleep', async () => {
  try {
    const isPreventing = powerManagementService.isPreventingSleep();
    return { isPreventing };
  } catch (error) {
    console.error('Failed to check sleep prevention status:', error);
    return { isPreventing: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Cleanup power management service when app is quitting
app.on('before-quit', () => {
  powerManagementService.cleanup();
});

// ============================================================================
// Cache Management IPC Handlers
// ============================================================================

ipcMain.handle('cache:getStats', async () => {
  try {
    const stats = await cacheManagementService.getStats();
    return stats;
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return {
      totalSize: 0,
      tempFiles: 0
    };
  }
});

ipcMain.handle('cache:clear', async () => {
  try {
    const result = await cacheManagementService.clearCache();
    return result;
  } catch (error) {
    console.error('Failed to clear cache:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

ipcMain.handle('cache:resetAllData', async () => {
  try {
    const result = await cacheManagementService.resetAllData();
    return result;
  } catch (error) {
    console.error('Failed to reset all data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// ============================================================================
// App Management IPC Handlers
// ============================================================================

ipcMain.handle('app:restart', async () => {
  try {
    app.relaunch();
    app.exit(0);
  } catch (error) {
    console.error('Failed to restart app:', error);
    throw error;
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
