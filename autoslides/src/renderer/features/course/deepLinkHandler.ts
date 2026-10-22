import type { DeepLink } from '@common/deepLink'
import { i18n } from '@shared/i18n'
import { tokenManager, whenStartupAuthSettled } from '@shared/services/authService'
import { createLogger } from '@shared/utils/logger'
import { notifyOpenById, openCourseById, openSessionById } from './openById'

const log = createLogger('DeepLink')

// Wait for the launch-time sign-in check: a cold launch from a link gets here
// before the stored token is verified.
async function open(link: DeepLink): Promise<void> {
  await whenStartupAuthSettled()
  if (!tokenManager.hasToken()) {
    notifyOpenById(i18n.global.t('deepLink.signInRequired'))
    return
  }
  if (link.kind === 'course') {
    openCourseById(link.courseId)
    return
  }
  await openSessionById(link.sessionId)
}

/**
 * `autoslides://course/<id>` and `autoslides://session/<id>`, checked in main
 * (`@common/deepLink`). Opens them as the Search page's "open by id" box does.
 * Returns an uninstall.
 */
export function installDeepLinkHandler(): () => void {
  const unsubscribe = window.electronAPI.deepLink.onOpen((link) => {
    open(link).catch((error: unknown) => log.error('Could not open link:', link, error))
  })
  window.electronAPI.deepLink.ready()
  return unsubscribe
}
