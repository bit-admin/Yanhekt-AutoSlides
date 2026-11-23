import { describe, expect, it } from 'vitest';
import { encodeCourseTitle, type CloudCourse } from '@common/courseCloud';
import { planCloudWrites, type CloudNote } from './courseCloudPlan';

// Fabricated ids and names.
const c = (yanhektId: string, yanhe2Id = '', title = '课程'): CloudCourse => ({ yanhektId, yanhe2Id, school_year: '2025', semester: '1', number: '', title });
const note = (id: number, course: CloudCourse): CloudNote => ({ id, course, rawTitle: encodeCourseTitle(course) as string });

describe('planCloudWrites', () => {
  it('creates, keeps and removes', () => {
    const plan = planCloudWrites([note(1, c('10')), note(2, c('20'))], [c('10'), c('30')]);
    expect(plan.unchanged).toEqual(['10']);
    expect(plan.create.map((x) => x.key)).toEqual(['30']);
    expect(plan.remove).toEqual([2]);
  });
  it('updates a note when a course gains its other id', () => {
    const plan = planCloudWrites([note(1, c('', '77'))], [c('10', '77')]);
    expect(plan.create).toEqual([]);
    expect(plan.remove).toEqual([]);
    expect(plan.retitle[0]).toMatchObject({ id: 1, key: '10' });
  });
  it('removes a duplicate from two computers', () => {
    const plan = planCloudWrites([note(1, c('10')), note(2, c('10'))], [c('10')]);
    expect(plan.remove).toEqual([2]);
  });
  it('does not erase a title this computer lacks', () => {
    const plan = planCloudWrites([note(1, c('10', '', '课程'))], [c('10', '', '')]);
    expect(plan.unchanged).toEqual(['10']);
  });
});
