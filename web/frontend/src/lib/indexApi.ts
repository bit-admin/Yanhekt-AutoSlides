/**
 * The Index (course search over past terms, a course's session ids), reached
 * same-origin through the Worker's `/api/index/*` service binding. Contract:
 * share/docs/api.md. No login: the Index answers the same to everyone.
 */
import { cached } from "./requestCache";

const INDEX_BASE = "/api/index";
/** Index answers only change when it is re-uploaded; a few minutes is plenty. */
const INDEX_TTL_MS = 5 * 60 * 1000;

/** An Index error code (share/docs/api.md), or `network` when no JSON came back. */
export class IndexError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "IndexError";
  }
}

export interface IndexCourse {
  id: number;
  name: string;
  number: string | null;
  /** Our term key, e.g. `2025-2026-1`, or null. */
  term: string | null;
  teachers: string[];
  sessionCount: number;
}

export interface IndexSearchResponse {
  total: number;
  results: IndexCourse[];
}

async function get<T>(path: string): Promise<T> {
  return cached(`INDEX ${path}`, INDEX_TTL_MS, async () => {
    let res: Response;
    try {
      res = await fetch(`${INDEX_BASE}${path}`);
    } catch (error) {
      throw new IndexError("network", error instanceof Error ? error.message : String(error));
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new IndexError("network", `HTTP ${res.status}, not JSON`);
    }
    if (!res.ok) {
      const e = body as { error?: string; message?: string };
      throw new IndexError(e.error ?? "internal", e.message ?? `HTTP ${res.status}`);
    }
    return body as T;
  });
}

/** Courses in one past term whose name, teachers or registrar code match `q`. */
export function searchIndex(q: string, term: string): Promise<IndexSearchResponse> {
  const params = new URLSearchParams({ q, term });
  return get<IndexSearchResponse>(`/search?${params.toString()}`);
}

/** The session ids the Index holds for a course, ascending. `not-found` for a course it does not have. */
export async function indexSessionIds(courseId: string): Promise<string[]> {
  const data = await get<{ sessions: Array<number | string> }>(`/courses/${encodeURIComponent(courseId)}/sessions`);
  return (data.sessions ?? []).map(String);
}
