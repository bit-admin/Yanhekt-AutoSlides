// Pure path rules for the Obsidian watch-notes provider. No IO here — callers
// pass in whatever they read from disk — so every rule is unit-testable.
//
// Obsidian's attachment setting (`.obsidian/app.json` → `attachmentFolderPath`):
//   absent / ''  / '/'   → vault root
//   './'                 → the note's own folder
//   './sub'              → `sub` under the note's folder
//   'folder/sub'         → that folder, relative to the vault root
// We follow it so slides land where the user's other attachments do, then add a
// per-lecture `slides_…` subfolder so `Slide_*.png` never collides across lectures.
import path from 'node:path';

/** Max ancestor levels walked when looking for a vault above a chosen note. */
export const VAULT_SEARCH_MAX_DEPTH = 32;

/**
 * Walk up from a note's folder to the nearest ancestor holding `.obsidian/`.
 * Ancestors only — never a scan. Stops at `stopAt` (the home folder), the
 * filesystem root, or after `maxDepth` levels; returns null when none is found.
 */
export function findVaultRoot(
  noteDir: string,
  isVault: (dir: string) => boolean,
  stopAt: string,
  maxDepth = VAULT_SEARCH_MAX_DEPTH,
): string | null {
  let dir = path.resolve(noteDir);
  const stop = path.resolve(stopAt);
  for (let depth = 0; depth < maxDepth; depth++) {
    if (isVault(dir)) return dir;
    if (dir === stop) return null;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

/** Whether `child` is `parent` or inside it (both resolved). */
export function isInside(parent: string, child: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Read `attachmentFolderPath` out of `.obsidian/app.json` text; undefined when absent/malformed. */
export function parseAttachmentFolderPath(appJson: string | null): string | undefined {
  if (!appJson) return undefined;
  try {
    const parsed = JSON.parse(appJson) as { attachmentFolderPath?: unknown };
    return typeof parsed?.attachmentFolderPath === 'string' ? parsed.attachmentFolderPath : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Folder that holds this lecture's slide images. `vaultRoot` null means the note
 * is not in a vault: images go next to the note. A setting that escapes the
 * vault (`../x`, absolute) falls back to the note's folder.
 */
export function resolveSlidesDir(
  vaultRoot: string | null,
  notePath: string,
  attachmentFolderPath: string | undefined,
  slidesFolderName: string,
): string {
  const noteDir = path.dirname(path.resolve(notePath));
  if (!vaultRoot) return path.join(noteDir, slidesFolderName);

  const setting = (attachmentFolderPath ?? '').trim();
  let base: string;
  if (setting === '' || setting === '/') {
    base = vaultRoot;
  } else if (setting === '.' || setting === './') {
    base = noteDir;
  } else if (setting.startsWith('./')) {
    base = path.join(noteDir, setting.slice(2));
  } else {
    base = path.join(vaultRoot, setting.replace(/^\/+/, ''));
  }
  if (!isInside(vaultRoot, base)) base = noteDir;
  return path.join(base, slidesFolderName);
}

/**
 * Note file name from a Yanhekt-style title. Strips characters that are illegal
 * in file names on any platform, plus the ones Obsidian refuses in note names
 * (`# ^ [ ] |`); keeps `·`. Trailing dots/spaces are dropped (Windows).
 */
export function noteFileNameFromTitle(title: string): string {
  const cleaned = title
    // eslint-disable-next-line no-control-regex
    .replace(/[/\\:*?"<>|#^[\]\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  const base = cleaned.length > 0 ? cleaned.slice(0, 150).trim() : 'AutoSlides';
  return `${base}.md`;
}

/**
 * Vault-relative subfolder for auto notes, from the Settings field. Returns null
 * when it would leave the vault (`..`, absolute) so the caller can refuse it.
 */
export function normalizeSubfolder(subfolder: string): string | null {
  const parts = subfolder.replace(/\\/g, '/').split('/').map((p) => p.trim()).filter((p) => p && p !== '.');
  if (parts.some((p) => p === '..')) return null;
  return parts.join('/');
}

/**
 * One Markdown image line pointing from the note to an image. CommonMark
 * angle-bracket destination, so spaces and CJK need no escaping; only `<`, `>`
 * and newlines are encoded. Always forward slashes.
 */
export function markdownImageLink(notePath: string, imagePath: string): string {
  const rel = path
    .relative(path.dirname(path.resolve(notePath)), path.resolve(imagePath))
    .split(path.sep)
    .join('/');
  const safe = rel.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/\r?\n/g, '');
  return `![](<${safe}>)`;
}

/**
 * Separator to write before an appended image line so each image is its own
 * paragraph: nothing for an empty file, otherwise enough newlines to end on a
 * blank line.
 */
export function appendSeparator(existingTail: string, fileSize: number): string {
  if (fileSize === 0) return '';
  if (existingTail.endsWith('\n\n')) return '';
  if (existingTail.endsWith('\n')) return '\n';
  return '\n\n';
}

/** `Slide_*.png` names only — the renderer never gets to choose a path. */
export function isSafeSlideFilename(filename: string): boolean {
  return /^Slide_[\w.-]+\.png$/.test(filename) && !filename.includes('..');
}
