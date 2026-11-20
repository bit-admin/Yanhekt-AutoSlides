import { describe, expect, it } from 'vitest'
import { readNoteContent } from './noteContent'

describe('a stored note body', () => {
  it('is empty only when nothing was written', () => {
    for (const raw of ['', '   ', null, undefined]) expect(readNoteContent(raw)).toEqual({ kind: 'empty' })
  })

  it('is a document when it is Editor.js JSON, an empty one included', () => {
    expect(readNoteContent('{"time":1,"blocks":[]}')).toEqual({ kind: 'document', data: { time: 1, blocks: [] } })
    expect(readNoteContent('{"blocks":[{"type":"paragraph","data":{"text":"课"}}]}').kind).toBe('document')
  })

  it('is unreadable, not empty, when there is content in another form', () => {
    for (const raw of ['plain text from another client', '{"blocks":', '{"text":"no blocks"}', '[]', 'null', '42', '{"blocks":{}}']) {
      expect(readNoteContent(raw), raw).toEqual({ kind: 'unreadable' })
    }
  })
})
