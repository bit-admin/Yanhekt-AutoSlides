const { app, BrowserWindow, ipcMain, dialog, session, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const { promisify } = require('util');
const fsAccess = promisify(fs.access);
const fsReaddir = promisify(fs.readdir);
const fsStat = promisify(fs.stat);
const fsUnlink = promisify(fs.unlink);
const fsRmdir = promisify(fs.rmdir);

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
    default: 0.005
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
  cacheCleanInterval: {
    type: 'number',
    default: 15
  },
  siteProfiles: {
    type: 'object',
    default: {
      yanhekt_session: {
        name: 'YanHeKT Session Player',
        elementSelector: '#video_id_topPlayer_html5_api',
        urlPattern: 'yanhekt.cn/session',
        builtin: true,
        automation: {
          autoDetectEnd: true,
          endDetectionSelector: '.player-ended-poster',
          autoStartPlayback: true,
          playButtonSelector: '.player-mid-button-container button',
          countdownSelector: '' // Leave empty for session player
        }
      },
      yanhekt_live: {
        name: 'YanHeKT Live Player',
        elementSelector: '#video_id_mainPlayer_html5_api',
        urlPattern: 'yanhekt.cn/live',
        builtin: true,
        automation: {
          autoDetectEnd: true,
          endDetectionSelector: '.VideoResult_result__LdbB3',
          autoStartPlayback: true,
          playButtonSelector: '.player-mid-button-container button',
          countdownSelector: '.countdown-content'
        }
      }
    }
  },
  activeProfileId: {
    type: 'string',
    default: 'yanhekt_live'  // Change default profile to live player
  }
};

const config = new Store({ schema });

// Create directory if it doesn't exist
function ensureDirectoryExists(directory) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

function createApplicationMenu() {
  // Template for macOS application menu
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'AutoSlides Help',
          click: async () => {
            const helpWindow = new BrowserWindow({
              width: 900,
              height: 700,
              webPreferences: {
                contextIsolation: true,
                nodeIntegration: false
              },
              title: 'AutoSlides Help'
            });
            
            helpWindow.loadFile(path.join(__dirname, 'renderer', 'help.html'));
          }
        },
        {
          label: 'Visit GitHub Repository',
          click: async () => {
            await shell.openExternal('https://github.com/bit-admin/Yanhekt-AutoSlides');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
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
  createApplicationMenu(); // Add this line to create the menu
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

// Cache management utilities
async function calculateCacheSize() {
  try {
    const cachePath = app.getPath('userData');
    let totalSize = 0;
    
    // Function to recursively calculate directory size
    const getDirSize = async (dirPath) => {
      try {
        const files = await fsReaddir(dirPath);
        const stats = await Promise.all(
          files.map(async (file) => {
            const filePath = path.join(dirPath, file);
            const stat = await fsStat(filePath);
            if (stat.isDirectory()) {
              return getDirSize(filePath);
            }
            return stat.size;
          })
        );
        return stats.reduce((acc, size) => acc + size, 0);
      } catch (e) {
        console.error(`Error calculating size for ${dirPath}:`, e);
        return 0;
      }
    };

    // Calculate cache directories sizes
    const cacheSize = await getDirSize(path.join(cachePath, 'Cache'));
    const gpuCacheSize = await getDirSize(path.join(cachePath, 'GPUCache'));
    const storageSize = await getDirSize(path.join(cachePath, 'Local Storage'));
    const sessionStorageSize = await getDirSize(path.join(cachePath, 'Session Storage'));
    
    totalSize = cacheSize + gpuCacheSize + storageSize + sessionStorageSize;
    
    // Format to MB with 2 decimal places
    return {
      totalMB: (totalSize / (1024 * 1024)).toFixed(2),
      details: {
        cache: (cacheSize / (1024 * 1024)).toFixed(2),
        gpuCache: (gpuCacheSize / (1024 * 1024)).toFixed(2),
        localStorage: (storageSize / (1024 * 1024)).toFixed(2),
        sessionStorage: (sessionStorageSize / (1024 * 1024)).toFixed(2)
      }
    };
  } catch (error) {
    console.error('Error calculating cache size:', error);
    return { totalMB: 'Error', details: {} };
  }
}

async function clearCacheDirectory(dirPath) {
  try {
    // Check if directory exists
    await fsAccess(dirPath).catch(() => {
      // Directory doesn't exist, nothing to delete
      return null;
    });
    
    // Read directory contents
    const files = await fsReaddir(dirPath);
    
    // Delete all files in the directory
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = await fsStat(filePath);
      
      if (stat.isDirectory()) {
        await clearCacheDirectory(filePath);
      } else {
        await fsUnlink(filePath).catch(err => {
          console.error(`Failed to delete file ${filePath}:`, err);
        });
      }
    }
    
    // Don't delete the directory itself as Electron might recreate it
    // and could have issues if it's missing
    
    return true;
  } catch (error) {
    console.error(`Error clearing directory ${dirPath}:`, error);
    return false;
  }
}

async function clearAllCacheData() {
  try {
    const userData = app.getPath('userData');
    
    // Clear various cache directories
    await Promise.all([
      clearCacheDirectory(path.join(userData, 'Cache')),
      clearCacheDirectory(path.join(userData, 'Code Cache')),
      clearCacheDirectory(path.join(userData, 'GPUCache')),
      session.defaultSession.clearCache(),
      session.defaultSession.clearStorageData({
        storages: ['appcache', 'cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage'],
      }),
    ]);
    
    return true;
  } catch (error) {
    console.error('Error clearing all cache data:', error);
    return false;
  }
}

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

ipcMain.handle('open-link', async (event, url) => {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  
  if (win) {
    win.webContents.send('open-url', url);
  }
  
  return true;
});

// Cache management IPC handlers
ipcMain.handle('clear-browser-cache', async () => {
  try {
    await session.defaultSession.clearCache();
    await clearCacheDirectory(path.join(app.getPath('userData'), 'Cache'));
    await clearCacheDirectory(path.join(app.getPath('userData'), 'GPUCache'));
    return { success: true };
  } catch (error) {
    console.error('Error clearing browser cache:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-cookies', async () => {
  try {
    await session.defaultSession.clearStorageData({
      storages: ['cookies']
    });
    return { success: true };
  } catch (error) {
    console.error('Error clearing cookies:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-all-data', async () => {
  try {
    const result = await clearAllCacheData();
    return { success: result };
  } catch (error) {
    console.error('Error clearing all data:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-cache-size', async () => {
  return calculateCacheSize();
});