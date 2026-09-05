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
  env.ts             bindings (ASSETS, SSO_RESUME_KEY, RELAY, SHARE, AI_ORIGIN)
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
    relayProxy.ts    GET /playlist|/segment — service-bind sibling relay/,
                     unless the relay policy sends browsers to the public relay
    config.ts        GET /api/config — relay policy + caller's ASN, for the SPA
    lib/relayPolicy.ts  binding-vs-direct relay policy (see below)
    shareProxy.ts    GET /api/share/get — service-bind sibling share/ (short links)
    aiProxy.ts       /api/ai/* — forward to AI_ORIGIN (strip /api/ai)
frontend/            Vue 3 + TypeScript + Vite app — builds to ../dist/
  index.html
  src/
    App.vue, components/          shell (LeftPanel, MainContent) + pages
    composables/                  data layer + video player composables
    composables/video/            useVideoPlayer/useDualStreamPlayer/
                                   useVideoErrorRecovery — ported from the
                                   Electron app, plus a native-HLS fallback
    lib/api.ts                    fetch client for /api/yanhekt/*
    lib/streamUrls.ts             recorded → same-origin /playlist (Worker
                                   service-binds sibling relay/); live → raw
                                   target/target_vga (CORS-open)
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
npm run dev:web                            # vite on :5173, proxies /api /playlist /segment to :8787
npm run typecheck                          # tsc --noEmit (Worker, src/)
npm run typecheck:web                      # vue-tsc --noEmit (frontend/)
```

Run `npm run dev` and `npm run dev:web` side by side for a normal dev loop:
the Vite server hot-reloads the UI on :5173 and proxies `/api/*`, `/playlist`,
and `/segment` to the Worker on :8787.

Note: local `wrangler dev` rejects a future `compatibility_date` — keep it at
or before today's date in `wrangler.jsonc`.

Recorded video playback is same-origin (`/playlist`, `/segment`) on this
Worker, which service-binds the sibling `relay/` Worker — see
`../relay/README.md` and **Off-campus relaying** below. Short share links resolve same-origin at
`GET /api/share/get?id=`, which service-binds sibling `share/` (`autoslides-share`)
so the browser never talks to `share.ruc.edu.kg`. Builtin AI is `/api/ai/*`,
forwarded by this Worker to `AI_ORIGIN` (a `vars` URL) with `User-Agent:
AutoSlides/web`. Uncomment `services` / `AI_ORIGIN` in `wrangler.jsonc` after
copying the example; unset, those routes 503. Settings → Relay Server can
point HLS at a local `wrangler dev` of `relay/` instead.

## Off-campus relaying (`RELAY_PUBLIC_ORIGIN`, `ALLOW_OFFCAMPUS_RELAY`)

Reaching the relay over the `RELAY` service binding is a Worker-to-Worker hop, so
the relay's own edge protection — in our deployment, a campus-network allowlist —
never sees the viewer. Two `vars` decide whether that is on offer
(`src/lib/relayPolicy.ts`):

| Mode | Set | `/playlist`, `/segment` here | SPA streams from |
|------|-----|------------------------------|------------------|
| `direct` (default) | `RELAY_PUBLIC_ORIGIN` | **403** | that origin, so each viewer meets the relay's edge themselves |
| `binding` | `ALLOW_OFFCAMPUS_RELAY: "true"` | proxy over the binding | this origin |
| `binding` | neither | proxy over the binding | this origin |

The 403 matters: without it, a hand-written same-origin URL (or Settings → Relay
Server pointed back here) would walk around the gate.

`GET /api/config` publishes the resolved policy to the SPA, plus the caller's own
ASN — free from `request.cf` — so when recorded playback fails the player can say
that this network is probably not one the relay admits, offer a link to the relay's
connection page, and offer Feedback. It confirms that guess by fetching the relay's
`/cf.txt` beacon without credentials (a static asset with CORS: no Worker request,
and a challenge page has no CORS headers, so the fetch simply rejects).

Keep both vars identical in `debug/wrangler.debug.jsonc` — the same rule as
`SSO_RESUME_KEY`, since both configs deploy the same Worker.

## SMS second factor (`SSO_RESUME_KEY`)

Campus SSO often demands a texted code after a correct password. A Worker can't
hold a half-finished CAS flow open while the user reads a text, so login is two
requests: `POST /api/login` answers `202 sms_required` with a **sealed** copy of
the mid-login state, and the SPA posts it back to `POST /api/login/sms` with the
code.

`SSO_RESUME_KEY` is what seals it. It is **not** a campus or Cloudflare
credential and is not issued by anyone — it is a random string this Worker
encrypts to itself with, so the browser can carry a half-finished login without
being able to read or forge it. Generate your own:

```sh
openssl rand -base64 32
```

It lives in the `vars` block of `wrangler.jsonc` **and** `debug/wrangler.debug.jsonc`
— both gitignored, so it stays out of this public repo, and `wrangler deploy`
carries it with no separate step to remember. `wrangler dev` reads the same
block, so local development needs nothing extra.

**Keep the value identical in both configs.** They deploy the same Worker, so a
mismatch invalidates every remembered device as soon as you deploy the other one.

Leaving it out is supported: password login still works, but an account that
needs an SMS code answers `"reason": "sms_unavailable"` and the UI points at the
token flow. That is distinct from `unsupported_page`, which means CAS served a
page we could not parse. Changing the key is safe — in-flight logins and
remembered devices stop opening, so users simply sign in again.

The resume token is a short-lived session secret: whoever holds it *and* the
texted code can finish that sign-in. The SPA keeps it in memory only, never in
`localStorage`. The separate long-lived `deviceKeepsake` **is** persisted — it
only makes SSO skip a second factor, and that is the point.

## Deploy

```sh
npm run deploy   # npm run build && wrangler deploy
```
