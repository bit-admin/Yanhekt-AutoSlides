// Must stay first: see the file.
import '@main/cli/earlyDockHide';
import { app, BrowserWindow, Menu } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MainAuthService } from '@main/platform/authService';
import { Yanhe2Service } from '@main/platform/yanhe2/yanhe2Service';
import { MainApiClient } from '@main/platform/apiClient';
import { ConfigService } from '@main/platform/configService';
import { NotesService } from '@main/platform/notesService';
import { ObsidianNotesService } from '@main/export/obsidianNotesService';
import { NotionNotesService } from '@main/export/notionNotesService';
import { IntranetMappingService } from '@main/platform/intranetMappingService';
import { IntranetApiTransport } from '@main/platform/intranetApiTransport';
import { routeYanhe2Through } from '@main/platform/yanhe2/yanhe2Http';
import { VideoProxyService } from '@main/video/videoProxyService';
import { LocalRelayService } from '@main/video/localRelayService';
import { ThumbnailService } from '@main/video/thumbnailService';
import { LocalLecturePosterService } from '@main/video/localLecturePosterService';
import {
  installAsmediaProtocol,
  registerAsmediaScheme,
} from '@main/video/asmediaProtocol';
import { FFmpegService } from '@main/infra/ffmpegService';
import { M3u8DownloadService } from '@main/video/m3u8DownloadService';
import { AudioDownloadService } from '@main/video/audioDownloadService';
import { PowerManagementService } from '@main/platform/powerManagementService';
import { AIPromptsService } from '@main/ai/aiPromptsService';
import { AIFilteringService } from '@main/ai/aiFilteringService';
import { LLMApiService } from '@main/ai/llmApiService';
import { updateDownloadService } from '@main/download/updateDownloadService';
import { windowsAutoUpdater } from '@main/download/windowsAutoUpdater';
import { QtExtractorService } from '@main/extraction/qtExtractorService';
import { extractorInstallerService } from '@main/download/extractorInstallerService';
import { AutoCropModelService } from '@main/ai/autoCropModelService';
import { MlClassifierModelService } from '@main/ai/mlClassifierModelService';
import { CompressLectureService } from '@main/video/compressLectureService';
import { WindowManager, getWindowBackgroundColor } from '@main/platform/windowManager';
import { TrayService } from '@main/platform/trayService';
import { pdfService } from '@main/export/pdfService';
import { noteExportService } from '@main/export/noteExportService';
import { slideExtractionService } from '@main/extraction/slideExtractionService';
import { Yanhe2SlideImportService } from '@main/extraction/yanhe2SlideImportService';
import { Yanhe2TwinResolver } from '@main/platform/yanhe2/yanhe2TwinResolver';
import { PinSyncService } from '@main/platform/pins/pinSyncService';
import { broadcastConfig } from '@main/ipc/broadcastConfig';
import { localCourseIndex } from '@main/platform/courseIndex/courseIndex';
import { CourseLookup } from '@main/platform/courseIndex/courseLookup';
import { CourseIndexUpdater } from '@main/platform/courseIndex/courseIndexUpdater';
import { Yanhe2SubtitleService } from '@main/video/yanhe2SubtitleService';
import { Yanhe2DownloadService } from '@main/video/yanhe2DownloadService';
import { Yanhe2CaptionSyncService } from '@main/video/yanhe2CaptionSyncService';
import { slideMetadataService } from '@main/extraction/slideMetadataService';
import { slideTimelineService } from '@main/extraction/slideTimelineService';
import { cacheManagementService } from '@main/platform/cacheManagementService';
import { registerAllIpcHandlers } from '@main/ipc';
import { createSettingsWriter } from '@main/ipc/settingsWriter';
import { applyDemoUserData, isDemoLaunch, demoWebPreferences } from '@main/demo/demoEnv';
import { initLogFile, setLogVerbose, flushLogFile, getLogDir } from '@main/infra/logFile';
import { YanhektCatalogStore } from '@main/platform/yanhektCatalog';
import { createLogger, setLoggerConsoleMode } from '@main/infra/logger';
import { CliInstallService } from '@main/platform/cliInstall/cliInstallService';
import { DeepLinkRouter } from '@main/platform/deepLinkRouter';
import { findDeepLinkArg } from '@common/deepLink';
import {
  APP_COMMANDS,
  CLI_EXIT,
  CliControlServer,
  RendererBridge,
  controlSocketPath,
  createCliInterrupts,
  launchApp,
  parseCliInvocation,
  runCli,
} from '@main/cli';

// Command line run (`yhdl …`, `autoslides download …`): a wrapper on PATH
// started this binary with `--cli`. The same services are built below, but no
// window, menu or IPC — the command runs once the app is ready and the process
// exits with its code. Everything GUI-only in this file is behind `!cliRun`.
// An `autoslides` command only passes through such a process: it is sent to the
// running app's control socket and runs there (`@main/cli/control`).
//
// A launch from an `autoslides://` link (Windows and Linux pass it in argv) is
// never a command line run, whatever else the argv holds.
const launchDeepLink = findDeepLinkArg(process.argv);
const cliRun = launchDeepLink ? null : parseCliInvocation(process.argv);
// Chromium's own session data (caches, GPU state) goes to a throwaway folder,
// so a command can run while the app itself is open on the real one.
let cliSessionDir: string | null = null;
const cliInterrupts = createCliInterrupts();
const exitCli = (code: number): void => {
  if (cliSessionDir) fs.rmSync(cliSessionDir, { recursive: true, force: true });
  app.exit(code);
};
if (cliRun) {
  cliSessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoslides-cli-'));
  app.setPath('sessionData', cliSessionDir);
  app.disableHardwareAcceleration();

  // Ctrl-C: Electron turns the signal into an app quit. Hand it to the running
  // command instead (see cli/interrupts.ts); with nothing to stop, just exit.
  const interrupt = (): void => {
    if (!cliInterrupts.fire()) exitCli(CLI_EXIT.interrupted);
  };
  app.on('before-quit', (event) => {
    event.preventDefault();
    interrupt();
  });
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
}

// Custom local media scheme for Lectures Library playback. Must register
// privileges BEFORE app is ready (Electron requirement).
registerAsmediaScheme();

// Demo mode (npm run demo / screenshots): isolate persistence to a separate
// `AutoSlides-Demo` userData dir. Must run BEFORE `new ConfigService()` below,
// since electron-store resolves its path from userData at construction.
applyDemoUserData(app);

// One app per user data folder (so demo mode runs beside the real one). A
// second launch — a Dock click, `autoslides` with no arguments — brings the
// running window forward instead. Command line runs never take the lock, and
// neither does a dev build: it shares the installed app's user data folder,
// and `npm start` must still run while the installed app is open.
if (!cliRun && app.isPackaged && !app.requestSingleInstanceLock()) {
  app.exit(0);
}

// Where the running app listens for `autoslides` commands; both ends compute it.
const cliSocketPath = controlSocketPath(app.getPath('userData'), { dev: !app.isPackaged });

const configService = new ConfigService();

// Persistent log file under <userData>/logs — after the demo swap so demo runs
// log separately. warn/error always; debug/info while Developer mode is on.
// A command line run does not open it: the app may be running and the file has
// one writer.
if (!cliRun) {
  setLogVerbose(configService.getDeveloperMode());
  initLogFile(path.join(app.getPath('userData'), 'logs'), {
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    os: `${process.platform}-${process.arch}`,
    osRelease: process.getSystemVersion(),
    packaged: app.isPackaged,
    developerMode: configService.getDeveloperMode(),
  });
}

const crashLog = createLogger('Crash');
// Monitor, not a handler: logs without suppressing Electron's own error dialog.
process.on('uncaughtExceptionMonitor', (error) => {
  crashLog.error('Uncaught exception in main process:', error);
});
process.on('unhandledRejection', (reason) => {
  crashLog.error('Unhandled promise rejection in main process:', reason);
});
app.on('render-process-gone', (_event, contents, details) => {
  crashLog.error('Renderer process gone:', contents.getURL(), details);
});
app.on('child-process-gone', (_event, details) => {
  crashLog.error('Child process gone:', details);
});

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

app.setName('AutoSlides');

// Set when a quit is requested (Cmd+Q / app.quit) so the main window's close
// handler knows to quit the whole app — not just close the window — once the
// user confirms past the "work still running" warning.
let quitRequested = false;

// The one main window (the Tools window is another BrowserWindow).
let mainWindowRef: BrowserWindow | null = null;

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

  mainWindowRef = mainWindow;
  mainWindow.on('closed', () => {
    if (mainWindowRef === mainWindow) mainWindowRef = null;
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
  // Windows is logging off or shutting down: let the window close so the
  // session can end (a hidden-to-tray window would otherwise block it).
  const endingSession = (): void => { quitRequested = true; };
  mainWindow.on('query-session-end', endingSession);
  mainWindow.on('session-end', endingSession);
  mainWindow.on('close', (event) => {
    // Close to tray (Settings → Download & Playback): hide instead of closing, so the
    // renderer keeps running tasks, downloads and `autoslides` commands. A
    // quit (Cmd+Q, tray menu, app.quit, session end) still closes, and goes
    // through the busy guard below.
    if (!quitRequested && !allowClose && trayService.isEnabled()) {
      event.preventDefault();
      mainWindow.hide();
      trayService.noteHidden();
      return;
    }
    if (allowClose || !windowManager.isAppBusy()) return;

    event.preventDefault();
    // `quitRequested` is set in before-quit; capture it before the (blocking)
    // dialog and reset so a later red-X close isn't mistaken for a quit.
    const wasQuitting = quitRequested;
    quitRequested = false;

    // Quit from the tray menu: bring the window back so the dialog has a
    // visible parent.
    if (!mainWindow.isVisible()) mainWindow.show();
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
  if (cliRun) return;
  // Local progressive media for Lectures Library (Range seeks under outputDir).
  // Install before any window loads so asmedia:// is ready immediately.
  installAsmediaProtocol(configService);
  if (process.platform === 'darwin') {
    windowManager.updateApplicationMenu();
  } else {
    Menu.setApplicationMenu(null);
  }
  createWindow();
});

// Restore and focus the main window, or create one. Before `ready` there is
// nothing to show: the `ready` handler creates the window.
const showMainWindow = (): void => {
  if (!app.isReady()) return;
  const win = mainWindowRef;
  if (!win) {
    createWindow();
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
};

// `autoslides://course/<id>` and `autoslides://session/<id>` (`@common/deepLink`).
const deepLinkRouter = new DeepLinkRouter(showMainWindow);

app.on('second-instance', (_event, argv) => {
  showMainWindow();
  // Windows and Linux: a link clicked while the app runs starts a second
  // instance, which quits on the lock and hands its argv over.
  const link = findDeepLinkArg(argv);
  if (link) deepLinkRouter.receive(link);
});

if (!cliRun) {
  // macOS: on a cold launch this fires before `ready`, so it is registered here,
  // at load, and the router keeps the link until the renderer is ready.
  app.on('open-url', (event, url) => {
    event.preventDefault();
    deepLinkRouter.receive(url);
  });
  if (launchDeepLink) deepLinkRouter.receive(launchDeepLink);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (cliRun) return;
  // macOS Dock click while the main window is hidden by a close.
  const win = mainWindowRef;
  if (win && !win.isVisible()) {
    showMainWindow();
    return;
  }
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Initialize services
const yanhe2Service = new Yanhe2Service(configService);
const authService = new MainAuthService(configService, yanhe2Service);
const autoCropModelService = new AutoCropModelService(configService);
const mlClassifierModelService = new MlClassifierModelService(configService);
const intranetMappingService = new IntranetMappingService(configService);
const apiTransport = new IntranetApiTransport(intranetMappingService);
const apiClient = new MainApiClient(configService, apiTransport);
// Developer-mode catalog of raw cbiz responses, written under logs/. A command
// line run does not open the log file (the app may already hold it), and it
// does not record into the catalog either.
const yanhektCatalogLog = createLogger('YanhektCatalog');
const yanhektCatalogStore = new YanhektCatalogStore(() => getLogDir(), {
  warn: (message, error) => yanhektCatalogLog.warn(message, error),
});
// A command-line run may read the saved current term but never writes it.
apiClient.setSemesterCacheWrites(!cliRun);
if (!cliRun) {
  apiClient.setCatalogSink(yanhektCatalogStore);
  yanhektCatalogStore.setEnabled(configService.getLogYanhektCatalog());
}
// Yanhe 2.0 JSON takes the same route as the rest of the API.
routeYanhe2Through((config) => apiTransport.send(config));
// The course index: on this computer (bundled + downloaded) and online, picked
// per Settings → General → Search. Signed-in users only: every lookup takes the
// Yanhekt token, which the online Index also receives as a Bearer.
const courseIndex = localCourseIndex();
const courseLookup = new CourseLookup(courseIndex, apiClient, configService);
apiClient.setSessionIdSource((courseId, token) => courseLookup.sessionIds(courseId, token));
// Only the app downloads index updates; a command-line run reads what is there.
const courseIndexUpdater = new CourseIndexUpdater({
  index: courseIndex,
  enabled: () => !cliRun && configService.getCourseIndexAutoUpdate(),
  currentTerm: () => courseLookup.currentTerm(),
});
const videoProxyService = new VideoProxyService(
  apiClient,
  intranetMappingService,
  configService,
  (account) => yanhe2Service.getPlayIdentity(account),
);
const localRelayService = new LocalRelayService(apiClient, intranetMappingService, configService);
const ffmpegService = new FFmpegService();
const thumbnailService = new ThumbnailService(videoProxyService, ffmpegService);
const localLecturePosterService = new LocalLecturePosterService(configService, ffmpegService);
const compressLectureService = new CompressLectureService(ffmpegService);
const m3u8DownloadService = new M3u8DownloadService(ffmpegService, configService, intranetMappingService, apiClient);
const audioDownloadService = new AudioDownloadService(configService, intranetMappingService);
const yanhe2TwinResolver = new Yanhe2TwinResolver(yanhe2Service, apiClient, configService, courseLookup);
const yanhe2SubtitleService = new Yanhe2SubtitleService(yanhe2Service, yanhe2TwinResolver, configService);
const pinSyncService = new PinSyncService(
  configService,
  apiClient,
  yanhe2Service,
  yanhe2TwinResolver,
  courseLookup,
  () => broadcastConfig(configService),
);
const yanhe2DownloadService = new Yanhe2DownloadService(
  yanhe2Service,
  yanhe2TwinResolver,
  configService,
  intranetMappingService,
  m3u8DownloadService,
);
const yanhe2CaptionSyncService = new Yanhe2CaptionSyncService(yanhe2Service, intranetMappingService, ffmpegService);
const yanhe2SlideImportService = new Yanhe2SlideImportService({
  yanhe2Service,
  twinResolver: yanhe2TwinResolver,
  configService,
  intranetMapping: intranetMappingService,
  slideExtractionService,
  slideMetadataService,
  slideTimelineService,
});
const powerManagementService = new PowerManagementService();
const aiPromptsService = new AIPromptsService();
const llmApiService = new LLMApiService(configService);
const aiFilteringService = new AIFilteringService(configService, aiPromptsService, llmApiService);
const qtExtractorService = new QtExtractorService(configService);
const notesService = new NotesService(configService, apiTransport);
const obsidianNotesService = new ObsidianNotesService(configService);
const notionNotesService = new NotionNotesService(configService);
const cliInstallService = new CliInstallService();
const cliControlBridge = new RendererBridge(
  () => mainWindowRef,
  () => {
    if (app.isReady() && !mainWindowRef) createWindow();
  },
);
const cliControlServer = new CliControlServer({
  socketPath: cliSocketPath,
  configService,
  settings: createSettingsWriter(configService, intranetMappingService),
  apiClient,
  courseLookup,
  renderer: cliControlBridge,
  commands: APP_COMMANDS,
});

const windowManager = new WindowManager();
windowManager.setConfigService(configService);

const trayService = new TrayService({
  configService,
  translate: (key) => windowManager.translate(key),
  getMainWindow: () => mainWindowRef,
  showMainWindow: () => showMainWindow(),
  quit: () => app.quit(),
});
// Tell the user when everything finished while the window sat in the tray.
// Wait a moment first: the queue goes idle briefly between two tasks.
let workFinishedTimer: NodeJS.Timeout | null = null;
windowManager.setOnBusyChange((busy) => {
  if (workFinishedTimer) clearTimeout(workFinishedTimer);
  workFinishedTimer = null;
  if (busy) return;
  workFinishedTimer = setTimeout(() => {
    workFinishedTimer = null;
    const win = mainWindowRef;
    if (windowManager.isAppBusy() || !win || win.isDestroyed() || win.isVisible()) return;
    if (trayService.isEnabled()) trayService.noteWorkFinished();
  }, 5000);
});
// Lecture Compress moved to the main-window Lectures page; do not cancel an
// in-flight batch encode just because the Tools window closes.

// Initialize power management based on config
const initializePowerManagement = async () => {
  const shouldPreventSleep = configService.getPreventSystemSleep();
  if (shouldPreventSleep) {
    await powerManagementService.preventSleep('settings');
  }
};

app.whenReady().then(() => {
  if (cliRun) {
    void runCli(cliRun, {
      version: app.getVersion(),
      configService,
      apiClient,
      courseLookup,
      intranetMappingService,
      m3u8DownloadService,
      controlSocketPath: cliSocketPath,
      launchApp: () => launchApp(app.isPackaged),
      setVerbose: () => setLoggerConsoleMode('all'),
      onInterrupt: cliInterrupts.onInterrupt,
    }).then(exitCli);
    return;
  }
  initializePowerManagement();
  windowManager.setupYuketangClassCapture();
  // Tray icon, when Settings → Download & Playback keeps the app running in the tray.
  trayService.applyConfig();
  // Start LAN relay if Developer mode is on and the user left it enabled.
  void localRelayService.applyConfig();
  // Take `autoslides` commands, unless Settings turned that off.
  cliControlServer.applyConfig();
  // Keep the agent skill's copy in step with this release.
  cliInstallService.syncSkill();
  // Download course index updates, unless Settings turned that off.
  courseIndexUpdater.applyConfig();
});

app.on('before-quit', () => {
  quitRequested = true;
});

// Cleanup only when the app is actually terminating. Using will-quit (instead
// of before-quit) means a quit cancelled by the close-guard dialog doesn't tear
// down power management while the app keeps running.
app.on('will-quit', () => {
  powerManagementService.cleanup();
  trayService.destroy();
  void localRelayService.stop();
  if (!cliRun) cliControlServer.stop();
  yanhektCatalogStore.flushSync();
  flushLogFile();
});

// Register all IPC handlers
if (!cliRun) registerAllIpcHandlers({
  authService,
  yanhe2Service,
  apiClient,
  courseIndex,
  courseLookup,
  courseIndexUpdater,
  configService,
  intranetMappingService,
  videoProxyService,
  localRelayService,
  thumbnailService,
  localLecturePosterService,
  m3u8DownloadService,
  audioDownloadService,
  powerManagementService,
  aiPromptsService,
  aiFilteringService,
  llmApiService,
  updateDownloadService,
  windowsAutoUpdater,
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
  slideTimelineService,
  yanhe2SlideImportService,
  yanhe2SubtitleService,
  yanhe2DownloadService,
  yanhe2TwinResolver,
  yanhe2CaptionSyncService,
  pinSyncService,
  cacheManagementService,
  yanhektCatalogStore,
  notesService,
  obsidianNotesService,
  notionNotesService,
  cliInstallService,
  cliControlServer,
  cliControlBridge,
  deepLinkRouter,
  trayService,
});
