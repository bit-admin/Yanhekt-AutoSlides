import { i18n } from '@shared/i18n'

const YANHEKT_ERROR = /^yanhekt-error:(-?\d+)$/

/**
 * User-facing text for a cloud-notes IPC error. Main reports Yanhekt's internal
 * failures as `yanhekt-error:<code>` (its own message is not meant for users);
 * those get a localized "Yanhekt's note service failed" line carrying the same
 * code the official site shows. Any other error passes through unchanged, so
 * machine codes like `not-signed-in` still reach their own checks.
 */
export function noteErrorText(error: string): string {
  const m = YANHEKT_ERROR.exec(error)
  return m ? i18n.global.t('cloudNotes.yanhektError', { code: m[1] }) : error
}
