// `yhdl search <keyword>`: find courses. Anonymous.
//
// The current term is searched where Settings → General → Search says
// (Yanhekt's own search by default; its keyword also takes a numeric course
// id, so `search 70101` finds that one course). Earlier terms, back to
// 2023-2024-1, come from the course index: the copy on this computer, then the
// AutoSlides Index online (or online only). A run reads that setting; it never
// changes it, and never downloads index updates.
import type { CourseData, SemesterOption } from '@common/apiTypes';
import type { CourseIndexRow } from '@common/courseIndexTypes';
import { isEarlierTermOption, termKeyOfOption, termOptionsBackFrom } from '@common/termOptions';
import type { ApiClient } from '@main/platform/apiClient';
import type { CourseLookup } from '@main/platform/courseIndex/courseLookup';
import { intOption, type OptionSpec } from '../args';
import { CliError } from '../errors';
import { englishTitle, table } from '../format';
import { matchTerm, termKey } from '../terms';
import { info } from '../terminal';
import type { CliCommand, CliContext, CommandInput, CommandResult } from '../types';

const ANONYMOUS = '';
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/** One course in `search`'s data (see SEARCH_DATA). */
export interface CliCourseRow {
  id: string;
  title: string;
  title_en: string | null;
  professors: string[];
  college: string | null;
  term: string | null;
  classrooms: string[];
  participants: number | null;
}

export function courseRowJson(c: CourseData): CliCourseRow {
  return {
    id: String(c.id),
    title: c.name_zh,
    title_en: englishTitle(c.name_en),
    professors: c.professors ?? [],
    college: c.college_name || null,
    term: termKey(c.school_year, c.semester) || null,
    classrooms: (c.classrooms ?? []).map((r) => r.name),
    participants: c.participant_count ?? null,
  };
}

/** A course index row in the same shape; the index has no English name, college, rooms or headcount. */
function indexRowJson(row: CourseIndexRow, term: string): CliCourseRow {
  return {
    id: row.id,
    title: row.name,
    title_en: null,
    professors: [...row.teachers],
    college: null,
    term: row.term ?? term,
    classrooms: [],
    participants: null,
  };
}

/** The terms `--term` takes: the current one and every earlier term back to 2023-2024-1. */
export async function cliTermOptions(apiClient: ApiClient): Promise<SemesterOption[]> {
  // No current term (Yanhekt did not answer and none was saved): a plain search
  // still runs on Yanhekt; only --term needs the list.
  const [current] = await apiClient.getAvailableSemesters().catch(() => [] as SemesterOption[]);
  return current ? termOptionsBackFrom(current) : [];
}

export interface SearchDeps {
  apiClient: ApiClient;
  courseLookup: CourseLookup;
  /** Empty for an anonymous search. */
  token: string;
  notice: (text: string) => void;
  /** The hint under the table: how to go on from a course id. */
  nextStep: string;
}

/** The search itself, for both the terminal command and the app's. */
export async function searchCourses(input: CommandInput, deps: SearchDeps): Promise<CommandResult> {
  const keyword = input.positionals.join(' ').trim();
  if (!keyword) throw new CliError('usage', 'missing search keyword');
  const page = intOption(input.options.page, 'page', 1);
  const limit = intOption(input.options.limit, 'limit', DEFAULT_LIMIT, MAX_LIMIT);

  // No --term (or `all`): the current term, as Yanhekt's search covers only that.
  const termArg = input.options.term;
  const options = await cliTermOptions(deps.apiClient);
  let picked: SemesterOption | null = options[0] ?? null;
  if (typeof termArg === 'string' && termArg.toLowerCase() !== 'all') {
    picked = matchTerm(termArg, options);
    if (!picked) throw new CliError('usage', `unknown term: ${termArg}`, `Run '${input.program} terms' to see the terms it accepts.`);
  }
  const term = picked ? termKeyOfOption(picked) : null;

  let data: {
    keyword: string;
    term: string | null;
    source: 'yanhekt' | 'local' | 'online';
    page: number;
    last_page: number;
    total: number;
    courses: CliCourseRow[];
  } | null = null;
  if (picked && term) {
    const answer = await deps.courseLookup.search(term, keyword, page, limit);
    if (answer.ok) {
      data = {
        keyword,
        term,
        source: answer.source,
        page: answer.page,
        last_page: answer.lastPage,
        total: answer.total,
        courses: answer.courses.map((row) => indexRowJson(row, term)),
      };
    } else if (answer.reason === 'local-missing') {
      throw new CliError(
        'term_unavailable',
        `the course index on this computer does not hold ${term}`,
        'Open AutoSlides to download it (Settings > General > Search > Keep the Course Index Up to Date), or choose AutoSlides Index there.',
      );
    } else if (answer.reason === 'online-failed') {
      if (answer.code === 'term-not-indexed') {
        throw new CliError('term_unavailable', `the AutoSlides Index does not cover ${term} yet`);
      }
      if (answer.code === 'network') throw new CliError('network', `the AutoSlides Index did not answer: ${answer.message ?? ''}`.trim());
      throw new CliError('failed', `the AutoSlides Index refused the search: ${answer.message ?? answer.code ?? ''}`.trim());
    } else if (isEarlierTermOption(picked.id)) {
      // Unreachable: an earlier term is never searched on Yanhekt.
      throw new CliError('failed', `cannot search ${term}`);
    }
  }
  if (!data) {
    const semesters = picked && !isEarlierTermOption(picked.id) && typeof termArg === 'string' && termArg.toLowerCase() !== 'all' ? [picked.id] : [];
    const result = await deps.apiClient.getCourseList(deps.token, { keyword, semesters, page, pageSize: limit });
    data = {
      keyword,
      term,
      source: 'yanhekt',
      page: Number(result.current_page) || page,
      last_page: Number(result.last_page) || 1,
      total: Number(result.total) || 0,
      courses: (result.data ?? []).map(courseRowJson),
    };
  }
  const { courses } = data;

  if (courses.length === 0) {
    deps.notice(page > 1 ? `No courses on page ${page}.` : 'No courses found.');
    return { data, text: '' };
  }
  const hints = [deps.nextStep];
  if (data.last_page > data.page) {
    hints.unshift(`Page ${data.page} of ${data.last_page} (${data.total} courses). Next: --page ${data.page + 1}`);
  }
  const text = table(
    ['ID', 'Course', 'Teacher', 'Term', 'College'],
    courses.map((c) => [c.id, c.title, c.professors.join(', '), c.term ?? '', c.college ?? ''])
  );
  return { data, text, hints };
}

const run = (input: CommandInput, ctx: CliContext): Promise<CommandResult> =>
  searchCourses(input, {
    apiClient: ctx.apiClient,
    courseLookup: ctx.courseLookup,
    token: ANONYMOUS,
    notice: info,
    nextStep: `Run '${input.program} course <id>' to list a course's sessions.`,
  });

export const SEARCH_OPTIONS: OptionSpec[] = [
  { long: 'term', value: 'term', description: 'This term: 2025-2026-1 or a name from `yhdl terms` (default: the current term)' },
  { long: 'limit', value: 'n', description: `Courses per page, 1 to ${MAX_LIMIT} (default ${DEFAULT_LIMIT})` },
  { long: 'page', value: 'n', description: 'Page to show (default 1)' },
];

export const SEARCH_DATA =
  "{ keyword, term: string|null, source: 'yanhekt'|'local'|'online', page, last_page, total, courses: [{ id, title, title_en, professors: string[], college, term, classrooms: string[], participants }] }";

export const searchCommand: CliCommand = {
  summary: 'Find courses by name, teacher or course id (no sign-in)',
  args: '<keyword…>',
  description: [
    'Search courses in one term (default: the current one). The current term',
    'is searched on Yanhekt unless the app\'s Settings > General > Search picks',
    'the course index; earlier terms (back to 2023-2024-1) always come from the',
    'course index: on this computer, then the AutoSlides Index online. A number',
    'finds the course with that id. No sign-in is needed.',
  ],
  examples: ['search 微积分', 'search 泛函分析 --term 2025-2026-1 --json'],
  options: SEARCH_OPTIONS,
  positionals: { min: 1, max: Infinity },
  network: true,
  data: SEARCH_DATA,
  run,
};
