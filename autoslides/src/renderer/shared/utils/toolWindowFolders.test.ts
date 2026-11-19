import { describe, it, expect } from 'vitest';
import type { SlideMetadata } from '@common/slideMetadataTypes';
import {
  compareToolFolderEntries,
  formatToolFolderName,
  getCourseId,
  getCourseKey,
  getCourseLabel,
  getLiveId,
  getSessionId,
  getSlideFolderDisplayLabel,
} from './toolWindowFolders';

/** Minimal metadata carrying just the identity fields grouping reads. */
function meta(courseId?: string, sessionId?: string, courseTitle?: string): SlideMetadata {
  return {
    version: 1,
    kind: 'recorded',
    source: { courseId, sessionId, courseTitle },
    extraction: { extractor: 'builtin', extractedAt: '' },
    review: { reviewed: false, reviewedAt: null, edited: false, editedAt: null, cropped: false },
    createdAt: '',
    updatedAt: '',
  };
}

// The three sources getCourseKey falls through, all of which occur on real
// disks: post-refactor folders carry ids in the name; folders written between
// the metadata work and the naming work have ids only in metadata.json; folders
// from <= v4.4.1 have neither.
describe('getCourseKey fallback chain', () => {
  it('1. prefers the course id embedded in the folder name', () => {
    const folder = { name: 'slides_泛函分析_第1周_星期三_第2大节__c70101s850101' };
    expect(getCourseKey(folder)).toBe('id:70101');
    expect(getCourseId(folder)).toBe('70101');
    expect(getSessionId(folder)).toBe('850101');
  });

  it('2. falls back to metadata.json when the name has no ids', () => {
    const folder = { name: 'slides_泛函分析_第1周_星期三_第2大节', metadata: meta('70101', '850101') };
    expect(getCourseKey(folder)).toBe('id:70101');
    expect(getCourseId(folder)).toBe('70101');
    expect(getSessionId(folder)).toBe('850101');
  });

  it('3. falls back to the parsed course title when there is neither', () => {
    const folder = { name: 'slides_泛函分析_第1周_星期三_第5大节', metadata: null };
    expect(getCourseKey(folder)).toBe('name:泛函分析');
    expect(getCourseId(folder)).toBeUndefined();
    expect(getSessionId(folder)).toBeUndefined();
  });

  it('groups an id-bearing folder apart from an identically-titled id-less one', () => {
    const identified = { name: 'slides_泛函分析_第1周_星期三_第2大节__c70101s850101' };
    const anonymous = { name: 'slides_泛函分析_第1周_星期三_第5大节', metadata: null };
    expect(getCourseKey(identified)).not.toBe(getCourseKey(anonymous));
    // ...while both still render the same course label, which is why the header
    // needs the id (or a "no ID" marker) to stay distinguishable.
    expect(getCourseLabel(identified)).toBe(getCourseLabel(anonymous));
  });

  it('separates two same-titled courses that differ only by id', () => {
    const a = { name: 'slides_高等数学_第1周_星期一_第1大节__c1001s5001' };
    const b = { name: 'slides_高等数学_第1周_星期一_第1大节__c2002s6002' };
    expect(getCourseKey(a)).not.toBe(getCourseKey(b));
    expect(formatToolFolderName(a.name)).toBe(formatToolFolderName(b.name));
  });

  // Real values: broadcasts 760952 and 761951 are both course 71001.
  it('groups two broadcasts of one course together, keyed on the course id', () => {
    const a = { name: 'slides_电工和电子技术BⅡ_第21周_星期日_第2大节__c71001l760952' };
    const b = { name: 'slides_电工和电子技术BⅡ_第21周_星期日_第4大节__c71001l761951' };
    expect(a.name).not.toBe(b.name);
    expect(getCourseKey(a)).toBe('id:71001');
    expect(getCourseKey(a)).toBe(getCourseKey(b));
    expect(getCourseId(a)).toBe('71001');
    expect(getLiveId(a)).toBe('760952');
    expect(getLiveId(b)).toBe('761951');
  });

  // 71735 and 71001 are two real courses sharing the title 电工和电子技术BⅡ.
  it('separates same-titled courses broadcasting concurrently', () => {
    const a = { name: 'slides_电工和电子技术BⅡ_第21周_星期日_第2大节__c71001l760952' };
    const b = { name: 'slides_电工和电子技术BⅡ_第21周_星期日_第2大节__c71735l761878' };
    expect(getCourseKey(a)).not.toBe(getCourseKey(b));
  });

  // A broadcast id alone must never become a course key, or every broadcast
  // would be its own group.
  it('does NOT key on a bare live id', () => {
    const a = { name: 'slides_泛函分析_2024秋季__l760952' };
    const b = { name: 'slides_泛函分析_2024秋季__l772100' };
    expect(getCourseKey(a)).toBe('name:泛函分析_2024秋季');
    expect(getCourseKey(a)).toBe(getCourseKey(b));
    expect(getCourseId(a)).toBeUndefined();
    expect(getLiveId(a)).toBe('760952');
  });

  it('reads a live id from metadata without letting it drive grouping', () => {
    const folder = {
      name: 'slides_泛函分析_2024秋季',
      metadata: { ...meta(undefined, undefined, '泛函分析'), source: { liveId: '760952' } },
    } as { name: string; metadata: SlideMetadata };
    expect(getCourseKey(folder)).toBe('name:泛函分析_2024秋季');
    expect(getLiveId(folder)).toBe('760952');
  });

  it('prefers the recorded course title over the parsed one as the label', () => {
    const folder = {
      name: 'slides_AS-export-name__c70101',
      metadata: meta('70101', undefined, '泛函分析'),
    };
    expect(getCourseLabel(folder)).toBe('泛函分析');
  });

  it('keeps a recorded course title as recorded', () => {
    const folder = { name: 'slides_Lab_A__c70101', metadata: meta('70101', undefined, ' Lab_A  C++ ') };
    expect(getCourseLabel(folder)).toBe('Lab_A  C++');
  });
});

describe('getSlideFolderDisplayLabel', () => {
  it('shows only the schedule under a course header and keeps the course in the flat list', () => {
    const folder = { name: 'slides_示例_课程_第1周_星期三_第2大节__c101s201' };
    expect(getCourseLabel(folder)).toBe('示例 课程');
    expect(getSlideFolderDisplayLabel(folder, true)).toBe('第1周 星期三 第2大节');
    expect(getSlideFolderDisplayLabel(folder)).toBe('示例 课程 第1周 星期三 第2大节');
    expect(formatToolFolderName(folder.name)).toBe('示例_课程_第1周_星期三_第2大节');
  });

  it('prefers the session title in metadata, including titles outside the schedule pattern', () => {
    const metadata = meta('101', '201', 'Example Course');
    metadata.source = { ...metadata.source, sessionTitle: 'Review_and_Q&A' };
    const folder = { name: 'slides_Example_Course_Old_Title__c101s201', metadata };
    expect(getSlideFolderDisplayLabel(folder, true)).toBe('Review and Q&A');
  });

  it('recovers only known legacy or course prefixes when metadata has no session title', () => {
    expect(getSlideFolderDisplayLabel({ name: 'slides_Example_Course - Lecture 2' }, true)).toBe('Lecture 2');
    const metadata = meta('101', '201', 'Example Course');
    expect(getSlideFolderDisplayLabel({ name: 'slides_Example_Course_Review_1', metadata }, true)).toBe('Review 1');
    expect(getSlideFolderDisplayLabel({ name: 'slides_Imported_Set', metadata }, true)).toBe('Imported Set');
  });
});

describe('compareToolFolderEntries', () => {
  it('orders sessions within a course by week, then weekday, then period', () => {
    const wed = { name: 'slides_泛函分析_第1周_星期三_第2大节__c70101s850101' };
    const fri = { name: 'slides_泛函分析_第1周_星期五_第2大节__c70101s850102' };
    const week2 = { name: 'slides_泛函分析_第2周_星期三_第2大节__c70101s860138' };
    expect([week2, fri, wed].sort(compareToolFolderEntries).map((f) => f.name))
      .toEqual([wed.name, fri.name, week2.name]);
  });

  it('keeps each course contiguous so one header is emitted per course', () => {
    const folders = [
      { name: 'slides_高等数学_第1周_星期一_第1大节__c2002s1' },
      { name: 'slides_泛函分析_第1周_星期三_第2大节__c70101s850101' },
      { name: 'slides_高等数学_第2周_星期一_第1大节__c2002s2' },
      { name: 'slides_泛函分析_第2周_星期三_第2大节__c70101s860138' },
    ];
    const keys = [...folders].sort(compareToolFolderEntries).map(getCourseKey);
    // No key reappears after a different key has intervened.
    expect(new Set(keys).size).toBe(keys.filter((k, i) => k !== keys[i - 1]).length);
  });

  it('splits two same-titled courses into adjacent but separate runs', () => {
    const folders = [
      { name: 'slides_泛函分析_第1周_星期三_第2大节__c70101s1' },
      { name: 'slides_泛函分析_第1周_星期三_第5大节', metadata: null },
      { name: 'slides_泛函分析_第2周_星期三_第2大节__c70101s2' },
      { name: 'slides_泛函分析_第2周_星期三_第5大节', metadata: null },
    ];
    const keys = [...folders].sort(compareToolFolderEntries).map(getCourseKey);
    expect(keys).toEqual(['id:70101', 'id:70101', 'name:泛函分析', 'name:泛函分析']);
  });
});
