# Yanhe 2.0 (`aita.yanhekt.cn`)

This is the field guide to **Yanhe 2.0**, the second Yanhekt web app at `aita.yanhekt.cn` (code name `yanhe2` in this repo). The site is still under active development. Everything here comes from observing it with an ordinary student account. None of it comes from vendor documentation, and any of it can change.

In short: `aita.yanhekt.cn` runs alongside `www.yanhekt.cn` / `cbiz.yanhekt.cn`. It has its own API, its own ids and its own sign-in. Underneath, both sites use the same recording archive and the same live CDN. For the cbiz side, see [architecture §9](architecture.md#9-yanhekt-api).

**About the examples.** Course titles, teacher names, ids, course codes, rooms, hashes and recording paths in this document are made up. They keep the shape of the real values (lengths, formats, string vs number), not their content. Field names, envelopes, status codes, hosts and the signing scheme are as observed. The main sample is a fictional Functional Analysis (泛函分析) course taught by 林知远, aita course `200101` / session `3000101`, cbiz course `80101`.

---

## Contents

1. [The service](#1-the-service)
2. [Authentication](#2-authentication)
3. [Conventions](#3-conventions)
4. [Mapping to cbiz](#4-mapping-to-cbiz)
5. [Endpoints](#5-endpoints)
6. [Playback](#6-playback)
7. [Server-side slides](#7-server-side-slides)
8. [Transcripts](#8-transcripts)
9. [Endpoints a student token cannot use](#9-endpoints-a-student-token-cannot-use)

---

## 1. The service

### 1.1 Product

aita is a second front end for Yanhekt, built by the contractor 成都华栖云 (chinamcloud, `cmc`). The product name is 「智播」课程云 (`product_code` `yjedu`). On session rows the recording vendor is 栖学 (`firm_code` `hqy`). The tenant is **21** (tenant name 「云教开发环境租户」), `group_code` `2796000000`, group name 北京理工大学. `www.yanhekt.cn` links to it from a banner that redirects through `yanhe.bit.edu.cn`. It is open to every BIT student, not to a pilot list.

A signed-in student can open courses they are not enrolled in, including playback, the slide list and the transcript. That is the same reach as cbiz public courses. Only 「我的课表」 and 「我的课程」 (`force_mycourse=1`) are limited to the account's enrolled courses.

A cbiz session does not always have an aita counterpart.

### 1.2 Host

One host serves the SPA, the JSON API, `/play/` and `/ai-nginx/`.

| | |
|-|-|
| Name | `aita.yanhekt.cn` |
| Public address | `211.68.10.5` |
| Campus address | `10.0.11.240` (as answered by campus DNS `10.0.32.33` / `10.0.32.32`) |

Both addresses are the same service: TLS validates against the host name, a given file has the same ETag on both, and the same requests get the same 403s. The desktop intranet route uses the campus address.

Live streams are not on this host. They are on `clive*.yanhekt.cn`.

### 1.3 Pages

Routing is hash-based. `/course`, `/livingroom` and `/workbenchAi` are one SPA (`index.html`). `/portal/` and `/yjlogin/` are separate builds.

| Page | URL |
|-|-|
| Landing | `/portal/#/` |
| Learning space | `/workbenchAi?tenant_code=21`. The personal calendar links to `/course` from here |
| Calendar | `/course?tenant_code=21&tab=todayCourse`. Pick a date first, then filter by keyword |
| Top-bar search | `/globalSearch` hands `title` / `realname` / `trans` to `/searchContent`, which calls `pptnote/v1/searchlist`. No date |
| My courses | `/education/?tenant_code=21#/home?menu_code=C-xswdkc,-1`. Three tabs: recently studied; all courses (enrolled plus any course whose player page was ever opened); my courses (enrolled only) |
| Course | `/coursedetail?course_id=…&tenant_code=21` |
| Player | `/livingroom?course_id=…&sub_id=…&tenant_code=21` |
| Mobile | `/livemobileyanhe/#/pages/liveCourse/index?tenant_code=21`, a uni-app on the same back end |

There are also 「我的收藏」 (course bookmarks, not cbiz subscriptions) and 「我的笔记」 (a wangEditor page). The site has no terms-of-use page.

The `phone` in a student's profile can be a number the student never gave. `/play/` signing still uses it (§6.3).

### 1.4 Stack

The back end is Yii (`_csrf`, `_token`, `JWTUser`; path prefixes `courseapi/`, `pptnote/`, `userapi/`) behind nginx (`/play/`, `/ai-nginx/`). `config.js` names cmc hosts (`kong.cmc`, `pgc-app-api.pgc`, `livepgcabroad.cmc.zju.edu.cn`).

The front-end bundle also pulls in MathJax, wangEditor, socket.io, a digital-human iframe, a knowledge graph, and the 「ai-bit」 SDK from `ibit.bit.edu.cn`. It references about 866 distinct API paths under `courseapi`, `pptnote`, `userapi`, `spidermaterial` and `xapi`. A student token gets no data from most of them.

An older page, `zy-eclass.bit.edu.cn`, still carries the 延河课堂 name.

---

## 2. Authentication

### 2.1 JWT

HS256. Payload:

```jsonc
{
  "account": "<student number>",
  "sub": 10001,                       // aita user id; equals infosimple params.id and JWTUser.id
  "tenant_id": 21,
  "cmcGroupCode": "2796000000",
  "cmcGroupId": "<hex>",
  "currentRole": "student",
  "mroles": [{ "code": "student", "id": 15, "isinspection": -1 }],
  "loginType": "default",
  "realname": "…",                    // the student's name in clear text
  "password": "<32 hex>",             // a 32-hex hash
  "exp": 1790663933                   // exactly sign-in time + 86400
}
```

A token lives 24 hours from sign-in. A new sign-in does not invalidate older tokens. The idle sign-out you see in a browser is not JWT expiry. It comes from the front end or the session layer (the 5-minute helper cookies, or `PHPSESSID`).

### 2.2 Sending it

| How | Result |
|-|-|
| `Authorization: Bearer <jwt>` | 200 |
| `Authorization: <jwt>` (no scheme) | 200 |
| Cookie `_token` set to the server-issued signed value | 200 |
| Cookie `_token` set to the bare PHP-serialized value (no HMAC prefix) | 403 |
| `?token=<jwt>` | 403 on `userapi`. Exception: `get-week-schedules` accepts `token` in the query, and the same call also works with only a Bearer |

A JWT with a bad signature, or a forged one, gets `403` with an empty body.

The `_token` cookie wraps the JWT in Yii's signed format: `hex(HMAC-SHA256(key, data)) + data`, where `data` is the PHP-serialized `a:2:{i:0;s:6:"_token";i:1;s:<len>:"<jwt>";}`. The key is a constant hard-coded in the `yjlogin` bundle. So the wrapper can be rebuilt, but the JWT inside cannot. To get the JWT out of `Set-Cookie`, URL-decode the value, then use the SPA's regex `/{i:\d+;s:\d+:"_token";i:\d+;s:\d+:"(.+?)";}/` or match `eyJ[\w-]+\.[\w-]+\.[\w-]+`.

The JSON API does not check `Origin`, `Referer` or User-Agent. Every JSON call in this document has been replayed from a plain HTTP client. `/play/` follows different rules (§6.3).

### 2.3 Cookies after sign-in

All are set on `.yanhekt.cn`, so the browser also sends them to `www.yanhekt.cn` and `cbiz.yanhekt.cn`.

| Cookie | Max-Age | Contents |
|-|-|-|
| `_token` | 57 600 (16 h) | The signed JWT. The cookie dies before the JWT's 24 h |
| `JWTUser` | 604 800 (7 d) | URL-encoded JSON `{"account","id","tenant_id"}`. Not a credential |
| `login_cmc_id`, `login_cmc_tid`, `login_cmc_type=2`, `login_cmc_url`, `group_code`, `cmc_version=v3` | 57 600 | CMC session bits. The API does not need them |
| `PHPSESSID` | session | casapi's PHP session. Carries the validated ticket from hop 5 to hop 6 |
| `remote_addr`, `user_agent`, `tenant_code`, `temp_url` | 300 | Reset on every casapi redirect |

### 2.4 CAS, hop by hop

`F` is the landing URL, for example `https://aita.yanhekt.cn/course`. `S` is the CAS service URL:

```
S = https://aita.yanhekt.cn/casapi/index.php?auType=cas&forward=<enc(F)>&r=auth/login&tenant_code=21
```

| # | Request | Response |
|-|-|-|
| 1 | `GET /casapi/index.php?r=auth/login&auType=&tenant_code=21&forward=<enc F>` | `302 → /yjlogin/#/?tenant_code=21&forward=…`. Sets `PHPSESSID` and the 5-minute cookies. `yjlogin` is the school picker |
| 2 | `GET /casapi/index.php?forward=<enc F>&r=auth/login&auType=cas&tenant_code=21` | `302 → https://login.bit.edu.cn/authserver/login?service=<enc S>`. `S` orders its parameters differently from this request. CAS compares the service byte for byte, so take `S` from this `Location` instead of building it |
| 3 | `GET login.bit.edu.cn/authserver/login?service=<enc S>` | `302 → https://sso.bit.edu.cn/cas/login?service=<enc S>` |
| 4a | `GET sso.bit.edu.cn/cas/login?service=<enc S>` | Sign-in page. The template carries `#login-croypto`, `#login-page-flowkey`, `#current-login-type`, `#captcha-url` |
| 4b | `POST sso.bit.edu.cn/cas/login` with `username`, `type=UsernamePassword`, `_eventId=submit`, `execution`, `croypto`, the encrypted `password`, `captcha_payload`, `risk_payload`, `targetSystem=sso`, `siteId=sourceId`, `riskEngine=true` | `302 → S&ticket=ST-…`. Sets `SOURCEID_TGC` (Path `/cas/`, HttpOnly, session). There is an SMS second-factor branch |
| 5 | `GET S&ticket=ST-…` with `PHPSESSID` | `302 → S`. The ticket is validated server-side and the result stays in `PHPSESSID`. No token yet |
| 6 | `GET S` with `PHPSESSID` | `302 → F`. Sets `_token`, `JWTUser`, `login_cmc_*` |

`PHPSESSID` has to survive hops 1, 5 and 6. Skipping hop 1 (letting hop 5 plant `PHPSESSID` itself) has not been tested. `F` can be any aita URL. An API client can use `https://aita.yanhekt.cn/course` and does not need to follow the final `302 → F`. casapi's 302s declare `Content-Type: application/json` with an empty body.

CAS's 「7天免认证」 option requires a graphic captcha first. `SOURCEID_TGC` is a session cookie, and its server-side lifetime was not measured. Any CAS sign-out deletes it.

### 2.5 Minting another token from an existing SSO session

After hop 4b the jar holds `SOURCEID_TGC`. From then on, `GET sso.bit.edu.cn/cas/login?service=<another service>` with that cookie goes straight to `302 → <service>&ticket=…` without a password. That is how a browser signs in to `www.yanhekt.cn` and aita one after the other. Signing in to aita does not sign you in to `www.yanhekt.cn`. What happens is that once `sso.bit.edu.cn` has a session, either app's sign-in completes without a prompt.

### 2.6 Sign-out

| # | Request | Response |
|-|-|-|
| 1 | `GET /casapi/index.php?r=auth/cmc-loginout&auType=&tenant_code=21&user_id=<sub>&forward=<url>` | `302 → https://login.bit.edu.cn/authserver/logout?service=<aita casapi sign-in URL>`. Deletes `_token`, `JWTUser`, `tenant_code`, `login_cmc_*`, `group_code`, `cmc_version`, `live_token` with `Max-Age=0` |
| 2 | `GET login.bit.edu.cn/authserver/logout?service=…` | `302 → https://sso.bit.edu.cn/cas/logout?service=…` |
| 3 | `GET sso.bit.edu.cn/cas/logout?service=…` | `200`. Deletes `SOURCEID_TGC`, `CASPRIVACY`, `SESSION` (Path `/cas/`), `access_token`, `iPlanetDirectoryPro`, `rg_objectid` |

Sign-out only deletes cookies. The JWT is not revoked: the browser's token keeps working on `userapi/v1/infosimple` until its `exp` (at most 24 hours). Hop 1 is also a CAS single sign-out, so it ends the BIT SSO session in that browser.

### 2.7 The local-account path in `yjlogin`

`yjlogin` also has a non-CAS form. It RSA-encrypts with JSEncrypt and `./pub.key`, POSTs, reads `data.params.token`, then writes the signed `_token` cookie on the client with the HMAC key above. BIT users are sent to CAS instead. This path is for local accounts on other tenants. The bundle also has `GET /userapi/v1/login_token` (`{params:{token}}`), shaped like a one-time token. It was not explored.

---

## 3. Conventions

### 3.1 Tenant, ids, time

`tenant_id` / `tenant_code` / `tenant` are all `21`. The SPA adds a `tenant-id: 21` header on catalog calls. Every catalog call tested also works with only the Bearer and no such header.

Ids are mostly strings (`"200101"`). The exceptions are JSON numbers: ids on `searchlist` rows, `id` on `search-term`, `params.id` / `params.tenant_id` on `infosimple`, and `Id` on `account-profile/course`. Timestamps are unix seconds, usually strings too.

An anonymous JSON call gets `403`, `text/html`, empty body.

### 3.2 Response envelopes

Decide success by envelope, not by HTTP status. "No data" is often still HTTP 200.

| Envelope | Success | Used by |
|-|-|-|
| `{code:0, msg, data}` | `code === 0` | `courseapi/v3/multi-search/*`, `courseapi/v3/portal-home-setting/*` |
| `{code:0, msg, total, list}` | `code === 0` | `courseapi/v3/course-live-role/*`, `courseapi/v3/web-socket/*`, `pptnote/v1/schedule/search-ppt`, and also `courseapi/v2/schedule/search-term` and `search-xy-list` (these two do not use the v2 envelope below) |
| `{code:0, msg, total:{list, total}}` | `code === 0` | `pptnote/v1/searchlist` only. `total` is an object. No hits is HTTP 200 `{code:-1, msg:"没有数据"}`, not an empty list. HTTP 400 `{code:-1}` means `tenant_id` is missing or `user_id` / `user_name` are not both present |
| `{success:true, result:{code:200, msg, data\|list}}` | `result.code === 200` | `courseapi/v2/course/*` and `get-week-schedules`. Not `search-term` / `search-xy-list` |
| `{success:true, data:{code:200, msg, data}}` | `data.code === 200` | `courseapi/v2/play-template/*`. The payload is `data.data` |
| `{success:true, result:{err:200, errMsg, data}}` | `result.err === 200` | `courseapi/v3/course-collect/*` |
| `{code:200, message, params}` | `code === 200` | `userapi/*` |
| `{code:1000, status:200, message, params:{result}}` | `code === 1000` | `vlabpassportapi/*` |
| `{code:10000, message, data}` | `code === 10000` | `consoleapi/*` |

`search-trans-result` with no transcript is HTTP 200 `{code:10002, msg:"未查询到语音数据"}`. `get-week-schedules` for a week with no classes is `{success:true, result:{code:400, msg:"课表为空"}}` with no `list`.

### 3.3 The `/personal/` prefix

`/personal/courseapi/…` is a proxy for the personal SPA, with the same back end behind it. `/personal/courseapi/courseapi/v3/course-collect/down` behaves like `/courseapi/v3/course-collect/down`.

`/personal/courseapi/vlabpassportapi/…` returns 404 without that page's own `Referer` and `x-requested-with`. The direct path works with only the Bearer and returns the same envelope:

```
GET /vlabpassportapi/v1/account-profile/course
```

---

## 4. Mapping to cbiz

The two sites' numeric ids have nothing in common. What does match is the registrar code, the course code, the room code, the teacher's staff number, and the recording path.

Sample: Functional Analysis, 林知远, 2026-09-21 08:00.

| | cbiz | aita |
|-|-|-|
| Course id | `80101` | `200101` |
| Session id | `900101` | `3000101` (`sub_data_id` `2990101`) |
| Video id | `600101` | none; use `resource_guid` |
| Registrar code | `number` `20262027110099010101` | `kcwybm`, and `course_code` on the day list. The detail's own `course_code` is the short `0099010101` |
| Course code | `code` `100990101` | `information.kcdm` `100990101` |
| Room | session `location` `9901A1002X` | day-list `SKJSM` `9901A1002X`. aita's `room` is an internal id (`512` here) |
| Teacher | `badge` | `lecturer`, and `teachers[].username` |
| Recording directory | `…/2026/09/21/51234567/1/…` | the same path |

### 4.1 `kcwybm` and `number`

They are equal as strings, including the non-standard formats. Do not parse them and do not compare them as numbers. The code embeds the academic year. There is no evidence about reuse across years, so compare with the year and term alongside.

Formats seen:

1. `20262027110099010101` (academic year + term digit + course code + sequence)
2. `202620271MTH1000112` (contains letters)
3. `20261-17-1709901-1781234567890` (short year + school + course + 13-digit milliseconds)
4. `5f0c2e9a7b3d4c18a6e1f2b7c9d0a4e3` (32 hex)

| Course | cbiz id / `number` | aita id / `kcwybm` |
|-|-|-|
| Functional Analysis, 林知远, 2026-1 | 80101 / `20262027110099010101` | 200101 / same |
| Functional Analysis, 周若岚, 2026-1 | 80102 / `20262027110099020101` | 200102 / same |
| Functional Analysis, 许子衡, 2025-1 | 70201 / `20251-17-1709901-1751234567890` | 150201 / same |
| Partial Differential Equations, 2026-1 | 80301 / `20261-03-0309902-1782345678901` | 210301 / same |
| Probability and Statistics B, 2026-1 | 80401 / `202620271MTH1000112` | 205401 / same |
| Topology | 79001 / `5f0c2e9a7b3d4c18a6e1f2b7c9d0a4e3` | (only matched on the cbiz side with `keyword`) |

Where `kcwybm` appears:

| Call | Field |
|-|-|
| `get-course-detail` | `data.kcwybm`. `data.information` is a JSON string holding `kcdm`, `kkxn`, `kkxq`, `kcwybm`, `zhiyuan_id`. This call's `course_code` is the short code, not `kcwybm` |
| `get-course-list` rows | `kcwybm`, equal to `course_code`. `information` at this level usually has no `zhiyuan_id` |
| `search-role-course-list` rows | only `course_code`, whose value equals `kcwybm` |
| `account-profile/course`, `account-profile/study` | inside the `information` string |
| `searchlist` | neither `kcwybm` nor `course_code` |

On older `get-course-list` rows (2025-2026-1), `information` can be only `{"zhiyuan_id":…}`, with no `kkxn` / `kkxq` / `kcwybm`. The year and term are in the row's `term_name` (`YYYY-YYYY-1` or `YYYY-YYYY-2`). `kcwybm` is still a separate field on those rows. Hand-entered rows can carry only `course_code` (equal to `kcwybm` on this call) with an empty `kcwybm`. `kkxy_name` can be `null`.

**cbiz → aita.** aita's `get-course-list` matches `title` as a substring and also matches teacher names, but not English titles. Putting the `kcwybm` itself in `title` returns 0 rows. Search by course title (or teacher name), then keep the row where `kcwybm === number`. Title search spans terms.

**aita → cbiz.** One anonymous call:

```
GET https://cbiz.yanhekt.cn/v2/course/list?page=1&page_size=16&keyword=<kcwybm>
```

Leave out `semesters[]`. `keyword` matches `number`, `code`, the course id and teacher staff numbers as whole strings (case-insensitive, trimmed), and course titles as substrings. It is not a substring match on `number`.

| `keyword` | Result |
|-|-|
| The first five `number`s in the table above, including lower-case `mth` | 1 row each, ids as above |
| `5f0c2e9a7b3d4c18a6e1f2b7c9d0a4e3` | 1 row: `79001` |
| `0099010101` (the detail's short code) | 0 |
| `2026202711009901` (a prefix), `99010101` (a suffix) | 0 |
| `100990101` (`code` = `kcdm`) | 2 rows: `70101` (2025-2026-1) and `80101`. The same course code in different terms |
| `80101` | 1 row |
| `6100000001` (a staff number) | 16 rows: that teacher's courses, across terms |

Rows from `/v2/course/list` and `/v1/course?id=` both carry `number` and `code`.

### 4.2 Sessions

Once the courses are matched, align sessions in `get-course-detail`'s `sub_list` by start time:

```
Number(aita class_begin) === unix(cbiz started_at, read as +08:00)
```

`1789948800` is 2026-09-21 08:00 +08. `sub_title` reads `YYYY-MM-DD第a-b节`, where a–b are class periods. Rescheduled sessions appear on both sides, so match by time, not by title.

`search-role-course-list` rows carry `course_id`, `sub_id`, `course_code` and `start_at`, but `search_time` is required. `searchlist` session rows carry `sub_id` and `subject_title` (`YYYY-MM-DD第a-b节`) but no `kcwybm`, and `start_at` only on hits that used `trans=`.

One day can have several offerings with the same title. On the sample day the Functional Analysis day list has three: `200101`, `200102` and `200103`. The third one's code is `20261-17-1709901-1781234567890`, and it still equals its cbiz `number`. Room code (`SKJSM` = `location`) plus start time plus teacher staff number is another set of fields you can cross-check. It is not a separate key.

The recording path `…/<date>/<assetId>/<n>/…` is the same on both sides (cbiz through `/v1/video`'s `vga`, aita through `get-sub-info`'s `playurl`). Each side only shows it after its own authenticated detail call.

### 4.3 Coverage

Past terms exist on aita (2025-2026-2, 2025-2026-1) but sparsely. 林知远's Functional Analysis in 2025-2026-1 has 29 sessions in `sub_list`. Slides and transcripts are rarer still for past terms: of 5 sampled sessions of that course, 1 had a transcript and 2 had slide rows.

---

## 5. Endpoints

Base `https://aita.yanhekt.cn`. Everything is GET except the POSTs marked in §5.16. **A** means a Bearer is required. Examples are trimmed to one row and to the fields that matter. Unless an example says otherwise, it uses Functional Analysis `200101` / session `3000101` (2026-09-21).

### 5.1 `GET /userapi/v1/infosimple` A

No query parameters. Use it to check a token. It is also where `phone` comes from. Envelope `{code:200, message, params}`. `params.id` and `params.tenant_id` are numbers. `phone` is an 11-digit string. It can be a placeholder and is still the §6.3 signing input.

```json
{
  "code": 200,
  "message": "查询成功",
  "params": {
    "id": 10001,
    "account": "<account>",
    "realname": "<name>",
    "phone": "<11 digits>",
    "currentRole": "student",
    "tenant_id": 21,
    "avatar": "https://aita.yanhekt.cn/image/cmc/default/console/default_header.png",
    "myroles": [{ "id": 15, "code": "student", "display_name": "学生", "isinspection": -1 }],
    "structures": [{ "id": 1, "code": "<code>", "display_name": "<college>", "xydm": "<code>", "xymc": "<college>" }],
    "tenant": { "id": 21, "tenant_code": "2796000000", "tenant_name": "云教开发环境租户" }
  }
}
```

`structures[0]` is the student's own school, not the school that offers a course. Alongside are `SFZH`, `memajor`, `tutor`, `roles` (same as `myroles`), `verifyphone`, and player switches in `tenant.data`.

### 5.2 `GET /consoleapi/v2/user/group-user` A

CMC product bootstrap. Envelope `{code:10000, message, data}`.

```json
{
  "code": 10000,
  "message": "操作成功",
  "data": {
    "product_info": { "product_name": "“智播”课程云", "product_code": "yjedu" },
    "group_info": { "group_code": "2796000000", "group_name": "北京理工大学", "user_count": "<count>" },
    "user_info": { "id": "10002", "login_name": "<account>", "user_type": "2" }
  }
}
```

`user_info.id` (`"10002"` here) is not `infosimple.params.id` (`10001`) and not the JWT `sub`. It cannot sign `/play/`.

### 5.3 `GET /courseapi/v3/multi-search/get-course-list` A

Catalog search. There is no date parameter.

| Parameter | |
|-|-|
| `title` | Substring of the course title. Also matches teacher names, but not English titles. Empty is allowed. `kcwybm` itself returns 0 rows |
| `tenant` | `21` |
| `page`, `per_page` | 1-based, and paging works. `title=泛函分析&per_page=5` gives `total` `"8"` and 5 rows in `list` |
| `term` | Optional, one bare term id (`42`). `_42_`, `42,30` and `term[]=` all return `total` 0. No multi-term filter |
| `order`, `struc_ids[]`, `publish` | The SPA sends them. None is required |

The `tenant-id: 21` header is optional. Envelope `{code:0, msg:"success", data:{total, list}}`. `data.total` is a string, and so are row ids.

The rows for `title=泛函分析&page=1&per_page=5` come back in this order: `200103` (许子衡, 2026-2027-1), `200101` (林知远), `200102` (周若岚), `150201` (2025-2026-1), `150101` (林知远, 2025).

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "total": "8",
    "list": [{
      "id": "200101",
      "title": "泛函分析",
      "realname": "<teacher>",
      "username": "<badge>",
      "kcwybm": "20262027110099010101",
      "course_code": "20262027110099010101",
      "kcbh": "100990101",
      "information": "{\"kcdm\":\"100990101\",\"kkxn\":\"2026-2027\",\"kkxq\":\"1\",\"kcwybm\":\"20262027110099010101\"}",
      "term": "_42_",
      "term_name": "2026-2027-1",
      "kkxy_code": "301",
      "kkxy_name": "数学学院",
      "structure_name": "数学学院",
      "student_num": "53",
      "live_status": "3",
      "english_name": "",
      "teacher_search": "",
      "type": "multi",
      "model": "public",
      "publish": "1"
    }]
  }
}
```

On this call `course_code === kcwybm`. A row has about 90 more keys (`brief`, `content`, `grading_mode`, `hkust_*` and so on), which in the samples were almost always `"0"`, `""` or `null`. `english_name` was `""` on all five rows.

### 5.4 `GET /pptnote/v1/searchlist` A

The top-bar search. `/globalSearch` collects `title` / `realname` / `trans` and `/searchContent` forwards them unchanged. Rows carry no `kcwybm`.

Every call appends a search-history entry for the `user_id` + `user_name` you pass, even a mismatched pair, and the pair is not checked against the JWT (a wrong pair still searches the whole library). Treat it as a write (§5.16).

| Parameter | |
|-|-|
| `tenant_id` | Required, `21`. Sending only `tenant_code` gives HTTP 400 `{code:-1, msg:"租户id不能为空"}` |
| `user_id` and `user_name` | Both required. Missing either gives HTTP 400 `"用户不能为空"` |
| `tenant_code` | Optional. The SPA sends `21` |
| `title`, `realname`, `trans` | At least one. The UI trims them and caps them at 30 characters. With none, the whole library comes back (about 23 000 rows, including `mooc`) |
| `page`, `per_page` | 1-based. The SPA uses 16. Paging works (`page=2&per_page=2` returns rows 3 and 4) |
| `term` | A bare id from `search-term` (`42`). Passing the row form `_42_` gives HTTP 400 `"租户id不能为空"` (the message names the wrong parameter) |
| `kkxycode` | From `search-xy-list`. `00000` returns nothing, so the filter is real |
| `create_at` | One day, in milliseconds or unix seconds. A string like `2025-09-15` is ignored. Midnight +08 of that day returns only that day's session |
| `search_type` | Comma-separated `c_type` values, or `_ALL_`. `multi` cannot tell courses from sessions (both are `c_type: multi`). `course_live` is a `sub_type` and matches nothing |

Envelope:

```json
{ "code": 0, "msg": "查询成功", "total": { "list": [], "total": 7 } }
```

No hits: HTTP 200 `{code:-1, msg:"没有数据"}`. Anonymous: 403. `total.total` is a number, and so are ids, `score`, `click_record_num` and `course_student_type`.

Highlights are marked `@kibana-highlighted-field@…@/kibana-highlighted-field@`, including inside `trans[].content`. The UI inserts them as HTML.

A course hit (`title=泛函分析`, first row) has `sub_id` `0`:

```json
{
  "course_id": 200103,
  "sub_id": 0,
  "sub_type": "multi",
  "c_type": "multi",
  "title": "泛函分析",
  "subject_title": "泛函分析",
  "teacher": "<teacher>",
  "realname": "<teacher>",
  "kkxy_name": "数学学院",
  "term": "_42_",
  "term_name": "2026-2027-1",
  "score": 23.70182,
  "click_record_num": 0,
  "course_student_type": 2,
  "thumb": "https://aita.yanhekt.cn/static/img/thumb/1.png",
  "extract_thumb": "",
  "trans_content": "",
  "course_category_id": "",
  "course_category_name": "",
  "highlight": { "title": ["@kibana-highlighted-field@泛函分析@/kibana-highlighted-field@"] }
}
```

Session hits follow the course hits. `sub_id` is non-zero and there is no `start_at`. `teacher` is `""`; the name is in `lecturer_name` and `realname`:

```json
{
  "course_id": 150101,
  "sub_id": 2400534,
  "sub_type": "course_live",
  "c_type": "multi",
  "title": "泛函分析",
  "subject_title": "2026-01-04第3-5节",
  "teacher": "",
  "lecturer_name": "<teacher>",
  "realname": "<teacher>",
  "room_name": "示例校区明理楼-A302",
  "is_public": 1,
  "kkxy_name": "数学学院",
  "term": "_30_",
  "term_name": "2025-2026-1",
  "score": 23.70182,
  "sponsor": "",
  "thumb": "https://aita.yanhekt.cn/sourceapi/uploads/<path>.png",
  "extract_thumb": "https://aita.yanhekt.cn/play/frim_files/teacher2025/<date>/Pic/<date>/<hash>_1920_1080_0.jpg",
  "trans_content": ""
}
```

`title=泛函分析` returns 7 rows: the three current-term courses first (`200103`, `200101`, `200102`, all with `sub_id` 0), then single sessions from earlier terms. `term=42` keeps only those three courses. `term=30` (2025-2026-1) keeps only 3 sessions and no course card. Clicking a `c_type: multi` card opens `/coursedetail?course_id=` even when the row has a `sub_id`. The player URL is `/livingroom?course_id=&sub_id=`.

Matching is by word segmentation. `泛函` and `泛函分析` both return the same 7 rows. `函分` crosses a word boundary and returns 「没有数据」. `分析` matches hundreds of titles. `realname=林知远` alone returns hundreds of rows, with lower-scoring hits for other teachers who share one character of the name. `title=泛函分析&realname=林知远` returns exactly 2. `realname` is not an exact match.

`trans` searches transcript text. The main site hides this box (`TRANS_RESULT_SEARCH` is `2` in `static/config.js`; the portal build sets it to `"1"` to show it), but the parameter works on both builds. `title=泛函分析&trans=空间` returns 11 sessions and no course card. These rows have no `score` and no `term_name`. The first one:

```json
{
  "course_id": 150101,
  "sub_id": 2300390,
  "sub_type": "course_live",
  "c_type": "multi",
  "title": "泛函分析",
  "subject_title": "2025-11-12第3-5节",
  "lecturer_name": "<teacher>",
  "realname": "<teacher>",
  "teacher": "",
  "room": 634,
  "room_name": "示例校区明理楼-A302",
  "is_public": 1,
  "start_at": 1762912500,
  "begin_section": "section_03",
  "end_section": "section_05",
  "sponsor": "",
  "trans": [
    { "time": 81, "content": "00:01:21 那么我们说这个线性附范@kibana-highlighted-field@空间@/kibana-highlighted-field@，" }
  ]
}
```

`time` is seconds and equals the `HH:MM:SS` inside `content` (`81` = `00:01:21`). The first row had 13 snippets. The highlight key is called `trans_content`, while the row field is `trans`. `start_at` `1762912500` is 2025-11-12 09:55 +08. Session rows found by title alone have no `start_at`.

### 5.5 `GET /pptnote/v1/searchhistory` A

Parameters `tenant_id`, `user_id`, `user_name`, `source=1` (what the SPA sends; leaving out `source` was not retested).

```json
{
  "code": 0,
  "msg": "查询成功",
  "total": 26,
  "list": ["泛函分析  空间", "泛函  "],
  "listIds": ["<es id>", "<es id>"],
  "historyMaps": [
    { "key": "泛函分析  ", "cnt": 17 },
    { "key": "泛函分析  空间", "cnt": 3 }
  ],
  "historys": [{ "泛函分析  ": 17 }, { "泛函分析  空间": 3 }]
}
```

`list` is the history chips in the UI (5 of them in this capture). Each one is `"<title> <realname> <trans>"`, with trailing spaces when only the title was used (`"泛函分析  "`). The UI splits it back into the three boxes on spaces. `total` (26) is not `list.length`: in the same minute `historyMaps` had 8 entries and `list` had 5. `listIds` are Elasticsearch ids, parallel to `list`. Clearing is `POST /pptnote/v1/delhistory` (§5.16).

### 5.6 `GET /courseapi/v2/schedule/search-term` A

Query `tenant=21`. The SPA calls `/courseapi/index.php/v2/schedule/search-term`; the body is the same without `index.php`. Flat envelope `{code:0, msg, total, list}`, not `{success, result}`. `total` is a string. `id` is a number, and it is the `term` that `searchlist` and `get-course-list` take. The row with `current: true` is the site's default term.

```json
{
  "code": 0,
  "msg": "获取学期列表成功",
  "total": "6",
  "list": [{
    "id": 42,
    "term_name": "2026-2027-1",
    "year": "2026-2027",
    "season": "1",
    "begin_date": "2026-08-31",
    "end_date": "2027-01-24",
    "current": true,
    "label": "1",
    "tenant": "21",
    "user_id": 0,
    "config": null,
    "special": null,
    "desc": null,
    "create_time": "<datetime>",
    "update_time": "<datetime>"
  }]
}
```

The other five have `current: false`: `38` `2025-2026-2`, `30` `2025-2026-1`, `22` `2024-2025-2`, `18` `2024-2025-1`, and `14` `2021-2022试用`, whose `season` is the string `"试用"` rather than `"1"` / `"2"`.

### 5.7 `GET /courseapi/v2/schedule/search-xy-list` A

Same path rule and same flat envelope. `total` is a string (`"54"`). Each row has only:

```json
{ "kkxy_code": "301", "kkxy_name": "数学学院" }
```

`kkxy_code` is what `searchlist?kkxycode=` takes. The first few rows are not schools: `00000` 北京理工大学, `0001` 默认学校, `00011` 默认学院. The SPA inserts its own `{kkxy_code:"null", kkxy_name:"无"}` and drops `kkxycode=null` before calling `searchlist`. The literal `"null"` is not a school code.

### 5.8 `GET /courseapi/v3/multi-search/get-course-detail` A

| Parameter | |
|-|-|
| `course_id` | Required |
| `student` | Optional, a student number. Gives each session a `finished` of `0`/`1`. Without it `finished` is always `0` |

Envelope `{code:0, msg:"success", data}`.

```json
{
  "id": "200101",
  "title": "泛函分析",
  "realname": "<teacher>",
  "username": "<badge>",
  "kcwybm": "20262027110099010101",
  "course_code": "0099010101",
  "information": "{\"kcdm\":\"100990101\",\"kkxn\":\"2026-2027\",\"kkxq\":\"1\",\"kcwybm\":\"20262027110099010101\",\"zhiyuan_id\":30001}",
  "term": "_42_",
  "term_name": "2026-2027-1",
  "kkxy_code": "301",
  "kkxy_name": "数学学院",
  "student_num": "53",
  "is_share": "2",
  "is_export": "2",
  "is_collect": 0,
  "click_num": 0,
  "learn_num": 0,
  "teachers": [{
    "username": "<badge>",
    "realname": "<teacher>",
    "is_speaker": "1",
    "user_id": "<id>",
    "kkxy_code": "301",
    "kkxy_name": "数学学院",
    "pro": null,
    "brief": null,
    "avatar": null
  }]
}
```

Here `course_code` is the short code. `is_share` / `is_export` are always `"2"` and are not per-course switches. `is_collect` is a number.

`sub_list` is three levels deep, with string keys:

```
sub_list[<year>][<month, not zero-padded>][<week of the month>] = [ session, … ]
```

For `200101`: `sub_list["2026"]["9"]["4"]` has two sessions, `["5"]` has two, `["10"]["2"]` has two. Week keys `"4"` and `"5"` hold the 21st/22nd and the 28th/29th; they are not days. An empty `sub_list` is a valid response (the course exists but has no sessions, as with a school-wide lecture), and `code` is still 0. `catalogue` is not a substitute.

```json
{
  "id": "3000101",
  "p_id": "0",
  "sub_title": "2026-09-21第1-2节",
  "type": "course_live",
  "class_begin": "1789948800",
  "class_over": "1789954500",
  "open_at": "0",
  "deadline_at": "0",
  "sub_status": "6",
  "playback_status": "1",
  "ai_status": "2",
  "lecturer": "<badge>",
  "lecturer_name": "<teacher>",
  "room_name": "示例校区明理楼-A102",
  "is_open": "1",
  "is_share": "2",
  "is_export": "2",
  "show": "yes",
  "is_public": "1",
  "open_barrage": "1",
  "sub_delayed_release": "0",
  "sub_delete": "0",
  "sub_review_type": "1",
  "sub_data_id": "2990101",
  "olive_type": "course_live",
  "precondition_type": null,
  "precondition_time": 1,
  "created_at": "1789234399",
  "click_record_num": "6",
  "play_time": 0,
  "finished": 0
}
```

`class_begin` / `class_over` are unix strings. `play_time` (this user's watch position in seconds), `finished` and `precondition_time` are numbers. `1789948800` is 2026-09-21 08:00 +08. This session has `ai_status` `"2"` and also 46 slides: `ai_status` says nothing about whether slides or a transcript exist (§5.17).

`data` also has `sub_chapter_cnt`, `ai_qa_cnt`, `ai_info`, an empty `origin_sub_list`, `intro_video`, `teaching_plans` and `destinationId`. None had content in the samples.

### 5.9 `GET /courseapi/v2/course/catalogue` A

Query `course_id`. A flat session list. Envelope `{success:true, result:{code:200, msg, data:[]}}`. `200101` has 6 sessions.

```json
{
  "sub_id": "3000101",
  "course_id": "200101",
  "title": "2026-09-21第1-2节",
  "lecturer": "<badge>",
  "lecturer_name": "<teacher>",
  "type": "course_live",
  "room": "512",
  "status": "6",
  "start_at": "1789948800",
  "sort": "0",
  "sub_public": "1",
  "sub_show": "yes",
  "sub_delete": "0",
  "olive_type": "course_live",
  "thumb": "https://aita.yanhekt.cn/static/img/thumb/1.png",
  "pic": "https://aita.yanhekt.cn/play/frim_files/teacher2026/2026-09-21/Pic/2026-09-21/<hash>_1920_1080_0.jpg",
  "content": "<JSON string>"
}
```

The row's `start_at` equals `sub_list.class_begin`, and `status` equals `sub_status`. `content` is a JSON string, and the clock inside it is not the session clock:

```json
{
  "id": 1001,
  "start_at": 1735113351,
  "end_at": 1892879751,
  "room_id": 301,
  "address": "示例校区明理楼-A102",
  "process_type": "processing",
  "trans_socket_url": "",
  "save_playback": {
    "contents": "https://aita.yanhekt.cn/play/frim_files/teacher2026/2026-09-21/2026-09-21/<hash>_1080p.mp4",
    "contents_duration": 5937
  },
  "playback": {
    "url": "https://aita.yanhekt.cn/play/frim_files/teacher2026/2026-09-21/2026-09-21/<hash>_1080p.mp4",
    "path": "w:\\\\frim_files\\\\teacher2026\\\\2026-09-21\\\\2026-09-21\\\\<hash>_1080p.mp4"
  }
}
```

`content.start_at` (`1735113351`) is not `1789948800`; use the row's `start_at` for session time. Here `playback.url` is the teacher MP4. For the same session in `get-sub-info`, the teacher HLS is in `content.save_playback.contents` and the teacher MP4 is in `content.playback.url`, so the two `content` objects differ. `path` is a Windows path on the recorder. `pic` is under `/play/`: it needs a Referer but no `t` (§6.3).

### 5.10 `GET /courseapi/v3/course-live-role/search-role-course-list` A

The `/course` calendar. The only search that requires a date.

| Parameter | SPA sends |
|-|-|
| `search_time` | Required. `YYYY-M-D`, not zero-padded: `2026-9-28` |
| `tenant` | `21` |
| `need_time_quantum` | `1` (sent twice in the capture) |
| `unique_course`, `with_sub_duration`, `with_sub_data`, `has_frame` | `1` |
| `nteacher` | `0` |
| `like_title` | Optional |
| `quantum_id` | One period id, from `list[].id` of a previous response |
| `sub_live_status`, `sub_public`, `course_student_type`, `kkxy_code` | Sent empty |

Envelope `{code:0, msg:"获取直播课列表成功", total, list}`. `list` holds the day's class periods, not sessions, while `total` counts sessions. In one capture with `quantum_id=46` there were 5 period headers. Only the first had rows (90), the other four had empty `list`s, and `total` was `90`.

```json
{
  "id": 46,
  "name": "第一节",
  "class_begin_time": "08:00:00",
  "class_end_time": "09:35:00",
  "class_begin": 0,
  "class_end": 0,
  "tenant": "21",
  "default": 0,
  "note": ""
}
```

`list[].list[]` holds that period's sessions:

```json
{
  "course_id": "202601",
  "sub_id": "3050038",
  "title": "线性代数A",
  "sub_title": "2026-09-28第1-2节",
  "course_code": "202620271MTH1010101",
  "SKJSM": "99050112",
  "room_name": "示例校区博学楼-112",
  "room": "112",
  "start_at": "1790553600",
  "end_at": "1790559300",
  "course_begin": "1790553600",
  "course_over": "1790559300",
  "sub_status": "2",
  "status": "2",
  "status_label": "未开始",
  "lecturer": "<badge>",
  "lecturer_name": "<teacher>",
  "realname": "<teacher>",
  "kkxy_name": "…",
  "term": "_42_",
  "term_name": "2026-2027-1",
  "student_num": "…",
  "firm_code": "hqy",
  "firm_name": "栖学",
  "sub_resource_guid": "",
  "sub_duration": "0",
  "is_live": "1",
  "teachers": [{ "username": "<badge>", "realname": "<teacher>", "is_speaker": "1", "user_id": "…" }]
}
```

Here `course_code` equals `kcwybm`. `SKJSM` is the room code, which cbiz calls `location`. `start_at` is the same unix string as `sub_list.class_begin`. Every row checked had `firm_code` / `firm_name` `hqy` / 栖学. With `sub_status` `"2"` the `status_label` is `未开始`. Rows also carry `xstream_begin`, `sub_precondition_type`, `webp`, `teach_class_name`, and `multi_type` (same as `sub_type`, `course_live`).

### 5.11 `GET /courseapi/v2/schedule/get-week-schedules` A

One week of enrolled classes.

| Parameter | |
|-|-|
| `user_id` | aita user id |
| `tenant_id` | `21` |
| `start_at`, `end_at` | `YYYY-MM-DD` |
| `token` | The JWT in the query string. The SPA sends it, but a Bearer alone also works |

Envelope `{success:true, result:{code:200, msg:"", list}}`, with one element per day in the range. A day with no classes still has its element, with `course: []`. A week with no classes at all comes back as `{success:true, result:{code:400, msg:"课表为空"}}` with no `list`.

```json
{
  "day": "2026-09-28",
  "course": [{
    "id": "3020010",
    "course_id": "201501",
    "course_title": "数值分析",
    "status": "2",
    "status_label": "",
    "start_at": "1790579700",
    "end_at": "1790588400",
    "begin_time": "0",
    "room_id": "640",
    "room_name": "示例校区明理楼-B205",
    "lecturer_name": "<teacher>",
    "teacher_name": "<teacher>",
    "is_live": "1",
    "is_public": "1",
    "multi_type": "course_live",
    "sub_show": "yes",
    "sub_delayed_release": "0",
    "sub_review_type": "1",
    "teachers": [{ "username": "<badge>", "realname": "<teacher>", "is_speaker": "1" }]
  }]
}
```

`id` is the session id, not the course id. `status` `"2"` means not started yet (the capture was taken before that class). `status_label` is an empty string here; only the calendar call fills in `未开始`.

### 5.12 `GET /vlabpassportapi/v1/account-profile/course` A

Enrolled courses. The SPA uses the `/personal/courseapi/` prefix; for the direct path see §3.3.

| Parameter | |
|-|-|
| `nowpage`, `per-page` | Note the hyphen |
| `force_mycourse` | `1` for enrolled only. Without it, courses whose player page was ever opened are included too |
| `model`, `search`, `course_type` | Optional |

Envelope `{code:1000, status:200, message, params:{ result:{ data, total, page, per-page }, t }}`. `params.t` is `null`. Rows are PascalCase. `total` / `page` are numbers. `Id` is a number and is the course id. Past terms are included.

```json
{
  "Id": 210301,
  "Title": "偏微分方程",
  "Teacher": "<teacher>",
  "Username": "<badge>",
  "Realname": "<teacher>",
  "Type": "multi",
  "Model": "public",
  "Term": "_42_",
  "TermName": "2026-2027-1",
  "KkxyCode": "301",
  "KkxyName": "数学学院",
  "LiveStatus": 3,
  "IsExport": 2,
  "PrevSubjectId": 3010814,
  "PrevSubjectPublish": "1",
  "PrevSubjectType": "course_live",
  "PrevLearnTime": "<datetime>",
  "RecordLearnTime": "<datetime>",
  "SubjectProgress": 0.33,
  "information": "{\"kcdm\":\"0309902\",\"kkxn\":\"2026-2027\",\"kkxq\":\"1\",\"kcwybm\":\"20261-03-0309902-1782345678901\",\"zhiyuan_id\":30002}",
  "progress": { "learnNum": 2, "recordNum": 0, "subjectNum": 6, "subjectProgress": 0.33 },
  "Teachers": [{ "Username": "<badge>", "Realname": "<teacher>", "IsSpeaker": "1" }]
}
```

`PrevSubjectId` is the session to resume. `SubjectProgress` duplicates `progress.subjectProgress`.

### 5.13 `GET /vlabpassportapi/v1/account-profile/study` A

Recently studied. Parameters `nowpage`, `per-page`. Same envelope, but the array is `params.result.models`, not `data`. Page 1 with `per-page=5` had `total` 7 and 5 `models`.

A row is a course row of the same kind as `get-course-list`, plus a watch pointer:

```json
{
  "id": "203202",
  "title": "复变函数（全英文）",
  "kcwybm": "20262027110099030101",
  "term_name": "2026-2027-1",
  "course_subject_id": "3005050",
  "prev_subject_type": "course_live",
  "record_id": "70001",
  "record_at": "1790567942",
  "record_update": "1790567978",
  "progress": { "learnNum": 1, "recordNum": 0, "subjectNum": 6, "subjectProgress": 0.16 }
}
```

`course_subject_id` is the session. `record_at` / `record_update` are unix strings. There is no `play_time` here; only `get-course-detail` sessions have that.

### 5.14 `GET /courseapi/v3/course-collect/lists` A

「我的收藏」, which is not a cbiz subscription. Parameters `course_title` (may be empty), `page`, `per-page`. `/personal/courseapi/courseapi/v3/course-collect/lists` is the same service. Envelope `{success:true, result:{ err:200, errMsg:"", data:{ models, total, page, per-page } }}`.

```json
{
  "id": "20591",
  "course_id": "203202",
  "course_title": "复变函数（全英文）",
  "course_type": "multi",
  "course_thumb": "https://aita.yanhekt.cn/static/img/thumb/1.png",
  "course_username": "<badge>",
  "course_realname": "<teacher>",
  "course_publish": "1",
  "course_deleted_at": "0",
  "collect_time": "1790576356",
  "course_click": 4,
  "course_mark": null,
  "teachers": [{ "username": "<badge>", "realname": "<teacher>", "is_speaker": "1" }]
}
```

`id` is the bookmark row, not the course. `collect_time` is unix seconds as a string. A row has no `kcwybm` and no term; read those from `get-course-detail`. Unlike cbiz's subscription list, this list returns courses from every term.

The list is the only way to read bookmarks: `is_collect` on `get-course-detail` stays `0` for a bookmarked course, with or without the `tenant-id` header (measured 2026-10-27). `course-collect/down` adds or removes a bookmark; it is not a query (§5.16).

### 5.15 `GET /courseapi/v3/multi-search/get-course-teacher-others` A

Query `course_id`, `per_page`. The same teacher's other courses. `data` is an array, not `{list, total}`, and there is no `kcwybm`.

```json
{
  "code": 0,
  "msg": "success",
  "data": [{
    "course_id": "30242",
    "course_title": "高等代数II",
    "realname": "<teacher>",
    "username": "<badge>",
    "term": "_22_",
    "term_name": "2024-2025-2",
    "type": "multi",
    "thumb": "https://aita.yanhekt.cn/static/img/thumb/1.png",
    "extract_thumb": "https://aita.yanhekt.cn/play/…"
  }]
}
```

For `200101` there are 4 rows: two offerings of 高等代数II (`30242`, `30246`, term `_22_`), Functional Analysis `150130` (`_30_`), and Topology `199326` (`_42_`).

### 5.16 Calls that change account state

Do not judge these by their HTTP method:

| Call | Effect |
|-|-|
| `GET /courseapi/v3/course-collect/down?course_id=` | Adds the course to 「我的收藏」: `result.err` `200` 收藏成功. Adding one already there answers `201` 重复收藏 and changes nothing (still `success:true`) |
| `GET …/course-collect/down?course_id=&cancel=1` | Removes it: `200` 已取消收藏, the same when it was not bookmarked |
| `POST /courseapi/v2/learn-record/learn-record` | The player's watch-progress beacon (a `keepalive` fetch). This is where `play_time` comes from |
| `courseapi/v3/portal-record/*` (`add-comment`, `sub-praise`, …) | Comments and likes |
| `courseapi/v3/course-learn-log/*` | Study log |
| `POST /pptnote/v1/delhistory` | Clears the user's search history |
| `GET /pptnote/v1/searchlist` | Reads results and also appends a search-history entry (§5.4) |

### 5.17 Status fields

Inferred from spot checks, not from vendor documentation.

| Field | Values seen | Notes |
|-|-|-|
| `sub_status` / session `status` | `2` not started, `1` live, `3` just ended (processing), `6` playable, `5` past with no playback | The calendar gives `status_label` `未开始` for `2`; the week schedule's `status_label` can be empty |
| `playback_status` | `0` / `1` | Whether a recording is available |
| `ai_status` | `0` / `1` / `2` | Does not predict slides or a transcript. `0` sessions have had both, `2` sessions have had neither, and one `2` session had 46 slides. `1` coincides with live |
| course `live_status` | `2` / `3` | Course-level. The values could not be told apart by meaning |
| `is_share`, `is_export` | always `2` (number or string, depending on the call) | Did not vary by course in the samples |

To learn whether slides or a transcript exist, read the bodies of `search-ppt` and `search-trans-result`. A module listed in the play template does not mean the session has that output.

---

## 6. Playback

### 6.1 `GET /courseapi/v3/portal-home-setting/get-sub-info` A

Parameters `course_id` and `sub_id`, both required. Envelope `{code:0, msg:"success", data}`. Recorded sessions (`sub_status` `"6"`) and live ones (`"1"`) have different shapes.

Recorded, Functional Analysis `3000101`:

```json
{
  "course_id": "200101",
  "course_title": "泛函分析",
  "course_type": "multi",
  "sub_id": "3000101",
  "sub_title": "2026-09-21第1-2节",
  "sub_type": "course_live",
  "sub_status": "6",
  "start_at": "1789948800",
  "end_at": "1789954500",
  "begin_time": "1789948800",
  "end_time": "1789954583",
  "duration": "5937",
  "resource_guid": "<32 hex>",
  "room": "512",
  "room_name": "示例校区明理楼-A102",
  "lecturer": "<badge>",
  "lecturer_name": "<teacher>",
  "enable_translation": 0,
  "is_m3u8": "no",
  "play_msg": "未找到任务信息",
  "from_cache": 1,
  "now": 1790528040
}
```

`start_at` / `end_at` are the timetable; `begin_time` / `end_time` are the recording. In this session `end_time` is 83 seconds after `end_at`. `duration` is seconds, as a string. `is_m3u8` is `"no"` even though `playurl` is an m3u8. The top-level `play_msg` is `"未找到任务信息"`, while the same field inside `video_list` and `save_playback` reads `"cdn鉴权完成"`. Neither tells you whether a URL will play: now that signing is on, `/play/` without `t` is a 403. `now` is the server clock at request time, not a playback position. `enable_translation` is `0`, consistent with an empty `TransText`.

**`video_list`** is keyed `"0"`, `"1"`, `"2"`. These keys are not `type`, and their order changes between sessions. Tell the streams apart by `type`:

| `type` | Duration here | Content | `preview_url` |
|-|-|-|-|
| `"3"` | `"5937"` | Teacher camera. cbiz's `main`. The player opens this one by default | `/play/2/vod4/2026/09/21/51234567/1/Video1/Video1.m3u8` |
| `"2"` | `"5938"` | Screen MP4. Same picture as cbiz `vga`, but a different container and clock (§7.4) | `/play/frim_files/ppt2026/2026-09-21/2026-09-21/<hash>_1080p.mp4` |
| `"4"` | `"5804"` | Classroom camera facing the students | `/play/default/2026/09/21/<hash>_1920_1080.mp4` |

Numerical Analysis `3000555` has the keys in the opposite order: `"0"` is type `"4"`, `"1"` is `"2"`, `"2"` is `"3"`, and its teacher HLS is `/play/2/vod3/2026/09/21/51230000/1/Video1/Video1.m3u8`. Both `vod3` and `vod4` occur. The `<n>` in the path is `0` or `1`.

Each entry also has `id`, `resource_guid`, `status` (`"2"`), `thumb`, `time_offset` (`"0"` in every sample), `play_msg`, `iva_source_id` (`null` except on the student camera), and `temp_preivew_url` (spelled that way, `null`).

`playurl` is `{ "0": "<the type 3 m3u8>" }`. `audio_list` is `{ "0": { "start_time": 42, "url": "…/51234567/1/SubAudio/07_59_03_42.aac" } }`. This is the same classroom-mic AAC that cbiz serves. It needs a Referer but no `t`.

On this call `content` is an object, not a string:

```json
{
  "id": 1001,
  "address": "示例校区明理楼-A102",
  "room_id": 301,
  "process_type": "processing",
  "trans_socket_url": "",
  "save_playback": {
    "contents": "https://aita.yanhekt.cn/play/2/vod4/2026/09/21/51234567/1/Video1/Video1.m3u8",
    "contents_duration": 5937,
    "play_msg": "cdn鉴权完成"
  },
  "playback": {
    "url": "https://aita.yanhekt.cn/play/frim_files/teacher2026/2026-09-21/2026-09-21/<hash>_1080p.mp4",
    "path": "w:\\\\frim_files\\\\teacher2026\\\\…"
  }
}
```

So one session has three "video URLs": `playurl["0"]` and `save_playback.contents` are the teacher HLS, `playback.url` is the teacher MP4, and `catalogue`'s `content.save_playback.contents` was an MP4. Read `video_list` by `type`. `content.start_at` is still `1735113351` and has nothing to do with the timetable. The field that lines up with cbiz is the row's `start_at`.

**`segment_video_list`** groups the recording by segment, keyed `"0"`, `"1"`, …. Each value has `teacher_list`, `student_list` and `ppt_list`. Each of the three is a single object (not an array) with the same fields as a `video_list` entry. In the sample session, segment `"1"` has a `ppt_list` (type `"2"`, a second screen MP4) while `teacher_list` / `student_list` have `type`, `id` and `preview_url` all `null`. The two screen MP4s have the same picture and the same clock (§7.3). `two_record: "yes"` in `temp_config` appears together with the second segment. Numerical Analysis `3000555` has only segment `"0"`.

`data` also has `count_collect`, `count_praise`, `collected`, `praised`, `catalog_info`, `inspection_*`, `surv_data` and `custom_module_id`.

**Live** (`sub_status` `"1"`). `video_list` is a placeholder, `playurl` is empty, and the streams are in `live_url`. `output` (teacher), `output_ppt` (screen), `output_student` and `output_tts` are each an object of 12 URLs: `flv`, `flv_audio`, `flv_lhd`, `flv_lsd`, `m3u8`, `m3u8_audio`, `m3u8_lhd`, `m3u8_lsd`, `rtmp`, `rtmp_audio`, `rtmp_lhd`, `rtmp_lsd`. `output_msg` is `""`.

`m3u8` values seen:

| Key | URL | cbiz name |
|-|-|-|
| `output` | `https://clive11.yanhekt.cn/live/305_Video1.m3u8` | `main` |
| `output_ppt` | `https://clive11.yanhekt.cn/live/305_VideoVga.m3u8` | `vga` |
| `output_student` | `https://clive11.yanhekt.cn/live/305_VideoRoom.m3u8` | `target_room` |
| `output_tts` | `https://clive11.yanhekt.cn/live/<32 hex>_Video1.m3u8` | none |

The number in the path (`305`; `412` on another session) is not `room` and not a school code. Numerical Analysis has `room` `640` and stream `305_Video1`; Ordinary Differential Equations has `room` `1520` and stream `412_Video1`. This is the same CDN cbiz uses. `clive*.yanhekt.cn` m3u8s do not use the §6.3 `t`. Safari opens them directly; the Chrome address bar does not.

When a `livepgc.yanhekt.cn` variant shows up, it carries `auth_key=<exp>-0-0-<md5>`, which is the CDN's own parameter. That host name is NXDOMAIN in public DNS (authoritative zone), and its `_audio` / `_lhd` / `_lsd` variants do not open either. What plays is `clive*.yanhekt.cn` without `auth_key`.

The `output_tts` stream name is `<32 hex>_Video1`: the same suffix as the teacher camera, but with a hash where the channel number would be. The student player's `getLiveUrl` reads only `output`, `output_student` and `ppt`. The UI module `tts_live_gn` is labelled 「同声传译」 and uses websocket text over `trans_socket_url`, not this m3u8. The URLs are present in the JSON even when `enable_translation` is 0 and `trans_socket_url` is empty. During one live Ordinary Differential Equations class (course `206338`, sub `3030926`, on clive10), the teacher stream `https://clive10.yanhekt.cn/live/412_Video1.m3u8` returned 200 with an advancing playlist (`#EXT-X-MEDIA-SEQUENCE` in the hundreds of thousands, segments `412_Video1-*.ts`), while the same response's `output_tts` `.m3u8` and `.flv` were both 404. The `auth_key` expiry on that response's `livepgc` URLs was already earlier than the response's own `now`.

### 6.2 `GET /courseapi/v2/play-template/get-config` A

Parameters `tenant_id=21`, `course_id`, `sub_id`. Envelope `{success:true, data:{ code:200, msg, data }}`; the payload is `data.data`.

```json
{
  "id": "200101",
  "sub_id": "3000101",
  "template_id": "…",
  "tenant_id": "21",
  "name": "…",
  "type": "course_live",
  "is_default": "1",
  "modules": [
    { "id": "29",   "code": "one_videos_live_liu",   "name": "1号视频流" },
    { "id": "2900", "code": "ppt_videos_live_liu",   "name": "PPT视频流" },
    { "id": "34",   "code": "course_index_live_gn",  "name": "课程目录" },
    { "id": "36",   "code": "voice_live_gn",         "name": "语音识别" },
    { "id": "38",   "code": "koudai_course_live_gn", "name": "口袋课堂" },
    { "id": "644",  "code": "other_course_live_gn",  "name": "老师其它课程" },
    { "id": "645",  "code": "guess_like_live_gn",    "name": "猜你喜欢" },
    { "id": "647",  "code": "captions_live_gn",      "name": "字幕" },
    { "id": "2871", "code": "deep_stream_allow_gn",  "name": "开启实时督导" },
    { "id": "32",   "code": "ppt_live_liu",          "name": "AI识别(PPT)" }
  ],
  "temp_config": "{\"two_record\":\"yes\",\"two_show\":\"no\"}"
}
```

`temp_config` is a JSON string. The module list is the template, not what the session produced. `voice_live_gn` and `captions_live_gn` read the same transcript.

### 6.3 `/play/` hotlink protection

Media under `/play/` once needed no signature at all: `config.js` had `OPEN_PLAY_AUTH: false`, and anonymous GETs of m3u8, ts, mp4, aac and jpg under `/play/` returned 206, even while the JSON API already answered 403. The live `static/config.js` now has `OPEN_PLAY_AUTH: true`. From a network that can still call the JSON API, `/play/` without `t` is an nginx 403 HTML page. A Bearer, a Referer, the sign-in cookies, only a Referer, and the cookies plus a Referer were each tried on `Video1.m3u8`, and every one got 403. All three together in one request was not tried.

With `OPEN_PLAY_AUTH` true, the player rewrites every URL it hands to `CmcMediaPlayer`. In the live bundle this is webpack module `1P4N`:

```
ts   = floor(Date.now() / 1000)
rev  = phone.split("").reverse().join("")
path = new URL(url).pathname          # leading slash, no host, no query
md5  = hex_lowercase( path + id + tenantId + rev + ts )    # js-md5 0.7.3
t    = id + "-" + ts + "-" + md5
url  = url + (url has "?" ? "&" : "?") + "t=" + t
```

`id`, `tenantId` and `phone` are `params.id`, `params.tenant_id` and `params.phone` from `infosimple` (the first two integers, `phone` an 11-character string). JavaScript `+` joins the numbers in decimal with no padding. The call site's second argument (the live flag, often `false`) is not hashed. Only `pathname` is hashed, so an existing `?clientUUID=` does not change the digest. `clientUUID` is the player's cache-buster.

The client bundle holds no server secret. The reversed `phone` is the secret part of the hash. A signed `t` is bound to one path and one timestamp. If `phone` is null, `sign()` throws on `.split`. The segment hook treats null as `""`, which produces a signature the server rejects.

The formula was re-verified against a second asset, plus the three MP4s, a JPEG and an AAC from that course's `get-sub-info`. With the formula exactly as above, the playlist returns 200. Not reversing the phone, dropping the path's leading slash, or adding the host to the hash each give 403. Moving the `t` from `Video1.m3u8` onto a `.ts` or onto `VGA.m3u8` also gives 403. Sign every path separately.

There are two walls, and not every file type needs both:

- **Referer.** Its host must be `yanhekt.cn` or a subdomain (`https://aita.yanhekt.cn/`, `https://www.yanhekt.cn/`, `https://cbiz.yanhekt.cn/` and `http://aita.yanhekt.cn/` all give 200). `https://example.com/` or no Referer gives an nginx 403, before the file is looked up. `Origin` alone does not count. User-Agent does not matter.
- **`t`.** Required for `.m3u8`, `.ts` and `.mp4`. Not required for `.jpg` thumbnails or `.aac`, but those still get 403 without a Referer.

| `ts` relative to the signer's clock | Result |
|-|-|
| −3 hours | 200 |
| −4 hours | 403 |
| +10 seconds | 200 |
| +15 seconds | 403 |

The gaps between −3 and −4 hours and between +10 and +15 seconds were not bisected. Sign at request time. A sampled playlist had 447 segments and `#EXT-X-TARGETDURATION:22`, about 2.7 hours. Signing every segment up front would put the last ones right at the edge of that roughly 3-hour window. Segment lines are relative paths.

`.ts` lines in the playlist are unsigned. The same module patches `XMLHttpRequest.prototype.open`:

- `sign()` registers an entry only when the pathname matches `/\.m3u8$/i`. An entry stores `dir` (the path without the file name, keeping the trailing slash), `id`, `tenant_id` and `phone`. At most 30 entries; a repeated pathname replaces its entry.
- On every XHR whose pathname matches `/\.ts$/i` and starts with a registered `dir`, it signs a fresh `t` for that segment's own path with the identity of the longest matching `dir`. If nothing matches and there is exactly one entry, that entry is used. A URL that already has `t=` is left alone. `fetch()` is not patched.

So a player that loads over XHR (hls.js in Chromium; `CmcMediaPlayer` 4.9.x does) plays. A player that uses `fetch()`, or Safari's native HLS (whose segment requests never pass through the XHR hook), gets 403 on segments unless the caller signs them. The XHR hook signs only `.ts`. MP4 URLs have to be passed through `sign()` by the caller.

For `mutli-rate:` (spelled that way) bodies that contain `[`, the body is JSON. Each `item.url` is signed separately and the JSON is serialized back.

A missing file, once the Referer check has passed, is a **404** (seen on an old `/play/frim_files/…jpg`). A 403 is the wall, not a missing file.

Golden vector (made-up inputs, not a real request):

```
path  /play/2/vod3/2026/09/21/51230000/1/Video1/Video1.m3u8
id 10001   tenant 21   phone 13800138000 (reversed 00083100831)   ts 1700000000
raw   /play/2/vod3/2026/09/21/51230000/1/Video1/Video1.m3u81000121000831008311700000000
md5   8fe2ba7907c0093a7e04cd17e3a32e91
t     10001-1700000000-8fe2ba7907c0093a7e04cd17e3a32e91
```

| Content | URL | Needs |
|-|-|-|
| Teacher HLS | `/play/2/vod<N>/<Y>/<M>/<D>/<asset>/<n>/Video1/Video1.m3u8` | `t`, and every `.ts` needs its own |
| Screen HLS | `VGA/VGA.m3u8` in the same directory | `t`. No aita API lists it. Same path as cbiz `vga`. Segments are about 20 s |
| Teacher MP4 | `/play/frim_files/teacher<YYYY>/<date>/<date>/<HASH>_1080p.mp4` | `t` |
| Screen MP4 | `/play/frim_files/ppt<YYYY>/<date>/<date>/<HASH>_1080p.mp4` | `t`. About 700 MB per 95 minutes. Supports Range |
| Student camera | `/play/default/<Y>/<M>/<D>/<hash>_1920_1080.mp4` | `t` |
| Mic AAC | `/play/2/…/SubAudio/<HH_MM_SS_ms>.aac` | Referer, no `t` |
| Thumbnail | `…/Pic/…_1920_1080_0.jpg` | Referer, no `t` |
| Slide JPEG | `/ai-nginx/ai3/ppt/<YYYYMMDD>/<uuid>/<ms>.jpg` | Neither `t` nor Referer. See §7 |

`/ai-nginx/` is not under `/play/`, and the player does not sign it.

---

## 7. Server-side slides

### 7.1 `GET /pptnote/v1/schedule/search-ppt` A

Parameters `sub_id` (required), `course_id` (optional), `page`, `per_page`. Paging is ignored: every row comes back whatever `page` / `per_page` say, and `page=2` returns page 1 again. Do not use `total` to page.

Envelope `{code:0, msg, total, list}`. `total` is a number (46 for `3000101`). Rows are in time order. `content` is a JSON string.

```json
{
  "code": 0,
  "msg": "success",
  "total": 46,
  "list": [{
    "sub_id": "3000101",
    "course_id": "200101",
    "created_sec": 0,
    "default": 1,
    "old_id": 0,
    "create_time": "",
    "update_time": "",
    "content": "{\"detecttype\":\"ppt\",\"is_key\":false,\"pptimgurl\":\"https://aita.yanhekt.cn/ai-nginx/ai3/ppt/20260921/<uuid>/0.jpg\",\"pptthumb\":\"<same url>\",\"created\":0,\"status\":\"running\",\"taskid\":\"\"}"
  }]
}
```

A later row has `created_sec` 681 and file name `680900.jpg`. `created` = `created_sec` = the milliseconds in the file name ÷ 1000, ±0.5. `detecttype` is always `ppt`, `is_key` is always false, and `status` is always `"running"`, which does not mean processing is still going on. An empty result is `list: []`, `total: 0`, and `code` still 0. When there is exactly one row, in the samples it was a no-signal frame.

The JPEGs are 1280×720. A GET of `…/0.jpg` returns 200 `image/jpeg` (about 31 KB) with no Bearer, with no Referer, and with `Referer: https://example.com/`. They are served with `Access-Control-Allow-Origin: *`. Listing the uuid directory is a 404. The list needs a token, the images do not.

The site's player can seek to a slide's time, but there is no download-all button. The bundle's `download-sub-ppt` is covered in §9.

### 7.2 What the images show

Each JPEG is the full projected frame, not a crop of a camera. In the sample session the first three quarters were a Functional Analysis textbook open in Adobe Reader, and two rows 3 seconds apart were two different pages. Edge-map correlation against VGA HLS frames is 0.97–0.99: the same screen pixels, scaled to 720p.

The list is the raw output of change detection, with no deduplication and no cropping. A page that stayed up for 4 seconds still gets its own row.

### 7.3 Two screen MP4s

In the sample session, `segment_video_list[0].ppt_list` and `[1].ppt_list` (two different guids) are both 5938 s long, and `temp_config` is `{"two_record":"yes"}`. Compared frame by frame, the two have the same content, the same clock and the same offset. The second segment's `teacher_list` / `student_list` are empty.

### 7.4 Clocks

`created` is on the clock of the screen MP4 (`video_list` type 2), not of the VGA HLS. Measured on the sample session only (room A102):

| `created` | PPT MP4 #0 | PPT MP4 #1 | VGA HLS (`…/VGA/VGA.m3u8`) |
|--------:|------:|------:|------:|
| 681 | 678.5 (−2.5) | 678.5 (−2.5) | 693.5 (+12.5) |
| 2053 | — | — | ≤2049 (slide already on screen when the window opened) |
| 3602 | 3599.0 (−3.0) | 3599.0 (−3.0) | 3615.5 (+13.5) |
| 4819 | — | — | ≈4830.5 (+11.5, by eye) |
| 5021 | — | — | 5033.5 (+12.5) |

A slide appears on the screen MP4 about 2.5–3 s before its `created` (the detector's confirmation delay). In this session the VGA HLS runs about 15 s behind the screen MP4, so VGA time ≈ `created` + 12.5 s. cbiz's `start_vga` for this session is 21, which does not equal that gap, so the offset cannot be derived from `start_vga`. Other rooms were not measured.

### 7.5 Coverage

Across 19 recorded sessions of 10 courses in one teaching week:

- Slides: 11/19 had a real list (16–106 rows). 5 had 0 rows. 3 had exactly 1 row (the no-signal frame; a blackboard-only class is no-signal on the screen feed).
- Slides only appear after class. For one 08:00 class, 35 slides and the transcript were there by about 17:00 the same day. Live sessions have neither.
- Past terms are sparser; see §4.3.

---

## 8. Transcripts

### 8.1 `GET /courseapi/v3/web-socket/search-trans-result` A

Parameters `sub_id`, `format=json`.

With a transcript (`3000101`, 1 584 lines):

```json
{
  "code": 0,
  "msg": "获取同传结果成功",
  "total": 1,
  "list": [{
    "sub_id": "3000101",
    "resource_guid": "",
    "trans_type": "ainew",
    "zh_num": 22146,
    "en_num": 303,
    "en_rate": 1.35,
    "all_content": [
      { "BeginSec": 17, "EndSec": 18, "Text": "我们开始。", "TransText": "" },
      { "BeginSec": 81, "EndSec": 82, "Text": "好的。", "TransText": "" }
    ],
    "trans_content": "[{\"BeginSec\":17,\"Text\":\"我们开始。\",\"TransText\":\"\",\"EndSec\":18}]"
  }]
}
```

`all_content` and `trans_content` are the same array; the latter is serialized to a string (115 402 characters for this session). `BeginSec` / `EndSec` are whole seconds. Lines are roughly 4–6 s apart. This session ran about 1 h 40 min, with 1 584 lines from second 17 to 5937 and about 25 600 Chinese characters. `zh_num` counts characters, not lines. `total` is 1 (one transcript), not the line count.

No transcript: HTTP 200 `{ "code": 10002, "msg": "未查询到语音数据" }`.

The player's captions and the 「语音识别」 panel are this same data. `voice_live_gn` and `captions_live_gn` are two entries in the template. Students have no SRT download button.

### 8.2 Coverage and text quality

In the same survey, 16/19 sessions had a transcript; the missing ones answered `code` 10002. Live sessions have none. Past terms are sparse.

The text is raw speech recognition, and homophone substitutions are common. A maths class gets its terms wrong too: in the `searchlist` snippet above, 线性赋范空间 came out as 「线性附范空间」, and 一致收敛 can come out as 「一直收敛」.

`TransText` was `""` in every session checked, including a course taught in English (复变函数（全英文） appears in other calls with the same empty field). `enable_translation` is 0. One session had `en_num: 303` and `en_rate: 1.35` and still produced no `TransText`. No session with a filled `TransText` has been seen.

### 8.3 Timing

When you click a line, the player seeks the teacher camera stream (type 3) to `BeginSec`. In one manual check, the speech was heard about 4.5 s after that seek point, so speech ≈ `BeginSec + 4.5` on the teacher stream's clock. That direction was checked once and not repeated on other sessions.

The offset between the teacher stream and the VGA / screen MP4 was not measured. The two show different pictures, so slide correlation cannot align them.

---

## 9. Endpoints a student token cannot use

These were called on sessions that already had slides and a transcript. Each returned an empty success, and no student page calls them.

- `GET /courseapi/v2/intelligent-summary/detail?sub_id=&resource_guid=`. If it ever returned data, the typed rows would be `Summarization`, `Keywords`, `AutoChapters` (`Start` in milliseconds) and `QA`.
- `GET /courseapi/v2/intelligent-summary/chapters`
- `GET /courseapi/v2/deep-stream/get-trans-analyse` (summary, `words_cloud`, keywords)
- `GET /courseapi/v2/web-socket/search-keywords?sub_id=`
- `GET /courseapi/v3/knowledge-points/search-list?sub_id=`. If it returned data, it would be class segments / knowledge points / worked examples with `start` / `end`.
- `spidermaterial/spider-material/web/aitask/async/getPPTData`, `getAiBigData`, `getTongyiData`
- Exports: `…/rcourse/export/download-sub-ppt`, `download-sub-trans`, `download-sub-file`, and `spidermaterial/…/downloadSrt`

The slide bytes you can actually get are the JPEGs that `search-ppt` lists. The transcript text you can get is `all_content`.

The bundle also has a `wss://aita.yanhekt.cn/ws` socket with room names `live_ppt://<room>`. In a student's browser that socket is unstable (it reconnects and closes). Live sessions have no slide rows; slides are written after class.

Homework, courseware, attendance, bullet comments, inspection, forums and Q&A all have paths in the bundle. On the sessions checked, the matching fields were empty or this token could not read them. No student flow produced a response with content.
