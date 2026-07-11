import { createApp } from "vue";
import App from "./App.vue";
import { i18n } from "./i18n";
import { authStore } from "./stores/authStore";
import { initSettings } from "./stores/settingsStore";
import "./styles/index.css";

// Apply persisted theme + language and start following the OS scheme.
initSettings();

// Kick off token verification (?token= from the bookmarklet wins over the
// stored token) before mounting; the UI shows the verifying state meanwhile.
void authStore.initFromUrlOrStorage();

createApp(App).use(i18n).mount("#app");
