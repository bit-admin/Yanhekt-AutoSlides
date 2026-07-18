import { createApp } from "vue";
import App from "./App.vue";
import { i18n } from "./i18n";
import { router } from "./router";
import { authStore } from "./stores/authStore";
import { initSettings } from "./stores/settingsStore";
import "./styles/index.css";

// Apply persisted theme + language and start following the OS scheme.
initSettings();

// Kick off auth init before mounting. The ?token= strip (bookmarklet return)
// is synchronous — stashed as pendingToken for the login form to auto-fill,
// never auto-adopted — so the router never sees the secret in the URL. A
// stored session is verified async; the UI shows the verifying state meanwhile.
void authStore.initFromUrlOrStorage();

const app = createApp(App).use(i18n).use(router);

// Mount after the initial navigation resolves so the first render already
// shows the deep-linked route (keeps KeepAlive caching deterministic). If the
// bookmarklet returned to a non-login path, bounce to /login so the paste
// step can pick up the pending token.
void router.isReady().then(async () => {
  if (authStore.pendingToken.value && router.currentRoute.value.name !== "login") {
    await router.replace({ name: "login" });
  }
  app.mount("#app");
});
