# Retired: Electron Drive and Yanhekt Notes

The desktop Drive workspace was rebuilt on 2026-11-20 as image upload and sharing (no notes), and the page itself was removed on 2026-11-21; only Slides → Upload to Drive remains (see `docs/architecture.md`). The old editor and sync depended on Yanhekt accepting note content writes. On 2026-11-20, a direct check reproduced `12101114` on `PUT /v1/note/content` for both a plain paragraph and an image block. Neither write persisted. Note reads and a repeat upload of an existing image worked. Nothing in the retirement deletes existing Yanhekt notes or groups.

## What is preserved here

`src/` mirrors paths under `autoslides/src/` before retirement. Files marked `.original.*` are snapshots of modules with a surviving counterpart in the app; the archived `shared/notesTypes.ts` and `shared/notesContent.ts` are also the original, fuller versions. The archive is outside the Electron package and is **not imported, compiled, tested, or packaged** by the active app. Its imports assume the old desktop layout; do not include this directory in a TypeScript or Vite entry point.

| Area | Source |
|---|---|
| Drive workspace, editor, note export, and former Share dialog | `src/renderer/components/cloudnotes/`, `src/renderer/features/cloudNotes/` |
| Note CRUD, groups, account-owned requests, and file export | `src/main/platform/notesService.ts`, `src/main/ipc/`, `src/main/export/noteExportService.ts`, `src/preload/` |
| Cloud Settings, provisioning, and onboarding | `src/renderer/components/settings/`, `src/renderer/features/settings/`, `src/renderer/features/cloudNotes/cloudStorageStore.ts` |
| Yanhekt watch-note sink and editor | `src/renderer/features/cloudNotes/yanhektWatchSink.ts`, `src/renderer/features/cloudNotes/useWatchNoteEditor.ts`, the watch store and panel snapshots |
| Editor.js document helpers and theme | `src/shared/`, `src/editorjs-tools.d.ts`, `src/renderer/shared/styles/editor.css` |

`locales/` contains the removed or superseded desktop strings by locale, not complete locale files. `screenshots/` shows the old UI (including sharing from a note).

## What still runs

- The desktop `cloud-notes` navigation ID is gone (no Drive page since 2026-11-21). Obsidian and Notion Watch Notes stay in **Settings → Add-ons**. An old Yanhekt opt-in is switched **off**, not redirected to another provider; existing Obsidian and Notion settings are preserved.
- Share does not require a note document. The live desktop implementation is [`ShareService`](../../autoslides/src/main/platform/shareService.ts) (authenticated MinIO upload, short links, link resolution and local folder reconstruction) and [`buildSlideShareLink`](../../autoslides/src/shared/shareCreation.ts) (v2/v3 encoding from uploaded images). `window.electronAPI.cloudNotes` is the historical name of the **Share-only** bridge. It no longer exposes note or group operations. Nothing in the app creates share links at the moment; **Lectures → Clone from Share Link** still accepts links with a timeline. The Share Timeline setting (`cloudShareEmbedTimeline`) is retired and dropped at launch.
- Web Notes and the public Share viewer are separate packages. They were not retired as part of this Electron change.

## If Drive returns

1. First verify that a disposable note's content save succeeds and reads back correctly. A successful image upload, title change, or HTTP 200 alone is not evidence that content writes work.
2. Restore only the pieces the new design needs. Merge snapshots into current files rather than overwriting the current preload, watch-note queues, or onboarding wholesale. Keep upload/link handling in `ShareService`; the archived `NotesService` included some of those methods before the split. Do not reintroduce background note writes, provision groups, or renew a user's old sync opt-in implicitly.
3. The old desktop editor used `@editorjs/editorjs` and its `code`, `delimiter`, `header`, `image`, `list`, `quote`, and `table` plugins. The old Word exporter used `docx`; Markdown ZIP used a direct runtime dependency on `jszip`. Those editor and Word dependencies are no longer in the desktop manifest. PDFKit and PPTX export remain active for Slides. Choose and audit compatible dependency versions before restoring any editor or exporter.
4. Wire the current page, account-scoped IPC, settings, schema, and translations deliberately. The old Slides integration ran on local review/edit changes and managed note import; keep local sidecar updates independent of sync. Merge keys from `locales/` as needed, reintroduce only relevant tests, and regenerate the desktop config schema. Review the account-switch, save-chain, and structured-clone tests before enabling remote writes. Keep the web and Share codec compatibility checks green.
5. Restore the drift checks that were removed with this code. In `scripts/check-drift.mjs`, re-add the `notesContent` and `notesTypes` pairs against `web/frontend/src/lib/notes/`, and the byte-identical entries for `noteSaveChain.ts`, `noteContent.ts` and `noteUngroup.ts`. Then port any web changes made since retirement and run `node scripts/check-drift.mjs --update`. Until then, the web copies are the only live versions.
