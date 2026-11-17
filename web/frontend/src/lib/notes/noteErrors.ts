import { i18n } from '../../i18n';
import { UNGROUP_KEPT_BOTH } from './noteUngroup';

const YANHEKT_ERROR = /^yanhekt-error:(\S+)$/;

/**
 * User-facing text for a notes error. `notesClient` reports Yanhekt's internal
 * failures as `yanhekt-error:<code>` (its own message is not meant for users);
 * those get a localized "Yanhekt's note service failed" line carrying the same
 * code the official site shows. Any other error passes through unchanged, so
 * machine codes like `not-signed-in` still reach their own checks.
 * Port of the desktop app's `features/cloudNotes/noteErrors.ts`.
 */
export function noteErrorText(error: string): string {
  if (error === UNGROUP_KEPT_BOTH) return i18n.global.t('cloudNotes.ungroupKeptBoth');
  const m = YANHEKT_ERROR.exec(error);
  return m ? i18n.global.t('cloudNotes.yanhektError', { code: m[1] }) : error;
}
