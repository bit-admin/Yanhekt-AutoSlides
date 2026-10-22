/**
 * Keeps a COPYRIGHT.txt at the root of the output folder (Copyright Notice
 * §5.2(e)).
 *
 * - Created with the exclusive flag (`wx`), so an existing file of any origin
 *   is never replaced by the create.
 * - An existing file is ours only if its first line is
 *   `OUTPUT_DIR_NOTICE_MARKER`; only then is it rewritten, and only when the
 *   wording changed. Anything else is the user's and stays as it is.
 * - The folder itself is never created here (a missing folder or a gone drive
 *   is the writers' business), and no failure reaches the caller: a denied or
 *   read-only folder must not fail a download or an extraction.
 *
 * Writers call it every time they write into the folder, so a deleted notice
 * comes back with the next slide or download.
 */
import fs from 'node:fs';
import path from 'node:path';
import { OUTPUT_DIR_COPYRIGHT_TXT, OUTPUT_DIR_NOTICE_MARKER } from '@common/copyrightNotice';
import { createLogger } from './logger';

const log = createLogger('CopyrightNotice');

export const COPYRIGHT_FILE_NAME = 'COPYRIGHT.txt';

export type NoticeResult = 'created' | 'updated' | 'kept' | 'user-file' | 'skipped';

function codeOf(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | null)?.code;
}

function isOurs(text: string): boolean {
  const first = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0].trim();
  return first === OUTPUT_DIR_NOTICE_MARKER;
}

export function ensureCopyrightNoticeSync(dir: string): NoticeResult {
  const file = path.join(dir, COPYRIGHT_FILE_NAME);
  try {
    fs.writeFileSync(file, OUTPUT_DIR_COPYRIGHT_TXT, { encoding: 'utf8', flag: 'wx' });
    return 'created';
  } catch (error) {
    if (codeOf(error) !== 'EEXIST') {
      log.debug('Copyright notice not written:', dir, codeOf(error));
      return 'skipped';
    }
  }
  try {
    const current = fs.readFileSync(file, 'utf8');
    if (!isOurs(current)) return 'user-file';
    if (current === OUTPUT_DIR_COPYRIGHT_TXT) return 'kept';
    fs.writeFileSync(file, OUTPUT_DIR_COPYRIGHT_TXT, 'utf8');
    return 'updated';
  } catch (error) {
    log.debug('Copyright notice not refreshed:', dir, codeOf(error));
    return 'skipped';
  }
}

export async function ensureCopyrightNotice(dir: string): Promise<NoticeResult> {
  const file = path.join(dir, COPYRIGHT_FILE_NAME);
  try {
    await fs.promises.writeFile(file, OUTPUT_DIR_COPYRIGHT_TXT, { encoding: 'utf8', flag: 'wx' });
    return 'created';
  } catch (error) {
    if (codeOf(error) !== 'EEXIST') {
      log.debug('Copyright notice not written:', dir, codeOf(error));
      return 'skipped';
    }
  }
  try {
    const current = await fs.promises.readFile(file, 'utf8');
    if (!isOurs(current)) return 'user-file';
    if (current === OUTPUT_DIR_COPYRIGHT_TXT) return 'kept';
    await fs.promises.writeFile(file, OUTPUT_DIR_COPYRIGHT_TXT, 'utf8');
    return 'updated';
  } catch (error) {
    log.debug('Copyright notice not refreshed:', dir, codeOf(error));
    return 'skipped';
  }
}
