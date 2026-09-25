import { describe, expect, it } from 'vitest'
import type { NotionPageSummary } from '@common/notionNotesTypes'
import { buildPageRows, pageAncestors } from './notionPageTree'

const p = (id: string, parentId: string | null, title = id): NotionPageSummary => ({ id, title, emoji: null, parentId })

describe('buildPageRows', () => {
  it('nests sub-pages under their parent, depth-first, keeping sibling order', () => {
    const pages = [p('course', 'test'), p('test', null), p('week1', 'course'), p('other', 'hidden-parent')]
    expect(buildPageRows(pages).map((r) => [r.page.id, r.depth])).toEqual([
      ['test', 0],
      ['course', 1],
      ['week1', 2],
      ['other', 0],
    ])
  })

  it('never loses pages to a parent cycle', () => {
    expect(buildPageRows([p('a', 'b'), p('b', 'a')]).map((r) => [r.page.id, r.depth])).toEqual([['a', 0], ['b', 1]])
    expect(buildPageRows([p('a', 'a')]).map((r) => r.page.id)).toEqual(['a'])
  })
})

describe('pageAncestors', () => {
  it('walks known parents outermost first', () => {
    const all = [p('test', null, 'Test'), p('course', 'test', 'Test Course'), p('week1', 'course', 'Week 1')]
    const byId = new Map(all.map((x) => [x.id, x]))
    expect(pageAncestors(all[2], byId)).toEqual(['Test', 'Test Course'])
    expect(pageAncestors(all[0], byId)).toEqual([])
    expect(pageAncestors(p('x', 'unknown'), byId)).toEqual([])
  })
})
