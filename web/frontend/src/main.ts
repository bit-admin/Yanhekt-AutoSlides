import { createApp } from "vue";
import App from "./App.vue";
import { i18n } from "./i18n";
import { router } from "./router";
import { authStore } from "./stores/authStore";
import { initSettings } from "./stores/settingsStore";
import "./styles/index.css";

// Apply persisted theme + language and start following the OS scheme.
initSettings();

// Kick off token verification (?token= from the bookmarklet wins over the
// stored token) before mounting; the UI shows the verifying state meanwhile.
// Must run before the router's initial navigation: the ?token= strip is
// synchronous (history.replaceState before the first await), so the router
// never sees the token in the URL.
void authStore.initFromUrlOrStorage();

const app = createApp(App).use(i18n).use(router);

// Mount after the initial navigation resolves so the first render already
// shows the deep-linked route (keeps KeepAlive caching deterministic).
void router.isReady().then(() => app.mount("#app"));
