/**
 * PDF Maker Window Renderer
 * Entry point for the PDF Maker window
 */

import './index.css';
import { createApp } from 'vue';
import PdfMakerApp from './renderer/PdfMakerApp.vue';
import { i18n } from './renderer/i18n';

const app = createApp(PdfMakerApp);
app.use(i18n);
app.mount('#app');
