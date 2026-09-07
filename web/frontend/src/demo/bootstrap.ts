/**
 * Turn this page into the demo. Called by `src/demo/main.ts` before the real
 * app's entry module is imported.
 *
 * Order matters and is the whole reason the demo has its own entry: storage is
 * swapped first (stores read `localStorage` at import time), then the network,
 * then the registry slot the player consults, and only then does `main.ts`
 * evaluate and boot an app that believes it is signed in and online.
 *
 * The dependency arrow points inward — this folder imports the app, never the
 * other way round. Deleting `src/demo/` and the demo Vite config leaves the
 * real app untouched.
 */

import { demoHooks } from "../lib/demoRegistry";
import { DEMO_TOKEN } from "./demoData";
import { isolateStorage, resetDemoDatabase } from "./isolateStorage";
import { demoPlayback } from "./playback";
import { seedSlides } from "./seedSlides";
import { installTransport } from "./transport";

/**
 * `?guest` opens the demo signed out, so the sign-in screen (and the
 * signed-out shell) can be shown without a real account. Everything else is
 * identical — the stub still answers, there is just no token to verify.
 */
function isGuest(): boolean {
  return new URLSearchParams(window.location.search).has("guest");
}

/** A profile that opens on the interesting settings, not on first-run notices. */
function demoProfile(): Record<string, string> {
  return {
    ...(isGuest() ? {} : { "autoslides.token": DEMO_TOKEN }),
    "autoslides.config": JSON.stringify({
      themeMode: "system",
      languageMode: "system",
      savedSearchesLive: ["Functional Analysis", "Complex Analysis"],
      savedSearchesRecorded: ["Functional Analysis", "Real Analysis", "Abstract Algebra"],
      subscribedRecordedCourses: [],
      sidebarCollapsed: false,
      relayEndpoint: "",
      autoPostProcessingLive: true,
      cloudWatchSyncEnabled: true,
      cloudStorageInitializedUsers: ["2022140137"],
      aiFilteringEnabled: true,
      aiServiceType: "builtin",
    }),
    // Acknowledgements, so a tour never opens behind a modal.
    "autoslides.notice": "2",
    "autoslides.publicStorageNotice": "1",
    "autoslides.extractionFeaturesPrompt": "1",
  };
}

/**
 * The banner that keeps a public demo honest about what it is showing — and
 * the way out of it: the demo has no other route back to the real app, since
 * every link inside it stays within /demo/.
 */
function installBanner(): void {
  const zh = navigator.language.startsWith("zh");

  const pill = document.createElement("a");
  pill.id = "demo-banner";
  // Root of the origin: the demo is served under /demo/, so "/" is the app.
  pill.href = "/";
  pill.append(zh ? "演示模式 · 数据均为虚构" : "Demo mode · everything here is fictional");

  const exit = document.createElement("span");
  exit.textContent = zh ? "返回正式站" : "Back to the app";
  exit.style.cssText = "margin-left:10px;padding-left:10px;border-left:1px solid rgba(251,250,248,.28)";
  pill.appendChild(exit);

  pill.style.cssText = [
    "position:fixed",
    "left:50%",
    "bottom:16px",
    "transform:translateX(-50%)",
    "z-index:10001",
    "display:flex",
    "align-items:center",
    "padding:6px 14px",
    "border-radius:999px",
    "font:500 12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif",
    "color:#fbfaf8",
    "background:rgba(21,20,18,.86)",
    "box-shadow:0 2px 10px rgba(0,0,0,.18)",
    "text-decoration:none",
    "white-space:nowrap",
    "user-select:none",
  ].join(";");
  document.body.appendChild(pill);

  // The screenshot script hides the pill (the README says it once, in prose).
  (window as unknown as { __demoChrome?: (visible: boolean) => void }).__demoChrome = (visible) => {
    pill.style.display = visible ? "" : "none";
  };
}

export async function installDemo(): Promise<void> {
  isolateStorage(demoProfile());
  installTransport();
  demoHooks.playback = demoPlayback;

  (window as unknown as { __demoReset?: () => Promise<void> }).__demoReset = () =>
    resetDemoDatabase("autoslides-web-demo");

  // Seeding is awaited so the Slides workspace is populated on a deep link
  // straight to /demo/#/slides (the screenshot script relies on that).
  try {
    await seedSlides();
  } catch (error) {
    console.warn("demo: could not seed slides", error);
  }

  if (document.body) installBanner();
  else document.addEventListener("DOMContentLoaded", installBanner, { once: true });
}
