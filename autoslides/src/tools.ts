/**
 * Tools Window Renderer
 * Entry point for the unified Tools window (PDF Maker, Trash, Offline Processing)
 */

import './index.css';
import { createApp } from 'vue';
import ToolsApp from './renderer/components/tools/ToolsApp.vue';
import { i18n } from './renderer/shared/i18n';
import { loadConfig } from './renderer/shared/services/configStore';

const app = createApp(ToolsApp);
app.use(i18n);
loadConfig().then(() => app.mount('#app'));
