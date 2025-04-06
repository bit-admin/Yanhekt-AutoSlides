const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Method to get dark mode status from main process
  getDarkModeStatus: () => ipcRenderer.invoke('get-dark-mode-status'),
  
  // Method to toggle dark mode
  toggleDarkMode: () => ipcRenderer.invoke('toggle-dark-mode')
});
