/**
 * Add-ons Window Renderer
 * Entry point for the Add-ons window (Yuketang, etc.)
 */

import './index.css';
import { createApp } from 'vue';
import AddonsApp from './renderer/components/addons/AddonsApp.vue';
import { i18n } from './renderer/shared/i18n';

const app = createApp(AddonsApp);
app.use(i18n);
app.mount('#app');
