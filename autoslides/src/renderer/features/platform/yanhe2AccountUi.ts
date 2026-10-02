/**
 * The signed-in account's Yanhe 2.0 (aita.yanhekt.cn) session, renderer side.
 *
 * The user menu, the Yanhe 2.0 sign-in dialog, the browser sign-in and
 * Settings → General → Authentication all read this module. The session itself
 * (a JWT with the student's real name in it) lives only in main; here there is
 * just `AppConfig.yanhe2SessionExpiry` (student id → expiry) and the results of
 * the `yanhe2` IPC calls.
 *
 * A Yanhe 2.0 session always belongs to the AutoSlides account of the same
 * student id (the badge). Main refuses to attach any other.
 */

import { computed, ref, watch } from 'vue'
import type { Yanhe2SignInResult } from '@common/yanhe2'
import { configStore } from '@shared/services/configStore'
import { isDemoMode } from '@shared/services/runtimeEnv'
import { i18n } from '@shared/i18n'
import { createLogger } from '@shared/utils/logger'
import { useAuth, type SmsChallengeState } from './useAuth'

const log = createLogger('Yanhe2')

const auth = useAuth()
const { isLoggedIn, userId } = auth

/** The active account's badge, or '' while signed out / still a placeholder. */
const activeBadge = computed(() => {
  const badge = userId.value
  return isLoggedIn.value && badge && badge !== 'user123' && badge !== 'unknown' ? badge : ''
})

// Re-read on a timer at the active session's expiry, so the menu flips to
// Signed out (and Auto Sign In runs) without waiting for some other change.
const now = ref(Date.now())

const activeExpiry = computed(() => {
  const badge = activeBadge.value
  return badge ? configStore.yanhe2SessionExpiry?.[badge] ?? 0 : 0
})

/** True when the signed-in account has a live Yanhe 2.0 session. Independent of the main token. */
export const yanhe2SignedIn = computed(() => activeExpiry.value > now.value)

// ---- Settings: paste a cookie / token ------------------------------------

/** Cookies field in Settings. Sent to main once on Verify; never saved here. */
export const yanhe2Cookies = ref('')

export const yanhe2CookiesVisible = ref(false)

export const yanhe2Verifying = ref(false)

/** Status line under the cookies field; `message` is finished display text. */
export const yanhe2VerifyStatus = ref<{ type: 'success' | 'error'; message: string } | null>(null)

export function onYanhe2CookiesInput(): void {
  yanhe2VerifyStatus.value = null
}

// ---- Sign-in dialog state (shared by LeftPanel's host and the dialog) -----

export const showYanhe2SsoModal = ref(false)
export const yanhe2Username = ref('')
export const yanhe2Password = ref('')
export const yanhe2Loading = ref(false)
/** Inline error under the credential form; '' when none. */
export const yanhe2Error = ref('')
export const yanhe2SmsChallenge = ref<SmsChallengeState | null>(null)
export const yanhe2SmsCode = ref('')
export const yanhe2SmsError = ref('')
export const yanhe2SubmittingSms = ref(false)

const t = (key: string, values?: Record<string, unknown>): string =>
  values ? i18n.global.t(key, values) : i18n.global.t(key)

/** Display text for a failed result: our reasons are localized, CAS's own message otherwise. */
export function describeYanhe2Failure(result: Yanhe2SignInResult): string {
  switch (result.reason) {
    case 'account_mismatch':
      return t('auth.yanhe2AccountMismatch', { account: activeBadge.value })
    case 'no_token':
      return t('auth.yanhe2NoToken')
    case 'expired':
      return t('auth.yanhe2Expired')
    case 'token_rejected':
      return t('auth.yanhe2Rejected')
    case 'network':
      return t('auth.yanhe2Network')
    default:
      return result.error || t('auth.yanhe2Failed')
  }
}

function adoptChallenge(challenge: NonNullable<Yanhe2SignInResult['smsChallenge']>): void {
  yanhe2SmsCode.value = ''
  yanhe2SmsError.value = ''
  yanhe2SmsChallenge.value = {
    challengeId: challenge.challengeId,
    phoneHint: challenge.phoneHint,
    expiresAt: Date.now() + challenge.expiresInSeconds * 1000,
  }
  showYanhe2SsoModal.value = true
}

function resetDialog(): void {
  yanhe2Password.value = ''
  yanhe2Error.value = ''
  yanhe2SmsChallenge.value = null
  yanhe2SmsCode.value = ''
  yanhe2SmsError.value = ''
}

export function requestYanhe2SsoSignIn(): void {
  if (!activeBadge.value) return
  resetDialog()
  // CAS's username is the student id, which is also the badge it must match.
  yanhe2Username.value = activeBadge.value
  showYanhe2SsoModal.value = true
}

export function closeYanhe2SsoModal(): void {
  const challenge = yanhe2SmsChallenge.value
  if (challenge) void window.electronAPI.yanhe2.cancelSmsChallenge(challenge.challengeId)
  resetDialog()
  showYanhe2SsoModal.value = false
}

export async function submitYanhe2SignIn(): Promise<void> {
  const badge = activeBadge.value
  if (!badge || !yanhe2Username.value.trim() || !yanhe2Password.value || yanhe2Loading.value) return
  yanhe2Loading.value = true
  yanhe2Error.value = ''
  try {
    const result = await window.electronAPI.yanhe2.login(badge, yanhe2Username.value.trim(), yanhe2Password.value)
    if (result.smsChallenge) {
      adoptChallenge(result.smsChallenge)
    } else if (result.success) {
      now.value = Date.now()
      resetDialog()
      showYanhe2SsoModal.value = false
    } else {
      yanhe2Error.value = describeYanhe2Failure(result)
    }
  } catch (error) {
    log.error('Yanhe 2.0 sign-in error:', error)
    yanhe2Error.value = t('auth.yanhe2Network')
  } finally {
    yanhe2Loading.value = false
  }
}

export async function submitYanhe2SmsCode(): Promise<void> {
  const challenge = yanhe2SmsChallenge.value
  const badge = activeBadge.value
  if (!challenge || !badge || yanhe2SubmittingSms.value) return

  const code = yanhe2SmsCode.value.trim()
  if (!/^\d{4,8}$/.test(code)) {
    yanhe2SmsError.value = 'invalidFormat'
    return
  }
  if (Date.now() >= challenge.expiresAt) {
    yanhe2SmsChallenge.value = null
    yanhe2Error.value = t('auth.yanhe2ChallengeExpired')
    return
  }

  yanhe2SubmittingSms.value = true
  yanhe2SmsError.value = ''
  try {
    const result = await window.electronAPI.yanhe2.submitSmsCode(badge, challenge.challengeId, code)
    if (result.success) {
      now.value = Date.now()
      resetDialog()
      showYanhe2SsoModal.value = false
      return
    }
    // CAS's code rejection stays on the OTP panel; anything after it (wrong
    // student id, Yanhe 2.0 refusing the token, an expired challenge) spends
    // the flow, so it goes back to the credential form with the reason.
    if (result.reason === 'code_rejected' || result.reason === 'network') {
      yanhe2SmsCode.value = ''
      yanhe2SmsError.value = result.reason
      return
    }
    yanhe2SmsChallenge.value = null
    yanhe2Error.value = result.reason === 'challenge_expired'
      ? t('auth.yanhe2ChallengeExpired')
      : describeYanhe2Failure(result)
  } catch (error) {
    log.error('Yanhe 2.0 SMS verification error:', error)
    yanhe2SmsError.value = 'network'
  } finally {
    yanhe2SubmittingSms.value = false
  }
}

/** Back out of the OTP step to the credential form. */
export function cancelYanhe2SmsChallenge(): void {
  const challenge = yanhe2SmsChallenge.value
  if (challenge) void window.electronAPI.yanhe2.cancelSmsChallenge(challenge.challengeId)
  yanhe2SmsChallenge.value = null
  yanhe2SmsCode.value = ''
  yanhe2SmsError.value = ''
  yanhe2Password.value = ''
}

export function requestYanhe2BrowserSignIn(): void {
  if (!activeBadge.value) return
  closeYanhe2SsoModal()
  auth.openBrowserLogin('yanhe2')
}

/** Local only: Yanhe 2.0 cannot revoke a token, and its own logout would end the CAS session. */
export function requestYanhe2SignOut(): void {
  const badge = activeBadge.value
  if (!badge) return
  void window.electronAPI.yanhe2.signOut(badge)
}

export async function verifyYanhe2Cookies(): Promise<void> {
  const badge = activeBadge.value
  const text = yanhe2Cookies.value.trim()
  if (!badge || !text || yanhe2Verifying.value) return
  yanhe2Verifying.value = true
  yanhe2VerifyStatus.value = null
  try {
    const result = await window.electronAPI.yanhe2.adoptCookies(badge, text)
    if (result.success) {
      now.value = Date.now()
      // Main has it now; don't leave a live token sitting in the field.
      yanhe2Cookies.value = ''
      yanhe2CookiesVisible.value = false
      yanhe2VerifyStatus.value = {
        type: 'success',
        message: t('advanced.yanhe2CookiesVerified', { account: result.account ?? badge }),
      }
    } else {
      yanhe2VerifyStatus.value = { type: 'error', message: describeYanhe2Failure(result) }
    }
  } catch (error) {
    log.error('Yanhe 2.0 cookie verification error:', error)
    yanhe2VerifyStatus.value = { type: 'error', message: t('auth.yanhe2Network') }
  } finally {
    yanhe2Verifying.value = false
  }
}

// ---- Launch check + Auto Sign In -----------------------------------------

let refreshing: string | null = null

/**
 * Re-check the account's stored session with Yanhe 2.0 and, when it has
 * expired, renew it the way the main account's Auto Sign In does (main applies
 * the same Remember Password / Auto Sign In switches). An account that never
 * signed in to Yanhe 2.0, or signed out of it, has no session and is left alone.
 */
async function refreshYanhe2Session(badge: string): Promise<void> {
  if (!badge || refreshing === badge || isDemoMode()) return
  refreshing = badge
  try {
    const state = await window.electronAPI.yanhe2.check(badge)
    now.value = Date.now()
    if (state !== 'expired') return
    // The main sign-in dialog is mid-SMS; don't stack a second prompt on it.
    if (auth.smsChallenge.value || showYanhe2SsoModal.value) return
    const result = await window.electronAPI.yanhe2.autoSignIn(badge)
    now.value = Date.now()
    if (result.smsChallenge && activeBadge.value === badge) {
      resetDialog()
      yanhe2Username.value = badge
      adoptChallenge(result.smsChallenge)
    } else if (!result.success && result.reason !== 'auto_sign_in_unavailable') {
      log.debug('Yanhe 2.0 auto sign-in did not finish:', result.reason)
    }
  } catch (error) {
    log.warn('Yanhe 2.0 session check failed:', error)
  } finally {
    refreshing = null
  }
}

let installed = false
let expiryTimer: ReturnType<typeof setTimeout> | null = null

/** Called once by the host (LeftPanel). */
export function installYanhe2Session(): void {
  if (installed) return
  installed = true

  // Launch, sign-in and account switch all land here.
  watch(activeBadge, (badge, previous) => {
    if (badge !== previous) closeYanhe2SsoModal()
    if (badge) void refreshYanhe2Session(badge)
  }, { immediate: true })

  watch([activeBadge, activeExpiry], ([badge, expiresAt]) => {
    if (expiryTimer) clearTimeout(expiryTimer)
    expiryTimer = null
    if (!badge || expiresAt <= Date.now()) return
    // +1s so the check sees the token as past `exp`. Sessions last 24h, well
    // under setTimeout's ~24.8-day ceiling.
    expiryTimer = setTimeout(() => {
      expiryTimer = null
      now.value = Date.now()
      void refreshYanhe2Session(badge)
    }, expiresAt - Date.now() + 1000)
  }, { immediate: true })
}
