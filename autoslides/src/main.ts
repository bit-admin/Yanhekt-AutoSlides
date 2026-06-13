import { app, BrowserWindow, Menu } from 'electron';
import path from 'node:path';
import { MainAuthService } from '@main/platform/authService';
import { MainApiClient } from '@main/platform/apiClient';
import { ConfigService } from '@main/platform/configService';
import { IntranetMappingService } from '@main/platform/intranetMappingService';
import { VideoProxyService } from '@main/video/videoProxyService';
import { ThumbnailService } from '@main/video/thumbnailService';
import { FFmpegService } from '@main/infra/ffmpegService';
import { M3u8DownloadService } from '@main/video/m3u8DownloadService';
import { PowerManagementService } from '@main/platform/powerManagementService';
import { AIPromptsService } from '@main/ai/aiPromptsService';
import { AIFilteringService } from '@main/ai/aiFilteringService';
import { LLMApiService } from '@main/ai/llmApiService';
import { updateDownloadService } from '@main/download/updateDownloadService';
import { QtExtractorService } from '@main/extraction/qtExtractorService';
import { extractorInstallerService } from '@main/download/extractorInstallerService';
import { AutoCropModelService } from '@main/ai/autoCropModelService';
import { MlClassifierModelService } from '@main/ai/mlClassifierModelService';
import { CompressLectureService } from '@main/video/compressLectureService';
import { WindowManager, getWindowBackgroundColor } from '@main/platform/windowManager';
import { pdfService } from '@main/export/pdfService';
import { slideExtractionService } from '@main/extraction/slideExtractionService';
import { offlineProcessingService } from '@main/extraction/offlineProcessingService';
import { cacheManagementService } from '@main/platform/cacheManagementService';
import { registerAllIpcHandlers } from '@main/ipc';

const configService = new ConfigService();

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

app.setName('AutoSlides');

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    frame: false,
    // macOS: native sidebar vibrancy shows through transparent renderer areas
    // (the left panel paints a translucent tint over it). The fully
    // transparent backgroundColor is required — without it the web contents
    // paint an opaque base layer that hides the vibrancy. Other platforms
    // keep an opaque background.
    ...(process.platform === 'darwin'
      ? { vibrancy: 'sidebar' as const, backgroundColor: '#00000000' }
      : { backgroundColor: getWindowBackgroundColor() }),
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
    windowManager.updateApplicationMenu();
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
const thumbnailService = new ThumbnailService(videoProxyService, ffmpegService);
const compressLectureService = new CompressLectureService(ffmpegService);
const m3u8DownloadService = new M3u8DownloadService(ffmpegService, configService, intranetMappingService, apiClient);
const powerManagementService = new PowerManagementService();
const aiPromptsService = new AIPromptsService();
const llmApiService = new LLMApiService(configService);
const aiFilteringService = new AIFilteringService(configService, aiPromptsService, llmApiService);
const qtExtractorService = new QtExtractorService(configService);

const windowManager = new WindowManager();
windowManager.setConfigService(configService);
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
  thumbnailService,
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
  pdfService,
  slideExtractionService,
  offlineProcessingService,
  cacheManagementService
});
