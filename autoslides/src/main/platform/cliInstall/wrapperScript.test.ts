import { describe, it, expect } from 'vitest';
import { CLI_WRAPPERS } from '@common/cliCommands';
import {
  WRAPPER_MARKER,
  buildPathCommand,
  buildWrapperScript,
  classifyWrapper,
  isDirOnPath,
  wrapperFileName,
} from './wrapperScript';

const umbrella = CLI_WRAPPERS.find((w) => w.command === null)!;
const yhdl = CLI_WRAPPERS.find((w) => w.name === 'yhdl')!;

describe('buildWrapperScript', () => {
  it('binds a posix wrapper to its command and ends switch parsing', () => {
    const script = buildWrapperScript(yhdl, '/Applications/AutoSlides.app/Contents/MacOS/AutoSlides', 'posix');
    expect(script.startsWith('#!/bin/sh\n')).toBe(true);
    expect(script).toContain(WRAPPER_MARKER);
    expect(script).toContain(`exec "$APP" --cli=download -- "$@"`);
  });

  it('quotes a path that contains a single quote', () => {
    const script = buildWrapperScript(yhdl, `/Users/o'neil/AutoSlides`, 'posix');
    expect(script).toContain(`APP='/Users/o'\\''neil/AutoSlides'`);
  });

  it('opens the app when the umbrella command gets no arguments', () => {
    const script = buildWrapperScript(umbrella, '/opt/AutoSlides/autoslides', 'posix');
    expect(script).toContain('if [ "$#" -eq 0 ]; then\n  exec "$APP"\nfi');
    expect(script).toContain('exec "$APP" --cli -- "$@"');
  });

  it('writes a CRLF batch file on Windows and returns the exit code', () => {
    const script = buildWrapperScript(yhdl, 'C:\\Program Files\\AutoSlides\\AutoSlides.exe', 'win32');
    expect(script).toContain(WRAPPER_MARKER);
    expect(script).toContain('"%APP%" --cli=download -- %*\r\n');
    expect(script.endsWith('exit /b %ERRORLEVEL%\r\n')).toBe(true);
    expect(script.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('escapes percent signs in a Windows path', () => {
    expect(buildWrapperScript(yhdl, 'C:\\100%\\a.exe', 'win32')).toContain('set "APP=C:\\100%%\\a.exe"');
  });

  it('names the file per platform', () => {
    expect(wrapperFileName(yhdl, 'posix')).toBe('yhdl');
    expect(wrapperFileName(yhdl, 'win32')).toBe('yhdl.cmd');
  });
});

describe('classifyWrapper', () => {
  const expected = buildWrapperScript(yhdl, '/a/AutoSlides', 'posix');

  it('tells our files from anyone else\'s', () => {
    expect(classifyWrapper(null, expected)).toBe('not_installed');
    expect(classifyWrapper(expected, expected)).toBe('installed');
    expect(classifyWrapper(buildWrapperScript(yhdl, '/b/AutoSlides', 'posix'), expected)).toBe('outdated');
    expect(classifyWrapper('#!/bin/sh\necho hi\n', expected)).toBe('foreign');
  });
});

describe('isDirOnPath', () => {
  it('matches a posix entry exactly, ignoring a trailing slash', () => {
    expect(isDirOnPath('/Users/k/.local/bin', '/usr/bin:/Users/k/.local/bin/:/bin', 'posix')).toBe(true);
    expect(isDirOnPath('/Users/k/.local/bin', '/usr/bin:/Users/k/.local/bin2', 'posix')).toBe(false);
  });

  it('ignores case on Windows', () => {
    const dir = 'C:\\Users\\K\\AppData\\Local\\Microsoft\\WindowsApps';
    expect(isDirOnPath(dir, `C:\\Windows;${dir.toLowerCase()}\\`, 'win32')).toBe(true);
    expect(isDirOnPath(dir, 'C:\\Windows', 'win32')).toBe(false);
  });
});

describe('buildPathCommand', () => {
  const line = 'export PATH="$HOME/.local/bin:$PATH"';

  it('appends to the profile the shell actually reads, and applies it now', () => {
    expect(buildPathCommand('/bin/zsh', 'darwin', '/Users/k/.local/bin')).toBe(
      `echo '${line}' >> ~/.zshrc && source ~/.zshrc`
    );
    expect(buildPathCommand('/bin/bash', 'darwin', '')).toContain('>> ~/.bash_profile && source ~/.bash_profile');
    expect(buildPathCommand('/usr/bin/bash', 'linux', '')).toContain('>> ~/.bashrc && source ~/.bashrc');
    expect(buildPathCommand('/bin/dash', 'linux', '')).toContain('>> ~/.profile && . ~/.profile');
    expect(buildPathCommand(undefined, 'darwin', '')).toContain('>> ~/.zshrc && source ~/.zshrc');
  });

  it('uses fish\'s own command', () => {
    expect(buildPathCommand('/opt/homebrew/bin/fish', 'darwin', '')).toBe('fish_add_path ~/.local/bin');
  });

  it('sets the user PATH on Windows', () => {
    const command = buildPathCommand(undefined, 'win32', 'C:\\Users\\K\\AppData\\Local\\AutoSlides\\bin');
    expect(command).toContain("'User') + ';C:\\Users\\K\\AppData\\Local\\AutoSlides\\bin', 'User')");
  });
});
