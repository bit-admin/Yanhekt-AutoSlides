// `yhdl mine`: the courses this account is enrolled in.
//
// `/v2/course/private/list` is a personal list, so like a session list it
// needs a login token — and like one, Yanhekt answers a missing or stale token
// with an empty list rather than an error.
import type { CourseListResponse } from '@common/apiTypes';
import { intOption } from '../args';
import { announceCredentials, credentialsJson, readCredentials } from '../auth';
import { table } from '../format';
import { info } from '../terminal';
import type { CliCommand, CliContext, CommandInput, CommandResult } from '../types';
import { DEFAULT_LIMIT, MAX_LIMIT, courseRowJson } from './search';

const EMPTY_NOTE =
  'Yanhekt listed no courses: this account is enrolled in none, or the token is no longer valid.';

async function run(input: CommandInput, ctx: CliContext): Promise<CommandResult> {
  const page = intOption(input.options.page, 'page', 1);
  const limit = intOption(input.options.limit, 'limit', DEFAULT_LIMIT, MAX_LIMIT);
  const credentials = readCredentials(input, ctx);
  announceCredentials(credentials, 'courses');

  const result = await ctx.apiClient.getPersonalCourseList(credentials.token, { page, pageSize: limit });
  // Without a valid token the answer is a bare `[]`, not a page.
  const pageData: Partial<CourseListResponse> = Array.isArray(result) ? {} : result;
  const courses = (pageData.data ?? []).map(courseRowJson);
  const data = {
    page: Number(pageData.current_page) || page,
    last_page: Number(pageData.last_page) || 1,
    total: Number(pageData.total) || courses.length,
    courses,
    auth: credentialsJson(credentials),
    ...(courses.length === 0 && page === 1 ? { note: EMPTY_NOTE } : {}),
  };

  if (courses.length === 0) {
    info(page > 1 ? `No courses on page ${page}.` : EMPTY_NOTE);
    return { data, text: '' };
  }
  const hints = [`Run '${input.program} course <id>' to list a course's sessions.`];
  if (data.last_page > data.page) {
    hints.unshift(`Page ${data.page} of ${data.last_page} (${data.total} courses). Next: --page ${data.page + 1}`);
  }
  const text = table(
    ['ID', 'Course', 'Teacher', 'Term', 'College'],
    courses.map((c) => [c.id, c.title, c.professors.join(', '), c.term ?? '', c.college ?? ''])
  );
  return { data, text, hints };
}

export const mineCommand: CliCommand = {
  summary: 'List the courses you are enrolled in (needs sign-in)',
  args: '',
  description: [
    'List the courses this account is enrolled in. This needs a sign-in: the',
    'token comes from --token, --account, YANHEKT_TOKEN, or the account signed',
    'in to AutoSlides, in that order.',
  ],
  examples: ['mine', 'mine --account alice --json'],
  options: [
    { long: 'limit', value: 'n', description: `Courses per page, 1 to ${MAX_LIMIT} (default ${DEFAULT_LIMIT})` },
    { long: 'page', value: 'n', description: 'Page to show (default 1)' },
  ],
  positionals: { min: 0, max: 0 },
  network: true,
  tokenUse: 'To read the account\'s course list',
  data: '{ page, last_page, total, courses: [{ id, title, title_en, professors: string[], college, term, classrooms: string[], participants }], auth: { source, account }, note?: string }',
  run,
};
