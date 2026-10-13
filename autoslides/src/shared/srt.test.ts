import { describe, expect, it } from 'vitest';
import { parseSrt } from './srt';
import { transcriptToSrt } from './yanhe2Transcript';

describe('parseSrt', () => {
  it('reads back what the subtitle download writes', () => {
    const lines = [
      { begin: 5, end: 9, text: '同学们好' },
      { begin: 9, end: 14, text: '今天讲人口老龄化' },
    ];
    expect(parseSrt('\uFEFF' + transcriptToSrt(lines, 1.5))).toEqual([
      { begin: 6.5, end: 10.5, text: '同学们好' },
      { begin: 10.5, end: 15.5, text: '今天讲人口老龄化' },
    ]);
  });

  it('takes Windows line ends, dots, tags, two-line cues and a missing counter', () => {
    const source = [
      '1\r\n00:00:01.5 --> 00:00:03.250\r\n<i>first</i>\r\nsecond line\r\n',
      '01:00:00,000 --> 01:00:02,000\r\n{\\an8}late\r\n',
    ].join('\r\n');
    expect(parseSrt(source)).toEqual([
      { begin: 1.5, end: 3.25, text: 'first second line' },
      { begin: 3600, end: 3602, text: 'late' },
    ]);
  });

  it('skips what is not a cue and sorts the rest', () => {
    const source = [
      'not a cue at all',
      '2\n00:00:10,000 --> 00:00:12,000\nlater',
      '3\n00:00:05,000 --> 00:00:05,000\nno length',
      '4\n00:00:07,000 --> 00:00:08,000\n',
      '1\n00:00:02,000 --> 00:00:04,000\nearlier',
    ].join('\n\n');
    expect(parseSrt(source).map((cue) => cue.text)).toEqual(['earlier', 'later']);
    expect(parseSrt('')).toEqual([]);
  });
});
