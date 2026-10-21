// `yhdl terms`: the terms `search --term` accepts. Anonymous. Only the current
// term since Yanhekt stopped publishing its term list (2026-10).
import type { ApiClient } from '@main/platform/apiClient';
import { table } from '../format';
import { semesterTermKey } from '../terms';
import type { CliCommand, CliContext, CommandResult } from '../types';

/** The term list, for both the terminal command and the app's. */
export async function listTerms(apiClient: ApiClient): Promise<CommandResult> {
  const terms = (await apiClient.getAvailableSemesters()).map((o) => ({
    id: String(o.id),
    term: semesterTermKey(o),
    label: o.label,
    label_en: o.labelEn,
  }));
  return {
    data: { terms },
    text: table(['Term', 'Name', 'English'], terms.map((t) => [t.term, t.label, t.label_en])),
  };
}

const run = (_input: unknown, ctx: CliContext): Promise<CommandResult> => listTerms(ctx.apiClient);

export const TERMS_DATA = '{ terms: [{ id, term, label, label_en }] }';

export const termsCommand: CliCommand = {
  summary: 'List the terms search --term accepts',
  args: '',
  description: ['List the terms search --term accepts: for now only the current one. Any column works as a --term value.'],
  examples: ['terms'],
  options: [],
  positionals: { min: 0, max: 0 },
  network: true,
  data: TERMS_DATA,
  run,
};
