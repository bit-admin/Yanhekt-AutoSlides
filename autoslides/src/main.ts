import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { MainAuthService } from './main/authService';
import { MainApiClient } from './main/apiClient';
import { ConfigService } from './main/configService';

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
  return configService.getConfig();
});

// IPC handlers for live streams
ipcMain.handle('api:getPersonalLiveList', async (event, token: string, page?: number, pageSize?: number) => {
  return await apiClient.getPersonalLiveList(token, page, pageSize);
});

ipcMain.handle('api:searchLiveList', async (event, token: string, keyword: string, page?: number, pageSize?: number) => {
  return await apiClient.searchLiveList(token, keyword, page, pageSize);
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
