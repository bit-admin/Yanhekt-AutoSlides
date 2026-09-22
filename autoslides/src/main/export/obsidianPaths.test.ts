import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendSeparator,
  findVaultRoot,
  isSafeSlideFilename,
  markdownImageLink,
  normalizeSubfolder,
  noteFileNameFromTitle,
  parseAttachmentFolderPath,
  resolveSlidesDir,
} from './obsidianPaths';

const V = path.resolve('/home/kate/Vault');
const note = path.join(V, 'Courses', 'Analysis.md');
const SLIDES = 'slides_泛函分析__c62313s751843';

describe('findVaultRoot', () => {
  const vaults = new Set([V]);
  const isVault = (d: string) => vaults.has(d);

  it('finds a vault above a nested note', () => {
    expect(findVaultRoot(path.join(V, 'a', 'b'), isVault, '/home/kate')).toBe(V);
  });

  it('finds the vault when the note sits at its root', () => {
    expect(findVaultRoot(V, isVault, '/home/kate')).toBe(V);
  });

  it('stops at the home folder', () => {
    expect(findVaultRoot('/home/kate/Documents/x', isVault, '/home/kate')).toBeNull();
  });

  it('stops at the filesystem root and at the depth cap', () => {
    expect(findVaultRoot('/tmp/x', () => false, '/nowhere')).toBeNull();
    expect(findVaultRoot(path.join(V, 'a', 'b', 'c'), isVault, '/home/kate', 2)).toBeNull();
  });
});

describe('parseAttachmentFolderPath', () => {
  it('reads the setting and tolerates missing or malformed files', () => {
    expect(parseAttachmentFolderPath('{"attachmentFolderPath":"./assets"}')).toBe('./assets');
    expect(parseAttachmentFolderPath('{}')).toBeUndefined();
    expect(parseAttachmentFolderPath('not json')).toBeUndefined();
    expect(parseAttachmentFolderPath(null)).toBeUndefined();
  });
});

describe('resolveSlidesDir', () => {
  it('uses the vault root by default and for "/"', () => {
    expect(resolveSlidesDir(V, note, undefined, SLIDES)).toBe(path.join(V, SLIDES));
    expect(resolveSlidesDir(V, note, '/', SLIDES)).toBe(path.join(V, SLIDES));
  });

  it('uses the note folder for "./" and a subfolder for "./x"', () => {
    expect(resolveSlidesDir(V, note, './', SLIDES)).toBe(path.join(V, 'Courses', SLIDES));
    expect(resolveSlidesDir(V, note, './assets', SLIDES)).toBe(path.join(V, 'Courses', 'assets', SLIDES));
  });

  it('uses a vault-relative folder otherwise', () => {
    expect(resolveSlidesDir(V, note, 'Attachments/img', SLIDES)).toBe(path.join(V, 'Attachments', 'img', SLIDES));
  });

  it('falls back to the note folder when the setting escapes the vault', () => {
    expect(resolveSlidesDir(V, note, '../outside', SLIDES)).toBe(path.join(V, 'Courses', SLIDES));
  });

  it('puts slides next to the note when there is no vault', () => {
    expect(resolveSlidesDir(null, '/docs/n.md', undefined, SLIDES)).toBe(path.join(path.resolve('/docs'), SLIDES));
  });
});

describe('noteFileNameFromTitle', () => {
  it('keeps the middle dot and strips unsafe characters', () => {
    expect(noteFileNameFromTitle('c62313s751843 · 泛函分析 · 第1周 星期三 第2大节'))
      .toBe('c62313s751843 · 泛函分析 · 第1周 星期三 第2大节.md');
    expect(noteFileNameFromTitle('A/B: C? [x] #1.')).toBe('A B C x 1.md');
    expect(noteFileNameFromTitle('   ')).toBe('AutoSlides.md');
  });
});

describe('normalizeSubfolder', () => {
  it('normalizes and refuses escapes', () => {
    expect(normalizeSubfolder('AutoSlides')).toBe('AutoSlides');
    expect(normalizeSubfolder('/School\\Notes/')).toBe('School/Notes');
    expect(normalizeSubfolder('')).toBe('');
    expect(normalizeSubfolder('../x')).toBeNull();
  });
});

describe('markdownImageLink', () => {
  it('links relative to the note with forward slashes and angle brackets', () => {
    const img = path.join(V, SLIDES, 'Slide_12.png');
    expect(markdownImageLink(note, img)).toBe(`![](<../${SLIDES}/Slide_12.png>)`);
  });

  it('keeps spaces and CJK as-is', () => {
    const img = path.join(V, 'Courses', 'my slides 图', 'Slide_1.png');
    expect(markdownImageLink(note, img)).toBe('![](<my slides 图/Slide_1.png>)');
  });
});

describe('appendSeparator', () => {
  it('ends the file on a blank line before appending', () => {
    expect(appendSeparator('', 0)).toBe('');
    expect(appendSeparator('text', 4)).toBe('\n\n');
    expect(appendSeparator('text\n', 5)).toBe('\n');
    expect(appendSeparator('text\n\n', 6)).toBe('');
  });
});

describe('isSafeSlideFilename', () => {
  it('accepts slide names only', () => {
    expect(isSafeSlideFilename('Slide_1712_3.png')).toBe(true);
    expect(isSafeSlideFilename('../Slide_1.png')).toBe(false);
    expect(isSafeSlideFilename('Slide_..png')).toBe(false);
    expect(isSafeSlideFilename('note.md')).toBe(false);
  });
});
