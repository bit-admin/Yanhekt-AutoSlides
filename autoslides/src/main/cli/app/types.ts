import type { ApiClient } from '@main/platform/apiClient';
import type { CourseLookup } from '@main/platform/courseIndex/courseLookup';
import type { SettingsWriter } from '@main/ipc/settingsWriter';
import type { ConfigService } from '@main/platform/configService';
import type { EnrolledCoursesService } from '@main/platform/enrolled/enrolledCoursesService';
import type { RendererBridge } from '../control/rendererBridge';
import type { CliCommand, CommandInput, CommandResult } from '../types';

/** The client's terminal, reached over the socket. Same calls as `terminal.ts`. */
export interface AppTerminal {
  info: (text: string) => void;
  status: (text: string) => void;
  endStatusLine: () => void;
  out: (text: string) => void;
}

/**
 * The settings a command may change, each applied exactly as the Settings
 * page applies it (saved, put into effect, sent to every window).
 */
export type AppSettingsWriter = SettingsWriter;

/** What a command running inside the app may use. */
export interface AppCommandContext {
  /** Read the config here; change it only through `settings`. */
  configService: ConfigService;
  settings: AppSettingsWriter;
  apiClient: ApiClient;
  /** Course index search and lookups (Settings → General → Search). */
  courseLookup: CourseLookup;
  enrolledCoursesService: EnrolledCoursesService;
  renderer: RendererBridge;
  term: AppTerminal;
  /** Aborted when the client goes away (Ctrl-C); work already handed to the app keeps going. */
  signal: AbortSignal;
}

/**
 * An `autoslides` command: the same record a terminal command has, minus the
 * route and token options (the app's settings and account apply), plus the
 * part that runs inside the app.
 */
export interface AppCommand extends Omit<CliCommand, 'run' | 'network' | 'tokenUse'> {
  serve: (input: CommandInput, ctx: AppCommandContext) => Promise<CommandResult>;
}
