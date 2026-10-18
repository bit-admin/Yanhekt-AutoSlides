// The prompts Settings → Add-ons → Command Line copies for the user to paste
// into an AI agent. English for every UI locale: it is read by the agent, not
// shown as interface text.
//
// Two scopes: `personal` (every project the agent works in; the default) and
// `project` (only the one it is working in, for users who do not want the
// skill in every project's context).
import type { CliSkillScope } from '@common/cliCommands';

export type SkillPlatform = 'darwin' | 'linux' | 'win32';

/** Claude Code's skills folder for the scope: the user's, or the project's (relative to its root). */
function skillsFolder(scope: CliSkillScope, platform: SkillPlatform): string {
  if (platform === 'win32') return scope === 'personal' ? '$HOME\\.claude\\skills' : '.claude\\skills';
  return scope === 'personal' ? '~/.claude/skills' : '.claude/skills';
}

/** The Claude Code line that links the skill, for the example in the prompt. */
function linkCommand(skillDir: string, platform: SkillPlatform, scope: CliSkillScope): string {
  const folder = skillsFolder(scope, platform);
  if (platform === 'win32') {
    // A junction needs no administrator rights or Developer Mode, unlike a symlink.
    return (
      `New-Item -ItemType Directory -Force "${folder}" | Out-Null; ` +
      `New-Item -ItemType Junction -Path "${folder}\\autoslides-cli" -Target "${skillDir}"`
    );
  }
  return `mkdir -p ${folder} && ln -sfn "${skillDir}" ${folder}/autoslides-cli`;
}

const WHERE: Record<CliSkillScope, string[]> = {
  personal: [
    'Install it for me personally, so it works in every project, not only the current one.',
  ],
  project: [
    'Install it for the current project only, not for me personally: I do not want it in other projects.',
    'The link holds a path on this computer, so keep it out of version control. In a git repository, add .claude/skills/autoslides-cli to .git/info/exclude rather than to .gitignore.',
  ],
};

export function buildSkillPrompt(skillDir: string, platform: SkillPlatform, scope: CliSkillScope): string {
  return [
    'Install the AutoSlides command-line skill for me.',
    '',
    'AutoSlides keeps the skill in this folder (SKILL.md and a references folder):',
    skillDir,
    '',
    ...WHERE[scope],
    '',
    `Add it to your skills as "autoslides-cli" by linking to that folder, not by copying it. AutoSlides refreshes the folder when it updates, and a link picks that up. For Claude Code${scope === 'project' ? ', from the project root' : ''}:`,
    linkCommand(skillDir, platform, scope),
    '',
    `If your ${scope === 'personal' ? 'personal' : 'project'} skills folder is somewhere else, link it there instead. If you cannot link, copy the folder, and copy it again after AutoSlides updates. If you do not support skills, read SKILL.md and follow it whenever I ask about Yanhekt lectures or AutoSlides.`,
    '',
    'Then check that the commands work by running: autoslides schema --json',
    'If the command is not found, tell me to install it in AutoSlides under Settings > Add-ons > Command Line.',
  ].join('\n');
}
