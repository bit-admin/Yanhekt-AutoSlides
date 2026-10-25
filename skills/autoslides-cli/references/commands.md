# Command reference

Every command takes `--json` and `-h/--help`. `autoslides schema` and `yhdl schema` print this as JSON from the code itself; when the two disagree, trust `schema`.

## `autoslides` (drives the app)

| Command | Arguments and options | Sign-in | `data` with `--json` |
|---|---|---|---|
| `search <keyword…>` | `--term <term>` (e.g. `2025-2026-1` or a name from `terms`; default the current term), `--limit <1-100>` (default 20), `--page <n>` | yes | the courses found, with paging, and `source`: `yanhekt`, `local` or `online` |
| `mine` | `--limit`, `--page` | yes | the account's enrolled courses, plus `account: {name, badge}` |
| `course <course id or link>` | `--no-sessions` | yes | the course, its `sessions` (each with `id`), plus `account` |
| `session <session id or link>` | — | yes | the session and which recordings it has |
| `terms` | — | yes | `{ terms }`, the values `search --term` accepts: the current term (`current: true`) and every earlier one back to `2023-2024-1` |
| `whoami` | — | yes | `{ signed_in: true, account, badge }` |
| `download <session…\|->` | `-s/--stream screen\|camera\|both` (default screen), `--course <id or link>`, `--dry-run`, `-f/--force`, `--no-wait` | yes | `{ output_dir, dry_run, waited, items: [Item] }` |
| `downloads [action] [row…]` | actions `list` (default), `wait`, `cancel`, `retry`, `clear`; `--all` with cancel or retry | only `retry` | see below |
| `config [key [value]]` | — | no | see below |
| `schema` | — | no | the full contract |

With no arguments, `autoslides` just opens the app.

### Where `search` looks

The current term is searched on Yanhekt, unless the app's Settings > General > Search picks the course index for it. Earlier terms (back to `2023-2024-1`) always come from the course index: the copy on this computer, then the AutoSlides Index online (or online only, per that setting). Index results have no `title_en`, `college`, `classrooms` or `participants`; `course <id>` gives the details. A term the chosen index does not hold is `term_unavailable` (exit 3).

### `download` items

`Item = { session_id, course_id, course_title, session_title, stream: "screen"|"camera"|null, status, path, error?: { code, message } }`

`status` is `downloaded`, `skipped` (the file already exists), `planned` (`--dry-run`), `queued` (`--no-wait`) or `failed`. The command exits 1 if any item failed; the other items are still in `data.items`.

### `downloads`

Name rows by `item_id` (from `downloads --json`) or by a session id or link, which takes every row of that session. A session with no rows is `not_found`.

- `list` and `wait`: `{ output_dir, items: [Row] }`. `wait` with no rows named waits for everything unfinished; if nothing is running it answers at once with "Nothing is downloading." It exits 1 if a row it waited for failed.
- `cancel` and `retry`: `{ action, items: [Row & { changed: boolean }] }`. `changed: false` means the row was already finished (cancel) or was not failed or cancelled (retry). One of `--all` or a row is required.
- `clear`: `{ removed }`. It removes every finished and failed row, like the panel's Clear Completed.

`Row = { item_id, session_id, course_id, course_title, session_title, kind: "screen"|"camera"|"audio", status, progress: 0-100, path, error?, added_at, completed_at, extraction: { state, progress, error? } | null }`

Row `status` is `queued`, `downloading`, `processing`, `completed`, `failed`, `cancelled` or `removed`.

### `config`

- `config`: `{ settings: { key: value, … } }`
- `config <key>`: prints just the value (empty when unset); with `--json`, `{ key, value, setting }`
- `config <key> <value>`: saves it; `{ key, value, previous, changed, setting }`. A value the setting does not take is `usage` (exit 2), and nothing is saved.

| Key | Settings location | Takes |
|---|---|---|
| `output_dir` | General > Output Directory | an absolute path to an existing folder (`~` works); never created |
| `connection_mode` | General > Connection Mode | `auto`, `internal` (campus intranet) or `external` (public network) |
| `intranet_interface` | Network > Intranet Network Interface | an interface name (`en0`) or one of this computer's IPv4 addresses; `default` for the system default |
| `anonymous_requests` | Network > Anonymous API requests | `true` / `false` |
| `concurrent_downloads` | Download & Playback > Concurrent Download Limit | 1-10 |
| `download_workers` | Download & Playback > Download Worker Threads | 1-32 |
| `download_retries` | Download & Playback > Download Retry Count | 1-30 |
| `extract_after_download` | Download & Playback > Run C++ Slide Extraction Automatically After Download | `true` / `false` |
| `post_process_after_extraction` | Download & Playback > Run Post-Processing After Extraction | `true` / `false` |

Booleans also take `on`/`off`, `yes`/`no` and `1`/`0`. No other setting can be read or changed from the command line.

## `yhdl` (terminal only)

The same lookup commands (`search`, `mine`, `course`, `session`, `terms`, `whoami`, `schema`) and `download`, run without the app. It has no `downloads` or `config`: those answer "needs the AutoSlides app".

- **Anonymous by default.** Only the personal lists use a token: `mine`, the session list of `course`, and `download --course`. The token comes from, in order: `--token <token>`, `--account <name or student number>` (an account saved in AutoSlides), `YANHEKT_TOKEN`, then the account signed in to the app. A token is never saved or printed. `whoami` reports which one would be used, offline.
- **Route.** Public network unless `--intranet` (strict: no fallback to public). `--interface <name or IPv4>` picks the interface, only with `--intranet`. The app's Connection Mode is ignored.
- **`download`.** Takes `-o/--output <dir>` for this run (created if needed); otherwise the app's output folder. Same `--stream`, `--course`, `--dry-run`, `--force`. Item `status` can also be `interrupted`; running the same command again resumes.
- `-v/--verbose` prints diagnostic logs to stderr.

```bash
# Every session of a course, piped into a download to a folder of your choice
yhdl course 70101 --json | jq -r '.data.sessions[].id' | yhdl download - -o ~/Lectures --json
```
