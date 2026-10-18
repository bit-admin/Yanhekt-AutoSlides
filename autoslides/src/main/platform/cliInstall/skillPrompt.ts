// The prompt Settings → Add-ons → Command Line copies for the user to paste
// into an AI agent. English for every UI locale: it is read by the agent, not
// shown as interface text.

export type SkillPlatform = 'darwin' | 'linux' | 'win32';

/** The Claude Code line that links the skill, for the example in the prompt. */
function linkCommand(skillDir: string, platform: SkillPlatform): string {
  if (platform === 'win32') {
    // A junction needs no administrator rights or Developer Mode, unlike a symlink.
    return (
      'New-Item -ItemType Directory -Force "$HOME\\.claude\\skills" | Out-Null; ' +
      `New-Item -ItemType Junction -Path "$HOME\\.claude\\skills\\autoslides-cli" -Target "${skillDir}"`
    );
  }
  return `mkdir -p ~/.claude/skills && ln -sfn "${skillDir}" ~/.claude/skills/autoslides-cli`;
}

export function buildSkillPrompt(skillDir: string, platform: SkillPlatform): string {
  return [
    'Install the AutoSlides command-line skill for me.',
    '',
    'AutoSlides keeps the skill in this folder (SKILL.md and a references folder):',
    skillDir,
    '',
    'Add it to your skills as "autoslides-cli" by linking to that folder, not by copying it. AutoSlides refreshes the folder when it updates, and a link picks that up. For Claude Code:',
    linkCommand(skillDir, platform),
    '',
    'If you keep skills somewhere else, link it there instead. If you cannot link, copy the folder, and copy it again after AutoSlides updates. If you do not support skills, read SKILL.md and follow it whenever I ask about Yanhekt lectures or AutoSlides.',
    '',
    'Then check that the commands work by running: autoslides schema --json',
    'If the command is not found, tell me to install it in AutoSlides under Settings > Add-ons > Command Line.',
  ].join('\n');
}
