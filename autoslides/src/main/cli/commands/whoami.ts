// `yhdl whoami`: which token the personal lists (`course`, `mine`) would use,
// and whose it is. Offline: nothing is sent, so the token is not checked, and it is never
// printed.
import { credentialsJson, readCredentials } from '../auth';
import { TOKEN_SOURCE_TEXT } from '../credentials';
import type { CliCommand, CliContext, CommandInput, CommandResult } from '../types';

async function run(input: CommandInput, ctx: CliContext): Promise<CommandResult> {
  const credentials = readCredentials(input, ctx);
  const who = credentials.account ? `${credentials.account.name} (${credentials.account.badge})` : 'an account not saved in AutoSlides';
  return {
    data: { ...credentialsJson(credentials), badge: credentials.account?.badge ?? null },
    text: `${who}, from ${TOKEN_SOURCE_TEXT[credentials.source]}.`,
  };
}

export const whoamiCommand: CliCommand = {
  summary: 'Show which sign-in course and mine would use (offline)',
  args: '',
  description: [
    'Show which token `course`, `mine` and `download --course` would use, and the',
    'saved account it belongs to. Nothing is sent to Yanhekt, so the token is',
    'not checked. Exits 4 when there is none.',
  ],
  examples: ['whoami', 'whoami --account 张三 --json'],
  options: [],
  positionals: { min: 0, max: 0 },
  network: false,
  tokenUse: 'Reads it to report where it comes from; sends nothing',
  data: '{ source: "flag"|"account"|"env"|"app", account: string|null, badge: string|null }',
  run,
};
