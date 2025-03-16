const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

// Configuration schema
const schema = {
  outputDir: {
    type: 'string',
    default: path.join(app.getPath('downloads'), 'slides')
  },
  topCropPercent: {
    type: 'number',
    default: 5
  },
  bottomCropPercent: {
    type: 'number',
    default: 5
  },
  changeThreshold: {
    type: 'number',
    default: 0.001
  },
  checkInterval: {
    type: 'number',
    default: 2
  },
  blockingRules: {
    type: 'string',
    default: `yanhekt.cn###root > div.app > div.sidebar-open:first-child
yanhekt.cn###root > div.app > div.BlankLayout_layout__kC9f3:last-child > div.ant-spin-nested-loading:nth-child(2) > div.ant-spin-container > div.index_liveWrapper__YGcpO > div.index_userlist__T-6xf:last-child > div.index_staticContainer__z3yt-
yanhekt.cn###ai-bit-shortcut`
  },
  cropGuidesTrigger: {
    type: 'string',
    default: 'session'
  }
};

const config = new Store({ schema });

// Create directory if it doesn't exist
function ensureDirectoryExists(directory) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

// Create main window
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true // Enable webview tag
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();
  
  // Ensure output directory exists
  ensureDirectoryExists(config.get('outputDir'));
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers
ipcMain.handle('get-config', () => {
  return config.store;
});

ipcMain.handle('save-config', (event, newConfig) => {
  for (const key in newConfig) {
    config.set(key, newConfig[key]);
  }
  return config.store;
});

ipcMain.handle('select-output-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const outputDir = result.filePaths[0];
    config.set('outputDir', outputDir);
    return outputDir;
  }
  return config.get('outputDir');
});

// Handle saving screenshots
ipcMain.handle('save-slide', (event, { imageData, timestamp }) => {
  try {
    const outputDir = config.get('outputDir');
    ensureDirectoryExists(outputDir);
    
    const fileName = `slide_${timestamp}.png`;
    const filePath = path.join(outputDir, fileName);
    
    // Remove the data URL prefix
    const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(filePath, base64Data, 'base64');
    
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Blocking rules handlers
ipcMain.handle('get-blocking-rules', () => {
  return config.get('blockingRules');
});

ipcMain.handle('save-blocking-rules', (event, rules) => {
  config.set('blockingRules', rules);
  return true;
});

// Add this IPC handler
ipcMain.handle('open-link', async (event, url) => {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  
  if (win) {
    win.webContents.send('open-url', url);
  }
  
  return true;
});