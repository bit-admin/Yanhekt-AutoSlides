import { app, BrowserWindow, ipcMain, dialog, Menu, shell, nativeTheme, session } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { MainAuthService } from './main/authService';
import { MainApiClient } from './main/apiClient';
import { ConfigService } from './main/configService';
import { IntranetMappingService } from './main/intranetMappingService';
import { VideoProxyService, LiveStreamInput, RecordedSessionInput } from './main/videoProxyService';
import { FFmpegService } from './main/ffmpegService';
import { M3u8DownloadService } from './main/m3u8DownloadService';
import { slideExtractionService, TrashMetadata } from './main/slideExtractionService';
import { PowerManagementService } from './main/powerManagementService';
import { cacheManagementService } from './main/cacheManagementService';
import { AIPromptsService } from './main/aiPromptsService';
import { AIFilteringService } from './main/aiFilteringService';
import { pdfService, PdfMakeOptions, FolderEntry } from './main/pdfService';
import { updateDownloadService, UpdateDownloadService } from './main/updateDownloadService';
import type { AIServiceType } from './main/configService';

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

// Set app name
app.setName('AutoSlides');

// Function to update the application menu
const updateApplicationMenu = () => {
  if (process.platform === 'darwin') {
    const menu = Menu.buildFromTemplate(createMenuTemplate());
    Menu.setApplicationMenu(menu);
  }
};

// Get window background color based on system theme
const getWindowBackgroundColor = (): string => {
  return nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff';
};

const createMenuTemplate = () => {
  const template: Electron.MenuItemConstructorOptions[] = [
    { label: app.name, submenu: [
      { role: 'about', label: getTranslation('titlebar.about') },
      { type: 'separator' },
      { label: getTranslation('titlebar.checkForUpdates'), click: async () => {
        const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
          mainWindow.webContents.send('menu:checkForUpdates');
        }
      } },
      {
        label: getTranslation('titlebar.legalNotices'),
        click: () => {
          // In development, use the source directory; in production, use the app directory
          const termsPath = app.isPackaged
            ? path.join(process.resourcesPath, 'terms/terms.rtf')
            : path.join(__dirname, '../../resources/terms/terms.rtf');
          shell.openPath(termsPath);
        }
      },
      { type: 'separator' },
      { role: 'services', label: getTranslation('titlebar.services') },
      { type: 'separator' },
      { role: 'hide', label: getTranslation('titlebar.hide') },
      { role: 'hideOthers', label: getTranslation('titlebar.hideOthers') },
      { role: 'unhide', label: getTranslation('titlebar.showAll') },
      { type: 'separator' },
      { role: 'quit', label: getTranslation('titlebar.quit') }
    ] },
    { label: getTranslation('titlebar.file'), submenu: [{ label: getTranslation('titlebar.new'), accelerator: 'CmdOrCtrl+N', enabled: false }, { label: getTranslation('titlebar.open'), accelerator: 'CmdOrCtrl+O', enabled: false }, { type: 'separator' }, { role: 'close', label: getTranslation('titlebar.close') }] },
    { label: getTranslation('titlebar.edit'), submenu: [{ role: 'undo', label: getTranslation('titlebar.undo') }, { role: 'redo', label: getTranslation('titlebar.redo') }, { type: 'separator' }, { role: 'cut', label: getTranslation('titlebar.cut') }, { role: 'copy', label: getTranslation('titlebar.copy') }, { role: 'paste', label: getTranslation('titlebar.paste') }, { role: 'selectAll', label: getTranslation('titlebar.selectAll') }] },
    { label: getTranslation('titlebar.view'), submenu: [{ role: 'reload', label: getTranslation('titlebar.reload') }, { role: 'forceReload', label: getTranslation('titlebar.forceReload') }, { role: 'toggleDevTools', label: getTranslation('titlebar.toggleDevTools') }, { type: 'separator' }, { role: 'resetZoom', label: getTranslation('titlebar.resetZoom') }, { role: 'zoomIn', label: getTranslation('titlebar.zoomIn') }, { role: 'zoomOut', label: getTranslation('titlebar.zoomOut') }, { type: 'separator' }, { role: 'togglefullscreen', label: getTranslation('titlebar.toggleFullscreen') }] },
    { label: getTranslation('titlebar.window'), submenu: [{ role: 'minimize', label: getTranslation('titlebar.minimize') }, { role: 'close', label: getTranslation('titlebar.close') }, { type: 'separator' }, { role: 'front', label: getTranslation('titlebar.bringAllToFront') }] },
    { label: getTranslation('titlebar.help'), role: 'help', submenu: [
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
    backgroundColor: getWindowBackgroundColor(), // Set initial background color based on system theme
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // Disable background throttling to prevent Chrome from limiting JS execution
      webviewTag: true, // Enable webview tag for browser login
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

  // Trigger auto-check for updates after the window loads
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:autoCheck');
      }
    }, 3000);
  });
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
const aiPromptsService = new AIPromptsService();
const aiFilteringService = new AIFilteringService(configService, aiPromptsService);

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

ipcMain.handle('auth:clearBrowserData', async () => {
  try {
    // Clear browser login session data
    const ses = session.fromPartition('persist:browserlogin');

    // Clear cookies for specific domains
    const cookies = await ses.cookies.get({});
    for (const cookie of cookies) {
      const domain = cookie.domain?.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
      if (domain?.includes('yanhekt.cn') || domain?.includes('bit.edu.cn')) {
        const url = `http${cookie.secure ? 's' : ''}://${domain}${cookie.path || '/'}`;
        await ses.cookies.remove(url, cookie.name);
      }
    }

    // Clear storage data
    await ses.clearStorageData({
      storages: ['localstorage', 'cookies', 'cachestorage'],
      quotas: ['temporary']
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to clear browser data:', error);
    return { success: false, error: String(error) };
  }
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

ipcMain.handle('config:setAutoPostProcessing', async (event, enabled: boolean) => {
  configService.setAutoPostProcessing(enabled);
  return configService.getConfig();
});

ipcMain.handle('config:setAutoPostProcessingLive', async (event, enabled: boolean) => {
  configService.setAutoPostProcessingLive(enabled);
  return configService.getConfig();
});

ipcMain.handle('config:getAutoPostProcessingLive', async () => {
  return configService.getAutoPostProcessingLive();
});

ipcMain.handle('config:setEnableAIFiltering', async (event, enabled: boolean) => {
  configService.setEnableAIFiltering(enabled);
  return configService.getConfig();
});

ipcMain.handle('config:getEnableAIFiltering', async () => {
  return configService.getEnableAIFiltering();
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

ipcMain.handle('config:getSkipUpdateCheckUntil', async () => {
  return configService.getSkipUpdateCheckUntil();
});

ipcMain.handle('config:setSkipUpdateCheckUntil', async (event, timestamp: number) => {
  configService.setSkipUpdateCheckUntil(timestamp);
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
  enablePngColorReduction?: boolean;
}) => {
  configService.setSlideImageProcessingParams(params);
  return configService.getSlideExtractionConfig();
});

// IPC handler for setting slide extraction config (partial updates)
ipcMain.handle('config:setSlideExtractionConfig', async (event, config: {
  enableDuplicateRemoval?: boolean;
  enableExclusionList?: boolean;
}) => {
  configService.setSlideExtractionConfig(config);
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
      const imageBuffer = fs.readFileSync(imagePath);

      // Return the image data for pHash calculation in renderer process
      return {
        success: true,
        imagePath,
        imageBuffer: Array.from(imageBuffer), // Convert to array for IPC transfer
        fileName: path.basename(imagePath)
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

// IPC handlers for AI filtering configuration
ipcMain.handle('config:getAIFilteringConfig', async () => {
  return configService.getAIFilteringConfig();
});

ipcMain.handle('config:setAIFilteringConfig', async (event, config: {
  serviceType?: AIServiceType;
  customApiBaseUrl?: string;
  customApiKey?: string;
  customModelName?: string;
  batchSize?: number;
}) => {
  configService.setAIFilteringConfig(config);
  return configService.getAIFilteringConfig();
});

ipcMain.handle('config:setAIBatchSize', async (event, batchSize: number) => {
  configService.setAIBatchSize(batchSize);
  return configService.getAIFilteringConfig();
});

ipcMain.handle('config:getAIBatchSize', async () => {
  return configService.getAIBatchSize();
});

// IPC handlers for AI prompts management
ipcMain.handle('config:getAIPrompts', async () => {
  return aiPromptsService.getPrompts();
});

ipcMain.handle('config:getAIPrompt', async (event, type: 'live' | 'recorded') => {
  return aiPromptsService.getPrompt(type);
});

ipcMain.handle('config:setAIPrompt', async (event, type: 'live' | 'recorded', prompt: string) => {
  aiPromptsService.setPrompt(type, prompt);
  return aiPromptsService.getPrompts();
});

ipcMain.handle('config:resetAIPrompt', async (event, type: 'live' | 'recorded') => {
  return aiPromptsService.resetPrompt(type);
});

ipcMain.handle('config:getDefaultAIPrompt', async (event, type: 'live' | 'recorded') => {
  return aiPromptsService.getDefaultPrompt(type);
});

// IPC handlers for AI filtering service
ipcMain.handle('ai:classifySingleImage', async (event, base64Image: string, type: 'live' | 'recorded', token?: string, modelOverride?: string) => {
  return aiFilteringService.classifySingleImage(base64Image, type, token, modelOverride);
});

ipcMain.handle('ai:classifyMultipleImages', async (event, base64Images: string[], type: 'live' | 'recorded', token?: string, modelOverride?: string) => {
  return aiFilteringService.classifyMultipleImages(base64Images, type, token, modelOverride);
});

ipcMain.handle('ai:getBuiltinModelName', async (event, token: string) => {
  return aiFilteringService.getBuiltinModelName(token);
});

ipcMain.handle('ai:isConfigured', async (event, token?: string) => {
  return aiFilteringService.isConfigured(token);
});

ipcMain.handle('ai:getServiceType', async () => {
  return aiFilteringService.getServiceType();
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
ipcMain.handle('video:getLiveStreamUrls', async (_event, stream: LiveStreamInput, token: string) => {
  try {
    return await videoProxyService.getLiveStreamUrls(stream, token);
  } catch (error) {
    console.error('Failed to get live stream URLs:', error);
    throw error;
  }
});

ipcMain.handle('video:getVideoPlaybackUrls', async (_event, session: RecordedSessionInput, token: string) => {
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

ipcMain.handle('video:stopSignatureLoop', async () => {
  try {
    videoProxyService.stopSignatureLoop();
    console.log('Video signature loop stopped');
  } catch (error) {
    console.error('Failed to stop signature loop:', error);
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
    // Get color reduction setting from config
    const slideConfig = configService.getSlideExtractionConfig();
    const enableColorReduction = slideConfig.enablePngColorReduction ?? true;
    await slideExtractionService.saveSlide(outputPath, filename, imageBuffer, enableColorReduction);
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

ipcMain.handle('slideExtraction:moveToInAppTrash', async (event, outputPath: string, filename: string, metadata: TrashMetadata) => {
  try {
    await slideExtractionService.moveToInAppTrash(outputPath, filename, metadata);
    return { success: true };
  } catch (error) {
    console.error('Failed to move slide to in-app trash:', error);
    throw error;
  }
});

ipcMain.handle('slideExtraction:readSlideAsBase64', async (event, outputPath: string, filename: string) => {
  try {
    const base64 = await slideExtractionService.readSlideAsBase64(outputPath, filename);
    return base64;
  } catch (error) {
    console.error('Failed to read slide as base64:', error);
    throw error;
  }
});

ipcMain.handle('slideExtraction:readSlideForAI', async (event, outputPath: string, filename: string, targetWidth: number, targetHeight: number) => {
  try {
    const base64 = await slideExtractionService.readSlideForAI(outputPath, filename, targetWidth, targetHeight);
    return base64;
  } catch (error) {
    console.error('Failed to read slide for AI:', error);
    throw error;
  }
});

ipcMain.handle('slideExtraction:listSlides', async (event, outputPath: string) => {
  try {
    const slides = await slideExtractionService.listSlides(outputPath);
    return slides;
  } catch (error) {
    console.error('Failed to list slides:', error);
    throw error;
  }
});

ipcMain.handle('slideExtraction:loadSlideImage', async (event, filePath: string) => {
  try {
    const imageBuffer = await slideExtractionService.loadSlideImage(filePath);
    return imageBuffer;
  } catch (error) {
    console.error('Failed to load slide image:', error);
    throw error;
  }
});

ipcMain.handle('slideExtraction:savePostProcessingResults', async (event, filePath: string, data: any) => {
  try {
    await slideExtractionService.savePostProcessingResults(filePath, data);
    return { success: true };
  } catch (error) {
    console.error('Failed to save post-processing results:', error);
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

ipcMain.handle('shell:openPath', async (_, filePath: string) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    console.error('Failed to open path:', error);
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

// ============================================================================
// Trash Window Management
// ============================================================================

// Declare Vite dev server variables for trash window
declare const TRASH_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const TRASH_WINDOW_VITE_NAME: string;

let trashWindow: BrowserWindow | null = null;

const createTrashWindow = () => {
  // If window already exists, focus it
  if (trashWindow && !trashWindow.isDestroyed()) {
    trashWindow.focus();
    return;
  }

  trashWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    title: 'In-App Trash',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    frame: false,
    backgroundColor: getWindowBackgroundColor(), // Set initial background color based on system theme
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the trash window HTML
  if (TRASH_WINDOW_VITE_DEV_SERVER_URL) {
    trashWindow.loadURL(`${TRASH_WINDOW_VITE_DEV_SERVER_URL}/trash.html`);
  } else {
    trashWindow.loadFile(
      path.join(__dirname, `../renderer/${TRASH_WINDOW_VITE_NAME}/trash.html`),
    );
  }

  // Clean up reference when window is closed
  trashWindow.on('closed', () => {
    trashWindow = null;
  });
};

// IPC handler to open trash window
ipcMain.handle('trash:openWindow', async () => {
  createTrashWindow();
  return { success: true };
});

// ============================================================================
// Trash IPC Handlers
// ============================================================================

ipcMain.handle('trash:getEntries', async () => {
  try {
    const outputDir = configService.getConfig().outputDirectory;
    const entries = await slideExtractionService.getTrashEntries(outputDir);
    return entries;
  } catch (error) {
    console.error('Failed to get trash entries:', error);
    throw error;
  }
});

ipcMain.handle('trash:restore', async (_event, ids: string[]) => {
  try {
    const outputDir = configService.getConfig().outputDirectory;
    const result = await slideExtractionService.restoreFromTrash(ids, outputDir);
    return result;
  } catch (error) {
    console.error('Failed to restore from trash:', error);
    throw error;
  }
});

ipcMain.handle('trash:clear', async () => {
  try {
    const outputDir = configService.getConfig().outputDirectory;
    const result = await slideExtractionService.clearTrash(outputDir);
    return result;
  } catch (error) {
    console.error('Failed to clear trash:', error);
    throw error;
  }
});

ipcMain.handle('trash:getImageAsBase64', async (_event, trashPath: string) => {
  try {
    const base64 = await slideExtractionService.getTrashImageAsBase64(trashPath);
    return base64;
  } catch (error) {
    console.error('Failed to get trash image:', error);
    throw error;
  }
});

// ============================================================================
// PDF Maker Window Management
// ============================================================================

// Declare Vite dev server variables for pdfmaker window
declare const PDFMAKER_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const PDFMAKER_WINDOW_VITE_NAME: string;

let pdfmakerWindow: BrowserWindow | null = null;

const createPdfMakerWindow = () => {
  // If window already exists, focus it
  if (pdfmakerWindow && !pdfmakerWindow.isDestroyed()) {
    pdfmakerWindow.focus();
    return;
  }

  pdfmakerWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'PDF Maker',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    frame: false,
    backgroundColor: getWindowBackgroundColor(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the pdfmaker window HTML
  if (PDFMAKER_WINDOW_VITE_DEV_SERVER_URL) {
    pdfmakerWindow.loadURL(`${PDFMAKER_WINDOW_VITE_DEV_SERVER_URL}/pdfmaker.html`);
  } else {
    pdfmakerWindow.loadFile(
      path.join(__dirname, `../renderer/${PDFMAKER_WINDOW_VITE_NAME}/pdfmaker.html`),
    );
  }

  // Clean up reference when window is closed
  pdfmakerWindow.on('closed', () => {
    pdfmakerWindow = null;
  });
};

// IPC handler to open pdfmaker window
ipcMain.handle('pdfmaker:openWindow', async () => {
  createPdfMakerWindow();
  return { success: true };
});

// ============================================================================
// PDF Maker IPC Handlers
// ============================================================================

// Get all slide folders in output directory
ipcMain.handle('pdfmaker:getFolders', async () => {
  try {
    const outputDir = configService.getConfig().outputDirectory;
    const expandedPath = outputDir.startsWith('~')
      ? path.join(os.homedir(), outputDir.slice(1))
      : outputDir;

    const entries = await fs.promises.readdir(expandedPath, { withFileTypes: true });
    const folders = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('slides_'))
      .map(entry => ({
        name: entry.name,
        path: path.join(expandedPath, entry.name)
      }));

    return folders;
  } catch (error) {
    console.error('Failed to get folders:', error);
    throw error;
  }
});

// Get images in a specific folder
ipcMain.handle('pdfmaker:getImages', async (_event, folderPath: string) => {
  try {
    const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
    const images = entries
      .filter(entry => entry.isFile() && entry.name.startsWith('Slide_') && entry.name.endsWith('.png'))
      .map(entry => ({
        name: entry.name,
        path: path.join(folderPath, entry.name)
      }));

    return images;
  } catch (error) {
    console.error('Failed to get images:', error);
    throw error;
  }
});

// Get image as base64
ipcMain.handle('pdfmaker:getImageAsBase64', async (_event, imagePath: string) => {
  try {
    const buffer = await fs.promises.readFile(imagePath);
    return buffer.toString('base64');
  } catch (error) {
    console.error('Failed to read image:', error);
    throw error;
  }
});

// Delete image (move to in-app trash)
ipcMain.handle('pdfmaker:deleteImage', async (_event, imagePath: string) => {
  try {
    const filename = path.basename(imagePath);
    const outputPath = path.dirname(imagePath);

    await slideExtractionService.moveToInAppTrash(outputPath, filename, {
      reason: 'manual',
      reasonDetails: 'User deleted via PDF Maker'
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to delete image:', error);
    throw error;
  }
});

// Make PDF from selected folders
ipcMain.handle('pdfmaker:makePdf', async (_event, folders: FolderEntry[], options: PdfMakeOptions) => {
  try {
    // Show save dialog
    const parentWindow = pdfmakerWindow || BrowserWindow.getFocusedWindow();
    // Extract course name from first folder (remove session pattern: _第N周_星期X_第N大节)
    let defaultFileName = 'slides.pdf';
    if (folders.length > 0) {
      const folderName = folders[0].name;
      // Match pattern: courseName_第N周_星期X_第N大节
      const sessionPattern = /_第\d+周_星期[一二三四五六日]_第\d+大节$/;
      const courseName = folderName.replace(sessionPattern, '');
      defaultFileName = `slides_${courseName}.pdf`;
    }
    const result = await dialog.showSaveDialog(parentWindow!, {
      title: 'Save PDF',
      defaultPath: path.join(
        configService.getConfig().outputDirectory,
        defaultFileName
      ),
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Cancelled' };
    }

    const outputPath = result.filePath;

    // Generate PDF with progress callback
    const pdfResult = await pdfService.makePdf(
      folders,
      options,
      outputPath,
      (current, total) => {
        // Send progress to pdfmaker window
        pdfmakerWindow?.webContents.send('pdfmaker:progress', { current, total });
      }
    );

    return pdfResult;
  } catch (error) {
    console.error('Failed to make PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// ============================================================================
// Update Check IPC Handlers
// ============================================================================

ipcMain.handle('update:checkForUpdates', async () => {
  const https = await import('https');

  // Helper function to fetch release info from a given URL config
  const fetchRelease = (options: { hostname: string; path: string; method: string; headers: Record<string, string> }): Promise<{ success: boolean; data?: string; error?: string }> => {
    return new Promise((resolve) => {
      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode !== 200) {
            resolve({ success: false, error: `HTTP ${res.statusCode}` });
            return;
          }
          resolve({ success: true, data });
        });
      });

      req.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });

      req.setTimeout(10000, () => {
        req.destroy();
        resolve({ success: false, error: 'Request timeout' });
      });

      req.end();
    });
  };

  // Parse release data and return update info
  const parseRelease = (data: string) => {
    const release = JSON.parse(data);
    const latestTag = release.tag_name; // e.g., "v4.0.2"
    const latestVersion = latestTag.replace(/^v/, ''); // Remove 'v' prefix
    const currentVersion = app.getVersion();

    // Compare versions
    const compareVersions = (v1: string, v2: string): number => {
      const parts1 = v1.split('.').map(Number);
      const parts2 = v2.split('.').map(Number);

      for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
      }
      return 0;
    };

    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

    // Get assets for current platform
    const platformAssets = updateDownloadService.getAssetsForPlatform(release.assets || []);

    return {
      success: true,
      hasUpdate,
      currentVersion,
      latestVersion,
      releaseUrl: release.html_url,
      releaseBody: release.body_html || release.body || '',  // Prefer HTML-rendered body
      publishedAt: release.published_at || '',
      assets: platformAssets.map((asset: { name: string; browser_download_url: string; size: number }) => ({
        name: asset.name,
        url: asset.browser_download_url,
        size: asset.size,
        formattedSize: UpdateDownloadService.formatBytes(asset.size),
        proxyUrl: UpdateDownloadService.getProxyUrl(asset.browser_download_url),
      })),
    };
  };

  const primaryOptions = {
    hostname: 'api.github.com',
    path: '/repos/bit-admin/Yanhekt-AutoSlides/releases/latest',
    method: 'GET',
    headers: {
      'User-Agent': 'AutoSlides',
      'Accept': 'application/vnd.github.html+json'  // Request HTML-rendered body
    }
  };

  const fallbackOptions = {
    hostname: 'gh-proxy.org',
    path: '/https://api.github.com/repos/bit-admin/Yanhekt-AutoSlides/releases/latest',
    method: 'GET',
    headers: {
      'User-Agent': 'AutoSlides',
      'Accept': 'application/vnd.github.html+json'  // Request HTML-rendered body
    }
  };

  try {
    // Try primary GitHub API first
    const primaryResult = await fetchRelease(primaryOptions);
    if (primaryResult.success && primaryResult.data) {
      return parseRelease(primaryResult.data);
    }

    // Silently fallback to proxy if primary fails
    const fallbackResult = await fetchRelease(fallbackOptions);
    if (fallbackResult.success && fallbackResult.data) {
      return parseRelease(fallbackResult.data);
    }

    // Both failed
    return {
      success: false,
      error: fallbackResult.error || primaryResult.error || 'Unknown error'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// ============================================================================
// Update Download IPC Handlers
// ============================================================================

// Get release info with HTML-rendered body
ipcMain.handle('update:getReleaseInfo', async () => {
  const https = await import('https');

  const fetchReleaseHtml = (options: { hostname: string; path: string; method: string; headers: Record<string, string> }): Promise<{ success: boolean; data?: string; error?: string }> => {
    return new Promise((resolve) => {
      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode !== 200) {
            resolve({ success: false, error: `HTTP ${res.statusCode}` });
            return;
          }
          resolve({ success: true, data });
        });
      });

      req.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });

      req.setTimeout(10000, () => {
        req.destroy();
        resolve({ success: false, error: 'Request timeout' });
      });

      req.end();
    });
  };

  // Fetch release with HTML body
  const primaryOptions = {
    hostname: 'api.github.com',
    path: '/repos/bit-admin/Yanhekt-AutoSlides/releases/latest',
    method: 'GET',
    headers: {
      'User-Agent': 'AutoSlides',
      'Accept': 'application/vnd.github.html+json'
    }
  };

  const fallbackOptions = {
    hostname: 'gh-proxy.org',
    path: '/https://api.github.com/repos/bit-admin/Yanhekt-AutoSlides/releases/latest',
    method: 'GET',
    headers: {
      'User-Agent': 'AutoSlides',
      'Accept': 'application/vnd.github.html+json'
    }
  };

  try {
    let result = await fetchReleaseHtml(primaryOptions);
    if (!result.success || !result.data) {
      result = await fetchReleaseHtml(fallbackOptions);
    }

    if (result.success && result.data) {
      const release = JSON.parse(result.data);
      const platformAssets = updateDownloadService.getAssetsForPlatform(release.assets || []);

      return {
        success: true,
        tagName: release.tag_name,
        name: release.name,
        body: release.body || '',
        bodyHtml: release.body_html || '',
        htmlUrl: release.html_url,
        publishedAt: release.published_at,
        assets: platformAssets.map((asset: { name: string; browser_download_url: string; size: number }) => ({
          name: asset.name,
          url: asset.browser_download_url,
          size: asset.size,
          formattedSize: UpdateDownloadService.formatBytes(asset.size),
          proxyUrl: UpdateDownloadService.getProxyUrl(asset.browser_download_url),
        })),
      };
    }

    return { success: false, error: result.error || 'Unknown error' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Download update file
ipcMain.handle('update:downloadUpdate', async (event, url: string, filename: string) => {
  try {
    const progressCallback = (progress: { downloaded: number; total: number; percent: number }) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('update:downloadProgress', progress);
      }
    };

    const filePath = await updateDownloadService.downloadUpdate(url, filename, progressCallback);

    if (!event.sender.isDestroyed()) {
      event.sender.send('update:downloadComplete', filename);
    }

    return { success: true, filePath };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (!event.sender.isDestroyed()) {
      event.sender.send('update:downloadError', errorMessage);
    }
    return { success: false, error: errorMessage };
  }
});

// Cancel active download
ipcMain.handle('update:cancelDownload', async () => {
  const cancelled = updateDownloadService.cancelDownload();
  return { success: cancelled };
});

// Open updates folder
ipcMain.handle('update:openDownloadFolder', async () => {
  try {
    await updateDownloadService.openUpdatesFolder();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Get updates folder path
ipcMain.handle('update:getDownloadFolder', async () => {
  return { success: true, path: updateDownloadService.getUpdatesPath() };
});

// Install update (open installer file)
ipcMain.handle('update:installUpdate', async (event, filename: string) => {
  try {
    const filePath = await updateDownloadService.installUpdate(filename);

    // For macOS and Windows, prompt user to quit
    const platform = process.platform;
    if (platform === 'darwin' || platform === 'win32') {
      // Send signal to renderer to show quit dialog
      if (!event.sender.isDestroyed()) {
        event.sender.send('update:promptQuit', filename);
      }
    }

    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// List downloaded update files
ipcMain.handle('update:listDownloadedUpdates', async () => {
  try {
    const updates = updateDownloadService.listDownloadedUpdates();
    return { success: true, updates };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Delete old update files
ipcMain.handle('update:deleteOldUpdates', async (_event, filenames: string[]) => {
  try {
    const result = await updateDownloadService.deleteUpdates(filenames);
    return result;
  } catch (error) {
    return { success: false, errors: [error instanceof Error ? error.message : 'Unknown error'] };
  }
});

// Find old updates (not matching current version)
ipcMain.handle('update:findOldUpdates', async () => {
  try {
    const currentVersion = app.getVersion();
    const oldFiles = updateDownloadService.findOldUpdates(currentVersion);
    return { success: true, files: oldFiles, currentVersion };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Check if download is in progress
ipcMain.handle('update:isDownloading', async () => {
  return { isDownloading: updateDownloadService.isDownloading() };
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
