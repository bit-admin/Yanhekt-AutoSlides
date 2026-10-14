// `yhdl terms`: the terms Yanhekt filters by, for `search --term`. Anonymous.
import { table } from '../format';
import { semesterTermKey } from '../terms';
import type { CliCommand, CliContext, CommandResult } from '../types';

async function run(_input: unknown, ctx: CliContext): Promise<CommandResult> {
  const terms = (await ctx.apiClient.getAvailableSemesters()).map((o) => ({
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

export const termsCommand: CliCommand = {
  summary: 'List the terms search --term accepts',
  args: '',
  description: ['List the terms Yanhekt knows, newest first. Any column works as a --term value.'],
  examples: ['terms'],
  options: [],
  positionals: { min: 0, max: 0 },
  network: true,
  data: '{ terms: [{ id, term, label, label_en }] }',
  run,
};
