# AutoSlides Web — Cloudflare Worker

A Cloudflare Worker serving the AutoSlides Web frontend and API on
`learn.ruc.edu.kg`. This is a from-scratch rebuild — the previous site is
being fully replaced.

## Layout

```
src/                Worker (TypeScript, Hono)
  index.ts          entry point: builds the app and starts serving
  app.ts            createApp/finalizeApp — the route table; API routes will
                     be added here as the project is rebuilt
  env.ts            bindings (ASSETS)
  lib/
    yanhekt.ts      yanhekt.cn API helpers (token verification)
public/             static frontend (placeholder until rebuilt)
```

## Develop

```sh
npm install
cp wrangler.example.jsonc wrangler.jsonc   # then set your own custom domain
npm run cf-typegen                         # generate worker-configuration.d.ts
npm run dev                                # http://localhost:8787
npm run typecheck                          # tsc --noEmit
```

Note: local `wrangler dev` rejects a future `compatibility_date` — keep it at
or before today's date in `wrangler.jsonc`.

## Deploy

```sh
npm run deploy
```
