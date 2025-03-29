const { app, BrowserWindow, ipcMain, dialog, session, Menu, shell, net } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const { promisify } = require('util');
const fsAccess = promisify(fs.access);
const fsReaddir = promisify(fs.readdir);
const fsStat = promisify(fs.stat);
const fsUnlink = promisify(fs.unlink);
const fsRmdir = promisify(fs.rmdir);
const fetch = require('node-fetch');

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
  checkInterval: {
    type: 'number',
    default: 2
  },
  blockingRules: {
    type: 'string',
    default: `yanhekt.cn###root > div.app > div.sidebar-open:first-child
yanhekt.cn###root > div.app > div.BlankLayout_layout__kC9f3:last-child > div.ant-spin-nested-loading:nth-child(2) > div.ant-spin-container > div.index_liveWrapper__YGcpO > div.index_userlist__T-6xf:last-child > div.index_staticContainer__z3yt-
yanhekt.cn###ai-bit-shortcut
yanhekt.cn##div#ai-bit-animation-modal`
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
          countdownSelector: '', // Leave empty for session player
          autoAdjustSpeed: false,  // Enable auto speed adjustment
          speedSelector: '#video_id_mainPlayer_html5_api', // not same as elementSelector
          playbackSpeed: '3.0', // Default to 3x speed
          autoDetectTitle: true, // Enable title detection
          courseTitleSelector: '.ant-breadcrumb li:nth-child(2) a', // Course title selector
          sessionInfoSelector: '.ant-breadcrumb li:nth-child(3) span' // Session info selector
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
          countdownSelector: '.countdown-content',
          autoAdjustSpeed: false, // Disabled for live player
          speedSelector: '#video_id_mainPlayer_html5_api', // Same as elementSelector
          playbackSpeed: '1.0', // 1x default speed for live
          autoDetectTitle: true, // Enable title detection
          courseTitleSelector: '.index_liveHeader__uN3uM', // Course title selector
          sessionInfoSelector: '' // No session info for live
        }
      }
    }
  },
  activeProfileId: {
    type: 'string',
    default: 'yanhekt_session'  // Change default profile
  },
  allowBackgroundRunning: {
    type: 'boolean',
    default: false
  },
  comparisonMethod: {
    type: 'string',
    default: 'default'
  },
  enableDoubleVerification: {
    type: 'boolean',
    default: false
  },
  fastModeEnabled: {
    type: 'boolean',
    default: false
  },
  resetVideoProgress: {
    type: 'boolean',
    default: true
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
  setupProgressInterceptor();

  // Ensure output directory exists
  ensureDirectoryExists(config.get('outputDir'));
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Handle API requests from renderer
ipcMain.handle('make-api-request', async (event, options) => {
  try {
    const { url, headers, method = 'GET', body } = options;
    
    // Request configuration
    const config = {
      method: method,
      headers: headers
    };
    
    // Add body for PUT/POST requests
    if (body && (method === 'PUT' || method === 'POST')) {
      config.body = body;
    }
    
    // Make the API request
    const response = await fetch(url, config);
    
    // Parse JSON response
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error making API request:', error);
    return {
      code: -1,
      message: `API Request failed: ${error.message}`,
      error: error.toString()
    };
  }
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

// Add these variables to track intercept state
let interceptProgress = false;

// Add this function to set up the webRequest interceptor
function setupProgressInterceptor() {
  // Filter for API responses from YanHeKT
  const filter = {
    urls: [
      'https://cbiz.yanhekt.cn/v2/course/session/*', 
      'https://cbiz.yanhekt.cn/v1/course/session/*',
      'https://cbiz.yanhekt.cn/v2/session/*/progress',
      'https://cbiz.yanhekt.cn/v1/session/*/progress'
    ]
  };

  // Intercept response headers
  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    if (!interceptProgress) {
      // If not intercepting, just pass through
      callback({ cancel: false });
      return;
    }

    // Get content type to check if JSON
    const contentTypeHeader = details.responseHeaders['content-type'] || details.responseHeaders['Content-Type'];
    const isJson = contentTypeHeader && contentTypeHeader[0] && 
                   contentTypeHeader[0].toLowerCase().includes('application/json');

    if (isJson) {
      // For JSON responses, we'll need to modify the response body
      // We'll do this by setting a flag to handle it in onResponseStarted
      details.interceptResponse = true;
    }

    callback({ responseHeaders: details.responseHeaders });
  });

  // Intercept and modify response bodies
  session.defaultSession.webRequest.onResponseStarted(filter, (details) => {
    if (!interceptProgress || !details.interceptResponse) {
      return;
    }

      // Add this to your setupProgressInterceptor function, within the onResponseStarted callback
      const code = `
        // Override fetch for YanHeKT progress APIs
        const originalFetch = window.fetch;
        window.fetch = async function(url, options) {
          // ...existing fetch override code
        };
        
        // Also override XMLHttpRequest for older implementations
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
          this._autoSlidesUrl = url;
          return originalXHROpen.call(this, method, url, ...args);
        };
        
        XMLHttpRequest.prototype.send = function(...args) {
          const url = this._autoSlidesUrl || '';
          
          if (typeof url === 'string' && (
              url.includes('/course/session/') || 
              url.includes('/session/') && url.includes('/progress'))) {
            
            const originalOnReadyStateChange = this.onreadystatechange;
            this.onreadystatechange = function() {
              if (this.readyState === 4 && this.status === 200) {
                try {
                  const originalResponse = JSON.parse(this.responseText);
                  const modifiedResponse = JSON.parse(JSON.stringify(originalResponse));
                  
                  // Modify user_progress in session list
                  if (modifiedResponse.data && Array.isArray(modifiedResponse.data.data)) {
                    modifiedResponse.data.data.forEach(session => {
                      if (session.user_progress) {
                        session.user_progress.progress_current = "0";
                        console.log('[AutoSlides] Reset progress for session (XHR):', session.id);
                      }
                    });
                  }
                  
                  // Modify direct progress response
                  if (modifiedResponse.data && modifiedResponse.data.progress_current) {
                    modifiedResponse.data.progress_current = "0";
                    console.log('[AutoSlides] Reset progress for current session (XHR)');
                  }
                  
                  // Override the response properties
                  Object.defineProperty(this, 'responseText', {
                    get: function() {
                      return JSON.stringify(modifiedResponse);
                    }
                  });
                } catch (e) {
                  console.error('[AutoSlides] Error modifying XHR response:', e);
                }
              }
              
              if (originalOnReadyStateChange) {
                originalOnReadyStateChange.apply(this, arguments);
              }
            };
          }
          
          return originalXHRSend.apply(this, args);
        };
        
        console.log('[AutoSlides] Progress intercept fully installed (fetch+XHR)');
      `;

    // Execute this code in all frames
    details.webContents.executeJavaScript(code)
      .catch(err => console.error('Error installing progress intercept:', err));
  });
}

// Background running handling
let powerSaveBlockerId = null;

function enableBackgroundRunning() {
  try {
    if (powerSaveBlockerId === null) {
      // The 'prevent-app-suspension' reason works on both macOS and Windows
      powerSaveBlockerId = require('electron').powerSaveBlocker.start('prevent-app-suspension');
      console.log('Background running enabled, ID:', powerSaveBlockerId);
      
      // On macOS, we can also prevent display sleep if needed
      if (process.platform === 'darwin') {
        const displayBlockerId = require('electron').powerSaveBlocker.start('prevent-display-sleep');
        console.log('Display sleep prevention enabled, ID:', displayBlockerId);
      }
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to enable background running:', error);
    return false;
  }
}

function disableBackgroundRunning() {
  try {
    if (powerSaveBlockerId !== null) {
      require('electron').powerSaveBlocker.stop(powerSaveBlockerId);
      console.log('Background running disabled');
      powerSaveBlockerId = null;
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to disable background running:', error);
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

// Add this helper function for sanitizing folder names
function sanitizeFolderName(name) {
  if (!name) return 'Untitled';
  
  // First replace spaces with underscores
  let sanitized = name.replace(/\s+/g, '_');
  
  // Then replace invalid characters with underscores, but preserve hyphens
  sanitized = sanitized.replace(/[\\/:*?"<>|]/g, '_');
  
  // Convert multiple sequential underscores to single
  sanitized = sanitized.replace(/_+/g, '_');
  
  // Limit length to avoid path issues
  return sanitized.substring(0, 100);
}

// Handle saving screenshots
ipcMain.handle('save-slide', (event, { imageData, timestamp, title }) => {
  try {
    const baseOutputDir = config.get('outputDir');
    ensureDirectoryExists(baseOutputDir);
    
    // Create a title-based subfolder if title is provided
    let targetDir = baseOutputDir;
    if (title) {
      const folderName = sanitizeFolderName(title);
      targetDir = path.join(baseOutputDir, folderName);
      ensureDirectoryExists(targetDir);
    }
    
    const fileName = `slide_${timestamp}.png`;
    const filePath = path.join(targetDir, fileName);
    
    // Remove the data URL prefix
    const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(filePath, base64Data, 'base64');
    
    return { success: true, filePath };
  } catch (error) {
    console.error('Error saving slide:', error);
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

// Add IPC handlers for background running
ipcMain.handle('enable-background-running', () => {
  return enableBackgroundRunning();
});

ipcMain.handle('disable-background-running', () => {
  return disableBackgroundRunning();
});

ipcMain.handle('get-background-running-status', () => {
  return powerSaveBlockerId !== null;
});

ipcMain.handle('enableProgressIntercept', (event) => {
  interceptProgress = true;
  console.log('Progress intercept enabled');
  return true;
});

ipcMain.handle('disableProgressIntercept', (event) => {
  interceptProgress = false;
  console.log('Progress intercept disabled');
  return true;
});

ipcMain.handle('getProgressInterceptStatus', (event) => {
  return interceptProgress;
});