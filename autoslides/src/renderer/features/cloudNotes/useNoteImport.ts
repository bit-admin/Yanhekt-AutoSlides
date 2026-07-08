import { computed } from 'vue'
import type { EditorJsBlock } from '@common/notesTypes'
import { EDITORJS_DOC_VERSION, buildManagedNoteTitle } from '@common/notesTypes'
import { buildNoteMetadataBlock, NOTE_METADATA_VERSION } from '@common/notesContent'
import type { NoteCloudMetadata } from '@common/notesContent'
import { SHARE_ORIGIN, SHARE_PATH, parseShareLink } from '@common/shareLink'
import type { SlideMetadata } from '@common/slideMetadataTypes'
import { formatToolFolderName, compareToolImages } from '@shared/utils/toolWindowFolders'
import type { useCloudNotes } from './useCloudNotes'
import { cloudStorageStore } from './cloudStorageStore'
import { useBackgroundQueue } from './useBackgroundQueue'
import { useNotesPublish } from './useNotesPublish'

type CloudNotesApi = ReturnType<typeof useCloudNotes>

export type ImportStatus =
  | 'pending' | 'resolving' | 'uploading' | 'building' | 'publishing' | 'done' | 'conflict' | 'error'

/** One queued import row — either a local slide folder or a resolved share link. */
export interface ImportItem {
  /** 'folder' = local slides (uploaded); 'share' = share link (URLs already public). */
  kind: 'folder' | 'share'
  /** Unique row key: the slide folder name, or a synthetic key for share rows. */
  folderName: string
  displayName: string
  path: string
  status: ImportStatus
  /** Images uploaded so far (folder) / total carried (share). */
  uploaded: number
  /** Total images in the folder / share. */
  total: number
  /** Public image URLs to embed directly (share imports only — no upload). */
  urls?: string[]
  /** Referenced images the server couldn't resolve (share imports only). */
  missing?: number
  /** Slide metadata from AutoSlides Index (share imports only; null if un-indexed). */
  metadata?: SlideMetadata | null
  /** The share (short) link imported (share imports only) — recorded on the note. */
  shareUrl?: string
  /** AutoSlides Index lecture URL, if the share was indexed (share imports only). */
  indexUrl?: string
  /** Note created for this row (on success). */
  noteId?: number
  /** Existing managed note(s) with the same title (on conflict). */
  conflictNoteIds?: number[]
  /**
   * Publish-only row (publish mode + a managed note already exists): skip the
   * upload/create and publish the existing note (`noteId`) to the index instead.
   */
  publishOnly?: boolean
  error?: string
}

/** Localized strings for the generated note content (the component owns i18n). */
export interface ImportTexts {
  meta: (count: number, date: string) => string
  warning: string
  slideCaption: (n: number) => string
}

interface PdfFolder { name: string; path: string; imageCount: number }
interface PdfImage { name: string; path: string }

/**
 * Background queue that pushes locally-extracted slide folders into the managed
 * Yanhekt group as image notes — one note per folder. Runs sequentially (one
 * folder, then images within it in slide order) so the note's blocks stay
 * ordered and uploads don't hammer the server.
 *
 * Re-import is a *conflict*, not an overwrite: if a managed note already exists
 * for a folder (matched by exact built title), that row is flagged `conflict`
 * with the existing note id so the UI can offer "open note"; the user deletes it
 * manually to re-import. State lives here (not in the modal) so closing the modal
 * mid-import keeps the queue running.
 */
export function useNoteImport(cn: CloudNotesApi, texts: ImportTexts) {
  const { queue, cancelRequested, running, overall, reset, cancel, removeItem } =
    useBackgroundQueue<ImportItem>()
  const publisher = useNotesPublish(cn)

  const importing = computed(() => running.value)
  /**
   * Image-level progress across the whole queue (for a continuous progress bar,
   * as opposed to `overall`'s per-folder done/total used for the modal's row
   * count). Each item contributes its `uploaded` count while actively uploading,
   * and its full `total` once past the upload phase (building/publishing/done/
   * error) so the bar keeps advancing through those near-instant steps instead
   * of stalling. Pending/resolving/conflict items contribute 0 until processed.
   */
  const imageProgress = computed(() => {
    let done = 0
    let total = 0
    for (const item of queue.value) {
      total += item.total
      switch (item.status) {
        case 'uploading':
          done += item.uploaded
          break
        case 'building':
        case 'publishing':
        case 'done':
        case 'error':
          done += item.total
          break
        default:
          break
      }
    }
    return { done, total }
  })

  /**
   * Build the stringified Editor.js document for a note's slides (uploaded or
   * shared). Appends a managed metadata code block at the end carrying the
   * originating folder's metadata.json (`slides`, null for share imports) plus
   * cloud-note metadata (`note`).
   */
  function buildContent(
    heading: string,
    urls: string[],
    slides: SlideMetadata | null,
    noteExtra?: Partial<NoteCloudMetadata>,
  ): string {
    // `heading` is the full display name (course + session, e.g.
    // "<course> 第N周 星期X 第N大节" or "<course> - Lecture N").
    const blocks: EditorJsBlock[] = [
      { type: 'header', data: { text: heading, level: 2 } },
      { type: 'paragraph', data: { text: texts.meta(urls.length, new Date().toLocaleDateString()) } },
      { type: 'paragraph', data: { text: texts.warning } },
      ...urls.map((url, idx): EditorJsBlock => ({
        type: 'image',
        data: {
          file: { url },
          caption: texts.slideCaption(idx + 1),
          withBorder: false,
          stretched: false,
          withBackground: false,
        },
      })),
      buildNoteMetadataBlock({
        v: NOTE_METADATA_VERSION,
        slides,
        note: {
          displayName: heading,
          imageCount: urls.length,
          importedAt: new Date().toISOString(),
          // `shareUrl` (the short link) + `indexUrl` for share-link imports.
          ...noteExtra,
        },
      }),
    ]
    return JSON.stringify({ time: Date.now(), blocks, version: EDITORJS_DOC_VERSION })
  }

  /** Create the note, upload every slide in order, then save the content. */
  async function processItem(item: ImportItem): Promise<void> {
    const images = (await window.electronAPI.pdfmaker.getImages(item.path)) as PdfImage[]
    const sorted = [...images].sort((a, b) => compareToolImages(a.name, b.name))
    item.total = sorted.length
    if (sorted.length === 0) {
      item.status = 'error'
      item.error = 'empty'
      return
    }

    const createRes = await window.electronAPI.cloudNotes.create()
    if (!createRes.ok) { item.status = 'error'; item.error = createRes.error; return }
    const noteId = createRes.data
    item.noteId = noteId

    const title = buildManagedNoteTitle(item.displayName)
    const groupId = cloudStorageStore.managedGroupId.value ?? cn.managedGroups.value[0]?.id
    const titleRes = await window.electronAPI.cloudNotes.updateTitle(noteId, title, groupId)
    if (!titleRes.ok) { item.status = 'error'; item.error = titleRes.error; return }

    item.status = 'uploading'
    const urls: string[] = []
    for (const img of sorted) {
      if (cancelRequested.value) { item.status = 'error'; item.error = 'cancelled'; return }
      const up = await window.electronAPI.cloudNotes.uploadImageFromPath(img.path)
      if (!up.ok) { item.status = 'error'; item.error = up.error; return }
      urls.push(up.data.url)
      item.uploaded += 1
    }

    item.status = 'building'
    // Carry the originating folder's metadata.json into the note (null if absent).
    const slidesMeta = await window.electronAPI.slideMetadata.get(item.path)
    const contentRes = await window.electronAPI.cloudNotes.updateContent(noteId, buildContent(item.displayName, urls, slidesMeta))
    if (!contentRes.ok) { item.status = 'error'; item.error = contentRes.error; return }
    item.status = 'done'
  }

  /**
   * Import a single share row: the images are already public coss URLs (resolved
   * from the share link), so there's no upload step — just create the note, set
   * the managed title, and embed the URLs in slide order.
   */
  async function processShareItem(item: ImportItem): Promise<void> {
    const urls = item.urls ?? []
    if (urls.length === 0) { item.status = 'error'; item.error = 'empty'; return }

    const createRes = await window.electronAPI.cloudNotes.create()
    if (!createRes.ok) { item.status = 'error'; item.error = createRes.error; return }
    const noteId = createRes.data
    item.noteId = noteId

    const title = buildManagedNoteTitle(item.displayName)
    const groupId = cloudStorageStore.managedGroupId.value ?? cn.managedGroups.value[0]?.id
    const titleRes = await window.electronAPI.cloudNotes.updateTitle(noteId, title, groupId)
    if (!titleRes.ok) { item.status = 'error'; item.error = titleRes.error; return }

    item.status = 'building'
    item.uploaded = urls.length
    // Embed the share's AutoSlides Index metadata as the `slides` group (null
    // when the link isn't indexed), so the note carries its origin identity +
    // review flags — same as a folder import carries its local metadata.json.
    // Also record the share (short) link + index URL on the note's `note` group.
    const contentRes = await window.electronAPI.cloudNotes.updateContent(
      noteId,
      buildContent(item.displayName, urls, item.metadata ?? null, {
        shareUrl: item.shareUrl,
        indexUrl: item.indexUrl,
      }),
    )
    if (!contentRes.ok) { item.status = 'error'; item.error = contentRes.error; return }
    item.status = 'done'
  }

  /**
   * Import a managed note from a share link (already resolved to a title/URLs by
   * the caller — e.g. the Cloud Index webview interception). Runs the same
   * conflict/create flow as folder imports — a same-titled managed note flags a
   * conflict for the user to resolve. The row is pushed immediately (status
   * `resolving`) for live feedback while the link is resolved server-side.
   * `metadata` (the index-sourced `slides` group the caller captured client-side)
   * is embedded in the note; null when the share isn't indexed.
   */
  async function importShareLink(
    link: string,
    resolvingLabel: string,
    metadata: SlideMetadata | null = null,
  ): Promise<void> {
    if (running.value) return
    const trimmed = link.trim()
    if (!trimmed) return
    running.value = true

    // Record ONLY a canonical short link as the note's shareUrl — a long-form
    // `/v1#<fragment>` link isn't a stable share URL and must not be recorded.
    const shortId = parseShareLink(trimmed)?.shortId
    const shareUrl = shortId ? `${SHARE_ORIGIN}${SHARE_PATH}/s/${shortId}` : undefined

    // The index lecture URL is derivable from the captured metadata's course/
    // session ids (omitted when the share isn't indexed).
    const src = metadata?.source
    const indexUrl = src?.courseId && src?.sessionId
      ? `${SHARE_ORIGIN}/?l=${encodeURIComponent(src.courseId)}.${encodeURIComponent(src.sessionId)}`
      : undefined

    const item: ImportItem = {
      kind: 'share',
      folderName: `share:${Date.now()}`,
      displayName: resolvingLabel,
      path: '',
      status: 'resolving',
      uploaded: 0,
      total: 0,
      metadata,
      shareUrl,
      indexUrl,
    }
    queue.value.push(item)

    try {
      await cn.loadAll()
      const res = await window.electronAPI.cloudNotes.resolveShareLink(trimmed)
      if (!res.ok) { item.status = 'error'; item.error = res.error; return }

      const { title, urls, missing } = res.data
      item.displayName = title
      item.urls = urls
      item.total = urls.length
      item.missing = missing
      if (urls.length === 0) { item.status = 'error'; item.error = 'empty'; return }

      const ids = sameTitleNoteIds(title)
      if (ids.length > 0) {
        item.status = 'conflict'
        item.conflictNoteIds = ids
      } else {
        await processShareItem(item)
      }
      await Promise.all([cn.loadAll(), cn.refreshGroups()])
    } finally {
      running.value = false
    }
  }

  /**
   * Publish an item's note to the AutoSlides Index (delegates to useNotesPublish).
   * Fetches the note's current content, publishes, and records the index URL on the
   * row. `already` (the note carried an index URL) counts as success.
   */
  async function publishItem(item: ImportItem): Promise<void> {
    if (item.noteId == null) { item.status = 'error'; item.error = 'publish-failed'; return }
    item.status = 'publishing'
    const got = await window.electronAPI.cloudNotes.get(item.noteId)
    if (!got.ok) { item.status = 'error'; item.error = got.error; return }
    const res = await publisher.publishNote(item.noteId, got.data.content)
    if (res.ok) { item.indexUrl = res.indexUrl; item.status = 'done'; return }
    if ('reason' in res) {
      if (res.reason === 'already') { item.indexUrl = res.indexUrl; item.status = 'done'; return }
      item.status = 'error'; item.error = res.reason // 'not-indexable' | 'no-images'
      return
    }
    item.status = 'error'; item.error = res.error
  }

  /**
   * Start importing the given folders. Refreshes the full note set for an
   * accurate conflict check, pre-flags conflicting folders, then processes the
   * rest sequentially. Reloads notes + groups afterwards so new notes appear.
   *
   * With `{ publish: true }` each folder is also published to the AutoSlides Index
   * after import ("Publish to Index does both"). A folder that's *already* imported
   * is not a conflict in publish mode — its existing note is published directly.
   */
  async function startImport(folderNames: string[], opts?: { publish?: boolean }): Promise<void> {
    if (running.value) return
    cancelRequested.value = false
    running.value = true
    try {
      await cn.loadAll()
      const folders = (await window.electronAPI.pdfmaker.getFolders()) as PdfFolder[]
      const byName = new Map(folders.map((f) => [f.name, f]))

      queue.value = folderNames.map((folderName) => {
        const f = byName.get(folderName)
        return {
          kind: 'folder' as const,
          folderName,
          displayName: formatToolFolderName(folderName),
          path: f?.path ?? '',
          status: 'pending' as ImportStatus,
          uploaded: 0,
          total: f?.imageCount ?? 0,
        }
      })

      // Pre-flag folders that already have a managed note. In import mode these
      // await a user decision (replace / create / skip). In publish mode there's
      // no conflict — publish the existing note directly (publishOnly).
      for (const item of queue.value) {
        const ids = sameTitleNoteIds(item.displayName)
        if (ids.length === 0) continue
        if (opts?.publish) {
          item.noteId = ids[0]
          item.publishOnly = true
        } else {
          item.status = 'conflict'
          item.conflictNoteIds = ids
        }
      }

      for (const item of queue.value) {
        if (cancelRequested.value) break
        if (item.status !== 'pending') continue
        if (item.publishOnly) {
          await publishItem(item)
        } else {
          await processItem(item)
          // processItem mutates item.status; the `!== 'pending'` guard above
          // narrowed it, so read through a call to re-widen for the comparison.
          if (opts?.publish && statusOf(item) === 'done') await publishItem(item)
        }
      }

      await Promise.all([cn.loadAll(), cn.refreshGroups()])
    } finally {
      running.value = false
    }
  }

  /** Read an item's status widened to ImportStatus (defeats loop-guard narrowing). */
  function statusOf(item: ImportItem): ImportStatus {
    return item.status
  }

  /** Current ids of all managed notes whose title matches this folder. */
  function sameTitleNoteIds(displayName: string): number[] {
    const title = buildManagedNoteTitle(displayName)
    return cn.allNotes.value.filter((n) => n.title === title).map((n) => n.id)
  }

  /**
   * Resolve a conflicting row. `replace` deletes *all* same-titled managed notes
   * first (the user may have more than one), then imports fresh; `create` imports
   * a new note alongside the existing one(s) — harmless, since identical images
   * dedup to the same server URL. Runs the same single-folder pipeline.
   */
  async function resolveConflict(item: ImportItem, mode: 'replace' | 'create'): Promise<void> {
    if (running.value) return
    running.value = true
    try {
      if (mode === 'replace') {
        for (const id of sameTitleNoteIds(item.displayName)) {
          const del = await window.electronAPI.cloudNotes.delete(id)
          if (!del.ok) { item.status = 'error'; item.error = del.error; return }
        }
      }
      item.status = 'pending'
      item.uploaded = 0
      item.conflictNoteIds = undefined
      if (item.kind === 'share') await processShareItem(item)
      else await processItem(item)
      await Promise.all([cn.loadAll(), cn.refreshGroups()])
    } finally {
      running.value = false
    }
  }

  /** Drop a conflicting row from the queue without importing it. */
  const skipConflict = removeItem

  /**
   * Auto-sync a single folder to the managed group in the background — the entry
   * point for the Settings → Cloud "Sync" feature (triggered when a folder becomes
   * reviewed/edited). Unlike startImport, this never touches the visible `queue`
   * (no modal/progress-bar surface) and never prompts: a folder that already has a
   * managed note is *skipped* (the user's chosen policy), not flagged as a conflict.
   * With `{ publish: true }` a freshly-imported folder is also published to the
   * AutoSlides Index. Returns the outcome so the caller can log/ignore.
   */
  async function syncFolder(folderName: string, opts: { publish: boolean }): Promise<'synced' | 'skipped' | 'error'> {
    if (running.value) return 'skipped'
    cancelRequested.value = false
    running.value = true
    try {
      await cn.loadAll()
      const displayName = formatToolFolderName(folderName)
      // Already imported → skip (no overwrite, no prompt).
      if (sameTitleNoteIds(displayName).length > 0) return 'skipped'

      const folders = (await window.electronAPI.pdfmaker.getFolders()) as PdfFolder[]
      const folder = folders.find((f) => f.name === folderName)
      if (!folder) return 'error'

      const item: ImportItem = {
        kind: 'folder',
        folderName,
        displayName,
        path: folder.path,
        status: 'pending',
        uploaded: 0,
        total: folder.imageCount,
      }
      await processItem(item)
      if (item.status === 'done' && opts.publish) await publishItem(item)

      await Promise.all([cn.loadAll(), cn.refreshGroups()])
      return item.status === 'done' ? 'synced' : 'error'
    } finally {
      running.value = false
    }
  }

  /**
   * Auto-resync a single folder that ALREADY has a managed note — the inverse of
   * `syncFolder`. Triggered when an imported folder is edited again. Replaces the
   * existing note by delete-then-create (matching the manual "Import Slides to
   * Notes" replace-on-conflict path), so the note reflects the freshly-edited
   * slides. A folder with no managed note is a no-op (`'skipped'`) — first import
   * is `syncFolder`'s job. With `{ republish: true }` the Cloud Index entry is
   * removed and re-published (remove-then-publish, since the Index is versioned).
   */
  async function resyncFolder(folderName: string, opts: { republish: boolean }): Promise<'resynced' | 'skipped' | 'error'> {
    if (running.value) return 'skipped'
    cancelRequested.value = false
    running.value = true
    try {
      await cn.loadAll()
      const displayName = formatToolFolderName(folderName)
      const ids = sameTitleNoteIds(displayName)
      // No existing note → nothing to resync (creating is syncFolder's job).
      if (ids.length === 0) return 'skipped'

      const folders = (await window.electronAPI.pdfmaker.getFolders()) as PdfFolder[]
      const folder = folders.find((f) => f.name === folderName)
      if (!folder) return 'error'

      // Republish = clear the old Index entry first. The Index is versioned, so
      // publishing changed content without removal would stack a new version.
      if (opts.republish) {
        const meta = await window.electronAPI.slideMetadata.get(folder.path)
        const src = meta?.source
        if (src?.courseId && src?.sessionId) {
          await window.electronAPI.cloudNotes.requestIndexRemoval(src.courseId, src.sessionId)
        }
      }

      // Replace = delete existing managed note(s), then import fresh.
      for (const id of ids) {
        const del = await window.electronAPI.cloudNotes.delete(id)
        if (!del.ok) return 'error'
      }

      const item: ImportItem = {
        kind: 'folder',
        folderName,
        displayName,
        path: folder.path,
        status: 'pending',
        uploaded: 0,
        total: folder.imageCount,
      }
      await processItem(item)
      if (item.status === 'done' && opts.republish) await publishItem(item)

      await Promise.all([cn.loadAll(), cn.refreshGroups()])
      return item.status === 'done' ? 'resynced' : 'error'
    } finally {
      running.value = false
    }
  }

  return {
    queue, importing, overall, imageProgress, cancelRequested,
    startImport, importShareLink, cancel, reset, resolveConflict, skipConflict, syncFolder, resyncFolder,
  }
}
