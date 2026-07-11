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
  env.ts             bindings (ASSETS)
  lib/
    yanhekt.ts       yanhekt.cn API helpers: header/signature construction
                     (upstreamHeaders/createHeaders) + token verification
  routes/
    yanhektProxy.ts  GET /api/yanhekt/* — allowlisted proxy to cbiz.yanhekt.cn
                     (the browser can't call it directly; no CORS upstream)
    login.ts         POST /api/login — Workers-fetch port of the Electron
                     app's CAS password-login scrape (authService.ts)
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

## Deploy

```sh
npm run deploy   # npm run build && wrangler deploy
```
