# yanhekt-proxy

A standalone Cloudflare Worker that proxies **recorded** yanhekt videos through their
signed-URL anti-hotlink scheme, so any HLS player can stream them. It's a cloud port of
AutoSlides' local Node proxy (`autoslides/src/main/video/videoProxyService.ts`).

## How it works

1. **Mint a video token** — `GET https://cbiz.yanhekt.cn/v1/auth/video/token?id=0` with the
   caller's `Authorization: Bearer <loginToken>`. The response carries `expired_at`/`now`
   (~600s lifetime); the token is cached in the **Workers Cache API** for its real remaining
   lifetime (minus a 30s safety margin), keyed by `MD5(loginToken)`. Concurrent cache-misses in
   one isolate are coalesced into a single fetch.
2. **Sign each media URL** — insert `MD5(MAGIC + "_100")` before the filename, then append
   `Xvideo_Token` / `Xclient_Timestamp` / `Xclient_Signature` (`MD5(MAGIC + "_v1_" + ts)`) /
   `Xclient_Version=v1` / `Platform=yhkt_user`. (`MAGIC = 1138b69dfef641d9d7ba49137d2d4875`.)
   Web Crypto has no MD5, so a small pure-JS MD5 is bundled (`src/md5.ts`).
3. **Stream media** — segments are fetched (with `Range` passthrough) and streamed straight
   back. On `403` the token is re-minted and the URL re-signed, up to 3 attempts.
4. **Shared VOD cache** — recorded content is immutable and byte-identical for every viewer,
   so raw m3u8 bodies and full `200` segment bodies are cached in the Workers Cache API for
   6h, keyed by upstream URL alone (deliberately shared across login tokens). Segments are
   `tee()`-streamed: the client gets first bytes immediately while the cache fills in the
   background. `Range` requests are served as `206` from a cached full body by the Cache API
   itself; a ranged cold miss streams through uncached (partial responses can't be `put`).
   The cache is per-PoP and free-plan eviction is aggressive — treat it as best-effort.
   Because cache hits never reach upstream, login tokens are format-checked up front
   (32 hex chars) and malformed ones get an early `403`.

## Routes

| Route | Purpose |
|-------|---------|
| `GET /` | Static page to generate a playable URL + test it with hls.js |
| `GET /playlist?u=<m3u8 url>&t=<loginToken>` | Fetch + sign the m3u8, rewrite segment/variant/key lines back through the proxy |
| `GET /segment?u=<media url>&t=<loginToken>` | Fetch + sign a segment and stream it (supports `Range`) |

Both routes accept `&nocache=1` to bypass the shared VOD cache (read and write); `/playlist`
propagates the flag into the segment URLs it emits, so setting it once on the playlist opts
the whole playback session out.

All responses are CORS-open (`Access-Control-Allow-Origin: *`).

## Develop & deploy

```bash
cd relay
npm install
cp wrangler.example.jsonc wrangler.jsonc   # then set your own `routes` custom domain
npm run dev        # local: http://localhost:8787
npm run deploy     # publish to your Cloudflare account (wrangler login first)
```

`wrangler.jsonc` is gitignored (it holds the live custom domain); commit changes
to `wrangler.example.jsonc` instead. Your Cloudflare credentials come from
`wrangler login` and never live in this repo.

### Quick test

```bash
# Rewritten playlist
curl "http://localhost:8787/playlist?u=$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))' 'https://cvideo.yanhekt.cn/.../index.m3u8')&t=<loginToken>"

# A segment (take a line from the playlist output)
curl -I "http://localhost:8787/segment?u=...&t=..."
curl -I -H 'Range: bytes=0-1023' "http://localhost:8787/segment?u=...&t=..."  # -> 206
```

Or just open `/` in a browser, paste the token + `.m3u8` URL, and hit **Test play**.

## Caveats

- **The login token is embedded in the generated URL** (so HLS players can fetch every
  segment). Anyone with the URL can stream as that user until the token expires. Treat
  generated URLs as secrets. Query strings may also appear in Worker logs — see
  `observability` in `wrangler.jsonc`.
- **Recorded videos only.** Live streams (which use IP failover, not signing) are out of scope.
- **The VOD cache is shared across tokens.** A cache hit never revalidates the login token
  upstream — a well-formed but expired/revoked token can still be served already-cached
  media until the entry expires or is evicted. The early format check only rejects
  malformed tokens.
