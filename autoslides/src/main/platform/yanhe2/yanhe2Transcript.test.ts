import { describe, expect, it } from 'vitest';
import { transcriptLineAt } from '@common/yanhe2Transcript';
import { parseYanhe2Transcript } from './yanhe2Transcript';

const body = (content: unknown[]) => ({
  code: 0,
  msg: '获取同传结果成功',
  total: 1,
  list: [{ sub_id: '1546346', trans_type: 'ainew', all_content: content, trans_content: JSON.stringify(content) }],
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
});
