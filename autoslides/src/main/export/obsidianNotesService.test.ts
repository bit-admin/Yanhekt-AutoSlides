import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dialogMock = vi.hoisted(() => ({ showOpenDialog: vi.fn() }));

vi.mock('electron', () => ({
  app: { isPackaged: true },
  dialog: dialogMock,
  shell: { openExternal: vi.fn(), showItemInFolder: vi.fn() },
}));

import { ObsidianNotesService } from './obsidianNotesService';
import type { ConfigService } from '@main/platform/configService';

const SLIDES = 'slides_泛函分析__c62313s751843';
const TITLE = 'c62313s751843 · 泛函分析 · 第1周';
const png = new Uint8Array([137, 80, 78, 71]).buffer;

let tmp: string;
let vault: string;
let cfg: { obsidianVaultPath: string; obsidianSubfolder: string };

function service(): ObsidianNotesService {
  const configService = {
    getConfig: () => cfg,
    setObsidian: (patch: { vaultPath?: string }) => {
      if (patch.vaultPath !== undefined) cfg.obsidianVaultPath = patch.vaultPath;
    },
  } as unknown as ConfigService;
  return new ObsidianNotesService(configService);
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'autoslides-obsidian-'));
  vault = path.join(tmp, 'Vault');
  fs.mkdirSync(path.join(vault, '.obsidian'), { recursive: true });
  cfg = { obsidianVaultPath: vault, obsidianSubfolder: 'AutoSlides' };
  dialogMock.showOpenDialog.mockReset();
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('ObsidianNotesService.openAuto', () => {
  it('creates the lecture note in the subfolder and reuses it', async () => {
    const svc = service();
    const first = await svc.openAuto('t1', TITLE, SLIDES);
    expect(first.ok).toBe(true);
    const notePath = path.join(vault, 'AutoSlides', `${TITLE}.md`);
    expect(fs.existsSync(notePath)).toBe(true);
    fs.writeFileSync(notePath, 'my own text');
    const again = await svc.openAuto('t2', TITLE, SLIDES);
    expect(again.ok && again.data.notePath).toBe(notePath);
    expect(fs.readFileSync(notePath, 'utf8')).toBe('my own text');
  });

  it('refuses a missing vault, a non-vault and an escaping subfolder', async () => {
    const svc = service();
    cfg.obsidianVaultPath = '';
    expect(await svc.openAuto('t', TITLE, SLIDES)).toMatchObject({ ok: false, error: 'no_vault' });
    cfg.obsidianVaultPath = tmp;
    expect(await svc.openAuto('t', TITLE, SLIDES)).toMatchObject({ ok: false, error: 'not_a_vault' });
    cfg.obsidianVaultPath = vault;
    cfg.obsidianSubfolder = '../elsewhere';
    expect(await svc.openAuto('t', TITLE, SLIDES)).toMatchObject({ ok: false, error: 'bad_subfolder' });
  });

  it('rejects a slides folder name that is not one path segment', async () => {
    expect(await service().openAuto('t', TITLE, 'slides_a/../../x')).toMatchObject({ ok: false, error: 'bad_request' });
  });
});

describe('ObsidianNotesService.append', () => {
  it('writes images and appends one image line each, never rewriting the note', async () => {
    const svc = service();
    const opened = await svc.openAuto('t', TITLE, SLIDES);
    if (!opened.ok) throw new Error('open failed');
    fs.writeFileSync(opened.data.notePath, '# My notes');
    await svc.append('t', png, 'Slide_1.png');
    await svc.append('t', png, 'Slide_2.png');
    expect(fs.existsSync(path.join(vault, SLIDES, 'Slide_1.png'))).toBe(true);
    expect(fs.readFileSync(opened.data.notePath, 'utf8')).toBe(
      `# My notes\n\n![](<../${SLIDES}/Slide_1.png>)\n\n![](<../${SLIDES}/Slide_2.png>)\n`,
    );
  });

  it("follows the vault's attachment folder setting", async () => {
    fs.writeFileSync(path.join(vault, '.obsidian', 'app.json'), JSON.stringify({ attachmentFolderPath: './assets' }));
    const svc = service();
    const opened = await svc.openAuto('t', TITLE, SLIDES);
    if (!opened.ok) throw new Error('open failed');
    await svc.append('t', png, 'Slide_1.png');
    expect(fs.existsSync(path.join(vault, 'AutoSlides', 'assets', SLIDES, 'Slide_1.png'))).toBe(true);
    expect(fs.readFileSync(opened.data.notePath, 'utf8')).toBe(`![](<assets/${SLIDES}/Slide_1.png>)\n`);
  });

  it('refuses unsafe names and tabs without a target', async () => {
    const svc = service();
    expect(await svc.append('none', png, 'Slide_1.png')).toMatchObject({ ok: false, error: 'no_target' });
    await svc.openAuto('t', TITLE, SLIDES);
    expect(await svc.append('t', png, '../../evil.png')).toMatchObject({ ok: false, error: 'bad_request' });
    expect(await svc.append('t', png, 'Slide_../x.png')).toMatchObject({ ok: false, error: 'bad_request' });
  });
});

describe('ObsidianNotesService.chooseNote', () => {
  it('finds the vault above a chosen note in another vault', async () => {
    const other = path.join(tmp, 'Other');
    fs.mkdirSync(path.join(other, '.obsidian'), { recursive: true });
    fs.mkdirSync(path.join(other, 'Courses'));
    const note = path.join(other, 'Courses', 'Analysis.md');
    fs.writeFileSync(note, '');
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [note] });
    const svc = service();
    const res = await svc.chooseNote('t', SLIDES, null);
    expect(res).toMatchObject({ ok: true, data: { vaultPath: other, displayPath: 'Courses/Analysis.md' } });
    await svc.append('t', png, 'Slide_1.png');
    expect(fs.existsSync(path.join(other, SLIDES, 'Slide_1.png'))).toBe(true);
  });

  it('puts images next to a note outside any vault', async () => {
    const loose = path.join(tmp, 'loose.md');
    fs.writeFileSync(loose, '');
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [loose] });
    const svc = service();
    const res = await svc.chooseNote('t', SLIDES, null);
    expect(res).toMatchObject({ ok: true, data: { vaultPath: null } });
    await svc.append('t', png, 'Slide_1.png');
    expect(fs.existsSync(path.join(tmp, SLIDES, 'Slide_1.png'))).toBe(true);
  });

  it('returns null when the dialog is cancelled', async () => {
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    expect(await service().chooseNote('t', SLIDES, null)).toEqual({ ok: true, data: null });
  });

  it('saves a found vault as the default', async () => {
    cfg.obsidianVaultPath = '';
    const note = path.join(vault, 'n.md');
    fs.writeFileSync(note, '');
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [note] });
    const svc = service();
    await svc.chooseNote('t', SLIDES, null);
    expect(svc.useFoundVault('t').ok).toBe(true);
    expect(cfg.obsidianVaultPath).toBe(vault);
  });
});
