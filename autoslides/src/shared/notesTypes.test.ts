import { describe, it, expect } from 'vitest';
import {
  buildManagedNoteTitle,
  buildShareImportTitle,
  isManagedNoteTitle,
  managedNoteDisplayName,
  managedNoteIdentity,
  shareImportDisplayName,
  splitNoteDisplayName,
} from './notesTypes';

describe('managed note titles', () => {
  it('builds the recorded form with id first and spaced session', () => {
    expect(
      buildManagedNoteTitle('泛函分析_第1周_星期三_第2大节', { courseId: '62313', sessionId: '751843' }),
    ).toBe('c62313s751843 · 泛函分析 · 第1周 星期三 第2大节');
  });

  it('builds the live form with course + broadcast ids', () => {
    expect(
      buildManagedNoteTitle('电工和电子技术BⅡ_2024秋季', { courseId: '71736', liveId: '761952' }),
    ).toBe('c71736l761952 · 电工和电子技术BⅡ 2024秋季');
  });

  it('round-trips folder stem and identity', () => {
    const title = buildManagedNoteTitle('泛函分析_第1周_星期三_第2大节', {
      courseId: 62313,
      sessionId: 751843,
    });
    expect(managedNoteIdentity(title)).toEqual({
      courseId: '62313',
      sessionId: '751843',
      liveId: undefined,
    });
    expect(managedNoteDisplayName(title)).toBe('泛函分析_第1周_星期三_第2大节');
    expect(isManagedNoteTitle(title)).toBe(true);
  });

  it('splits a folder-style display name', () => {
    expect(splitNoteDisplayName('泛函分析_第1周_星期三_第2大节')).toEqual({
      course: '泛函分析',
      session: '第1周 星期三 第2大节',
    });
    expect(splitNoteDisplayName('Real Analysis - Lecture 11')).toEqual({
      course: 'Real Analysis',
      session: 'Lecture 11',
    });
  });

  it('does not treat a user note as managed', () => {
    expect(isManagedNoteTitle('My shopping list')).toBe(false);
    expect(isManagedNoteTitle('AutoSlides Cloud Storage README')).toBe(false);
  });

  it('builds a share-import title from hydrated Yanhekt names', () => {
    expect(
      buildShareImportTitle(
        { courseId: '61841', sessionId: '751112' },
        { courseTitle: '操作系统', sessionTitle: '第1周 星期二 第5大节' },
      ),
    ).toBe('c61841s751112 · 操作系统 · 第1周 星期二 第5大节');
  });

  it('turns a hydrated share result into the on-disk folder stem', () => {
    expect(
      shareImportDisplayName({
        title: 'c61841s751112',
        identity: { courseId: '61841', sessionId: '751112' },
        lectureMeta: { courseTitle: '操作系统', sessionTitle: '第1周 星期二 第5大节' },
      }),
    ).toBe('操作系统_第1周_星期二_第5大节');
  });
});
