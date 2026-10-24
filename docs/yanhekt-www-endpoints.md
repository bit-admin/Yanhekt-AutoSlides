# Yanhekt (`www.yanhekt.cn`): endpoints in the official front end

This is a catalog of every API call the official Yanhekt web app (`www.yanhekt.cn`) makes, read from its published JavaScript bundle (October 2026). It complements [architecture §9](architecture.md#9-yanhekt-api), which is the contract for the calls AutoSlides actually uses. Yanhe 2.0 (`aita.yanhekt.cn`) is a different service; see [`aita-yanhekt.md`](aita-yanhekt.md).

**How far to trust it.** Everything here comes from the minified front-end code. Unless a row is marked **DOC** (documented in architecture §9, and therefore observed live), nothing was called live. Request shapes come from the call sites. Response shapes come from how the UI uses them, so they are partial. Nothing was probed for auth requirements; "Auth" below describes what the web app does, not what the server enforces. Bundle file names change on every upstream deploy, and any of this can change with them.

---

## Contents

1. [Summary](#1-summary)
2. [Hosts](#2-hosts)
3. [The request wrapper](#3-the-request-wrapper)
4. [Endpoint catalog](#4-endpoint-catalog)
5. [AI assistant API](#5-ai-assistant-api)
6. [Telemetry](#6-telemetry)
7. [What looks useful for AutoSlides](#7-what-looks-useful-for-autoslides)
8. [Hazards in the official client](#8-hazards-in-the-official-client)
9. [Method and limits](#9-method-and-limits)
10. [Quick index of undocumented paths](#10-quick-index-of-undocumented-paths)

---

## 1. Summary

The web app calls **75 distinct cbiz paths** (84 method + path pairs, because several paths take more than one verb) through one axios wrapper. It also calls **9 `/v3/assistant/*` paths** through the AI assistant SDK, which is a separate client, and sends OpenTelemetry traces to `websocket.yanhekt.cn`.

Of the 75 paths, **22 are already in architecture §9** (the core catalog, VOD, notes, subscription, progress, logout, current term). The other **53** are listed in [§10](#10-quick-index-of-undocumented-paths), together with the assistant paths and one navigation URL. Most of them are product features AutoSlides does not use: check-in, feedback, themes, knowledge graph, danmaku, DingTalk groups, teaching statistics. The few that matter for AutoSlides are in [§7](#7-what-looks-useful-for-autoslides).

## 2. Hosts

The bundle's config module defines these hosts.

| Key | Value | Used for |
|---|---|---|
| `API_HOST` | `https://cbiz.yanhekt.cn` | every `/v1`, `/v2`, `/v3/course/…` call |
| `API_DANMU_HOST` | `https://barrage.yanhekt.cn` | chosen by substring: any path containing `barrage` goes to this host instead of `API_HOST` ([§4.9](#49-danmaku-live-barrage)) |
| `VIEW_HOST` | `https://kgviews.yanhekt.cn` | knowledge-graph iframes (`/web/?tid=…&kg=…&cid=…&gid=…&type=1`, plus `&number=` for 乐学 resources) |
| `DATA_URL` | `https://websocket.yanhekt.cn` | OTLP telemetry ([§6](#6-telemetry)) |
| `SOCKET_SERVER` | `wss://websocket.yanhekt.cn/` | defined, but the app code never opens a WebSocket to it |
| `RES_HOST` | `https://coss.yanhekt.cn` | static images and `/htmls/*.html` help pages |
| `CAS_HOST` | `https://login.bit.edu.cn/cas` | BIT campus SSO. AutoSlides signs in through `sso.bit.edu.cn` ([architecture §9.8](architecture.md#98-campus-cas)) |
| `CAS_ZHUHAI_HOST` | `https://cas.bitzh.edu.cn/cas3` | Zhuhai campus SSO, chosen when `localStorage.bit_zh == 1` |
| `PROFESSOR_SERVER_URL` | `https://login.bit.edu.cn/authserver/login?service=https://cprobiz.yanhekt.cn/v1/cas/callback` | the 课程管理 menu item. **`cprobiz.yanhekt.cn` is a second API host** (the teacher console) that also serves `/v1/cas/callback` |
| `IBIT_URL` | `https://ibit.bit.edu.cn` | the 艾比特 chat widget, not cbiz |
| `SERVER_URL` | `https://www.yanhekt.cn` | the site itself |
| (assistant SDK) | `https://cbiz.yanhekt.cn`, passed as `api_base_url` by the web player. The SDK's own default is `https://yanhektdevbiz.info.bit.edu.cn`, an internal development host | [§5](#5-ai-assistant-api) |

Also present as plain strings, and not reachable from outside as far as is known: `http://10.1.11.189:9000/beltandroad/files/…` (MinIO storage for the 一带一路 page), `http://10.0.9.232:8012/onlinePreview` (a file previewer), `yanhektdevres.info.bit.edu.cn` and `yanhektdev.info.bit.edu.cn`. The bundle also embeds a Sentry DSN on `csentry.yanhekt.cn`.

## 3. The request wrapper

Every cbiz call goes through one object:

```
get/post/put/delete(path, payload, extraHeaders)
  url      = (path contains "barrage" ? API_DANMU_HOST : API_HOST) + path
  GET      -> params = payload, serialised with qs {arrayFormat:"brackets"}   (a=1&ids[]=1&ids[]=2)
  POST/PUT/DELETE -> JSON body = payload   (DELETE sends a body, not a query)
  headers  = { "Content-Type":"application/json", "Xdomain-Client":"web_user" }
             + extraHeaders
             + X-TRACE-ID        4 random base36 chars -> md5 -> upper case -> 8-4-4-4-12 UUID shape
             + xclient-timestamp unix seconds
             + xclient-signature
             + xclient-version   "v1"
  request interceptor adds:  Authorization: Bearer <token>   when signed in
```

What this adds to [architecture §9.2](architecture.md#92-headers-and-signatures):

- **The web app sends `X-TRACE-ID`** (UUID-shaped, derived from 4 random base36 characters). AutoSlides does not send it, and nothing suggests the server checks it.
- The signer exposes `k()` (the magic constant), `v()` = `"v1"`, `t()` = unix seconds, `s(n)` = `md5(k + "_" + v + "_" + n)`, `d(a, b)` = `md5(k_a_b)`, and `p(path)` / `auth(...)` helpers for CDN path encryption. The `Xclient-Signature` value in §9.2 is `s(undefined)`, which is why the suffix `undefined` is a literal. The magic constant is assembled from obfuscated string fragments; the one fragment read matches the §9.2 constant, and the golden md5 tests are the real check.
- **Response handling:** `code === 61101113` (not signed in) clears the local login and reloads the page. Any other body with HTTP 200 resolves; a non-200 status rejects.
- **Token storage:** `localStorage.auth = {login, token, expired_at}`, where `expired_at = 1000 * (server_expired_at + 518400)`. The web app adds **6 days of grace** to the server's expiry. `localStorage.local_user` holds the `/v1/user` payload, AES-CBC encrypted with a key and IV compiled into the bundle (obfuscation, not secrecy). `device_id` is a random id in `localStorage`. `yh_v_auth` caches the video token ([§4.2](#42-catalog-course-session-live-read)) and is refreshed within 180 s of expiry. The web app warns when `|now - server.now| > 30 s`, because clock skew breaks signed playback ([architecture §9.6](architecture.md#96-recorded-vod-and-the-cdn)).
- **Guest sign-in.** The route `/show` (`https://www.yanhekt.cn/show`) signs the browser in with a token hard-coded in the bundle, `0eb3e70ade1e5da068aaad0cb1adda12`, and a client-side expiry of `2712745500` (December 2055), then redirects to `/home`. It uses the same store-token function as a CAS sign-in, so the site then fetches `/v1/user` and caches the profile in `local_user`. Whether the token is still accepted by the server, and what that account can see, has not been checked.
- **Guest check.** A helper reads the cached profile and treats the account as a guest when its badge **contains** `9820200879` (a substring match, not equality). This is presumably the badge of the `/show` account. The only call site is a course's session list: clicking a session shows 游客用户，访问受限 and does not open `/session/<id>`. Nothing else in the client restricts a guest; what the server restricts is unknown.
- **Not the same as anonymous browsing.** When a CAS callback arrives without a token, the callback page shows 登录失败，将以游客身份浏览 and continues with no token at all; it does not fall back to the `/show` token.

## 4. Endpoint catalog

**DOC** = in architecture §9. **NEW** = not documented there. Param names are the literal names from the call site.

### 4.1 Auth, token, identity

| | Method + path | Params / body | Notes |
|---|---|---|---|
| DOC | `GET /v1/user` | – | profile |
| NEW | `PUT /v1/user` | profile fields from a form | profile edit |
| NEW | `PUT /v1/user/password ` | form fields | **the path ends in a space** in the bundle (`"/v1/user/password "`). Probably sent as `%20`; likely a bug in the web app, and the request may 404 |
| NEW | `POST /v1/sms/send` | `{phone, badge}` | SMS code for password reset. Client-side phone check `^1[345789]\d{9}$`, 60 s cooldown |
| NEW | `PUT /v1/user/reset/password` | `{badge, phone, code, password}` | forgot password |
| NEW | `GET /v1/auth/token` | `{code, type:1}` | **DingTalk** (i北理 app) sign-in: `code` is DingTalk's `requestAuthCode`; returns `{token, expired_at}`. Only runs inside DingTalk |
| NEW | `GET /v1/auth?type=0&auth=<b64>` | browser navigation, not XHR | **password sign-in for non-BIT schools** (延河联盟 accounts). `auth = base64(JSON.stringify({code: <school code>, badge, password}))`, **sent in the URL query**; the response redirects back to the web app with a token. BIT users go to `CAS_HOST/login?service=<cbiz>/v1/cas/callback` instead |
| DOC | `GET /v1/cas/callback?ticket=` | – | [§9.8](architecture.md#98-campus-cas). Schools other than BIT main campus use `service = encodeURIComponent(API_HOST + "/v1/cas/callback?code=<school code>")` on the Zhuhai CAS |
| DOC | `GET /v1/cas/logout` | – | |
| NEW | `GET /v1/university/list` | – | rows `{id, name, code}` for the school picker. BIT, RUC, CAU, BFSU, CCOM, CAFA, 中央戏剧学院, MUC and 延安大学 are the 延河联盟 schools that sign in with a 联盟 account |
| NEW | `GET /v1/auth/permission` | `{type, relevant_id, code}` | **access check for one object.** `type`: `0` course, `2` live, `4` theme lecture. Returns `{allowed, type}`; when not allowed, `type` gives the reason: `0` sign in, `1` no course permission, `2` the live needs an access code (the web app then asks for `code`) |
| NEW | `GET /v1/auth/signature` | `{target}` | exported but no call site found. The name suggests a signed-URL helper. Unverified |
| NEW | `GET /v1/auth/ai/sdk/badge` | `{}` | returns `{access_badge}` for the 艾比特 widget |
| DOC | `GET /v1/auth/video/token?id=<badge>` | – | the web app passes the **user's badge** as `id`; AutoSlides passes `0`, which the server accepts ([§9.6](architecture.md#96-recorded-vod-and-the-cdn)) |

### 4.2 Catalog, course, session, live (read)

| | Method + path | Params | Notes |
|---|---|---|---|
| DOC | `GET /v2/course/list` | `page, page_size, keyword, semesters[], colleges[], attributes[], degrees[]` | sends **bracketed arrays** (`semesters[]=92`). Default semester literal is `"92"`. The web app also **removes the current semester id from `colleges`/`attributes`/`degrees`** before sending, which matters if a filter seems ignored |
| DOC | `GET /v2/course/private/list` | `page, page_size, user_relationship_type, with_introduction` | |
| NEW | `GET /v2/course/graph/list` | same filters as the course list | courses that have a knowledge graph. Its `/v1` twin is compared in [§9.5.1](architecture.md#9x-v1-twins-of-the-v2-endpoints) |
| DOC | `GET /v1/course` | `id, with_professor_badges` | |
| NEW | `GET /v1/course/introduction` | `course_id` | course introduction (HTML) |
| NEW | `GET /v1/course/description` | `course_id` | course description |
| NEW | `GET /v1/course/professor/list` | `course_id` | teachers; **a lighter alternative to `with_professor_badges`** |
| NEW | `GET /v1/course/graph` | `gid` | knowledge graph. `data.datas` is a **JSON string** the web app parses. The course payload carries `graph.graph_gid` |
| NEW | `GET /v1/course/library/list/code` | `course_id, course_code` | 图书资源: `data = {permission, resource_list[]}` |
| DOC | `GET /v2/course/session/list` | `course_id, with_page, page, page_size, order_type, order_type_weight` | the web app pages sessions and sends `order_type`, `order_type_weight`, `with_page`; AutoSlides sends none of these |
| DOC | `GET /v1/course/session` | `session_id, with_video` | |
| DOC | `PUT /v1/course/session/user/progress` | `{session_id, seconds}` | |
| NEW | `GET /v1/course/hot/list` | `with_page, page, page_size, order` | home page "hot courses" |
| NEW | `GET /v1/course/latest/list` | `page:1, page_size:8, with_page:true, with_participant_count:true` | home page "latest courses". `with_participant_count` appears nowhere else |
| NEW | `GET /v1/recommendation/course/list` | `limit` | home page recommendations |
| NEW | `GET /v1/recommendation/live/list` | `limit` | |
| NEW | `GET /v1/live/hot/list` | `with_page, page, page_size, order` | |
| NEW | `GET /v1/banner/list` | `limit` (default 5) | home page banners |
| DOC | `GET /v1/tag/semester/default` | – | current term. The web app calls it at startup and falls back to **92** on any failure |
| DOC | `GET /v1/tag/list` | `with_sub:true` | the live page's filter drops rows whose `param == "semesters"` |
| DOC | `GET /v2/live/list` | `page, page_size, user_relationship_type, keyword` + filters | |
| DOC | `GET /v1/live` | `id, with_session, with_course` | |
| DOC | `GET /v1/video` | `id, course_id` | **the web app also sends `course_id`**; AutoSlides sends only `id`. The UI reads `main`, `vga`, `room`, `audio` (plus `*_origin`) |
| NEW | `GET /v1/video/subtitle/list` | `video_id` | **subtitles for a recording.** Response shape not captured |
| NEW | `GET /v1/video/knowledge/point` | `video_id` | 知识点 markers on the timeline |

### 4.3 Subscription and notices

| | Method + path | Params | Notes |
|---|---|---|---|
| DOC | `GET /v1/course/subscription/list` | `page, page_size` | the web app's default `page_size` is **10** (the server default is 4) |
| DOC | `POST/DELETE /v1/course/subscription` | `{course_id}` | |
| NEW | `GET /v1/notice/list` | `order_type, limit` or `{with_page, page_size, page, order_type, with_brief:false}` | site announcements; the header shows `data[0]` of `order_type:"desc"` |
| NEW | `GET /v1/ding_talk/list` | `page, page_size, with_search` | class group chats (`/iclassroom` page): `data.data[]`, `total`, `current_page` |

### 4.4 Notes (`/v1/note*`)

[Architecture §9.7](architecture.md#97-account-notes-minio-logout) covers `note`, `note/content`, `note/group` and `note/list`. New here:

| | Method + path | Params / body | Notes |
|---|---|---|---|
| NEW | `POST /v1/note/save` | `{id, type, relevant_id, root_id, title, content, uuid, client_time, version}` | **upsert keyed by a client-side identity** (`uuid` + `client_time`). Used for the in-player note: `type:0`, `relevant_id` = session id, `root_id` = course id, title `<课程名>笔记`. `version` defaults to 1 here and on `POST /v1/note`; the manual note editor posts `version:2` |
| DOC | `POST /v1/note` | `{type, relevant_id, root_id, title, content, version}` | `type:1` is "import as note" from a record: title `<title>笔记`, HTML content |
| DOC | `GET /v1/note` | `{id}` **or** `{type, relevant_id}` | **lookup by `(type:0, relevant_id)`** finds the note attached to a session without listing |
| DOC | `GET /v1/note/list` | `order_type, with_brief, root_id, type, keyword, groupId, page, page_size, with_page` | filters AutoSlides does not send: `root_id` (all notes of a course), `type`, `groupId` (camelCase, unlike `note_group_id` elsewhere). §9.7 found the server ignores `groupId` |
| NEW | `PUT /v1/note/group` | `{id, name}` | rename a group |
| DOC | `PUT /v1/note` | `{id, title, note_group_id?}` | the web app drops `note_group_id` when it is `0` |
| NEW | `GET /v1/note/label/list` | – | note labels (tags) |
| NEW | `POST /v1/note/label` | `{name}` | create a label |
| NEW | `PUT /v1/note/label` | `{id, name}` | rename |
| NEW | `DELETE /v1/note/label` | `{id}` | |
| NEW | `POST /v1/note/label/save` | note id + label ids (the editor's tag selection) | attach labels to a note |
| DOC | `POST /v1/minio/upload` | multipart `file` + `bucket` | `bucket: "notes"` for editor images; response `{host, path}`, image URL `host + path` |

A group named `default_group` is shown as 未分组.

### 4.5 Live check-in (签到)

A full attendance subsystem. None of it matters for downloading; the contracts are here in case the live page ever needs them.

| Method + path | Params | Notes |
|---|---|---|
| `POST /v1/live/sign` | `{live_id}` | student check-in (some lives require a typed 6-digit code; see `/v1/auth/permission` `type:2`) |
| `GET /v1/live/sign/check` | `{live_id}` | `data.allowed`: whether this user can still check in |
| `GET /v1/live/attendance` | `{live_id}` | `data.attendance`; polled while watching |
| `GET /v1/live/sign/list` | `{live_id, page, page_size}` | supervisor view: `data.data[]` |
| `GET /v1/live/sign/signed/num` | `{live_id}` | `data.uv` |
| `GET /v1/course/initiate/sign/list` | – | teacher-side widget: `data = {list[], show}`, polled **every minute** |
| `GET /v1/live/sign/qr/code` | `{session_id}` | teacher starts a check-in: `data = {qr_code, date_desc, ended_at}`. The UI says it lasts 10 minutes, one per 大节 |
| `POST /v1/live/sign/qr/code/close` | `{session_id}` | stop it |
| `GET /v1/live/sign/offline/check` | `{session_id}` | scan-to-check-in page (`/checkin`): `data.allowed` |
| `POST /v1/live/sign/offline` | `{session_id, timestamp, sign}` | **`timestamp` and `sign` come from the QR code's URL query**, produced on the teacher side. The signing algorithm is not in this bundle |

### 4.6 Themes (专题) and seminars

| Method + path | Params |
|---|---|
| `GET /v1/theme/list` | – |
| `GET /v1/theme` | `{id}` |
| `GET /v1/theme/group/list` | `{theme_id}` |
| `GET /v1/theme/lecture/list` | `{theme_id, group_id, page, page_size:20, with_video:true}` or `{…, with_page:false}` |
| `GET /v1/theme/lecture` | `{id, with_video}` |
| `GET /v1/theme/lecture/hot/list` | `{page, page_size, with_page}` |

A theme lecture is a video outside any course or session, with its own id space; its player route is `/themeLectureDetail/:lecture_id`. `with_video` on `theme/lecture` appears to attach the videos, unlike `/v1/course/session` (unverified).

### 4.7 Teaching statistics (IPE / IPA)

`GET /v1/course/ipe/statistic` and `…/list`, and `GET /v1/course/session/ipa/list`, take `{school_year: "2024-2025", semester: 1|2}` (`…/list` takes a free-form object). They return teaching-hours tables: `data[]` of `{nickname, total_duration, courses[{name_zh, duration}]}`. Teacher and admin pages only.

### 4.8 Feedback

`POST /v1/feedback` (`{category, content (HTML), …}`; `category 1` is a video problem and adds the video link and browser to the HTML), `GET /v1/feedback/list`, `PUT /v1/feedback/reply/status {id, reply_status:1}`. `reply_status 2` means replied; the badge counts those into `localStorage.feedbackCount`.

### 4.9 Danmaku (live barrage)

| Method + path | Params | Notes |
|---|---|---|
| `POST /v1/barrage/add` | `{content, badge}` | **sent to `barrage.yanhekt.cn`** (the path contains `barrage`) |
| `GET /v1/barrage/show/list` | `{timestamp: now - 1 s, idx: localStorage.yh_li_idx \|\| 0}` | cursor-based polling: `data = {list[{content}], idx}`; the web app stores `idx` back. **Only runs with `?admin=1`** in the page URL (an operator / big-screen mode). A 5-lane scroller renders it |

### 4.10 Calls outside the wrapper

| Path | How | Notes |
|---|---|---|
| `GET /v1/auth/video/token?id=` | wrapper, with the query inlined in the path string | documented |
| `GET /v1/auth?type=0&auth=` | `location.href` | [§4.1](#41-auth-token-identity) |
| `GET /v1/cas/callback` | redirect target | [§4.1](#41-auth-token-identity) |
| `/show` (page route) | stores the hard-coded guest token, no request of its own | [§3](#3-the-request-wrapper) |

## 5. AI assistant API

`/v3/assistant/*` and `/v3/course/resource/assistant` come from the assistant SDK, a React package bundled into the web app. The player passes `api_base_url: "https://cbiz.yanhekt.cn"` and the user's Bearer token. The SDK's built-in default `api_base_url` is the internal development host `https://yanhektdevbiz.info.bit.edu.cn`.

Every SDK request sends `Authorization: Bearer <token>` and `Xdomain-Client: <client>` (the SDK takes the client name from its caller; the web app passes `web_user`). The axios-based endpoints also send `X-assistant-id: <assistant.id>`. **No `Xclient-*` signature headers.**

| Method + path | Role |
|---|---|
| `GET /v3/course/resource/assistant?course_id=` | goes through the main wrapper: the assistant object for a course (`data.id`), or empty |
| `POST /v3/assistant/dialogue` | create a conversation `{assistant_id, title}` (title = first 10 characters of the question). Response `data.id` |
| `PUT /v3/assistant/dialogue` | rename |
| `DELETE /v3/assistant/dialogue` | delete |
| `GET /v3/assistant/dialogue/list` | the 聊天历史 sidebar |
| `PUT /v3/assistant/dialogue/top` / `…/top/cancel` | pin / unpin |
| `GET /v3/assistant/dialogue/history/list` | messages of one conversation |
| `POST /v3/assistant/comment` | thumbs up / down on an answer |
| `POST /v3/assistant/chat/stream/private/kb` | **streaming chat over the course knowledge base** |

**Chat stream protocol** (`fetch` + `ReadableStream`):

```
POST <api_base_url>/v3/assistant/chat/stream/private/kb
Content-Type: application/json
Xdomain-Client: web_user
Authorization: Bearer <token>
{ "query": "<question>", "dialogue_id": <id>, ...extra params from the caller }
```

The body is a stream of `data:`-prefixed JSON chunks (the client strips newlines and splits on `data:`). A chunk is `{answer, type, apps?, is_end?, dialogue_history_id?, result?, error?}`. `type 4` carries `apps` (cited sources). The final chunk has `is_end` (or `result.is_completion`) and the `dialogue_history_id` the UI keeps as the message id. This is plain `fetch`, **not SSE** (no `EventSource`), so any HTTP client that reads the body works.

This is the AI assistant of `www.yanhekt.cn`. It is unrelated to Yanhe 2.0 and to AutoSlides' own AI features, and AutoSlides does not use it. Whether it requires enrolment in the course is unknown.

## 6. Telemetry

The web app runs an OpenTelemetry web tracer (`yhkt-service` v`0.1.0`) with two OTLP/HTTP trace exporters, both sending `xdomain-client: web_user`:

- `POST https://websocket.yanhekt.cn/offline/v1/traces`
- `POST https://websocket.yanhekt.cn/realtime/v1/traces` (only spans whose instrumentation name contains `realtime`)

Span names: `course_visit`, `realtime_user_heartbeat`, `realtime_live_user_heartbeat`, `realtime_recording_user_heartbeat`. Every span carries `user_id`, `university_id`, `badge`, `device_id`, `session_id` (a browser session, not a lecture), `type`, `relevant_id`, `number` (the course number), plus per-event `course_id`, `live_id`, `session_id`. Heartbeats fire on a worker timer ("minute" / "hour" ticks).

**Why it matters:** these spans, not `PUT /v1/course/session/user/progress`, are the likely source of the platform's viewing-time statistics. AutoSlides sends only the progress PUT. Nothing suggests the server rejects a client that skips the spans.

## 7. What looks useful for AutoSlides

In order of how directly they help. None is verified live; probe before building on one.

1. **`GET /v1/video/subtitle/list?video_id=`** ([§4.2](#42-catalog-course-session-live-read)). Subtitles for a cbiz recording. Captions currently exist only for Yanhe 2.0, from its transcript. If this returns timed text, it would give captions and `.srt` export on the main site too. Highest value and cheapest to probe.
2. **`GET /v1/video/knowledge/point?video_id=`**. Chapter-like markers that could seed the slides strip or timeline.
3. **`GET /v1/course/professor/list?course_id=`** and **`/v1/course/introduction`**, **`/v1/course/description`**. Cheaper than `with_professor_badges` when only teachers are needed; introduction and description for a richer course page.
4. **`GET /v1/note?type=0&relevant_id=<session id>`** finds the note attached to a session without paging `/v1/note/list`. **`POST /v1/note/save`** takes `uuid` + `client_time`, so it is the idempotent upsert the web app itself uses, and a better fit for managed notes than create-then-update.
5. **`GET /v1/auth/permission?type=0&relevant_id=<course id>`**. One call answers "may this account open this course", with a reason code (`0` sign in, `1` no permission, `2` needs a code). That would replace guessing from an empty list.
6. **`GET /v1/video` with `course_id`.** The web app sends it. If the server uses it for access control, passing it may matter for restricted courses.
7. **Telemetry spans** ([§6](#6-telemetry)), if platform-side watch statistics ever have to match the official client.

Safe to ignore: check-in ([§4.5](#45-live-check-in-签到)), teaching statistics ([§4.7](#47-teaching-statistics-ipe--ipa)), feedback ([§4.8](#48-feedback)), danmaku ([§4.9](#49-danmaku-live-barrage)), DingTalk groups, themes (unless 专题 lectures become a download source), and `/v1/auth?type=0&auth=` (it puts the password in the URL).

## 8. Hazards in the official client

- `PUT "/v1/user/password "` has a **trailing space** in the path.
- `/v1/auth?type=0&auth=<base64(JSON{code,badge,password})>` sends the password **in the query string** through a redirect. Base64 is not encryption.
- The assistant SDK ships an internal development host (`yanhektdevbiz.info.bit.edu.cn`) and the web app ships private-network addresses (`10.1.11.189`, `10.0.9.232`). Do not rely on them.
- `local_user` in `localStorage` is encrypted with a key that ships in the bundle.
- A guest token ships in the bundle with an expiry three decades out ([§3](#3-the-request-wrapper)). Anyone can sign in as that account by opening `/show`.
- The web app extends the local token expiry by **518 400 s (6 days)** past the server's value, so a stale token can look valid client-side until the server answers `61101113`.

## 9. Method and limits

- The bundle is the set of `main-*` and `vendors-*` chunks served from `https://www.yanhekt.cn/static/js/`. Paths were collected by scanning for `<axios>.get|post|put|delete("/path", …)` call sites, then reading each call site.
- Among the `vendors-*` chunks, only the one holding the assistant SDK and axios contains app code; the rest is third-party (antd, Monaco, Editor.js, a Neo4j driver, dingtalk-jsapi and so on).
- **Coverage:** only literal paths are found. A path built at run time (concatenated, or a URL sent by the server) would be missed. The web app appears to build none, but other front ends can call more: the teacher console on `cprobiz`, the mobile H5 site, and the `/supervisor/:live_id` page's own chunks were not scanned. The help pages under `coss.yanhekt.cn/htmls/` are static HTML.
- The in-bundle signer is obfuscated (string-array rotation). Its structure (`md5(k + "_" + "v1" + "_" + arg)`) was read but not executed. The `X-TRACE-ID` hash is assumed to be md5 from its 32-hex slicing; this was not checked.
- Bundle file names change on every upstream deploy. To refresh this catalog, download the current chunk list, scan again and diff against §10.

## 10. Quick index of undocumented paths

```
auth       /v1/auth/ai/sdk/badge  /v1/auth/permission  /v1/auth/signature  /v1/auth/token
           /v1/auth?type=0 (nav)  /v1/university/list  /v1/sms/send
           /v1/user/password  /v1/user/reset/password  (PUT /v1/user)
catalog    /v1/banner/list  /v1/course/hot/list  /v1/course/latest/list
           /v1/live/hot/list  /v1/recommendation/course/list  /v1/recommendation/live/list
           /v2/course/graph/list
course     /v1/course/introduction  /v1/course/description  /v1/course/professor/list
           /v1/course/graph  /v1/course/library/list/code  /v3/course/resource/assistant
video      /v1/video/subtitle/list  /v1/video/knowledge/point
check-in   /v1/live/sign  /v1/live/sign/check  /v1/live/sign/list  /v1/live/sign/signed/num
           /v1/live/attendance  /v1/live/sign/offline  /v1/live/sign/offline/check
           /v1/live/sign/qr/code  /v1/live/sign/qr/code/close  /v1/course/initiate/sign/list
stats      /v1/course/ipe/statistic  /v1/course/ipe/statistic/list  /v1/course/session/ipa/list
themes     /v1/theme  /v1/theme/list  /v1/theme/group/list
           /v1/theme/lecture  /v1/theme/lecture/list  /v1/theme/lecture/hot/list
notes      /v1/note/save  /v1/note/label  /v1/note/label/list  /v1/note/label/save
misc       /v1/notice/list  /v1/ding_talk/list  /v1/feedback  /v1/feedback/list
           /v1/feedback/reply/status  /v1/barrage/add  /v1/barrage/show/list
assistant  /v3/assistant/dialogue  /v3/assistant/dialogue/list  /v3/assistant/dialogue/top
           /v3/assistant/dialogue/top/cancel  /v3/assistant/dialogue/history/list
           /v3/assistant/comment  /v3/assistant/chat/stream/private/kb
```
