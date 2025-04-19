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
  fetchRecordedCourses: () => ipcRenderer.invoke('fetch-recorded-courses'),
  fetchCourseSessions: (courseId) => ipcRenderer.invoke('fetch-course-sessions', courseId),
  fetchLiveCourses: () => ipcRenderer.invoke('fetch-live-courses'),

  getLocalIpAddresses: () => ipcRenderer.invoke('get-local-ip-addresses'),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),

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

  showNotification: (options) => ipcRenderer.invoke('show-notification', options),

  // Send message to main window
  sendToMainWindow: (channel, data) => {
    return ipcRenderer.invoke('send-to-main-window', channel, data);
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
  platform: process.platform,

  // Task management methods
  receiveAddTask: (task) => {
    return new Promise((resolve, reject) => {
      try {
        ipcRenderer.invoke('task:add', task)
          .then(resolve)
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  },
  
  receiveAddTasks: (data) => {
    return new Promise((resolve, reject) => {
      try {
        ipcRenderer.invoke('task:add-multiple', data.tasks)
          .then(resolve)
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  },
  
  receiveStartTasks: (data) => {
    return new Promise((resolve, reject) => {
      try {
        ipcRenderer.invoke('task:start', data.options)
          .then(resolve)
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  },
  
  receiveCancelTasks: () => {
    return new Promise((resolve, reject) => {
      try {
        ipcRenderer.invoke('task:cancel')
          .then(resolve)
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  },
  
  getTaskStatus: () => {
    return new Promise((resolve, reject) => {
      try {
        ipcRenderer.invoke('task:status')
          .then(resolve)
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  },

  sendTaskStatus: (channel, data) => {
    ipcRenderer.send(channel, data);
  },

  debugLog: (message) => {
    ipcRenderer.send('debug-log', message);
  },
  
  onReceiveTaskCommands: () => {
    // Already set up the event listeners in preload.js
    return true;
  }
});

// Forward IPC events to renderer via custom events
ipcRenderer.on('add-task', (event, task) => {
  document.dispatchEvent(new CustomEvent('ipc-add-task', { detail: task }));
});

ipcRenderer.on('add-tasks', (event, tasks) => {
  document.dispatchEvent(new CustomEvent('ipc-add-tasks', { detail: tasks }));
});

ipcRenderer.on('start-tasks', (event, options) => {
  document.dispatchEvent(new CustomEvent('ipc-start-tasks', { detail: options }));
});

ipcRenderer.on('cancel-tasks', () => {
  document.dispatchEvent(new CustomEvent('ipc-cancel-tasks'));
});

ipcRenderer.on('get-task-status', (event, responseChannel) => {
  document.dispatchEvent(new CustomEvent('ipc-get-task-status', { 
    detail: { responseChannel } 
  }));
});

// Get tasks request
ipcRenderer.on('get-tasks', (event, responseChannel) => {
  document.dispatchEvent(new CustomEvent('ipc-get-tasks', { 
    detail: { responseChannel } 
  }));
});

// Remove task request
ipcRenderer.on('remove-task', (event, data) => {
  document.dispatchEvent(new CustomEvent('ipc-remove-task', { 
    detail: data 
  }));
});

// Clear tasks request
ipcRenderer.on('clear-tasks', (event, responseChannel) => {
  document.dispatchEvent(new CustomEvent('ipc-clear-tasks', { 
    detail: { responseChannel } 
  }));
});

// Log when preload script has been loaded
console.log('Preload script has been loaded');