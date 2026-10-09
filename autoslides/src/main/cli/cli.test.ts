import { describe, it, expect } from 'vitest';
import { parseCliInvocation } from './invocation';
import { parseDownloadArgs } from './downloadArgs';

describe('parseCliInvocation', () => {
  it('is null for an ordinary app start', () => {
    expect(parseCliInvocation(['/Applications/AutoSlides.app/Contents/MacOS/AutoSlides'])).toBeNull();
    expect(parseCliInvocation(['electron', '.', '--demo-mode'])).toBeNull();
  });

  it('reads a wrapper bound to one command', () => {
    expect(parseCliInvocation(['exe', '--cli=download', '--', '123456', '--stream', 'both'])).toEqual({
      command: 'download',
      commandWord: 'download',
      bound: true,
      args: ['123456', '--stream', 'both'],
    });
  });

  it('reads the command from the umbrella wrapper', () => {
    expect(parseCliInvocation(['exe', '--cli', '--', 'download', '123456'])).toEqual({
      command: 'download',
      commandWord: 'download',
      bound: false,
      args: ['123456'],
    });
  });

  it('keeps an unknown command word for the error message', () => {
    const invocation = parseCliInvocation(['exe', '--cli', '--', 'extract', 'x']);
    expect(invocation?.command).toBeNull();
    expect(invocation?.commandWord).toBe('extract');
  });

  it('passes umbrella flags through without a command', () => {
    expect(parseCliInvocation(['exe', '--cli', '--', '--version'])).toEqual({
      command: null,
      bound: false,
      args: ['--version'],
    });
  });

  it('finds the switch after dev-mode arguments', () => {
    expect(parseCliInvocation(['electron', '.', '--cli=download', '--', '1'])?.args).toEqual(['1']);
  });
});

describe('parseDownloadArgs', () => {
  const run = (...args: string[]) => {
    const result = parseDownloadArgs(args);
    if (result.kind !== 'run') throw new Error(`expected run, got ${JSON.stringify(result)}`);
    return result.options;
  };

  it('accepts a bare id and defaults to the screen stream', () => {
    expect(run('123456')).toEqual({
      sessionId: '123456',
      streams: ['screen'],
      outputDir: undefined,
      intranet: false,
      force: false,
      verbose: false,
    });
  });

  it('accepts a session link', () => {
    expect(run('https://www.yanhekt.cn/session/123456').sessionId).toBe('123456');
  });

  it('reads options in either form and any position', () => {
    const options = run('--stream=both', '-o', '/tmp/x', '123456', '--intranet', '-f');
    expect(options.streams).toEqual(['screen', 'camera']);
    expect(options.outputDir).toBe('/tmp/x');
    expect(options.intranet).toBe(true);
    expect(options.force).toBe(true);
    expect(run('1', '--output=/a', '-s', 'camera')).toMatchObject({ outputDir: '/a', streams: ['camera'] });
  });

  it('reports usage errors', () => {
    expect(parseDownloadArgs([]).kind).toBe('error');
    expect(parseDownloadArgs(['1', '2']).kind).toBe('error');
    expect(parseDownloadArgs(['1', '--stream', 'audio']).kind).toBe('error');
    expect(parseDownloadArgs(['1', '-o']).kind).toBe('error');
    expect(parseDownloadArgs(['1', '--nope']).kind).toBe('error');
    expect(parseDownloadArgs(['https://example.com/session/1']).kind).toBe('error');
    expect(parseDownloadArgs(['https://www.yanhekt.cn/course/64333']).kind).toBe('error');
  });

  it('answers help and version without a session', () => {
    expect(parseDownloadArgs(['-h']).kind).toBe('help');
    expect(parseDownloadArgs(['1', '--version']).kind).toBe('version');
  });
});
