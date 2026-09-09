# AutoSlides Relay

A Cloudflare Worker that proxies **recorded** Yanhekt HLS through their signed-URL
anti-hotlink scheme, so any HLS player can stream it. Cloud port of AutoSlides'
local Node proxy (`autoslides/src/main/video/videoProxyService.ts`) — recorded
path only; live streams (IP failover, no signing) are out of scope.

Live deployment: [relay.ruc.edu.kg](https://relay.ruc.edu.kg).

AutoSlides Web (`learn.ruc.edu.kg`) streams recorded lectures from here. The
desktop app does **not** — it runs its own `localhost` proxy. No D1, KV, or other
bindings: Cache API only.

> [!NOTE]
> This origin is campus-network only (Cloudflare WAF on the zone, not Worker
> code). Open [relay.ruc.edu.kg](https://relay.ruc.edu.kg) to check whether your
> browser can reach it. Off-campus browsing, live playback, and slide review on
> the web app still work; recorded playback will not.

## How it works

1. **Gate the request** — `t=` must be 32 hex chars (`/^[0-9a-f]{32}$/i`); `u=`
   must be `http(s)` on `yanhekt.cn` or `*.yanhekt.cn`. Failures 403 **before**
   any cache lookup or upstream fetch, so junk cannot ride the shared VOD cache.
   `t=` is an access-format gate: it is not sent to the CDN and not used to mint
   the video token. It is rewritten into every playlist child URL so later
   `/segment` hits keep the same check. The one exception is watch progress
   (below), which needs it as the Bearer the Yanhekt API requires — and only
   when the caller opts in with `sid=`.
2. **Mint one anonymous video token** — `GET https://cbiz.yanhekt.cn/v1/auth/video/token?id=0`
   with Yanhekt client-signature headers and **no** `Authorization`. Cached in
   the Workers Cache API under a single key (`…/token/anon`) for the remaining
   lifetime minus 30s (floor 60s). Concurrent misses in one isolate coalesce.
3. **Sign each media URL** — path-hash insert plus `Xvideo_Token` /
   `Xclient_Timestamp` / `Xclient_Signature` / `Xclient_Version=v1` /
   `Platform=yhkt_user`. Same formulas as desktop `@common/crypto`
   (`src/yanhekt.ts`); Workers Web Crypto has no MD5, so `src/md5.ts` is bundled.
4. **Stream** — playlists are rewritten so variant / segment / `#EXT-X-KEY` URIs
   come back through this origin. Segments pass `Range` through. A CDN `403`
   invalidates the cached token, re-mints, re-signs, and retries — up to 3
   attempts.
5. **Shared VOD cache** — recorded bytes are immutable and identical for every
   viewer, so raw m3u8 bodies and full `200` segment bodies are cached 6h, keyed
   by `md5(upstream URL)` alone (deliberately shared across `t=` values).
   Segments are `tee()`-streamed: the client gets first bytes immediately while
   the cache fills in the background (`waitUntil` keeps filling if the player
   aborts). `Range` hits are sliced as `206` from a cached full body by the
   Cache API; a ranged cold miss streams through uncached (`put` rejects
   partials). Per-PoP, best-effort.

## Routes

| Route | Purpose |
|-------|---------|
| `GET /` | Static page: paste a token + `.m3u8`, generate a playable URL, test with hls.js. Connection details come from `/cdn-cgi/trace` (Cloudflare edge, not this Worker) and the optional `x-client-asn` header on `/cf.txt`. |
| `GET /cf.txt` | Static `ok` — ASN header beacon and cross-origin reachability probe. |
| `GET /playlist?u=<m3u8>&t=<token>` | Fetch + sign the playlist, rewrite child lines back through the proxy. |
| `GET /segment?u=<url>&t=<token>` | Fetch + sign a segment and stream it (`Range` supported). |

`&sid=<session id>` opts into **watch progress**. `/playlist` carries it into
every segment line it emits; a `/segment` request that also has `&p=<seconds>`
then reports that playhead to Yanhekt (`PUT /v1/course/session/user/progress`,
with `t=` as the Bearer) in the background while the segment streams.

The player supplies `p=`, because the relay cannot work it out: an HLS client
fetches up to a full buffer ahead of where the viewer actually is, so a
segment's own media offset would resume the lecture roughly a minute late. The
point of doing it here at all is that a `fetch` inside a Worker is a
*subrequest*, which is not billed as a request — a 5-second heartbeat sent from
the browser would cost ~1000 Worker requests per 90-minute lecture. Malformed
`sid`/`p`, or either one missing, simply means no report; nothing 400s.

`OPTIONS` → `204`. Other methods → `405`. Other paths → `404`.

`&nocache=1` on either media route skips the shared VOD cache (read and write).
`/playlist` copies the flag onto every URL it emits, so setting it once opts the
whole session out. Token cache is unaffected.

Worker responses are CORS-open (`Access-Control-Allow-Origin: *`). Static `/`
and `/cf.txt` are Workers Assets — they do not run Worker code and do not count
as Worker requests.

Errors (all CORS, `text/plain`):

| Status | When |
|--------|------|
| `400` | Missing `u` or `t` |
| `403` | Malformed `t=`, `u=` not `yanhekt.cn` / `*.yanhekt.cn`, or upstream playlist 403 |
| `502` | Upstream playlist non-403 failure, or a thrown proxy error |

## Access

**`t=` is not checked as a Yanhekt login.** Any well-formed 32-hex string passes
the gate and can use the shared anonymous video token plus the shared VOD cache.
(It *is* forwarded verbatim as the Bearer on a watch-progress report, but Yanhekt
rejecting it there is swallowed and changes nothing about playback.) A
well-formed but expired, revoked, or invented token still gets cache hits until
the entry expires or is evicted — cache hits never revalidate upstream. The
regex only stops malformed junk.

**This deployment's real gate is the zone WAF** (campus ASNs, currently AS4847
and AS23910 / CERNET2). That list lives in Cloudflare, not in `src/`. A clone
with no edge rule is an open Yanhekt-VOD proxy for anyone who can supply 32 hex
chars.

`/cdn-cgi/trace` does not include ASN. To surface it, add a **Response Header
Transform Rule** on `GET /cf.txt` that sets `x-client-asn` to
`to_string(ip.src.asnum)` (`cf-*` header names are reserved). Evaluated per
request at the edge; not a Worker route.

`public/_headers` puts `Access-Control-Allow-Origin: *` and
`Access-Control-Expose-Headers: x-client-asn` on `/cf.txt` only. AutoSlides Web
fetches that file credential-less (like hls.js) when recorded playback fails: a
readable `ok` means this origin is reachable; a rejected fetch means the request
never got past the edge (a challenge page has no CORS headers). That is how the
web client distinguishes “off-campus / challenged” from a generic HLS error
instead of retrying forever.

Web's own policy (`RELAY_PUBLIC_ORIGIN` / `ALLOW_OFFCAMPUS_RELAY`) decides
whether the browser talks to this origin (`direct`, production default) or to
the web Worker, which then service-binds here (`binding` — the relay edge never
sees the viewer). Details: [`web/README.md`](../web/README.md).

## Cache

| What | Key | TTL |
|------|-----|-----|
| Anonymous video token | `…/token/anon` | server expiry − 30s, min 60s |
| Raw m3u8 body | `…/m3u8/${md5(url)}` | 6h (`21600`) |
| Full segment body | `…/seg/${md5(url)}` | 6h |

Rewriting the playlist (injecting the caller's `t=` and origin) happens on
every `/playlist` response, including cache hits.

## Develop & deploy

```bash
cd relay
npm install
cp wrangler.example.jsonc wrangler.jsonc   # then set your own `routes` custom domain
npm run typecheck
npm test                 # t= gate, host allowlist, 403 re-mint, nocache, rewrite, progress
npm run dev              # local: http://localhost:8787
npm run deploy           # wrangler login first
```

The example config also sets:

- **Smart Placement** on `cvideo.yanhekt.cn` — run the isolate close to the
  video origin, since every cache miss proxies there.
- **`observability.enabled: false`** — query strings carry `t=`. Leave it off
  or scrub logs if that matters.

### Quick test

```bash
# Rewritten playlist
curl "http://localhost:8787/playlist?u=$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))' 'https://cvideo.yanhekt.cn/.../index.m3u8')&t=<32-hex>"

# A segment (take a line from the playlist output)
curl -I "http://localhost:8787/segment?u=...&t=..."
curl -I -H 'Range: bytes=0-1023' "http://localhost:8787/segment?u=...&t=..."  # -> 206
```

Or open `/`, paste a 32-hex token + `.m3u8` URL, and hit **Test play**.

## Caveats

- **Recorded videos only.** Live is a different CDN path.
- **Treat generated URLs as secrets anyway.** They embed `t=`, they work in any
  HLS player, and on a clone without WAF any well-formed `t=` is enough to
  stream (and to drain the shared cache). A URL carrying `sid=` additionally
  lets its holder overwrite that account's saved watch position.
- **Electron in-app playback is a different proxy** (`/recorded?originalUrl=&loginToken=`
  on localhost). The desktop *can* expose this same `/playlist`+`/segment` API
  on the LAN (`localRelayService`) for phones / a custom web `relayEndpoint`;
  that is opt-in and not used inside the desktop player.
