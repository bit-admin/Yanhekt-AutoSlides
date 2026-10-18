import { describe, expect, it } from 'vitest';
import { buildSkillPrompt } from './skillPrompt';

const MAC_DIR = '/Users/someone/Library/Application Support/AutoSlides/skills/autoslides-cli';
const WIN_DIR = 'C:\\Users\\someone\\AppData\\Roaming\\AutoSlides\\skills\\autoslides-cli';

describe('buildSkillPrompt', () => {
  it('names the folder and links it into the personal skills by default', () => {
    const prompt = buildSkillPrompt(MAC_DIR, 'darwin', 'personal');
    expect(prompt).toContain(`\n${MAC_DIR}\n`);
    expect(prompt).toContain('every project');
    expect(prompt).toContain(`mkdir -p ~/.claude/skills && ln -sfn "${MAC_DIR}" ~/.claude/skills/autoslides-cli`);
    expect(prompt).toContain('autoslides schema --json');
  });

  it('keeps a project install in that project and out of version control', () => {
    const prompt = buildSkillPrompt(MAC_DIR, 'darwin', 'project');
    expect(prompt).toContain('current project only');
    expect(prompt).toContain(`mkdir -p .claude/skills && ln -sfn "${MAC_DIR}" .claude/skills/autoslides-cli`);
    expect(prompt).toContain('.git/info/exclude');
    expect(prompt).not.toContain('~/.claude');
  });

  it('uses a junction on Windows, which needs no administrator rights', () => {
    const personal = buildSkillPrompt(WIN_DIR, 'win32', 'personal');
    expect(personal).toContain(`New-Item -ItemType Junction -Path "$HOME\\.claude\\skills\\autoslides-cli" -Target "${WIN_DIR}"`);
    expect(personal).not.toContain('ln -s');
    const project = buildSkillPrompt(WIN_DIR, 'win32', 'project');
    expect(project).toContain(`New-Item -ItemType Junction -Path ".claude\\skills\\autoslides-cli" -Target "${WIN_DIR}"`);
  });
});
