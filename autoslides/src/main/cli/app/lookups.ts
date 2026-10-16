// The read-only `autoslides` commands: the same lookups as `yhdl`, run by the
// app as its signed-in account and under its network settings. There is no
// `--token` / `--account`: the account is whichever the app is signed in with,
// and switching it is the app's business. Where `yhdl` reports `auth` (which
// token, from where), these report `account` (whose sign-in it is).
import { COURSE_DATA, showCourse } from '../commands/course';
import { MINE_DATA, MINE_OPTIONS, listMyCourses } from '../commands/mine';
import { SESSION_DATA, showSession } from '../commands/session';
import { TERMS_DATA, listTerms } from '../commands/terms';
import { requireSignIn } from './signIn';
import type { AppCommand } from './types';

const ACCOUNT_DATA = 'account: { name, badge } | null';

export const appMineCommand: AppCommand = {
  summary: 'List the courses you are enrolled in',
  args: '',
  description: ['List the courses the account signed in to AutoSlides is enrolled in.'],
  examples: ['mine', 'mine --page 2 --json'],
  options: MINE_OPTIONS,
  positionals: { min: 0, max: 0 },
  data: `${MINE_DATA}, ${ACCOUNT_DATA} }`,
  serve: async (input, ctx) => {
    const { token, account } = await requireSignIn(ctx);
    const result = await listMyCourses(input, { apiClient: ctx.apiClient, token, notice: ctx.term.info });
    return { ...result, data: { ...(result.data as object), account } };
  },
};

export const appCourseCommand: AppCommand = {
  summary: 'Show a course and list its sessions',
  args: '<course link or id>',
  description: [
    'Show one course and its sessions. A bare number is a course id; a link',
    'such as https://www.yanhekt.cn/course/<id> works too. Use --no-sessions',
    'to skip the session list.',
  ],
  examples: ['course 70101', 'course https://www.yanhekt.cn/course/70101 --json', 'course 70101 --no-sessions'],
  options: [{ long: 'no-sessions', description: 'Show the course only' }],
  positionals: { min: 1, max: 1 },
  data: `${COURSE_DATA}, ${ACCOUNT_DATA} }`,
  serve: async (input, ctx) => {
    const { token, account } = await requireSignIn(ctx);
    const result = await showCourse(input, {
      apiClient: ctx.apiClient,
      lookupToken: token,
      listToken: input.options['no-sessions'] === true ? null : token,
      notice: ctx.term.info,
    });
    return { ...result, data: { ...(result.data as object), account } };
  },
};

export const appSessionCommand: AppCommand = {
  summary: 'Show one session and its recordings',
  args: '<session link or id>',
  description: [
    'Show one recorded session: its course, time, length and which streams',
    'exist. A bare number is a session id; a link such as',
    'https://www.yanhekt.cn/session/<id> works too.',
  ],
  examples: ['session 850101', 'session https://www.yanhekt.cn/session/850101 --json'],
  options: [],
  positionals: { min: 1, max: 1 },
  data: SESSION_DATA,
  serve: async (input, ctx) => {
    const { token } = await requireSignIn(ctx);
    return showSession(input, ctx.apiClient, token);
  },
};

export const appTermsCommand: AppCommand = {
  summary: 'List the terms search --term accepts',
  args: '',
  description: ['List the terms Yanhekt knows, newest first. Any column works as a --term value.'],
  examples: ['terms'],
  options: [],
  positionals: { min: 0, max: 0 },
  data: TERMS_DATA,
  serve: async (_input, ctx) => {
    await requireSignIn(ctx);
    return listTerms(ctx.apiClient);
  },
};

export const appWhoamiCommand: AppCommand = {
  summary: 'Show which account AutoSlides is signed in with',
  args: '',
  description: [
    'Show the account AutoSlides is signed in to Yanhekt with: the one every',
    'command uses. The app checked it at launch; nothing new is sent to',
    'Yanhekt. Exits 4 when the app is signed out.',
  ],
  examples: ['whoami', 'whoami --json'],
  options: [],
  positionals: { min: 0, max: 0 },
  data: '{ signed_in: true, account: string|null, badge: string|null }',
  serve: async (_input, ctx) => {
    const { account } = await requireSignIn(ctx);
    return {
      data: { signed_in: true, account: account?.name ?? null, badge: account?.badge ?? null },
      text: `${account ? `${account.name} (${account.badge})` : 'An account not saved in AutoSlides'}, signed in to AutoSlides.`,
    };
  },
};
