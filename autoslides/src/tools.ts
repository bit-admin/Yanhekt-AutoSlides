/**
 * Tools Window Renderer
 * Entry point for the unified Tools window (PDF Maker, Trash, Offline Processing)
 */

import './index.css';
import { createApp } from 'vue';
import ToolsApp from './renderer/components/tools/ToolsApp.vue';
import { i18n } from './renderer/shared/i18n';
import { loadConfig } from './renderer/shared/services/configStore';
import { tokenManager } from './renderer/shared/services/authService';
import { PostProcessingService } from './renderer/shared/services/postProcessingService';
import {
  classifyMultipleImages,
  classifySingleImage,
} from './renderer/features/ai/slideClassificationService';

PostProcessingService.setClassifier({ classifyMultipleImages, classifySingleImage });

const app = createApp(ToolsApp);
app.use(i18n);
loadConfig().then(async () => {
  // Demo mode: install fake Results View / PDF Maker data before mount.
  // Deleting src/renderer/demo/ + this guarded import drops demo mode.
  const { isDemoMode } = await import('./renderer/shared/services/runtimeEnv');
  if (isDemoMode()) {
    await import('./renderer/demo/bootstrap').then((m) => m.installDemo());
  }
  await tokenManager.hydrate();
  app.mount('#app');
});
