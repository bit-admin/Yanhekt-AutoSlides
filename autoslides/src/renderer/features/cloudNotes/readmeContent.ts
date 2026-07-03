import { i18n } from '@shared/i18n'
import { EDITORJS_DOC_VERSION } from '@common/notesTypes'

/**
 * Build the cloud-storage README's Editor.js document (localized) as a JSON
 * string. Includes a fresh timestamp so recreating it bumps its modified time
 * and keeps it pinned to the top of the note list. Single source for every
 * surface that provisions or recreates the README (cloud storage store, Cloud
 * Notes page).
 */
export function buildReadmeContent(): string {
  const t = i18n.global.t
  const stamp = t('cloudNotes.readmeUpdatedAt', { time: new Date().toLocaleString() })
  const blocks = [
    { type: 'header', data: { text: t('cloudNotes.readmeHeading'), level: 2 } },
    { type: 'paragraph', data: { text: t('cloudNotes.readmeBody1') } },
    { type: 'paragraph', data: { text: t('cloudNotes.readmeBody2') } },
    { type: 'paragraph', data: { text: t('cloudNotes.readmeBody3') } },
    { type: 'paragraph', data: { text: stamp } },
  ]
  return JSON.stringify({ time: Date.now(), blocks, version: EDITORJS_DOC_VERSION })
}
