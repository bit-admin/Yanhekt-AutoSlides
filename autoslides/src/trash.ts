/**
 * Trash Window Renderer
 * Entry point for the in-app trash window
 */

import './index.css';
import { createApp } from 'vue';
import TrashApp from './renderer/TrashApp.vue';
import { i18n } from './renderer/i18n';

const app = createApp(TrashApp);
app.use(i18n);
app.mount('#app');
