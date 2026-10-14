import { describe, expect, it, vi } from 'vitest';
import { buildDownloadFileName } from '@common/downloadNaming';

vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { yanhe2SubtitleStem } from './yanhe2SubtitleService';

describe('yanhe2SubtitleStem', () => {
  it('is the stem of the same lecture\'s Yanhekt screen download', () => {
    const target = { courseId: '80101', courseTitle: '泛函分析', sessionId: '900101', sessionTitle: '第4周 星期一 第1大节' };
    // What useSessionPage queues for Download Screen, through the same builder.
    const screenDownload = buildDownloadFileName({ name: 'screen_泛函分析_第4周 星期一 第1大节', courseId: '80101', sessionId: '900101' });
    expect(yanhe2SubtitleStem(target)).toBe(screenDownload);
    expect(yanhe2SubtitleStem(target)).toBe('screen_泛函分析_第4周_星期一_第1大节__c80101s900101');
  });
});
