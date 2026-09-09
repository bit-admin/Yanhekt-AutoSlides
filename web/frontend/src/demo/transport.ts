/**
 * The demo's whole data layer: one `fetch` wrapper.
 *
 * Every network call the frontend makes is a `fetch` to a relative URL — the
 * Yanhekt proxy (`/api/yanhekt/*`), login, `/api/config`, notes, MinIO uploads,
 * the AI endpoint, share links. Wrapping `fetch` once therefore replaces what
 * the desktop app needs fourteen override slots and ~20 call sites to do, and
 * it means the demo exercises the app's real code paths: `authStore` signs
 * itself in by verifying a token, `useCourseList` paginates, the notes editor
 * saves. Nothing knows it is talking to a stub.
 *
 * Anything not recognised falls through to the real `fetch` so the demo's own
 * assets (JS, CSS, fonts, favicon) still load.
 */

import * as demo from "./demoData";

type Fetch = typeof window.fetch;

/** Yanhekt's envelope. `unwrapEnvelope` in lib/api.ts reads exactly this. */
function envelope(data: unknown): Response {
  return json({ code: 0, message: "", data });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Slow a route down a touch so loading states are reachable, never janky. */
function delay<T>(value: T, ms = 90): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function num(params: URLSearchParams, key: string, fallback: number): number {
  const raw = Number(params.get(key));
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/**
 * A canned AI verdict. Phase 3 asks the model to classify a batch of frames;
 * the demo answers "every frame is a slide" so a post-processing run started
 * from the UI completes instead of erroring.
 */
function aiCompletion(): Response {
  return json({
    id: "demo",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "autoslides-demo",
    choices: [{ index: 0, message: { role: "assistant", content: "slide" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  });
}

/** Routes under `/api/yanhekt/*`. Returns null when the path is unhandled. */
function yanhekt(path: string, params: URLSearchParams, method: string): Response | null {
  if (path === "/v1/user") return envelope(demo.demoUser());
  if (path === "/v1/cas/logout") return envelope(null);
  if (path === "/v1/tag/list") return envelope(demo.demoTagList());

  if (path === "/v2/live/list") {
    const personal = params.get("user_relationship_type") === "1";
    return envelope(demo.demoLiveList(params.get("keyword") ?? "", personal));
  }

  if (path === "/v2/course/list") {
    return envelope(
      demo.demoCourseList(
        num(params, "page", 1),
        num(params, "page_size", 16),
        params.get("keyword") ?? "",
        params.getAll("semesters[]").map(Number).filter(Number.isFinite),
      ),
    );
  }

  if (path === "/v2/course/private/list") {
    return envelope(demo.demoPersonalCourseList(num(params, "page", 1), num(params, "page_size", 16)));
  }

  if (path === "/v1/course/subscription/list") return envelope(demo.demoSubscriptionList());
  // Subscribing is local-only in the demo: the store keeps its own list.
  if (path === "/v1/course/subscription") return envelope(null);

  if (path === "/v1/course") return envelope(demo.demoCourseDetail(params.get("id") ?? ""));
  if (path === "/v2/course/session/list") {
    return envelope(demo.demoSessionRows(params.get("course_id") ?? ""));
  }
  // Classroom mic sidecar. Demo lectures have none — returning "" keeps
  // `hasMicAudio` false so the player never mounts an <audio> element.
  if (path === "/v1/video") {
    return envelope({ id: params.get("id") ?? "", audio: "" });
  }

  if (path === "/v1/note/group/list") return envelope(demo.demoNoteGroups());
  if (path === "/v1/note/list") return envelope(demo.demoNoteList(params.get("keyword") ?? ""));
  if (path === "/v1/note") {
    if (method === "GET") {
      const detail = demo.demoNoteDetail(Number(params.get("id")));
      return detail ? envelope(detail) : json({ code: 12111010, message: "note not found" });
    }
    // Create / rename / delete: accepted, and forgotten on reload.
    return envelope({ id: Math.floor(Date.now() / 1000), success: true });
  }
  if (path === "/v1/note/content") return envelope(null);
  if (path === "/v1/note/group") return envelope(null);
  if (path === "/v1/minio/upload") {
    // Note images "upload" to a data URI, so the editor shows them right back.
    return envelope({ url: demo.slideSvg("已上传的图片", ["演示模式不会真的上传"], "") });
  }

  return null;
}

/** Everything outside the Yanhekt proxy. Returns null when unhandled. */
function siteRoutes(path: string): Response | null {
  if (path === "/api/config") {
    return json({ relay: { mode: "binding" }, network: { asn: 4538, onAllowlist: true } });
  }

  if (path === "/api/login") {
    // Always answer with the second factor: it is the interesting half of the
    // flow, and the demo's whole point is showing what sign-in looks like.
    return json(
      {
        success: false,
        smsRequired: {
          phoneHint: "138****0137",
          resumeToken: "demo-resume-token",
          resumeNonce: "demo-nonce",
          expiresIn: 300,
        },
      },
      202,
    );
  }

  if (path === "/api/login/sms") {
    return json({ success: true, token: demo.DEMO_TOKEN, deviceKeepsake: "demo-keepsake" });
  }

  if (path.startsWith("/api/ai/")) return aiCompletion();
  if (path === "/api/share/get") return json({ error: "not found" }, 404);

  return null;
}

/** Hosts the app talks to directly (no Worker in front). */
function externalRoutes(url: URL): Response | null {
  if (url.hostname === "api.github.com") {
    // The Apps page asks for the desktop app's latest release; asset names are
    // what classifyAsset() reads to sort them into macOS/Windows/Linux.
    return json({
      tag_name: "v5.0.0",
      name: "AutoSlides 5.0.0",
      published_at: "2026-09-01T09:00:00Z",
      html_url: "https://github.com/bit-admin/Yanhekt-AutoSlides/releases",
      body_html: "",
      assets: [
        { name: "AutoSlides-5.0.0-macOS-arm64.dmg", size: 138_000_000, browser_download_url: "https://demo.invalid/AutoSlides.dmg" },
        { name: "AutoSlides-5.0.0-Windows-x64.exe", size: 121_000_000, browser_download_url: "https://demo.invalid/AutoSlides.exe" },
        { name: "AutoSlides-5.0.0-Linux-x86_64.AppImage", size: 147_000_000, browser_download_url: "https://demo.invalid/AutoSlides.AppImage" },
      ],
    });
  }
  if (url.hostname.endsWith("yanhekt.cn")) return json({ error: "demo" }, 404);
  return null;
}

/**
 * Install the stub. Returns nothing: there is no uninstall, because the demo
 * build never wants the real network.
 */
export function installTransport(): void {
  const real: Fetch = window.fetch.bind(window);

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const href =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href, window.location.origin);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

    if (url.origin === window.location.origin) {
      if (url.pathname.startsWith("/api/yanhekt/")) {
        const answer = yanhekt(url.pathname.replace("/api/yanhekt", ""), url.searchParams, method);
        if (answer) return delay(answer);
      }
      const answer = siteRoutes(url.pathname);
      if (answer) return delay(answer);
      // Not an API path — a real asset of the demo build itself.
      return real(input, init);
    }

    const external = externalRoutes(url);
    if (external) return delay(external);

    // Anything else (a stray CDN image, a probe) simply fails, the way it would
    // for a visitor with no campus network. Callers all handle that already.
    return json({ error: "offline in demo" }, 503);
  }) as Fetch;
}
