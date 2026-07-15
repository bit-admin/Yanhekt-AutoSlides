import { watch } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import { i18n } from "../i18n";
import type { NavTarget } from "../stores/navigationStore";
import HomePage from "../components/course/HomePage.vue";
import CoursePage from "../components/course/CoursePage.vue";
import SearchPage from "../components/course/SearchPage.vue";
import RecordedCourseRoute from "../components/course/RecordedCourseRoute.vue";
import SlidesPage from "../components/slides/SlidesPage.vue";
import SettingsPage from "../components/SettingsPage.vue";
import PlayerRoute from "../components/video/PlayerRoute.vue";
import LoginPage from "../components/LoginPage.vue";
import AppsPage from "../components/AppsPage.vue";
import LegalPage from "../components/legal/LegalPage.vue";

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
  history: createWebHistory(),
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
      name: "slides",
      path: "/slides",
      component: SlidesPage,
      meta: { nav: "slides", keepAlive: true, titleKey: "navigation.slidesReview" },
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
