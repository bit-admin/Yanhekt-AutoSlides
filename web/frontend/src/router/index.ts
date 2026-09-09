import { watch } from "vue";
import { createRouter, createWebHashHistory, createWebHistory } from "vue-router";
import { i18n } from "../i18n";
import type { NavTarget } from "../stores/navigationStore";
// Eager: the browse tabs. These are what a cold visit lands on and what the
// sidebar flips between constantly, so switching must never wait on a network
// round-trip. They live behind MainContent's KeepAlive.
import HomePage from "../components/course/HomePage.vue";
import CoursePage from "../components/course/CoursePage.vue";
import SearchPage from "../components/course/SearchPage.vue";
import RecordedCourseRoute from "../components/course/RecordedCourseRoute.vue";

// Lazy: the player, Settings, and the full-page workspaces. Each is the ONLY
// path by which a heavy dependency enters the graph, so a static import here
// would put it in the entry chunk and charge every visitor for it:
//
//   PlayerRoute         → PlaybackPage → hls.js          (~618 kB minified)
//   NotesPage           → Editor.js + its tools          (~394 kB)
//   SlidesPage          → the extraction/export pipeline
//   AppsPage            → the vendored github-markdown stylesheets
//   SettingsPage        → cloudStorageStore → the lib/notes client stack
//
// vue-router awaits the loader inside the navigation guard, so the view still
// renders in one paint — there is no flash of an empty route. KeepAlive keeps
// working on the cached ones (Slides/Notes): it unwraps the async component
// before matching its `include` list by name.
// Settings is a sidebar entry but a rare destination, not something you flip
// between — and it was the one eager route dragging the cloud-storage/notes
// client stack (cloudStorageStore → lib/notes/*, ~37 kB) into first paint.
const SettingsPage = () => import("../components/SettingsPage.vue");
const SlidesPage = () => import("../components/slides/SlidesPage.vue");
const NotesPage = () => import("../components/notes/NotesPage.vue");
const PlayerRoute = () => import("../components/video/PlayerRoute.vue");
const LoginPage = () => import("../components/LoginPage.vue");
const AppsPage = () => import("../components/AppsPage.vue");
const LegalPage = () => import("../components/legal/LegalPage.vue");
const ImageComparisonPage = () => import("../components/lab/ImageComparisonPage.vue");

// Routes are the source of truth for navigation; navigationStore is a thin
// façade over this instance. Exported as a module singleton so the singleton
// stores/composables can import it directly (useRouter() only works in setup).
declare module "vue-router" {
  interface RouteMeta {
    /** Which sidebar/bottom-nav entry this route highlights. */
    nav?: NavTarget;
    /** Cached in MainContent's KeepAlive; playback must stay false. */
    keepAlive?: boolean;
    /** i18n key for document.title. */
    titleKey?: string;
    /** Renders standalone in App.vue — no Header/LeftPanel/bottom nav. */
    fullPage?: boolean;
  }
}

export const router = createRouter({
  // The demo build is a plain static bundle under /demo/, where a deep link
  // has to resolve to one real file: Workers' SPA fallback serves the ROOT
  // index.html for anything it does not recognise, which would hand /demo/live
  // to the real app. Hash routes keep every URL pointing at /demo/index.html.
  history: __DEMO__ ? createWebHashHistory(import.meta.env.BASE_URL) : createWebHistory(),
  routes: [
    {
      name: "home",
      path: "/",
      component: HomePage,
      meta: { nav: "home", keepAlive: true, titleKey: "navigation.home" },
    },
    {
      name: "live",
      path: "/live",
      component: CoursePage,
      props: { mode: "live" },
      meta: { nav: "live", keepAlive: true, titleKey: "navigation.live" },
    },
    {
      name: "recorded",
      path: "/recorded",
      component: CoursePage,
      props: { mode: "recorded" },
      meta: { nav: "recorded", keepAlive: true, titleKey: "navigation.recorded" },
    },
    {
      // YouTube-style Subscriptions grid (same CoursePage shell as Recordings).
      name: "subscriptions",
      path: "/subscriptions",
      component: CoursePage,
      props: { mode: "subscriptions" },
      meta: {
        nav: "subscriptions",
        keepAlive: true,
        titleKey: "navigation.subscriptions",
      },
    },
    {
      name: "recorded-course",
      path: "/recorded/:courseId",
      component: RecordedCourseRoute,
      meta: { nav: "recorded", keepAlive: true },
    },
    {
      name: "search",
      path: "/search",
      component: SearchPage,
      meta: { nav: "search", keepAlive: true, titleKey: "navigation.search" },
    },
    {
      // Standalone Photos-like workspace: fullPage drops the YouTube shell.
      // slides + slides-folder share one KeepAlive instance (see App.vue).
      name: "slides",
      path: "/slides",
      component: SlidesPage,
      meta: { fullPage: true, keepAlive: true, titleKey: "navigation.slidesReview" },
    },
    {
      name: "slides-folder",
      path: "/slides/:folderName",
      component: SlidesPage,
      meta: { fullPage: true, keepAlive: true, titleKey: "navigation.slidesReview" },
    },
    {
      // Standalone Notion-like workspace: fullPage drops the YouTube shell.
      // notes + notes-detail share one KeepAlive instance (see App.vue).
      name: "notes",
      path: "/notes",
      component: NotesPage,
      meta: { fullPage: true, keepAlive: true, titleKey: "navigation.notes" },
    },
    {
      name: "notes-detail",
      path: "/notes/:noteId",
      component: NotesPage,
      meta: { fullPage: true, keepAlive: true, titleKey: "navigation.notes" },
    },
    {
      name: "settings",
      path: "/settings",
      component: SettingsPage,
      meta: { nav: "settings", keepAlive: true, titleKey: "settings.settings" },
    },
    {
      name: "login",
      path: "/login",
      component: LoginPage,
      meta: { fullPage: true, keepAlive: false, titleKey: "webAuth.pageTitle" },
    },
    {
      // Opened in its own tab from the sidebar; standalone chrome so it reads
      // as a product page rather than a view inside the player app.
      name: "apps",
      path: "/apps",
      component: AppsPage,
      meta: { fullPage: true, keepAlive: false, titleKey: "apps.pageTitle" },
    },
    {
      // Lab tool: SSIM/pHash calibration (was root test-image-comparison.html).
      name: "image-comparison",
      path: "/test",
      component: ImageComparisonPage,
      meta: { fullPage: true, keepAlive: false, titleKey: "lab.imageComparison" },
    },
    {
      // Route names match LegalDocId — the legal sidebar links by name.
      name: "terms",
      path: "/terms",
      component: LegalPage,
      props: { docId: "terms" },
      meta: { fullPage: true, keepAlive: false, titleKey: "legal.terms" },
    },
    {
      name: "privacy",
      path: "/privacy",
      component: LegalPage,
      props: { docId: "privacy" },
      meta: { fullPage: true, keepAlive: false, titleKey: "legal.privacy" },
    },
    {
      name: "disclosure",
      path: "/disclosure",
      component: LegalPage,
      props: { docId: "disclosure" },
      meta: { fullPage: true, keepAlive: false, titleKey: "legal.disclosure" },
    },
    {
      name: "copyright",
      path: "/copyright",
      component: LegalPage,
      props: { docId: "copyright" },
      meta: { fullPage: true, keepAlive: false, titleKey: "legal.copyright" },
    },
    {
      name: "player-live",
      path: "/player/live/:courseId",
      component: PlayerRoute,
      meta: { nav: "live", keepAlive: false },
    },
    {
      name: "player-recorded",
      path: "/player/recorded/:courseId/:sessionId",
      component: PlayerRoute,
      meta: { nav: "recorded", keepAlive: false },
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

// document.title follows the active route's titleKey (player routes set their
// own title from the hydrated course). Re-applied on locale switches.
const translate = i18n.global.t as (key: string) => string;

const applyTitle = () => {
  const titleKey = router.currentRoute.value.meta.titleKey;
  document.title = titleKey ? `${translate(titleKey)} - AutoSlides` : "AutoSlides";
};

router.afterEach(applyTitle);
watch(i18n.global.locale, applyTitle);
