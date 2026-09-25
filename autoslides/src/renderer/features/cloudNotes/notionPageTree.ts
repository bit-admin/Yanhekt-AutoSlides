// Pure helpers for the Notion page picker: turn the flat search results into
// indented rows (parent → sub-pages), and name a page's parent path.
import type { NotionPageSummary } from '@common/notionNotesTypes'

export interface NotionPageRow {
  page: NotionPageSummary
  depth: number
}

/**
 * Depth-first rows, keeping Notion's order (most recently edited first) among
 * siblings. A page whose parent is not among `pages` (top level, or a parent
 * the connection can't see) is a root.
 */
export function buildPageRows(pages: NotionPageSummary[]): NotionPageRow[] {
  const ids = new Set(pages.map((p) => p.id))
  const children = new Map<string, NotionPageSummary[]>()
  const roots: NotionPageSummary[] = []
  for (const page of pages) {
    if (page.parentId && page.parentId !== page.id && ids.has(page.parentId)) {
      const list = children.get(page.parentId) ?? []
      list.push(page)
      children.set(page.parentId, list)
    } else {
      roots.push(page)
    }
  }

  // Pages only reachable through a parent cycle: promote the first of each
  // cycle to a root, so nothing the connection can see goes missing.
  const reachable = new Set<string>()
  const mark = (page: NotionPageSummary) => {
    if (reachable.has(page.id)) return
    reachable.add(page.id)
    for (const kid of children.get(page.id) ?? []) mark(kid)
  }
  roots.forEach(mark)
  for (const page of pages) {
    if (!reachable.has(page.id)) {
      roots.push(page)
      mark(page)
    }
  }

  const rows: NotionPageRow[] = []
  const seen = new Set<string>()
  const visit = (page: NotionPageSummary, depth: number) => {
    if (seen.has(page.id)) return
    seen.add(page.id)
    rows.push({ page, depth })
    for (const kid of children.get(page.id) ?? []) visit(kid, depth + 1)
  }
  for (const root of roots) visit(root, 0)
  return rows
}

/** Titles of the page's known ancestors, outermost first. */
export function pageAncestors(page: NotionPageSummary, byId: ReadonlyMap<string, NotionPageSummary>): string[] {
  const path: string[] = []
  const seen = new Set<string>([page.id])
  let parentId = page.parentId
  while (parentId && !seen.has(parentId)) {
    const parent = byId.get(parentId)
    if (!parent) break
    seen.add(parentId)
    path.unshift(parent.title)
    parentId = parent.parentId
  }
  return path
}
