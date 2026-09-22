// Obsidian watch-notes provider: appends kept slide images to a Markdown note.
//
// Main owns path authority. A tab's target is set only from config (the vault
// for auto notes) or from a main-side open dialog (Choose Note…); after that the
// renderer sends a tab id, PNG bytes and a `Slide_*.png` name — never a path.
// Every write stays inside the tab's root: its vault, or the chosen note's folder
// when the note is outside any vault.
//
// Only images are written: no metadata, no timeline, no headings. The note is
// appended to, never rewritten.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dialog, shell, type BrowserWindow } from 'electron';
import type { ConfigService } from '@main/platform/configService';
import { createLogger } from '@main/infra/logger';
import type {
  ObsidianResult,
  ObsidianTargetInfo,
  ObsidianVaultProbe,
} from '@common/obsidianNotesTypes';
import {
  appendSeparator,
  findVaultRoot,
  isInside,
  isSafeSlideFilename,
  markdownImageLink,
  normalizeSubfolder,
  noteFileNameFromTitle,
  parseAttachmentFolderPath,
  resolveSlidesDir,
} from './obsidianPaths';

const log = createLogger('ObsidianNotes');

interface TabTarget {
  info: ObsidianTargetInfo;
  /** Writes are confined here: the vault, or the note's folder without one. */
  root: string;
  slidesDir: string;
}

function isVaultDir(dir: string): boolean {
  try {
    return fs.statSync(path.join(dir, '.obsidian')).isDirectory();
  } catch {
    return false;
  }
}

function readAttachmentSetting(vaultRoot: string): string | undefined {
  try {
    return parseAttachmentFolderPath(fs.readFileSync(path.join(vaultRoot, '.obsidian', 'app.json'), 'utf8'));
  } catch {
    return undefined;
  }
}

/** `slides_…` folder names only, one path segment. */
function isSafeSlidesFolderName(name: string): boolean {
  return /^slides_[^/\\]+$/.test(name) && !name.includes('..');
}

function describe(notePath: string, vaultPath: string | null): ObsidianTargetInfo {
  return {
    notePath,
    displayPath: vaultPath
      ? path.relative(vaultPath, notePath).split(path.sep).join('/')
      : path.basename(notePath),
    vaultPath,
    vaultName: vaultPath ? path.basename(vaultPath) : null,
  };
}

function ioError(err: unknown): ObsidianResult<never> {
  return { ok: false, error: 'io', message: err instanceof Error ? err.message : String(err) };
}

export class ObsidianNotesService {
  private targets = new Map<string, TabTarget>();
  private chains = new Map<string, Promise<unknown>>();

  constructor(private readonly configService: ConfigService) {}

  private setTarget(tabId: string, notePath: string, vaultPath: string | null, slidesFolderName: string): ObsidianTargetInfo {
    const attachment = vaultPath ? readAttachmentSetting(vaultPath) : undefined;
    const slidesDir = resolveSlidesDir(vaultPath, notePath, attachment, slidesFolderName);
    const root = vaultPath ?? path.dirname(notePath);
    const info = describe(notePath, vaultPath);
    this.targets.set(tabId, { info, root, slidesDir });
    return info;
  }

  probeVault(dir: string): ObsidianVaultProbe {
    if (!dir) return { exists: false, isVault: false };
    let exists = false;
    try {
      exists = fs.statSync(dir).isDirectory();
    } catch {
      exists = false;
    }
    return { exists, isVault: exists && isVaultDir(dir) };
  }

  async selectVault(parent: BrowserWindow | null): Promise<{ path: string; isVault: boolean } | null> {
    const current = this.configService.getConfig().obsidianVaultPath;
    const options: Electron.OpenDialogOptions = {
      properties: ['openDirectory'],
      defaultPath: current || os.homedir(),
    };
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;
    const picked = result.filePaths[0];
    return { path: picked, isVault: isVaultDir(picked) };
  }

  /** Find-or-create the lecture's note in the configured vault. */
  async openAuto(tabId: string, title: string, slidesFolderName: string): Promise<ObsidianResult<ObsidianTargetInfo>> {
    if (!isSafeSlidesFolderName(slidesFolderName)) return { ok: false, error: 'bad_request' };
    const cfg = this.configService.getConfig();
    const vault = cfg.obsidianVaultPath;
    if (!vault) return { ok: false, error: 'no_vault' };
    if (!isVaultDir(vault)) return { ok: false, error: 'not_a_vault' };
    const sub = normalizeSubfolder(cfg.obsidianSubfolder ?? '');
    if (sub === null) return { ok: false, error: 'bad_subfolder' };

    const noteDir = sub ? path.join(vault, sub) : vault;
    const notePath = path.join(noteDir, noteFileNameFromTitle(title));
    if (!isInside(vault, notePath)) return { ok: false, error: 'bad_subfolder' };
    try {
      await fs.promises.mkdir(noteDir, { recursive: true });
      // 'a' creates the file when missing and never truncates an existing one.
      const handle = await fs.promises.open(notePath, 'a');
      await handle.close();
    } catch (err) {
      log.warn('failed to create Obsidian note', err);
      return ioError(err);
    }
    return { ok: true, data: this.setTarget(tabId, notePath, vault, slidesFolderName) };
  }

  /** Let the student pick any `.md`; its vault (if any) is found by walking up. */
  async chooseNote(
    tabId: string,
    slidesFolderName: string,
    parent: BrowserWindow | null,
  ): Promise<ObsidianResult<ObsidianTargetInfo | null>> {
    if (!isSafeSlidesFolderName(slidesFolderName)) return { ok: false, error: 'bad_request' };
    const current = this.targets.get(tabId)?.info.notePath;
    const vault = this.configService.getConfig().obsidianVaultPath;
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      defaultPath: current ? path.dirname(current) : vault || os.homedir(),
    };
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return { ok: true, data: null };
    const notePath = path.resolve(result.filePaths[0]);
    if (path.extname(notePath).toLowerCase() !== '.md') return { ok: false, error: 'bad_request' };
    const vaultPath = findVaultRoot(path.dirname(notePath), isVaultDir, os.homedir());
    return { ok: true, data: this.setTarget(tabId, notePath, vaultPath, slidesFolderName) };
  }

  /** Append one slide: write the PNG, then one image line at the end of the note. */
  append(tabId: string, bytes: Uint8Array | ArrayBuffer, filename: string): Promise<ObsidianResult<void>> {
    const run = async (): Promise<ObsidianResult<void>> => {
      const target = this.targets.get(tabId);
      if (!target) return { ok: false, error: 'no_target' };
      if (!isSafeSlideFilename(filename)) return { ok: false, error: 'bad_request' };
      const imagePath = path.join(target.slidesDir, filename);
      if (!isInside(target.root, imagePath)) return { ok: false, error: 'bad_request' };
      const notePath = target.info.notePath;
      try {
        await fs.promises.mkdir(target.slidesDir, { recursive: true });
        await fs.promises.writeFile(imagePath, bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
        let size = 0;
        let tail = '';
        try {
          const handle = await fs.promises.open(notePath, 'r');
          try {
            size = (await handle.stat()).size;
            if (size > 0) {
              const len = Math.min(2, size);
              const buf = Buffer.alloc(len);
              await handle.read(buf, 0, len, size - len);
              tail = buf.toString('utf8');
            }
          } finally {
            await handle.close();
          }
        } catch {
          // Note deleted mid-lecture: appendFile below recreates it.
        }
        const line = `${appendSeparator(tail, size)}${markdownImageLink(notePath, imagePath)}\n`;
        await fs.promises.appendFile(notePath, line, 'utf8');
        return { ok: true, data: undefined };
      } catch (err) {
        log.warn('failed to append slide to Obsidian note', err);
        return ioError(err);
      }
    };
    // Per-tab chain keeps image lines in capture order.
    const prev = this.chains.get(tabId) ?? Promise.resolve();
    const next = prev.then(run, run);
    this.chains.set(tabId, next);
    return next;
  }

  close(tabId: string): void {
    this.targets.delete(tabId);
    this.chains.delete(tabId);
  }

  async openInObsidian(tabId: string): Promise<ObsidianResult<void>> {
    const target = this.targets.get(tabId);
    if (!target) return { ok: false, error: 'no_target' };
    try {
      await shell.openExternal(`obsidian://open?path=${encodeURIComponent(target.info.notePath)}`);
      return { ok: true, data: undefined };
    } catch (err) {
      return ioError(err);
    }
  }

  reveal(tabId: string): ObsidianResult<void> {
    const target = this.targets.get(tabId);
    if (!target) return { ok: false, error: 'no_target' };
    shell.showItemInFolder(target.info.notePath);
    return { ok: true, data: undefined };
  }

  /** Save the vault found above this tab's chosen note as the default vault. */
  useFoundVault(tabId: string): ObsidianResult<void> {
    const vaultPath = this.targets.get(tabId)?.info.vaultPath;
    if (!vaultPath) return { ok: false, error: 'no_target' };
    this.configService.setObsidian({ vaultPath });
    return { ok: true, data: undefined };
  }
}
