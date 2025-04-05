const { contextBridge, ipcRenderer } = require('electron');

/**
 * The preload script runs before the renderer process is loaded,
 * and has access to both Node.js APIs and the window object.
 * It provides a secure bridge between the renderer process and the main process.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Configuration methods
   */
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  selectOutputDirectory: () => ipcRenderer.invoke('select-output-directory'),
  
  /**
   * Screenshot capture methods
   */
  saveSlide: (data) => ipcRenderer.invoke('save-slide', data),
  
  /**
   * Element blocking rules methods
   */
  getBlockingRules: () => ipcRenderer.invoke('get-blocking-rules'),
  saveBlockingRules: (rules) => ipcRenderer.invoke('save-blocking-rules', rules),
  
  /**
   * Cache management methods
   */
  clearBrowserCache: () => ipcRenderer.invoke('clear-browser-cache'),
  clearCookies: () => ipcRenderer.invoke('clear-cookies'),
  clearAllData: () => ipcRenderer.invoke('clear-all-data'),
  getCacheSize: () => ipcRenderer.invoke('get-cache-size'),
  
  /**
   * Background running methods
   */
  enableBackgroundRunning: () => ipcRenderer.invoke('enable-background-running'),
  disableBackgroundRunning: () => ipcRenderer.invoke('disable-background-running'),
  getBackgroundRunningStatus: () => ipcRenderer.invoke('get-background-running-status'),

  /**
   * API request method
   */
  makeApiRequest: (options) => ipcRenderer.invoke('make-api-request', options),

  muteWebviewAudio: async (webviewId) => {
    try {
      return await ipcRenderer.invoke('muteWebviewAudio', webviewId);
    } catch (error) {
      console.error('Error muting webview audio:', error);
      throw error;
    }
  },

  applyBlockingRules: () => ipcRenderer.invoke('apply-blocking-rules'),
  onApplyBlockingRules: (callback) => ipcRenderer.on('apply-blocking-rules', () => callback()),

  onThemeChange: (callback) => {
    ipcRenderer.on('theme-changed', (event, data) => callback(event, data));
  },

  // Send message to main window
  sendToMainWindow: (channel, data) => {
    return ipcRenderer.invoke('send-to-main-window', channel, data);
  },

  fetchRecordedCourses: async () => {
    try {
      return await ipcRenderer.invoke('fetch-recorded-courses');
    } catch (error) {
      console.error('Error in fetchRecordedCourses:', error);
      return { success: false, error: error.message };
    }
  },

  onShowCropGuides: (callback) => ipcRenderer.on('show-crop-guides', () => callback()),

  onUpdateCropPreview: (callback) => {
    ipcRenderer.on('update-crop-preview', (event, data) => callback(event, data));
    return () => {
      ipcRenderer.removeAllListeners('update-crop-preview');
    };
  },

  // For main window to receive updates
  onUpdateProfiles: (callback) => {
      ipcRenderer.on('update-profiles', (event, profiles) => callback(event, profiles));
  },
  
  unmuteWebviewAudio: async (webviewId) => {
    try {
      return await ipcRenderer.invoke('unmuteWebviewAudio', webviewId);
    } catch (error) {
      console.error('Error unmuting webview audio:', error);
      throw error;
    }
  },
  /**
   * System information
   */
  platform: process.platform
});

// Log when preload script has been loaded
console.log('Preload script has been loaded');