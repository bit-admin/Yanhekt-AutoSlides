import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courseGrams, numberKey, prefixEnd, searchWords, splitWords, wordLookup } from './grams.ts';

test('splitWords: lowercase, split at punctuation and where CJK meets other scripts', () => {
  assert.deepEqual(splitWords('Java程序设计（双语）'), ['java', '程序设计', '双语']);
  assert.deepEqual(splitWords('电工和电子技术AⅠ'), ['电工和电子技术', 'aⅰ']);
  assert.deepEqual(splitWords('C++ 语言'), ['c', '语言']);
  assert.deepEqual(splitWords('Alex  Morgan'), ['alex', 'morgan']);
  assert.deepEqual(splitWords(null), []);
});

test('courseGrams: CJK bigrams, w: words (2+ characters), n: registrar code; no English name', () => {
  const grams = courseGrams({
    name: 'Java电路分析',
    teachers: ['王一', 'Alex Morgan'],
    number: '01S0120262027119999999901',
  });
  assert.deepEqual(grams.sort(), ['n:01s0120262027119999999901', 'w:morgan', 'w:java', 'w:alex', '分析', '王一', '电路', '路分'].sort());
});

test('wordLookup: non-overlapping pieces for CJK (at most 4), prefix for others, nothing for one character', () => {
  assert.deepEqual(wordLookup('电路'), { kind: 'bigrams', grams: ['电路'] });
  assert.deepEqual(wordLookup('大学物理'), { kind: 'bigrams', grams: ['大学', '物理'] });
  assert.deepEqual(wordLookup('马克思'), { kind: 'bigrams', grams: ['马克', '克思'] });
  assert.deepEqual(wordLookup('马克思主义'), { kind: 'bigrams', grams: ['马克', '思主', '主义'] });
  assert.deepEqual(wordLookup('电工和电子技术基础'), { kind: 'bigrams', grams: ['电工', '和电', '术基', '基础'] });
  assert.deepEqual(wordLookup('lin'), { kind: 'prefix', word: 'lin' });
  assert.deepEqual(wordLookup('100002'), { kind: 'prefix', word: '100002' });
  assert.deepEqual(wordLookup('张'), { kind: 'none' });
  assert.deepEqual(wordLookup('c'), { kind: 'none' });
  assert.deepEqual(wordLookup('and'), { kind: 'none' });
});

test('numberKey: the registrar code whole, lowercased; never split', () => {
  assert.equal(numberKey(' 202620271MTH1000112 '), '202620271mth1000112');
  assert.equal(numberKey('20261-17-1709901-1781234567890'), '20261-17-1709901-1781234567890');
  assert.equal(numberKey('电路 分析'), null);
  assert.equal(numberKey('1234'), null);
  assert.ok(courseGrams({ name: 'x', teachers: [], number: '20261-17-1709901-1781234567890' }).includes('n:20261-17-1709901-1781234567890'));
});

test('searchWords dedupes; prefixEnd bounds a prefix range', () => {
  assert.deepEqual(searchWords('电路 电路  Linear'), ['电路', 'linear']);
  assert.equal(prefixEnd('w:lin'), 'w:lio');
  assert.ok('w:linear' < prefixEnd('w:lin') && 'w:lio' >= prefixEnd('w:lin'));
});
