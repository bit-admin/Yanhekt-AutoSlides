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
   * Link handling
   */
  openLink: (url) => ipcRenderer.invoke('open-link', url),
  
  /**
   * System information
   */
  platform: process.platform
});

// Log when preload script has been loaded
console.log('Preload script has been loaded');