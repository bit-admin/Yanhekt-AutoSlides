// `autoslides search <keyword>`: the catalog search, run by the app as its
// signed-in user and under its network settings.
import { SEARCH_DATA, SEARCH_OPTIONS, searchCourses } from '../commands/search';
import { requireSignIn } from './signIn';
import type { AppCommand } from './types';

export const appSearchCommand: AppCommand = {
  summary: 'Find courses by name, teacher or course id',
  args: '<keyword…>',
  description: [
    'Search courses in one term (default: the current one), as the app\'s',
    'Search page does: the current term on Yanhekt unless Settings > General >',
    'Search picks the course index; earlier terms (back to 2023-2024-1) from the',
    'course index. A number finds the course with that id.',
  ],
  examples: ['search 微积分', 'search 泛函分析 --term 2025-2026-1 --json'],
  options: SEARCH_OPTIONS,
  positionals: { min: 1, max: Infinity },
  data: SEARCH_DATA,
  serve: async (input, ctx) => {
    const { token } = await requireSignIn(ctx);
    return searchCourses(input, {
      apiClient: ctx.apiClient,
      courseLookup: ctx.courseLookup,
      token,
      notice: ctx.term.info,
      nextStep: `Run '${input.program} course <id>' to list a course's sessions.`,
    });
  },
};
