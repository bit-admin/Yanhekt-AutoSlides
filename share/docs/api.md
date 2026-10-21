# Index API

The Index API answers questions about Yanhekt courses from our own copy of the catalogue: the `yanhekt-index` D1 database, which [`indexer/`](../../indexer/) fills by walking session ids without logging in. It is served by the share Worker on `share.ruc.edu.kg` under `/api/`.

It is deliberately small: it returns course ids and the few fields needed to show a match, plus each course's session ids. Everything else about a course or a session (times, titles, recordings) a client reads from Yanhekt itself, which serves it by id without login. Only the list of a course's sessions needs our crawl.

- **Read-only, no auth.** Access is limited at the edge: the zone's WAF challenges requests from outside the campus network, so a browser on campus (or one that has passed the challenge) can call it; a script off campus will get a challenge page, not JSON.
- **Our model, not Yanhekt's.** Terms are named by academic year and semester (`2026-2027-1`), never by Yanhekt's semester tag ids.
- **As fresh as the last upload.** The index is updated when a crawl is uploaded (at most a few times a day). Courses and sessions Yanhekt has not shown the crawler yet are missing.

## Paths

| Path | Status |
|---|---|
| `GET /api/search` | search courses in one term |
| `GET /api/courses/{id}/sessions` | a course's session ids |
| `/api/*` (anything else) | `404` |
| `/v1/…` | slides share viewer and its API, unchanged |
| `/v2/api/*` | the retired AutoSlides Index; always `503` |
| `/` | placeholder (`503`) until the new Index site is built |

The API is not versioned in the path. Changes will be additive (new fields, new parameters); a breaking change would move to new paths.

## `GET /api/search`

Finds **courses** (one row per course offering, i.e. one section in one term) in **one term**. Searching all terms, or several at once, is not supported: a client asks term by term.

```
GET /api/search?q=电路分析&term=2026-2027-1
```

### Parameters

| Name | | |
|---|---|---|
| `q` | **required** | 2–64 characters, at most 6 words, and at least one word of 2+ characters. Empty searches are refused. |
| `term` | **required** | exactly one term key, e.g. `2026-2027-1` |

Other parameters are ignored. There is no paging: one response holds the best 200 matches, and `total` says how many there are.

### How `q` matches

`q` is lowercased and split into words at spaces and punctuation, and also where Chinese meets Latin letters or digits: `Java程序设计` is the two words `java` and `程序设计`. Every word must match the course, in the requested term:

| Word | Matches | `match.fields` |
|---|---|---|
| Chinese (2+ characters) | the course name or a teacher's name **contains** it | `name`, `teacher` |
| Latin letters / digits (2+ characters) | a word of the course name or of a teacher's name **starts with** it | `name`, `teacher` |
| 1 character | only narrows what the other words found | |

Two whole-query identifiers match in **any** term (the result's `term` says which):

| Query | Matches | `match.fields` |
|---|---|---|
| a course's registrar code (`number`), exactly, ignoring case | that course | `number` |
| a course id (digits), or a pasted `yanhekt.cn/course/{id}` link | that course | `id` |

So `大学物理 孙四美` finds 大学物理 courses taught by 孙四美. English course names, course codes (shared by every class of a subject) and session ids are not searchable; a pasted session link is refused with `bad-param`.

The registrar code is cbiz's `number`, which equals Yanhe 2.0's `kcwybm`, so pasting a `kcwybm` finds the matching Yanhekt course. Its formats vary (`20262027110099010101`, `202620271MTH1000112`, `20261-17-1709901-1781234567890`, 32 hex); it is matched as a whole string, never split or prefix-matched, like cbiz's own `keyword`.

**Order.** An id or registrar code match ranks first. Otherwise each word scores by where it hit (exact name > exact teacher > name prefix > name contains > teacher contains). Scores add up across words; a query that spells out the whole course name gets a bonus. Ties go to name order (pinyin), then the newer course id.

### Response `200`

```jsonc
{
  "query": { "q": "电路分析", "term": "2026-2027-1" },  // the search as understood (normalized)
  "total": 32,                     // all matches; results holds at most 200
  "truncated": false,              // true: over 5000 courses matched the words; only the newest 5000 were ranked
  "results": [
    {
      "id": 12345,                                 // Yanhekt course id
      "name": "电路分析基础",
      "number": "202620271199999999CX02",          // registrar code; = Yanhe 2.0 kcwybm; or null
      "term": "2026-2027-1",                       // or null
      "teachers": ["周五"],                      // names only; may be empty
      "sessionCount": 4,                           // session ids in the index
      "match": { "fields": ["name"] }
    }
  ]
}
```

No matches is a normal `200` with `total: 0` and empty `results`.

## `GET /api/courses/{id}/sessions`

```
GET /api/courses/12345/sessions
→ { "course": 12345, "sessions": [100101, 100102, 100103, 100104] }
```

The ids of the course's sessions, ascending. Fetch each session from Yanhekt (`/v1/course/session?session_id=`, no login) for its times, title and recordings. The list can lag behind Yanhekt for the newest days, and a session Yanhekt deleted may stay listed until the indexer notices. `404 not-found` for a course the index does not have.

## Errors

Errors are JSON with a stable `error` code and a human `message`; parameter errors also name the `param`.

| Status | `error` | When |
|---|---|---|
| 400 | `query-required` | `q` missing or blank |
| 400 | `query-too-short` | fewer than 2 characters, or no word of 2+ characters |
| 400 | `query-too-long` | over 64 characters or 6 words |
| 400 | `term-required` | `term` missing |
| 400 | `bad-param` | any other invalid parameter (see `param`): several terms, a malformed term, a session link, a non-numeric course id |
| 404 | `not-found` | unknown `/api/` path, or unknown course |
| 405 | `method-not-allowed` | not `GET` |
| 500 | `internal` | the database failed; retry later |
| 503 | `retired` | `/v2/api/*` (the old Index) |

```json
{ "error": "term-required", "message": "term is required, e.g. term=2026-2027-1", "param": "term" }
```

## Caching

Every upload to the index sets a new data version. Answers are cached at the edge under the normalized request plus that version, so a repeated request is served from cache until the next upload, then answered fresh. Browsers may reuse a response for 5 minutes (`Cache-Control: public, max-age=300`). CORS is open (`Access-Control-Allow-Origin: *`).

## Data source

The `yanhekt-index` D1 database, in the layout the indexer writes (`indexer/src/d1model.ts`; see the indexer README, "D1 layout"). The Worker only reads it, through the `YANHEKT_DB` binding.

| Table | Used for |
|---|---|
| `course_grams` | finding candidates: search keys by primary key `(term, gram, course_id)`, so a search reads only its term's entries |
| `courses` | what results show, and each course's `session_ids` |
| `meta` | the data version (`data`) that cache keys carry; read at most once a minute per Worker instance |

A search never scans a table. It reads at most 33 entries per search key, then fetches the candidate courses of the rarest key. Only when every key is common in that term does it intersect all of their entries. On this term's data that is about 100–500 rows read for a typical search and about 1,200 at most, well within D1's free plan of 5M rows read per day.
