# UI copy conventions

Applies to every user-visible string in `autoslides/` (desktop), `web/frontend/` and `share/`. Locale **keys** never change for copy reasons; only values do. Code ids (nav ids, IPC channels, feature folders, CSS classes) are frozen and are not product names.

## English casing by role

| UI role | Form | Examples |
|---------|------|----------|
| Nav items, workspace names, menu items, modal/section **titles**, primary and secondary **buttons**, settings **field labels**, empty-state **titles** | **Title Case** | Sign In, Public Index, Output Directory, Other Groups, No Notes, Can't Import |
| Descriptions, placeholders, helper text, tooltips, error bodies, empty-state **sentences**, confirmations | **Sentence case** | Couldn't load this lecture. · Search by course, session, instructor, or college… |
| Filter chips that read as predicates | Sentence case | All colleges, Recently added, Has timeline |
| Row status / progress verbs | Sentence case, short | Loading…, Saved ✓, Importing 3/10… |
| Product names | Proper nouns, **per surface** (see glossary) | Drive, Notes, Public Index, Watch Notes, AutoSlides Database |

Rules of thumb:
- Small words (a, an, the, to, with, of, for, and, or, in, on) stay lowercase inside Title Case unless first or last: **Sign In with Browser**, **Import to AutoSlides Database**, **Export to Local**.
- Two sibling controls on one screen share one casing. Do not pair `Delete group` with `New Group`.
- Ellipsis is the Unicode character `…`, never `...`.
- Do not abbreviate in labels (`Initialize`, not `Init`).
- Retired names must not appear in new copy: **Results View** (now Slides), **Cloud Notes** (desktop: Drive; web: Notes), **Cloud Index** (Public Index).

## CJK locales

zh / ja / ko follow their own typography: no English Title Case, CJK punctuation (`，。：` in zh), `…` for ellipsis, `「」` quotes in ja, `“”` in zh. Translate the product name **for that surface** (below), not the English word literally.

## Glossary — product names are per surface (owner rulings, do not unify)

| Surface | UI (en) | UI (zh) | Code id (frozen) |
|---------|---------|---------|------------------|
| Desktop | **Drive** | **云存储** | `cloud-notes`, `cloudNotes`, `electronAPI.cloudNotes` |
| Web | **Notes** | **笔记** | `/notes`, `useCloudNotes` |
| Desktop | **Pinned** | 置顶 | `pinned`, `PinnedCourse` |
| Web | **Subscribed** | (web zh for that slot) | `navigation.pinned` (id kept; label is Subscribed) |
| Both | Public Index | 公共索引 | `cloudIndex`, `share/`, `.ci-*` |
| Both | Slides | 课程幻灯片 | `slides-review`, `results*`, `trash.*` i18n |
| Desktop | Lectures | 课程视频 | `lectures` |
| Both | Watch Notes | 随堂笔记 | `ASuser` (Yanhekt group name) |
| Both | AutoSlides Database | AutoSlides 数据库 | `ASnote` (Yanhekt group name) |
| Both | Live / Recorded | 直播课程 / 录播课程 | `live` / `recorded` |

Rulings (2026-09-03):
1. Desktop **Drive** vs web **Notes** is an intended split. Do not introduce Drive on web or Notes-as-workspace on desktop.
2. Desktop English **Drive** is Chinese **云存储**. Do not "fix" it to 云盘 / 驱动器.
3. Desktop **Pinned** vs web **Subscribed** is an intended split. Do not unify the copy.

`ASnote` / `ASuser` are 6-character Yanhekt group names. Say them once in Settings and README bodies for support purposes; keep them off primary buttons and nav.
