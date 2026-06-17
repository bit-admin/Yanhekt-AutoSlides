/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';
import { createApp } from 'vue';
import App from './App.vue';
import { i18n } from './renderer/shared/i18n';
import { loadConfig } from './renderer/shared/services/configStore';
import { PostProcessingService } from './renderer/shared/services/postProcessingService';
import {
  classifyMultipleImages,
  classifySingleImage,
} from './renderer/features/ai/slideClassificationService';

PostProcessingService.setClassifier({ classifyMultipleImages, classifySingleImage });

// Platform class for CSS gating (e.g. the macOS vibrancy sidebar needs
// transparent backgrounds that would render white on Windows).
if (navigator.userAgent.toLowerCase().includes('mac')) {
  document.documentElement.classList.add('platform-darwin');
}

const app = createApp(App);
app.use(i18n);
loadConfig().then(async () => {
  // Demo mode: install the override registry (fake account/courses/queues) before
  // mount. Deleting src/renderer/demo/ + this guarded import drops demo mode.
  const { isDemoMode } = await import('./renderer/shared/services/runtimeEnv');
  if (isDemoMode()) {
    await import('./renderer/demo/bootstrap').then((m) => m.installDemo());
  }
  app.mount('#app');
});
