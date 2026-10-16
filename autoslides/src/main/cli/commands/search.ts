// `yhdl search <keyword>`: find courses in the Yanhekt catalog. Anonymous.
//
// The keyword is matched by Yanhekt against course names and also accepts a
// numeric course id, so `search 70101` finds that one course.
import type { CourseData } from '@common/apiTypes';
import type { ApiClient } from '@main/platform/apiClient';
import { intOption, type OptionSpec } from '../args';
import { CliError } from '../errors';
import { englishTitle, table } from '../format';
import { matchTerm, semesterTermKey, termKey } from '../terms';
import { info } from '../terminal';
import type { CliCommand, CliContext, CommandInput, CommandResult } from '../types';

const ANONYMOUS = '';
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export function courseRowJson(c: CourseData) {
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

export interface SearchDeps {
  apiClient: ApiClient;
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

  let semesters: number[] = [];
  let term: string | null = null;
  const termArg = input.options.term;
  if (typeof termArg === 'string' && termArg.toLowerCase() !== 'all') {
    const match = matchTerm(termArg, await deps.apiClient.getAvailableSemesters());
    if (!match) throw new CliError('usage', `unknown term: ${termArg}`, `Run '${input.program} terms' to see the terms Yanhekt has.`);
    semesters = [match.id];
    term = semesterTermKey(match);
  }

  const result = await deps.apiClient.getCourseList(deps.token, { keyword, semesters, page, pageSize: limit });
  const courses = (result.data ?? []).map(courseRowJson);
  const data = {
    keyword,
    term,
    page: Number(result.current_page) || page,
    last_page: Number(result.last_page) || 1,
    total: Number(result.total) || 0,
    courses,
  };

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
    token: ANONYMOUS,
    notice: info,
    nextStep: `Run '${input.program} course <id>' to list a course's sessions.`,
  });

export const SEARCH_OPTIONS: OptionSpec[] = [
  { long: 'term', value: 'term', description: 'Only this term: 2025-2026-1, a name from `yhdl terms`, or all (default)' },
  { long: 'limit', value: 'n', description: `Courses per page, 1 to ${MAX_LIMIT} (default ${DEFAULT_LIMIT})` },
  { long: 'page', value: 'n', description: 'Page to show (default 1)' },
];

export const SEARCH_DATA =
  '{ keyword, term: string|null, page, last_page, total, courses: [{ id, title, title_en, professors: string[], college, term, classrooms: string[], participants }] }';

export const searchCommand: CliCommand = {
  summary: 'Find courses by name or course id (no sign-in)',
  args: '<keyword…>',
  description: [
    'Search the Yanhekt course catalog. The keyword matches course names; a',
    'number finds the course with that id. No sign-in is needed.',
  ],
  examples: ['search 微积分', 'search 泛函分析 --term 2025-2026-1 --json'],
  options: SEARCH_OPTIONS,
  positionals: { min: 1, max: Infinity },
  network: true,
  data: SEARCH_DATA,
  run,
};
