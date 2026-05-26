import { app, BrowserWindow, Menu, shell } from 'electron';
import path from 'node:path';
import { MainAuthService } from './main/authService';
import { MainApiClient } from './main/apiClient';
import { ConfigService } from './main/configService';
import { IntranetMappingService } from './main/intranetMappingService';
import { VideoProxyService } from './main/videoProxyService';
import { FFmpegService } from './main/ffmpegService';
import { M3u8DownloadService } from './main/m3u8DownloadService';
import { PowerManagementService } from './main/powerManagementService';
import { AIPromptsService } from './main/aiPromptsService';
import { AIFilteringService } from './main/aiFilteringService';
import { LLMApiService } from './main/llmApiService';
import { updateDownloadService } from './main/updateDownloadService';
import { QtExtractorService } from './main/qtExtractorService';
import { extractorInstallerService } from './main/extractorInstallerService';
import { AutoCropModelService } from './main/autoCropModelService';
import { MlClassifierModelService } from './main/mlClassifierModelService';
import { CompressLectureService } from './main/compressLectureService';
import { WindowManager, getWindowBackgroundColor } from './main/windowManager';
import { registerAllIpcHandlers } from './main/ipc';

import enTranslations from './renderer/i18n/locales/en.json';
import zhTranslations from './renderer/i18n/locales/zh.json';

const configService = new ConfigService();

const getTranslation = (key: string): string => {
  const languageMode = configService.getLanguageMode();
  let locale: 'en' | 'zh' = 'en';

  if (languageMode === 'zh') {
    locale = 'zh';
  } else if (languageMode === 'system') {
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

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

app.setName('AutoSlides');

const createMenuTemplate = (): Electron.MenuItemConstructorOptions[] => {
  return [
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
      { label: getTranslation('titlebar.itCenterSoftware'), click: () => { shell.openExternal('https://it.ruc.edu.kg/zh/software'); } }
    ] }
  ];
};

const updateApplicationMenu = () => {
  if (process.platform === 'darwin') {
    const menu = Menu.buildFromTemplate(createMenuTemplate());
    Menu.setApplicationMenu(menu);
  }
};

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    frame: false,
    backgroundColor: getWindowBackgroundColor(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      webviewTag: true
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:autoCheck');
      }
    }, 3000);
  });
};

app.on('ready', () => {
  if (process.platform === 'darwin') {
    updateApplicationMenu();
  } else {
    Menu.setApplicationMenu(null);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Initialize services
const authService = new MainAuthService();
const apiClient = new MainApiClient();
const autoCropModelService = new AutoCropModelService(configService);
const mlClassifierModelService = new MlClassifierModelService(configService);
const intranetMappingService = new IntranetMappingService(configService);
const videoProxyService = new VideoProxyService(apiClient, intranetMappingService);
const ffmpegService = new FFmpegService();
const compressLectureService = new CompressLectureService(ffmpegService);
const m3u8DownloadService = new M3u8DownloadService(ffmpegService, configService, intranetMappingService, apiClient);
const powerManagementService = new PowerManagementService();
const aiPromptsService = new AIPromptsService();
const llmApiService = new LLMApiService(configService);
const aiFilteringService = new AIFilteringService(configService, aiPromptsService, llmApiService);
const qtExtractorService = new QtExtractorService(configService);

const windowManager = new WindowManager();
windowManager.setOnToolsWindowClosed(() => compressLectureService.cancel());

// Initialize power management based on config
const initializePowerManagement = async () => {
  const shouldPreventSleep = configService.getPreventSystemSleep();
  if (shouldPreventSleep) {
    await powerManagementService.preventSleep();
  }
};

app.whenReady().then(() => {
  initializePowerManagement();
  windowManager.setupYuketangClassCapture();
});

app.on('before-quit', () => {
  powerManagementService.cleanup();
});

// Register all IPC handlers
registerAllIpcHandlers({
  authService,
  apiClient,
  configService,
  intranetMappingService,
  videoProxyService,
  ffmpegService,
  m3u8DownloadService,
  powerManagementService,
  aiPromptsService,
  aiFilteringService,
  llmApiService,
  updateDownloadService,
  qtExtractorService,
  extractorInstallerService,
  autoCropModelService,
  mlClassifierModelService,
  compressLectureService,
  windowManager,
  updateApplicationMenu
});
