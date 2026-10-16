// The commands `autoslides` sends to the running app. `schema` is not here: it
// describes the commands and answers in the terminal.
import type { CliAppCommandId } from '@common/cliCommands';
import { appDownloadCommand } from './download';
import { appCourseCommand, appMineCommand, appSessionCommand, appTermsCommand, appWhoamiCommand } from './lookups';
import { appSearchCommand } from './search';
import type { AppCommand } from './types';

export const APP_COMMANDS: Record<Exclude<CliAppCommandId, 'schema'>, AppCommand> = {
  search: appSearchCommand,
  mine: appMineCommand,
  course: appCourseCommand,
  session: appSessionCommand,
  download: appDownloadCommand,
  terms: appTermsCommand,
  whoami: appWhoamiCommand,
};

export type { AppCommand, AppCommandContext } from './types';
