import { describe, expect, it } from 'vitest';
import { buildSkillPrompt } from './skillPrompt';

describe('buildSkillPrompt', () => {
  it('names the folder and links it rather than copying it', () => {
    const dir = '/Users/someone/Library/Application Support/AutoSlides/skills/autoslides-cli';
    const prompt = buildSkillPrompt(dir, 'darwin');
    expect(prompt).toContain(`\n${dir}\n`);
    expect(prompt).toContain(`mkdir -p ~/.claude/skills && ln -sfn "${dir}" ~/.claude/skills/autoslides-cli`);
    expect(prompt).toContain('autoslides schema --json');
  });

  it('uses a junction on Windows, which needs no administrator rights', () => {
    const dir = 'C:\\Users\\someone\\AppData\\Roaming\\AutoSlides\\skills\\autoslides-cli';
    const prompt = buildSkillPrompt(dir, 'win32');
    expect(prompt).toContain(`New-Item -ItemType Junction -Path "$HOME\\.claude\\skills\\autoslides-cli" -Target "${dir}"`);
    expect(prompt).not.toContain('ln -s');
  });
});
