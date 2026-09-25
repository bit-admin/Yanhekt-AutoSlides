// Types shared by the Notion watch-notes bridge (main service, preload,
// renderer sink/panel). Plain data only — every value crosses IPC. The
// connection token is never among them: it stays in main.

/** The page a watch tab's slides are appended to, picked in the Notes tab. */
export interface NotionTargetInfo {
  pageId: string;
  title: string;
  emoji: string | null;
  /** notion.so / app.notion.com link, opened by main (Open in Notion). */
  url: string;
}

/** One row of the page picker. */
export interface NotionPageSummary {
  id: string;
  title: string;
  emoji: string | null;
  /** Parent page, or null for a top-level page (workspace, database or other parent). */
  parentId: string | null;
}

export interface NotionPageList {
  pages: NotionPageSummary[];
  /** Pass back to searchPages for the next page of results; null at the end. */
  nextCursor: string | null;
}

export type NotionErrorCode =
  | 'no_token'
  | 'unauthorized'
  | 'not_shared'
  | 'rate_limited'
  | 'too_large'
  | 'bad_request'
  | 'no_target'
  | 'network'
  | 'api';

export type NotionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: NotionErrorCode; message?: string };
