# AutoSlides Share

The public web viewer for AutoSlides cloud-note slides, deployed as a Cloudflare
Worker with Static Assets. It renders a managed note's slides as a continuous,
Notion-style document and offers Download-all (zip) and Save-as-PDF.

A share link encodes, in its URL `#fragment`, the note title plus each slide
image's `YYYY/M` prefix and a short md5 prefix. The viewer resolves the short
hashes to full object keys by listing the public `coss.yanhekt.cn/images` bucket.
The share-link codec is the single source of truth in
`../autoslides/src/shared/shareLink.ts`, imported by both the app (encode) and
this site (decode).

## Routing & Worker usage

The viewer and the apex landing are **real static assets** served directly by
Cloudflare (no Worker invocation). The Worker runs only for the dynamic paths:

| Path | Served by | Worker? |
|---|---|---|
| `/` (landing) | static `dist/index.html` | no |
| `/v1/`, `/v1/assets/*` | static `dist/v1/**` | no |
| `/v1/#<payload>` (long link) | static SPA + client-side coss listing | no |
| `/v1/api/shorten`, `/v1/api/get` | Worker (KV) | yes |
| `/v1/s/<id>` (short link) | Worker serves the SPA shell → SPA calls `api/get` | yes |

The version lives in the path (`/v1`); a future `/v2` viewer can be added
alongside without breaking existing links, and the apex landing stays unchanged.

## Develop

```bash
npm install
npm run dev        # Vite dev server (viewer only)
npm run build      # → dist/v1 (app) + dist/index.html (landing)
npm run preview    # wrangler dev (Worker + assets + local KV)
```

## Deploy

1. Copy the config template and create the KV namespace:
   ```bash
   cp wrangler.example.jsonc wrangler.jsonc
   wrangler kv namespace create SHARE_KV
   ```
   Paste the returned id into `wrangler.jsonc` (`kv_namespaces[0].id`) and set
   your own `routes` custom domain.
2. Deploy:
   ```bash
   npm run deploy      # vite build && wrangler deploy
   ```

`wrangler.jsonc` is gitignored (it holds the live KV id + domain); commit changes
to `wrangler.example.jsonc` instead. Your Cloudflare credentials come from
`wrangler login` and never live in this repo.
