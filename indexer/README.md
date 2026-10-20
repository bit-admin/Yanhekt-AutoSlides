# Yanhekt session indexer

A local script that walks Yanhekt session ids **without logging in** and stores everything the public API returns: session details, the course, the teacher, the live record and the recorded stream URLs. It runs only inside a nightly window (02:00–05:00 Beijing time by default), at about one request per second.

Why: since 2026-10 Yanhekt's course list and search only show the current term, so older courses can no longer be found by name. Any course can still be opened by id, and session ids can be read one by one without a login. This index makes old courses findable again.

## Requirements

- Node.js **22.18 or newer**. Node runs the TypeScript files directly and has SQLite built in, so there are no runtime dependencies to install.
- `npm install` is only needed for `npm run typecheck`.

## Quick start

```sh
cd indexer
npm run now -- --minutes 5      # try it right now, ignoring the window
npm run status                  # see what was stored
npm start                       # the real thing: wait for 02:00 UTC+8, crawl until 05:00, repeat every night
```

The database is `./data/yanhekt-index.db` (change it with `--db`). Stopping is always safe: Ctrl-C finishes the current request, saves, and exits. The next start continues where it stopped.

## Keeping it running

`npm start` is a long-running process that sleeps outside the window. Pick one:

- **tmux / screen**: `tmux new -s indexer 'npm start'`.
- **systemd** (Linux): a service with `WorkingDirectory=…/indexer`, `ExecStart=/usr/bin/npm start`, `Restart=on-failure`.
- **launchd** (macOS): `ProgramArguments` = `npm start`, `KeepAlive` = true.
- **cron / Task Scheduler instead of a long-running process**: start `node --disable-warning=ExperimentalWarning src/cli.ts run --once` at 02:00 Beijing time. It crawls until the window closes, then exits.

The window is checked against Beijing time whatever your computer's time zone is. Change it with `--window 1-6`; it may wrap past midnight (`--window 23-2`). If the computer sleeps through the window, the run resumes the next night.

## Options

| Option | Default | Meaning |
|---|---|---|
| `--db PATH` | `./data/yanhekt-index.db` | SQLite file |
| `--window A-B` | `2-5` | Crawl window, Beijing hours, `[A, B)` |
| `--once` | off | `run`: exit after one window |
| `--minutes N` | `10` | `now`: how long to crawl |
| `--interval-ms N` | `1000` | Time between request starts (minimum 250) |
| `--max-requests N` | `0` (no cap) | Cap per window / per `now` run |
| `--batch N` | `25` | Session ids per round; each round is one transaction |
| `--initial-id N` | `932000` | Where both lanes start on a fresh database |
| `--floor-id N` | `1` | Backfill stops below this id |
| `--no-videos` | off | Skip `/v1/video` (no stream URLs; about twice as fast) |
| `--no-course-detail` | off | Skip `/v1/course` and the teacher list; keep only the course copy that comes with each session |
| `--gap-threshold N` | `150` | Missing ids in a row before probing ahead |
| `--probe-step N` / `--probe-count N` | `500` / `20` | How far probes look past a hole |
| `--refresh-days N` | `14` | Re-check sessions that ended within N days and still have no video |
| `--user-agent S` | identifies this project | User-Agent header |
| `-q` | off | Log only progress lines and errors |

## How it works

### Which endpoints

All four work without a login. The session list endpoint (`/v2/course/session/list`), which needs a login, is **never** called.

| Endpoint | Gives | Not-found code |
|---|---|---|
| `GET /v1/course/session?session_id=` | session, its course, its live broadcast | `12121010` |
| `GET /v1/video?id=` | camera / screen / room / mic URLs, duration, offsets | `13121010` |
| `GET /v1/course?id=` | full course detail (tags, college, introduction) | `12111010` |
| `GET /v1/course/professor/list?course_id=` | teachers | `12111010` |

Requests send the official `Origin` (a different Origin gets HTTP 403) and an honest User-Agent naming this project.

### How session ids are laid out

Measured in 2026-10:

- Ids start at 1 (March 2021) and only go up, about 70–80k per term. Each term begins at roughly: 463k (2023 autumn), 543k, 605k, 678k, 743k (2025 autumn), 823k, 893k (2026 autumn). The newest id was about 932k on 2026-10-20.
- Ids are created **one teaching week at a time, about a week ahead**, in blocks of about 4,500–6,000. Inside a block they are roughly sorted by course id, so a course's sessions sit about one block apart from week to week.
- About 10% of ids are missing (deleted), sometimes in long runs of up to ~10k. Cancelled sessions exist with `state = 0` and no video.

### Two lanes

- **forward** starts at `--initial-id` and goes up. When it runs into a long run of missing ids, it probes 20 points over the next 10k ids. If none exist, it has reached the newest id: it steps back to the start of the run and parks until the next night, so ids created during the week are picked up later.
- **backfill** starts just below `--initial-id` and goes down to `--floor-id`, newest term first, so the most useful history arrives first. Long holes are skipped with the same probes, and each skipped range is written to `gaps`.

Each round reads a batch of ids, then the stream URLs and course details those sessions point to, and every 10th round re-checks lectures that ended recently without a video. A round is one SQLite transaction, so a crash or Ctrl-C never moves the saved position past data that wasn't saved.

Errors: a network error, timeout, HTTP error or "系统繁忙" saves what was done and backs off (30 s, 1 min, 2 min … up to 15 min). After 6 failures in a row it stops for the night. An unknown response code is written to `failures` and skipped; 5 in a row count as an error. Only one process can use a database at a time (`<db>.lock`).

### How long it takes

At the default 1 request/second, a 3-hour window is about 10,000 requests. One session id costs about 1.9 requests (the session, usually one video, and a course now and then), so that is roughly 5,000 ids a night:

| Scope | Ids | Nights at default | Nights with `--no-videos` |
|---|---|---|---|
| One term | ~75k | ~14 | ~8 |
| Since 2023 autumn | ~470k | ~90 | ~50 |
| Everything | ~930k | ~170 | ~95 |

The forward lane keeps up with new sessions in a few minutes each night (about 700 new ids a day). Going faster than the default is possible with `--interval-ms`, but please don't: this is a shared university service.

## Data

One SQLite file. API fields keep their API names as columns. Any field we don't know yet goes into an `extra` JSON column, so nothing is dropped if Yanhekt adds fields. Yanhekt times (`started_at` …) are Beijing-time text as sent; our own `*_at` bookkeeping columns are epoch milliseconds.

| Table | Key | Contents |
|---|---|---|
| `sessions` | session id | every session field, `video_ids` (JSON), `live_id`; `refreshed_at`, `gone_at` |
| `courses` | course id | course fields (`tags`, `college`, `introduction` as JSON), `professor_list` (JSON), `professor_names`, `detail_status` |
| `videos` | video id | `main`, `vga`, `room`, `audio` (+ `*_origin`), `duration`, `start_*`, `session_id`, `status` |
| `lives` | live id | the broadcast record, `target*` URLs (dead after the lecture), `session_id` |
| `pending_videos` | video id | queued `/v1/video` lookups |
| `gaps`, `failures`, `runs`, `crawl_state` | — | skipped ranges, errors, one row per run, lane positions |

Storage is roughly 1.5–2 KB per session including its live and video rows, so 1.5–2 GB for the full history.

Example queries (`sqlite3 data/yanhekt-index.db`, or any SQLite viewer):

```sql
-- Find an old course by name or teacher
SELECT id, name_zh, school_year, semester, professor_names
FROM courses WHERE name_zh LIKE '%女性权益%' OR professor_names LIKE '%裴%';

-- Every recorded lecture of a course, with stream URLs
SELECT s.id, s.title, s.started_at, v.main, v.vga, v.audio
FROM sessions s LEFT JOIN videos v ON v.session_id = s.id
WHERE s.course_id = 64333 AND s.state = 1
ORDER BY s.started_at;
```

`main` / `vga` are the unsigned URLs, the same ones the session list returns. They play through the normal path-encrypt + signature flow (see `docs/architecture.md` §9.6). `audio` plays as is.

## Cloudflare D1

D1 is SQLite, so the same tables work unchanged. To publish the index:

```sh
npx wrangler d1 create yanhekt-index
npm run dump -- --out ./d1-dump        # SQL files of at most 50 MB each (--max-mb)
for f in d1-dump/*.sql; do npx wrangler d1 execute yanhekt-index --remote --file="$f"; done
```

The full history (~2 GB) needs Workers Paid; the free plan allows 500 MB per database. A dump is meant for a fresh database: `gaps` and `failures` have no unique key, so importing twice duplicates those rows (the other tables replace by id).

## Behind a proxy

Node's built-in `fetch` ignores `HTTPS_PROXY` unless asked. If every request times out and you need a proxy, run with `NODE_USE_ENV_PROXY=1` (Node 22.21+), plus `NODE_EXTRA_CA_CERTS=<ca.pem>` if the proxy re-signs TLS.

## Development

```sh
npm test            # node:test, no install needed
npm install && npm run typecheck
```

`src/crawler.ts` is the crawl logic (lanes, probes, rounds); `src/store.ts` is SQLite; `src/schema.ts` lists every column once, and the schema, the upserts and `dump` are all built from it; `src/yanhekt.ts` is the HTTP client; `src/cli.ts` handles the window loop, locking and backoff.
