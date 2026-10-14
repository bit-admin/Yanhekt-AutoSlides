import { describe, expect, it } from 'vitest';
import { transcriptIndexAt, transcriptLineAt, transcriptToSrt } from '@common/yanhe2Transcript';
import { parseYanhe2Transcript } from './yanhe2Transcript';

const body = (content: unknown[]) => ({
  code: 0,
  msg: '获取同传结果成功',
  total: 1,
  list: [{ sub_id: '3000101', trans_type: 'ainew', all_content: content, trans_content: JSON.stringify(content) }],
});

describe('parseYanhe2Transcript', () => {
  it('reads the lines out of all_content', () => {
    const lines = parseYanhe2Transcript(body([
      { BeginSec: 17, EndSec: 18, Text: '我用。', TransText: '' },
      { BeginSec: 82, EndSec: 88, Text: '我们开始上课了啊，', TransText: '' },
    ]));
    expect(lines).toEqual([
      { begin: 17, end: 18, text: '我用。' },
      { begin: 82, end: 88, text: '我们开始上课了啊，' },
    ]);
  });

  it('treats "no speech data" as an empty transcript', () => {
    expect(parseYanhe2Transcript({ code: 10002, msg: '未查询到语音数据' })).toEqual([]);
    expect(parseYanhe2Transcript({ code: 0, total: 0, list: [] })).toEqual([]);
  });

  it('sorts, drops empty lines and gives every line a length', () => {
    const lines = parseYanhe2Transcript(body([
      { BeginSec: 30, EndSec: 30, Text: 'b' },
      { BeginSec: 5, EndSec: 9, Text: 'a' },
      { BeginSec: 40, EndSec: 44, Text: '  ' },
      { EndSec: 3, Text: 'no start' },
      null,
    ]));
    expect(lines).toEqual([
      { begin: 5, end: 9, text: 'a' },
      { begin: 30, end: 31, text: 'b' },
    ]);
  });

  it('refuses another envelope', () => {
    expect(parseYanhe2Transcript({ code: -1 })).toBeNull();
    expect(parseYanhe2Transcript('nope')).toBeNull();
  });
});

describe('transcriptLineAt', () => {
  const lines = [
    { begin: 5, end: 9, text: 'a' },
    { begin: 9, end: 12, text: 'b' },
    { begin: 20, end: 24, text: 'c' },
  ];

  it('finds the line being spoken', () => {
    expect(transcriptLineAt(lines, 5)?.text).toBe('a');
    expect(transcriptLineAt(lines, 8.9)?.text).toBe('a');
    expect(transcriptLineAt(lines, 9)?.text).toBe('b');
    expect(transcriptLineAt(lines, 23.5)?.text).toBe('c');
  });

  it('is empty before, between and after lines', () => {
    expect(transcriptLineAt(lines, 0)).toBeNull();
    expect(transcriptLineAt(lines, 15)).toBeNull();
    expect(transcriptLineAt(lines, 24)).toBeNull();
    expect(transcriptLineAt([], 3)).toBeNull();
  });

  it('has an index that stays on a line through the pause after it', () => {
    expect(transcriptIndexAt(lines, 0)).toBe(-1);
    expect(transcriptIndexAt(lines, 5)).toBe(0);
    expect(transcriptIndexAt(lines, 15)).toBe(1);
    expect(transcriptIndexAt(lines, 99)).toBe(2);
    expect(transcriptIndexAt([], 3)).toBe(-1);
  });
});

describe('transcriptToSrt', () => {
  const lines = [
    { begin: 17, end: 18, text: '我用。' },
    { begin: 82, end: 90, text: '我们开始\n上课了啊，' },
    { begin: 88, end: 3725, text: '下一句。' },
  ];

  it('numbers the cues and writes SubRip clocks', () => {
    expect(transcriptToSrt(lines)).toBe([
      '1\n00:00:17,000 --> 00:00:18,000\n我用。\n',
      // Cut short where the next line begins; a line break inside a line would end the cue.
      '2\n00:01:22,000 --> 00:01:28,000\n我们开始 上课了啊，\n',
      '3\n00:01:28,000 --> 01:02:05,000\n下一句。\n',
    ].join('\n'));
  });

  it('holds every line back by the shift', () => {
    expect(transcriptToSrt(lines, 24.5).split('\n')[1]).toBe('00:00:41,500 --> 00:00:42,500');
  });

  it('drops a line shifted to before the start and renumbers', () => {
    const srt = transcriptToSrt(lines, -20);
    expect(srt.startsWith('1\n00:01:02,000 --> 00:01:08,000')).toBe(true);
  });

  it('is empty for no lines or blank text', () => {
    expect(transcriptToSrt([])).toBe('');
    expect(transcriptToSrt([{ begin: 1, end: 2, text: '  ' }])).toBe('');
  });
});
