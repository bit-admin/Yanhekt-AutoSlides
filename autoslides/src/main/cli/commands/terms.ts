// `yhdl terms`: the terms `search --term` accepts. Anonymous. Yanhekt names
// only the current term (it stopped publishing its term list in 2026-10); the
// earlier terms back to 2023-2024-1 are listed from it and searched in the
// course index.
import type { ApiClient } from '@main/platform/apiClient';
import { isEarlierTermOption } from '@common/termOptions';
import { table } from '../format';
import { semesterTermKey } from '../terms';
import { cliTermOptions } from './search';
import type { CliCommand, CliContext, CommandResult } from '../types';

/** The term list, for both the terminal command and the app's. */
export async function listTerms(apiClient: ApiClient): Promise<CommandResult> {
  const options = await cliTermOptions(apiClient);
  if (options.length === 0) await apiClient.getAvailableSemesters(); // throws the reason
  const terms = options.map((o) => ({
    id: isEarlierTermOption(o.id) ? null : String(o.id),
    term: semesterTermKey(o),
    label: o.label,
    label_en: o.labelEn,
    current: !isEarlierTermOption(o.id),
  }));
  return {
    data: { terms },
    text: table(['Term', 'Name', 'English', ''], terms.map((t) => [t.term, t.label, t.label_en, t.current ? 'current' : ''])),
  };
}

const run = (_input: unknown, ctx: CliContext): Promise<CommandResult> => listTerms(ctx.apiClient);

export const TERMS_DATA = '{ terms: [{ id: string|null, term, label, label_en, current: boolean }] }';

export const termsCommand: CliCommand = {
  summary: 'List the terms search --term accepts',
  args: '',
  description: [
    'List the terms search --term accepts: the current one (Yanhekt) and every',
    'earlier term back to 2023-2024-1 (the course index). Term, Name or English works as a --term value.',
  ],
  examples: ['terms'],
  options: [],
  positionals: { min: 0, max: 0 },
  network: true,
  data: TERMS_DATA,
  run,
};
