import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ ipcMain: { handle: () => {} } }));
vi.mock('@main/infra/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }));

import { restoreTrash } from './trashIpc';

const entry = (folder: string, filename: string) => ({
  id: `${folder}/${filename}`,
  filename,
  originalPath: `/out/${folder}/${filename}`,
});

function deps(outcome: { restored: unknown[]; failed: unknown[] }, timelineFails = false) {
  const staged: string[] = [];
  const timeline: string[] = [];
  return {
    staged,
    timeline,
    services: {
      slideExtractionService: { restoreTrashEntries: async () => outcome },
      slideMetadataService: { stageEdited: (folder: string) => staged.push(folder) },
      slideTimelineService: {
        restoreCanonical: async (folder: string, target: { file: string }) => {
          timeline.push(`${folder}/${target.file}`);
          if (timelineFails) throw new Error('timeline write failed');
        },
      },
    } as never,
  };
}

describe('restoring from the trash', () => {
  it('records only the files that came back', async () => {
    const { services, staged, timeline } = deps({
      restored: [entry('a', 'Slide_001.png')],
      failed: [entry('b', 'Slide_002.png')],
    });
    expect(await restoreTrash(services, ['a/Slide_001.png', 'b/Slide_002.png'], '/out')).toEqual({
      restored: 1,
      failed: 1,
    });
    expect(staged).toEqual(['/out/a']);
    expect(timeline).toEqual(['/out/a/Slide_001.png']);
  });

  it('touches nothing when no file could be restored', async () => {
    const { services, staged, timeline } = deps({ restored: [], failed: [entry('a', 'Slide_001.png')] });
    await restoreTrash(services, ['a/Slide_001.png'], '/out');
    expect(staged).toEqual([]);
    expect(timeline).toEqual([]);
  });

  it('still reports the restore when the timeline cannot be updated', async () => {
    const { services, timeline } = deps({ restored: [entry('a', 'Slide_001.png')], failed: [] }, true);
    expect(await restoreTrash(services, ['a/Slide_001.png'], '/out')).toEqual({ restored: 1, failed: 0 });
    expect(timeline).toHaveLength(1);
  });
});
