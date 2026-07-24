# AutoSlides Web — Cloudflare Worker

A Cloudflare Worker (Hono API) serving a Vue 3 frontend on `learn.ruc.edu.kg`.
This is a from-scratch rebuild of the browser client — a step-by-step port of
the AutoSlides Electron app's shell and playback (left-panel navigator, no
right panel; Home/Search/Live/Recorded browsing; single-view playback). See
the repo root `CLAUDE.md` ("Sibling Projects: `web/`") for the full picture,
including how this relates to the gitignored `debug/` production build.

## Layout

```
src/                Worker (TypeScript, Hono) — the tracked, public API
  index.ts          entry point: builds the app and starts serving
  app.ts            createApp/finalizeApp — the route table; real API routes
                     are mounted inside createApp() as the project grows
  env.ts             bindings (ASSETS, SSO_RESUME_KEY)
  lib/
    yanhekt.ts       yanhekt.cn API helpers: header/signature construction
                     (upstreamHeaders/createHeaders) + token verification
    campusSso.ts     the sso.bit.edu.cn CAS flow: password login and the SMS
                     second factor (port of the Electron app's campusSso/)
    resumeSeal.ts    AES-GCM sealing for the mid-login state a two-request
                     login has to hand through the browser
  routes/
    yanhektProxy.ts  GET /api/yanhekt/* — allowlisted proxy to cbiz.yanhekt.cn
                     (the browser can't call it directly; no CORS upstream)
    login.ts         POST /api/login (200 | 202 sms_required | 401) and
                     POST /api/login/sms — campus SSO password login, in one
                     request or two when an SMS code is required
frontend/            Vue 3 + TypeScript + Vite app — builds to ../dist/
  index.html
  src/
    App.vue, components/          shell (LeftPanel, MainContent) + pages
    composables/                  data layer + video player composables
    composables/video/            useVideoPlayer/useDualStreamPlayer/
                                   useVideoErrorRecovery — ported from the
                                   Electron app, plus a native-HLS fallback
    lib/api.ts                    fetch client for /api/yanhekt/*
    lib/streamUrls.ts             recorded → relay.ruc.edu.kg/playlist URLs;
                                   live → raw target/target_vga (CORS-open)
    lib/bookmarklet.ts            token-grabbing bookmarklet (paste-token
                                   sign-in fallback)
    stores/                       navigationStore, playbackStore, authStore
    styles/                       theme.css/components.css/modal.css copied
                                   verbatim from the Electron renderer
    i18n/                         vue-i18n, locales copied from the Electron app
dist/                Vite build output (gitignored) — served via the ASSETS
                     binding; must exist before `wrangler dev`/`deploy`
```

## Develop

```sh
npm install
cp wrangler.example.jsonc wrangler.jsonc   # then set your own custom domain
npm run cf-typegen                         # generate worker-configuration.d.ts
npm run build                              # vite build → dist/ (required at least once)
npm run dev                                # wrangler dev, serves dist/: http://localhost:8787
npm run dev:web                            # vite dev server on :5173, proxies /api to :8787
npm run typecheck                          # tsc --noEmit (Worker, src/)
npm run typecheck:web                      # vue-tsc --noEmit (frontend/)
```

Run `npm run dev` and `npm run dev:web` side by side for a normal dev loop:
the Vite server hot-reloads the UI on :5173 and proxies `/api/*` requests to
the Worker on :8787.

Note: local `wrangler dev` rejects a future `compatibility_date` — keep it at
or before today's date in `wrangler.jsonc`.

Recorded video playback depends on the sibling `relay/` Worker (live at
`relay.ruc.edu.kg`) to sign and proxy Yanhekt's HLS streams — see
`../relay/README.md`.

## SMS second factor (`SSO_RESUME_KEY`)

Campus SSO often demands a texted code after a correct password. A Worker can't
hold a half-finished CAS flow open while the user reads a text, so login is two
requests: `POST /api/login` answers `202 sms_required` with a **sealed** copy of
the mid-login state, and the SPA posts it back to `POST /api/login/sms` with the
code. Sealing needs a secret:

```sh
wrangler secret put SSO_RESUME_KEY            # any long random string
wrangler secret put SSO_RESUME_KEY -c debug/wrangler.debug.jsonc   # and for the real deploy
```

For local development pass it inline instead: `wrangler dev --var SSO_RESUME_KEY:dev-only`.

With the secret unset, password login still works but cannot complete an SMS
challenge — it reports "please sign in with token instead", exactly as it did
before this existed. Rotating the secret invalidates in-flight logins and every
remembered device, which is a safe (if mildly annoying) thing to do.

The resume token is a short-lived session secret: whoever holds it *and* the
texted code can finish that sign-in. The SPA keeps it in memory only, never in
`localStorage`. The separate long-lived `deviceKeepsake` **is** persisted — it
only makes SSO skip a second factor, and that is the point.

## Deploy

```sh
npm run deploy   # npm run build && wrangler deploy
```
