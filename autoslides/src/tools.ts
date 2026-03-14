/**
 * Tools Window Renderer
 * Entry point for the unified Tools window (PDF Maker, Trash, Offline Processing)
 */

import './index.css';
import { createApp } from 'vue';
import ToolsApp from './renderer/ToolsApp.vue';
import { i18n } from './renderer/i18n';

const app = createApp(ToolsApp);
app.use(i18n);
app.mount('#app');
