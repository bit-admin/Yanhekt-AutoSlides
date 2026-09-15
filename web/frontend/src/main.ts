import { createApp } from "vue";
import App from "./App.vue";
import { i18n } from "./i18n";
import { router } from "./router";
import { authStore } from "./stores/authStore";
import { initSettings } from "./stores/settingsStore";
// Side-effect import: registers the subscription-list refresh on authStore's
// onIdentityReady hook. Named here rather than left to whichever component
// happens to import it first, so the wiring is visible at the entry point.
// Imports are evaluated before this module's body, so it is registered well
// before the session guard below can fire the hook.
import "./composables/subscribedCourses";
import "./styles/index.css";

// Apply persisted theme + language and start following the OS scheme.
initSettings();

// The ?token= strip (bookmarklet return) is synchronous and runs before the
// router is installed — stashed as pendingToken for the login form to
// auto-fill, never auto-adopted — so the router never sees the secret in the URL.
authStore.consumeUrlToken();

// A stored session is verified on the first navigation that can show it, not
// at startup: standalone pages (Apps, legal, Lab, Slides) set meta.skipSession
// and cost no Worker request. Registered before `.use(router)`, which starts
// the initial navigation. The UI shows the verifying state meanwhile.
//
// There is deliberately no startup `/api/config` fetch either: only recorded
// playback reads it, and useVideoPlayer awaits it alongside its other lookups.
router.beforeEach((to) => {
  if (!to.meta.skipSession) void authStore.ensureStoredSession();
});

const app = createApp(App).use(i18n).use(router);

// Mount after the initial navigation resolves so the first render already
// shows the deep-linked route (keeps KeepAlive caching deterministic). If the
// bookmarklet returned to a non-login path, bounce to /login so the paste
// step can pick up the pending token.
void router.isReady().then(async () => {
  const current = router.currentRoute.value;
  if (authStore.pendingToken.value && current.name !== "login") {
    // Carry the origin path so paste-confirm returns the user there (e.g. Notes).
    await router.replace({
      name: "login",
      query: { redirect: current.fullPath },
    });
  }
  app.mount("#app");
});
