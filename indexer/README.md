# Yanhekt session indexer

A local script that walks Yanhekt session ids **without logging in** and records, for every lecture, which course it belongs to. It runs in a nightly window (02:00–05:00 Beijing time by default) at about one request per second, stores everything in a local SQLite file, and can upload it to Cloudflare D1 so several devices can contribute to one index.

**Why:** since 2026-10, Yanhekt's course list and search only show the current term, so older courses can't be found by name. Any course or session can still be opened by id without logging in. This index makes the old ones findable again.

## What it stores

By default it makes two kinds of request, both without login:

| Request | When | Gives |
|---|---|---|
| `GET /v1/course/session?session_id=` | every id | the session (title, week, time, room, `state`, **`video_ids`**) and a copy of its course |
| `GET /v1/course?id=&with_professor_badges=true` | once per new course | full course details: **teachers**, tags, college, image, introduction |

Every field of both responses is kept, in its own column, or in an `extra` JSON column if it's a field we don't know yet. Three are dropped: the session's `live` (the live-broadcast record, whose stream URLs only work during the lecture), the session's `user_progress` and the course's `user_mapping_type` (both always empty without login). The course copy inside each session response is stored once and then replaced by the fuller `/v1/course` record, so no request is spent twice.

That is enough to find any course by name or teacher and list all its sessions. The recorded URLs (camera, screen, mic) are **not** in the session response, only the `video_ids`. Your client resolves them when a lecture is played (`GET /v1/video?id=`, no login), or the index can fill them in later with `--only-videos`.

The login-only session list (`/v2/course/session/list`) is never used.

## Quick start

Needs Node.js **22.18 or newer**. Node runs the TypeScript directly and has SQLite built in, so there is nothing to install.

```sh
cd indexer
npm run now -- --minutes 5      # try it right now, ignoring the nightly window
npm run status                  # what is stored, where each lane is
npm start                       # the real thing: crawl 02:00–05:00 UTC+8, every night
```

Data goes to `./data/yanhekt-index.db` (`--db` to change). Ctrl-C is always safe: it finishes the current request, saves and exits. The next start continues where it stopped.

## Choosing what to crawl

**Default:** two lanes.

- **forward** starts at `--initial-id` (932000, the newest id on 2026-10-20) and moves up, following new sessions as Yanhekt creates them. Once it reaches the newest id, it waits until the next night.
- **backfill** moves down from just below the same point to `--floor-id` (1), newest term first.

`--backfill-only` runs only the backfill lane, so the whole run goes to older terms; the forward lane keeps its position for a later run without the flag. On Actions, tick **backfill_only**.

**A specific range:** `--from A --to B` crawls exactly A→B, in either direction, and nothing else. `--from A` alone goes upward until the newest id. Running the same command again continues from the saved position, and once the range is finished `run` exits. `--restart` throws away the saved position for the selected lane(s) and starts over.

Approximate first session id of each term (useful for `--from` / `--to`):

| Term | First id | | Term | First id |
|---|---|---|---|---|
| 2026-2027 第一学期 | ~893,000 | | 2024-2025 第一学期 | ~605,000 |
| 2025-2026 第二学期 | ~823,000 | | 2023-2024 第二学期 | ~543,000 |
| 2025-2026 第一学期 | ~743,000 | | 2023-2024 第一学期 | ~463,000 |
| 2024-2025 第二学期 | ~678,000 | | (2021-03) | 1 |

For example, `npm start -- --from 822999 --to 743000` covers all of 2025–2026 term 1, newest first.

## Progress

- **End of every run:** a report with requests made, sessions found, each lane's position, % of its range done, ids left, an estimate of how many more runs it needs, and the command to continue. For example:
  ```
  stop (deadline): 10012 requests, 8410 sessions found, 1093 missing, 512 courses, 0 videos
    range:822999:743000      next id 813496, 11.9% of 822999→743000 (70497 ids left), ≈8 more run(s) at this pace; this run 9503 ids
    database: 8410 sessions (ids 813497–822999), 1903 courses, 0 video URLs, 0 queued
    to continue: run the same command again (--from 822999 --to 743000); it resumes at the saved position
  ```
- **`npm run status`:** totals, every saved lane, sessions/courses per term, upload positions, recent runs.
- **`npm run status -- --remote`:** what D1 holds, per term, and where **every device** was at its last upload.

## Several devices and Cloudflare D1

Each device crawls into its own SQLite file and uploads to one shared D1 database. Uploads only send courses that changed since that device's last upload to that database (a new session changes its course). Courses are merged by id: a full course record beats the thinner copy that comes with a session, and otherwise the newer fetch wins; session id lists are combined, minus sessions a device knows are gone. So devices can upload overlapping data in any order.

**D1 is not a copy of the local database.** It holds a slim layout with only what the Index serves (see [D1 layout](#d1-layout)), sized for D1's free plan. The local SQLite keeps every field, so D1 can gain a field later without recrawling.

**One-time setup:**

1. `npx wrangler d1 create yanhekt-index` (or dashboard → D1 → Create). Note the database id.
2. Dashboard → My Profile → API Tokens → Create Token → Custom token with **Account · D1 · Edit**.
3. On each device: `cp .env.example .env` and fill in `CF_ACCOUNT_ID`, `CF_D1_DATABASE_ID`, `CF_API_TOKEN`. `.env` is git-ignored.

**Uploading:**

```sh
npm run upload                          # creates the tables on first use, then sends what changed
npm run upload -- --reset               # once, after the D1 layout changed: drop D1's tables and send everything
npm start -- --upload                   # or: upload automatically after each night's crawl
npm run status -- --remote              # check the shared result
```

Give each device a different range so they don't repeat each other's work. Run the default lanes (which follow new sessions) on one device only:

```sh
# device A: follows new sessions every night, backfills the current term
npm start -- --floor-id 893000 --upload --device desk
# device B: last academic year
npm start -- --from 892999 --to 743000 --upload --device laptop
# device C: the year before
npm start -- --from 742999 --to 605000 --upload --device server
```

`--device` is the name shown in `status --remote` (default: the computer's hostname). The first upload of a big database takes a while (≤ 200 statements / 800 KB per request). If it's interrupted, or D1 refuses because the daily write limit is reached, the next `upload` continues where it stopped.

Each upload stops before writing more than `--max-writes` rows (default 90,000, under the free plan's 100k a day), sending the newest courses first, so the current term goes in on the first day and older terms follow on the next uploads. `--max-writes 0` removes the limit (paid plan). No API token? `npm run upload -- --wrangler` sends the same batches through `wrangler d1 execute --remote` with your `wrangler login`, slower but otherwise the same.

Prefer wrangler? `npm run dump -- --out ./d1-dump` writes the same statements as SQL files: `for f in d1-dump/*.sql; do npx wrangler d1 execute yanhekt-index --remote --file="$f"; done`. With `--local` instead of `--remote` it fills wrangler's local D1, for trying the Index locally (`wrangler dev` in `share/`). Add `--reset` to the dump to drop the old tables first.

**Free plan budget** (500 MB, 100k rows written and 5M rows read per day; every index entry counts as a written row). Measured on 2026-27 term 1 (39k sessions, 4.4k courses; 1.9 MB in D1):

| | Per course | Full history (~900k sessions, ~50k courses) |
|---|---|---|
| Size | ~440 B (row, session ids, search keys) | ~25 MB |
| Rows written | ~10 the first time (row + ~9 search keys); 1 each later upload that brings it new sessions | ~0.5M once, i.e. ~5–6 days at the daily limit; then ~50k per new term plus a few thousand per daily upload |
| Rows read per search | ≤ 33 per search key, then the candidates; all of each key's entries in the term only when every key is common | ~100–500 typical, ~1.2k worst seen |

Video URLs are never uploaded.

## Running on GitHub Actions

The **Indexer** workflow (`.github/workflows/indexer.yml`) runs the same crawler on a GitHub runner for up to about 5 h 40 min, with no time window. When it finishes, the database is available to download, and you merge it into your local one.

### Setup (once)

1. The workflow must be on the repository's **default branch** before it appears under *Actions* (GitHub only lists manually started workflows from there).
2. Optional repository secrets (*Settings → Secrets and variables → Actions*):
   - `INDEX_ARTIFACT_PASSPHRASE`: encrypts the downloadable database. **Set this if the repository is public.** Artifacts of a public repository can be downloaded by anyone signed in to GitHub.
   - `CF_ACCOUNT_ID`, `CF_D1_DATABASE_ID`, `CF_API_TOKEN`: only if you want runs to upload to D1 directly.

### Starting a run

*Actions → Indexer → Run workflow*, or with the GitHub CLI:

```sh
gh workflow run indexer.yml -f from=822999 -f to=743000 -f minutes=330
```

| Input | Default | |
|---|---|---|
| `from` / `to` | empty | range to crawl, same as `--from` / `--to`. Both empty = default lanes |
| `minutes` | 330 | crawl time, max 340 (leaves room for setup and upload within GitHub's 6-hour limit) |
| `mode` | sessions | `sessions`, `sessions-and-videos` or `videos-only` |
| `interval_ms` | 1000 | time between requests |
| `backfill_only` | off | default lanes only: skip the forward lane, spend the run on older terms |
| `continue_from_run` | empty | run id of an earlier Indexer run: download its database and keep going |
| `upload_to_d1` | off | also upload to D1 at the end (needs the `CF_*` secrets) |

The run first checks that Yanhekt answers from GitHub's network (runners are outside China) and stops at once if not. At the end, the run page's summary shows the crawl report, the database status and the exact inputs to continue.

### Long crawls: chaining runs

One run of 330 minutes at 1 request/second is about 19,000 requests, roughly 17,000 session ids, so a term (~75k ids) takes 4–5 runs. To continue, start the workflow again with the **same `from` / `to`** and `continue_from_run` set to the previous run's id (shown in its summary and URL). The new run downloads the previous database, resumes the range where it stopped, and its artifact contains everything so far. You only need to download the last one.

Two runs over **different** ranges can run at once; download both and merge both. Please don't run more than two at a time: each one adds a request per second to a university service.

### Downloading and merging

```sh
# from the run page (Artifacts → yanhekt-index), or:
gh run download <run-id> -n yanhekt-index -D artifacts/<run-id>

# if INDEX_ARTIFACT_PASSPHRASE is set (on Windows, use Git Bash):
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in artifacts/<run-id>/yanhekt-index.db.gz.enc | gunzip > run-<run-id>.db
# if not:
gunzip -c artifacts/<run-id>/yanhekt-index.db.gz > run-<run-id>.db

npm run merge -- run-<run-id>.db       # several files at once is fine
npm run upload                         # optional: push the merged rows to D1
```

`merge` uses the same rules as D1: new rows are added, a full course record replaces a thin copy, and nothing is downgraded. Merged rows are marked as changed, so your next `upload` includes them. Merging the same file twice is harmless.

### Things to know

- Artifacts are kept for **30 days**. Download or chain runs before then. Private repositories count artifacts against the account's Actions storage quota.
- GitHub's terms say Actions are for work related to the repository's software project. This index feeds the app's course lookup, but it's your call whether that fits your use.
- If the run is cancelled or crashes, the database is still packaged and uploaded with whatever was saved, and the range can be continued from it.

## Filling in video URLs later

```sh
npm run now -- --only-videos --minutes 60    # only /v1/video for stored sessions, no scanning
npm start -- --only-videos                   # same, nightly, exits when all are done
npm start -- --videos                        # scan as usual AND fetch URLs as it goes
```

Both modes first queue every stored `video_ids` entry that has no URL yet, so sessions crawled earlier are covered. About 0.8 requests per session id.

## How long it takes

At 1 request/second, a 3-hour night is about 10,000 requests. One session id costs about 1.1 requests (the session, plus `/v1/course` for each new course), so that's roughly 9,000 ids a night:

| Scope | Ids | Nights (one device) |
|---|---|---|
| One term | ~75k | ~8 |
| Since 2023 autumn | ~470k | ~52 |
| Everything since 2021 | ~930k | ~105 |

Split across devices, it goes proportionally faster. Please don't raise the rate (`--interval-ms`): this is a shared university service.

## Keeping it running

`npm start` is a long-running process that sleeps outside the window. Use tmux (`tmux new -s indexer 'npm start'`), systemd (`ExecStart=/usr/bin/npm start`, `Restart=on-failure`), or launchd (`KeepAlive`). Alternatively, use cron or Task Scheduler at 02:00 Beijing time with `node --env-file-if-exists=.env --disable-warning=ExperimentalWarning src/cli.ts run --once`, which crawls until the window closes and then exits.

The window is always Beijing time, whatever the computer's time zone. Use `--window 1-6`, or one that wraps past midnight like `--window 23-2`.

## All options

| Option | Default | |
|---|---|---|
| `--from A` / `--to B` | — | crawl only this range (see above) |
| `--restart` | off | forget the saved position of the selected lane(s) |
| `--initial-id N` / `--floor-id N` | 932000 / 1 | default lanes: start point (fresh database only) / backfill stop |
| `--videos` / `--only-videos` | off | also / only fetch recorded URLs |
| `--no-course-detail` | off | skip `/v1/course`; keep only the course copy from each session (no teachers or tags) |
| `--window A-B` | 2-5 | crawl window, Beijing hours `[A, B)` |
| `--once` | off | `run`: exit after one window |
| `--minutes N` | 10 | `now`: how long |
| `--interval-ms N` | 1000 | time between request starts (minimum 250) |
| `--max-requests N` | 0 (no cap) | per window / per `now` run |
| `--batch N` | 25 | ids per round; each round is one transaction |
| `--upload` | off | upload after each crawl |
| `--device NAME` | hostname | name in the D1 progress table |
| `--remote` | off | `status`: show D1 |
| `--reset` | off | `upload` / `dump`: drop D1's tables first and send everything |
| `--wrangler` | off | `upload` / `status --remote`: go through `wrangler d1 execute --remote` (your `wrangler login`) instead of `CF_API_TOKEN`; `--wrangler-db` (default `yanhekt-index`) and `--wrangler-cwd` (default `../share`) |
| `--max-writes N` | 90000 | `upload`: stop before writing more than N D1 rows, newest courses first; 0 = no limit |
| `merge FILE…` | — | command: merge other index files (e.g. Actions artifacts) into this one |
| `--db PATH` | ./data/yanhekt-index.db | |
| `--gap-threshold`, `--probe-step`, `--probe-count` | 150, 500, 20 | hole skipping (see below) |
| `--refresh-days N` | 14 | re-check recent sessions that had no video id yet |
| `--user-agent S` | names this project | |
| `-q` | off | only progress lines and errors |

## How it works

**How session ids are laid out** (measured 2026-10):

- Ids only go up, about 70–80k per term.
- They are created one teaching week at a time, about a week ahead, in blocks of 4,500–6,000, roughly sorted by course id inside a block.
- About 10% of ids are missing, sometimes in deleted runs of up to ~10k.
- Cancelled sessions exist with `state = 0` and no video ids.

**Holes:** after 150 missing ids in a row, a lane probes ahead (20 probes, 500 apart). If a probe finds a session, the lane jumps there and records the skipped range in `gaps`. If no probe finds anything:

- an upward lane has reached the newest id. It steps back to the start of the missing run, so ids created later are not skipped, then waits (default lanes) or finishes (ranges).
- a downward lane skips that span.

**Rounds:** each round scans 25 ids, then fetches the course details (and video URLs, if enabled) they queued. Every 10th round it re-checks lectures that ended 2 h–14 days ago with no video id yet, since sessions are created before they happen. Each step is one SQLite transaction, so the saved position never runs ahead of the saved data.

**Errors:**

- A network error, timeout, HTTP error, 系统繁忙 or the maintenance answer (code 99151011) keeps the work done so far and backs off (30 s, 1, 2 … 15 min). After 6 failures in a row the run stops for the night.
- Any other response code (for example 2002 "service runtime exception", which Yanhekt sends at random while unstable) is asked again up to 3 times. If it persists, the id goes to `failures` and the scan moves on; 5 such ids in a row count as one error. Failed session ids are tried again an hour or more later (about 1 in 25 requests goes to this), up to 6 times, and stored once they answer.
- Only one process can use a database file at a time (`<db>.lock`), and that includes `upload`.

## Data

### Local database

API fields keep their API names as columns. Fields we don't know yet go into an `extra` JSON column, so nothing is lost if Yanhekt adds fields. Yanhekt times (`started_at` …) are Beijing-time text as sent; our own `*_at` columns are epoch milliseconds.

| Table | Contents |
|---|---|
| `courses` | course fields (`tags`, `college`, `professors`, `introduction` as JSON), `professor_names` (e.g. `张三、李四`), `detail_status` |
| `sessions` | every session field, `video_ids` (JSON array), `gone_at` |
| `videos` | `main`, `vga`, `room`, `audio` (+ `*_origin`), `duration`, `start_*`, `session_id` (only with `--videos` / `--only-videos`); never uploaded |
| `pending_videos`, `gaps`, `failures`, `runs`, `crawl_state` | device-local queue, logs, positions |

Example queries (`sqlite3 data/yanhekt-index.db`):

```sql
-- Find an old course by name or teacher
SELECT id, name_zh, school_year, semester, professor_names
FROM courses WHERE name_zh LIKE '%女性权益%' OR professor_names LIKE '%裴%';

-- All recorded sessions of a course, with their video ids
SELECT id, title, started_at, location, video_ids
FROM sessions WHERE course_id = 64333 AND state = 1 AND video_ids <> '[]'
ORDER BY started_at;
```

### D1 layout

Defined in `src/d1model.ts` (layout version 3, kept in D1's `meta` table). `upload` and `dump` convert local rows into it; the share Worker's Index API reads it.

| Table | Contents |
|---|---|
| `courses` | `name` (Chinese), `number` (the registrar code; equals Yanhe 2.0's `kcwybm`, so it matches courses between the two sites, see `docs/aita-yanhekt.md` §4), `term` (our key, e.g. `2026-2027-1`), `teachers` (JSON array of names; no titles or staff numbers), `session_ids` (JSON array, ascending), `detail`, `fetched_at` |
| `course_grams` | the search index, keyed by `(term, gram, course_id)`: CJK 2-character pieces of the course name and teacher names, `w:` + other words of those, and `n:` + registrar code under the empty term (found in any term) (`src/grams.ts`) |
| `meta` | `schema` (layout version) and `data` (changed by every upload that sent something; the Index API keys its cache by it) |
| `device_progress` | each device's lanes and totals at its last upload |

There is no sessions table: a client reads a session's details from Yanhekt (`/v1/course/session`, no login); only the list of a course's sessions needs the crawl. Left out on purpose: English names, session details, teacher titles, colleges, undergraduate/graduate level, course categories, video URLs, room codes, staff numbers, images, introductions, and the crawler's own bookkeeping.

What each device last sent is kept locally in `d1_sent` (a hash of each course's D1 row and of its search keys, per D1 database); `--reset` clears it for that database.

## Behind a proxy

Node's built-in `fetch` ignores `HTTPS_PROXY` unless asked. If every request times out and you need a proxy, set `NODE_USE_ENV_PROXY=1` (Node 22.21+), plus `NODE_EXTRA_CA_CERTS=<ca.pem>` if the proxy re-signs TLS.

## Development

```sh
npm test                           # node:test, nothing to install
npm install && npm run typecheck
```

| File | Role |
|---|---|
| `src/crawler.ts` | lanes, probes, rounds |
| `src/store.ts` | SQLite |
| `src/schema.ts` | local database: every column, listed once; `merge` rules |
| `src/d1model.ts` | D1 layout, conversion from local rows, D1 merge rules |
| `src/grams.ts` | search keys; also imported by the share Worker |
| `src/remote.ts` | D1 HTTP client and upload |
| `src/dump.ts` | the D1 layout as SQL files |
| `src/yanhekt.ts` | Yanhekt client and pacing |
| `src/cli.ts` | commands, window loop, lock, backoff, end-of-run report |
