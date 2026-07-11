import { app, BrowserWindow, Menu } from 'electron';
import path from 'node:path';
import { MainAuthService } from '@main/platform/authService';
import { MainApiClient } from '@main/platform/apiClient';
import { ConfigService } from '@main/platform/configService';
import { NotesService } from '@main/platform/notesService';
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
import { noteExportService } from '@main/export/noteExportService';
import { slideExtractionService } from '@main/extraction/slideExtractionService';
import { slideMetadataService } from '@main/extraction/slideMetadataService';
import { offlineProcessingService } from '@main/extraction/offlineProcessingService';
import { cacheManagementService } from '@main/platform/cacheManagementService';
import { registerAllIpcHandlers } from '@main/ipc';
import { applyDemoUserData, isDemoLaunch, demoWebPreferences } from '@main/demo/demoEnv';

// Demo mode (npm run demo / screenshots): isolate persistence to a separate
// `AutoSlides-Demo` userData dir. Must run BEFORE `new ConfigService()` below,
// since electron-store resolves its path from userData at construction.
applyDemoUserData(app);

const configService = new ConfigService();

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

app.setName('AutoSlides');

// Set when a quit is requested (Cmd+Q / app.quit) so the main window's close
// handler knows to quit the whole app — not just close the window — once the
// user confirms past the "work still running" warning.
let quitRequested = false;

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 768,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    frame: false,
    // macOS: native sidebar vibrancy shows through transparent renderer areas
    // (the left panel paints a translucent tint over it). The fully
    // transparent backgroundColor is required — without it the web contents
    // paint an opaque base layer that hides the vibrancy. Other platforms
    // keep an opaque background.
    // Demo mode (screenshots): force an opaque background. macOS vibrancy is
    // composited by the OS and is NOT captured by Playwright/capturePage, so a
    // transparent window would screenshot with a black/transparent sidebar.
    ...(process.platform === 'darwin' && !isDemoLaunch()
      ? { vibrancy: 'sidebar' as const, backgroundColor: '#00000000' }
      : { backgroundColor: getWindowBackgroundColor() }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      webviewTag: true,
      // Demo mode flag (npm run demo → DEMO_MODE=1), forwarded as an argv entry
      // the preload reads reliably (process.env is not dependable there).
      ...demoWebPreferences()
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

  // Warn before closing/quitting while tasks or downloads are still running.
  // Covers every platform and every close path: the macOS traffic-light button
  // and Cmd+Q (which closes windows), and the custom close button on
  // Windows/Linux (which calls window:close → window.close()). The renderer
  // pushes its busy state via `window:setBusyState`.
  let allowClose = false;
  mainWindow.on('close', (event) => {
    if (allowClose || !windowManager.isAppBusy()) return;

    event.preventDefault();
    // `quitRequested` is set in before-quit; capture it before the (blocking)
    // dialog and reset so a later red-X close isn't mistaken for a quit.
    const wasQuitting = quitRequested;
    quitRequested = false;

    if (windowManager.confirmCloseWhileBusy(mainWindow)) {
      allowClose = true;
      // Defer to the next tick: calling app.quit()/close() synchronously from
      // inside a close handler that just preventDefault()'d gets swallowed by
      // Electron (the quit it was cancelling is still settling). Letting the
      // prevented close unwind first makes the re-issued quit/close take effect.
      setImmediate(() => {
        if (wasQuitting) {
          app.quit();
        } else {
          mainWindow.close();
        }
      });
    }
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
const videoProxyService = new VideoProxyService(apiClient, intranetMappingService, configService);
const ffmpegService = new FFmpegService();
const thumbnailService = new ThumbnailService(videoProxyService, ffmpegService);
const compressLectureService = new CompressLectureService(ffmpegService);
const m3u8DownloadService = new M3u8DownloadService(ffmpegService, configService, intranetMappingService, apiClient);
const powerManagementService = new PowerManagementService();
const aiPromptsService = new AIPromptsService();
const llmApiService = new LLMApiService(configService);
const aiFilteringService = new AIFilteringService(configService, aiPromptsService, llmApiService);
const qtExtractorService = new QtExtractorService(configService);
const notesService = new NotesService(configService);

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
  quitRequested = true;
});

// Cleanup only when the app is actually terminating. Using will-quit (instead
// of before-quit) means a quit cancelled by the close-guard dialog doesn't tear
// down power management while the app keeps running.
app.on('will-quit', () => {
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
  noteExportService,
  slideExtractionService,
  slideMetadataService,
  offlineProcessingService,
  cacheManagementService,
  notesService
});
