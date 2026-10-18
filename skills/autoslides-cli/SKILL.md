---
name: autoslides-cli
description: Drive the AutoSlides desktop app and fetch Yanhekt (www.yanhekt.cn) lecture recordings from the command line with `autoslides` and `yhdl`. Use when asked to find a Yanhekt course or session, list enrolled courses, download recorded lectures, watch or manage the AutoSlides Download panel, or read or change AutoSlides settings such as the output folder or connection mode.
---

# AutoSlides command line

AutoSlides installs two commands (Settings > Add-ons > Command Line > Install):

| Command | Runs | Account and settings | Use it for |
|---|---|---|---|
| `autoslides` | inside the running AutoSlides app; starts the app if it is closed | the app's signed-in account, its network route and its output folder | anything the user should see in the app: downloads in the Download panel (with auto-extraction), the panel itself, app settings |
| `yhdl` | in the terminal, with no window | anonymous where possible; its own flags (`--output`, `--intranet`, `--token`) | one-off downloads to another folder or route, scripts on a machine where the app is not open |

Prefer `autoslides` unless the user asks for a separate folder or route for one run, or the app is unavailable. `autoslides` takes no per-run overrides (no `--output`, `--intranet`, `--token`); those exist only on `yhdl`.

Only Yanhekt is covered. Yanhe 2.0 (aita.yanhekt.cn) is not reachable from either command. Do not try to work around that.

## Always use `--json`

Every command takes `--json`. Then stdout is exactly one object:

```json
{"ok": true, "data": {}}
{"ok": false, "error": {"code": "not_found", "message": "…", "hint": "…"}, "data": {}}
```

Progress and notices go to stderr; ignore them or show them to the user. Branch on `error.code` (or the exit code), never on message text. Pass `error.hint` on to the user; it says what to do next.

| Exit | `error.code` | What to do |
|---|---|---|
| 0 | — | done |
| 1 | `failed` | read the message; for downloads, `data.items` says which failed |
| 2 | `usage` | the command line was wrong and nothing ran; fix the arguments (see `--help`) |
| 3 | `not_found`, `no_recording` | wrong id, or the session has no recording yet; do not retry unchanged |
| 4 | `sign_in_required` (autoslides), `auth_required` (yhdl) | ask the user to sign in to Yanhekt in the AutoSlides window, then run it again |
| 5 | `network` | Yanhekt could not be reached; check the connection or `connection_mode` |
| 6 | `app_not_running`, `cli_control_disabled` | the app could not start, or the user turned off Allow Command-Line Control; ask the user |
| 130 | `interrupted` | stopped by Ctrl-C. An `autoslides` download keeps going in the app |

`autoslides schema` (or `yhdl schema`) prints every command, option, data shape and code as JSON. Use it as the source of truth if anything here disagrees.

## Ids and links

- Courses and sessions are numbers. A Yanhekt link works anywhere the id does: `https://www.yanhekt.cn/course/<id>`, `https://www.yanhekt.cn/session/<id>`.
- A bare number means whatever the command expects: a course for `course`, a session for `session` and `download`. Use `download --course <id>` for a whole course.
- `download -` reads session ids from stdin, one per line.

## Common tasks

```bash
# Find a course, then list its sessions
autoslides search 微积分 --json
autoslides course 70101 --json

# Download one lecture into the Download panel and wait until it finishes
autoslides download 850101 --json

# A whole course, screen and camera, without waiting
autoslides download --course 70101 --stream both --no-wait --json

# See what would be written first; queues nothing
autoslides download --course 70101 --dry-run --json

# Follow, cancel or retry what is in the panel
autoslides downloads --json
autoslides downloads wait --json
autoslides downloads retry --all --json

# Settings the commands follow
autoslides config --json
autoslides config output_dir ~/Lectures
autoslides config connection_mode internal
```

A finished download's `path` is the absolute path of the `.mp4` (`.aac` for audio rows) in the app's output folder. Files that already exist are `skipped`, not downloaded again, unless you pass `--force`.

## Rules

- **Sign-in.** Every `autoslides` command that talks to Yanhekt needs the app signed in. `config` and `downloads` (except `retry`) stay inside the app and work signed out. Never ask the user for a token or password, and never pass one to `autoslides`.
- **Waiting.** `download` and `downloads wait` block until the downloads end, which can take many minutes per lecture. Use `--no-wait` and then `downloads wait` (or `downloads --json` to poll) when you need to do other work meanwhile.
- **Stopping.** Ctrl-C on `autoslides` only stops waiting. To stop a download, use `downloads cancel <item or session>`.
- **Changing settings.** `autoslides config <key> <value>` saves at once, as if the user pressed Save in Settings, and the app uses it straight away. Change a setting only when the user asks for that change. For a different folder or route on one run, use `yhdl download … -o <dir>` or `--intranet` instead.
- **Output folder missing.** If `download` fails with "the AutoSlides output folder is not available", ask the user which folder to use, then run `autoslides config output_dir <absolute path>`. The folder must already exist.

Full options, data shapes and config keys: [references/commands.md](references/commands.md).
