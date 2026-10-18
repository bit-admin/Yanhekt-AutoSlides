// The commands `autoslides` sends to the running app. `schema` is not here: it
// describes the commands and answers in the terminal.
import type { CliAppCommandId } from '@common/cliCommands';
import { appConfigCommand } from './config';
import { appDownloadCommand } from './download';
import { appDownloadsCommand } from './downloads';
import { appCourseCommand, appMineCommand, appSessionCommand, appTermsCommand, appWhoamiCommand } from './lookups';
import { appSearchCommand } from './search';
import type { AppCommand } from './types';

export const APP_COMMANDS: Record<Exclude<CliAppCommandId, 'schema'>, AppCommand> = {
  search: appSearchCommand,
  mine: appMineCommand,
  course: appCourseCommand,
  session: appSessionCommand,
  download: appDownloadCommand,
  downloads: appDownloadsCommand,
  terms: appTermsCommand,
  whoami: appWhoamiCommand,
  config: appConfigCommand,
};

export type { AppCommand, AppCommandContext } from './types';
