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
  
  /**
   * System information
   */
  platform: process.platform
});

// Log when preload script has been loaded
console.log('Preload script has been loaded');