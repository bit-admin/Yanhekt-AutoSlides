/**
 * Add-ons Window Renderer
 * Entry point for the Add-ons window (Yuketang, etc.)
 */

import './index.css';
import { createApp } from 'vue';
import AddonsApp from './renderer/components/addons/AddonsApp.vue';
import { i18n } from './renderer/shared/i18n';
import { loadConfig } from './renderer/shared/services/configStore';

const app = createApp(AddonsApp);
app.use(i18n);
loadConfig().then(async () => {
  // Demo mode: install the override registry before mount (consistent with the
  // other windows). Deleting src/renderer/demo/ + this guarded import drops it.
  const { isDemoMode } = await import('./renderer/shared/services/runtimeEnv');
  if (isDemoMode()) {
    await import('./renderer/demo/bootstrap').then((m) => m.installDemo());
  }
  app.mount('#app');
});
