/**
 * The signed-in account's Yanhe 2.0 (aita.yanhekt.cn) session, renderer side.
 *
 * The user menu, the Yanhe 2.0 sign-in dialog, the browser sign-in and
 * Settings → General → Authentication all read this module. The session itself
 * lives in main. `AppConfig` carries only `yanhe2SessionExpiry`; the Settings
 * field reads the JWT itself through `yanhe2:getJwt`.
 *
 * A Yanhe 2.0 session always belongs to the AutoSlides account of the same
 * student id (the badge). Main refuses to attach any other.
 */

import { computed, ref, watch } from 'vue'
import type { Yanhe2ProfileSummary, Yanhe2SignInResult } from '@common/yanhe2'
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

/** Same badge, for pages that read Yanhe 2.0 on the account's behalf (Calendar). */
export const yanhe2ActiveBadge = activeBadge

// Re-read on a timer at the active session's expiry, so the menu flips to
// Signed out (and Auto Sign In runs) without waiting for some other change.
const now = ref(Date.now())

const activeExpiry = computed(() => {
  const badge = activeBadge.value
  return badge ? configStore.yanhe2SessionExpiry?.[badge] ?? 0 : 0
})

/** True when the signed-in account has a live Yanhe 2.0 session. Independent of the main token. */
export const yanhe2SignedIn = computed(() => activeExpiry.value > now.value)

/** `userId/playSigningPhone` for the signed-in flyout. Empty until loaded, or when signed out. */
export const yanhe2ProfileLine = ref('')

/**
 * What the user-menu status is doing right now, for the active account only.
 * Idle falls back to Signed in / Signed out. The other two cover the short
 * launch check and the renewal that follows an expired JWT.
 */
export const yanhe2MenuPhase = ref<'idle' | 'verifying' | 'signing'>('idle')

// ---- Settings: the stored JWT, or a paste waiting on Verify ----------------

/**
 * JWT field in Settings. Shows the stored JWT once this account is signed in
 * to Yanhe 2.0, the same way the Token field shows the main token. A paste
 * replaces it only after Verify.
 */
export const yanhe2Cookies = ref('')

/** Drops a JWT read that lost the race with a newer account, sign-out, or edit. */
let jwtLoad = 0

export const yanhe2CookiesVisible = ref(false)

export const yanhe2Verifying = ref(false)

/** Status line under the JWT field; `message` is finished display text. */
export const yanhe2VerifyStatus = ref<{ type: 'success' | 'error'; message: string } | null>(null)

export function onYanhe2CookiesInput(): void {
  yanhe2VerifyStatus.value = null
  // A keystroke wins over an in-flight read, so the stored JWT cannot land on top of a paste.
  jwtLoad++
}

/**
 * Settings entry, beside the Token and Password fields: drop a paste that was
 * never verified, hide the value, and show the stored JWT again. Left alone
 * while a Verify is still running; its result fills the field.
 */
export function reloadYanhe2JwtField(): void {
  if (yanhe2Verifying.value) return
  yanhe2VerifyStatus.value = null
  yanhe2CookiesVisible.value = false
  const badge = activeBadge.value
  if (badge && yanhe2SignedIn.value) {
    void showStoredJwt(badge)
    return
  }
  jwtLoad++
  yanhe2Cookies.value = ''
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
  // Signing in from signed out flips `yanhe2SignedIn`, and its watcher fills the
  // field and the menu line. Replacing a live session flips nothing, so read here.
  const wasSignedIn = yanhe2SignedIn.value
  try {
    const result = await window.electronAPI.yanhe2.adoptCookies(badge, text)
    if (result.success) {
      now.value = Date.now()
      yanhe2CookiesVisible.value = false
      if (wasSignedIn) {
        await showStoredJwt(badge)
        void showStoredProfile(badge)
      }
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
/** So a finished check cannot clear a newer account's status. */
let phaseTicket = 0

function hasStoredYanhe2Session(badge: string): boolean {
  return Object.prototype.hasOwnProperty.call(configStore.yanhe2SessionExpiry ?? {}, badge)
}

/**
 * Re-check the account's stored session with Yanhe 2.0 and, when it has
 * expired, renew it the way the main account's Auto Sign In does (main applies
 * the same Remember Password / Auto Sign In switches). An account that never
 * signed in to Yanhe 2.0, or signed out of it, has no session and is left alone.
 */
async function refreshYanhe2Session(badge: string): Promise<void> {
  if (!badge || refreshing === badge || isDemoMode()) return
  refreshing = badge
  const ticket = ++phaseTicket
  // No stored row means there is nothing to check. Skip the word, or a launch
  // would flash "Verifying" at every account that never signed in.
  if (activeBadge.value === badge) {
    yanhe2MenuPhase.value = hasStoredYanhe2Session(badge) ? 'verifying' : 'idle'
  }
  try {
    const state = await window.electronAPI.yanhe2.check(badge)
    now.value = Date.now()
    if (state === 'signed_in') void showStoredProfile(badge)
    if (state !== 'expired') return
    // The main sign-in dialog is mid-SMS; don't stack a second prompt on it.
    if (auth.smsChallenge.value || showYanhe2SsoModal.value) return
    if (ticket === phaseTicket && activeBadge.value === badge) yanhe2MenuPhase.value = 'signing'
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
    if (ticket === phaseTicket) yanhe2MenuPhase.value = 'idle'
    if (refreshing === badge) refreshing = null
  }
}

let installed = false
let expiryTimer: ReturnType<typeof setTimeout> | null = null

async function showStoredJwt(badge: string): Promise<void> {
  const ticket = ++jwtLoad
  let jwt: unknown = ''
  try {
    jwt = await window.electronAPI.yanhe2.getJwt(badge)
  } catch (error) {
    // Show an empty field rather than leave stale text in it.
    log.warn('Could not read the stored Yanhe 2.0 JWT:', error)
  }
  if (ticket !== jwtLoad || activeBadge.value !== badge) return
  yanhe2Cookies.value = typeof jwt === 'string' ? jwt : ''
}

let profileLoad = 0

/** The flyout line. A missing phone is just the id, not a trailing slash. */
async function showStoredProfile(badge: string): Promise<void> {
  const ticket = ++profileLoad
  let profile: Yanhe2ProfileSummary | null
  try {
    profile = await window.electronAPI.yanhe2.getProfile(badge)
  } catch (error) {
    log.warn('Could not read the Yanhe 2.0 profile:', error)
    return
  }
  if (ticket !== profileLoad || activeBadge.value !== badge || !yanhe2SignedIn.value) return
  if (!profile?.userId) {
    yanhe2ProfileLine.value = ''
    return
  }
  const phone = profile.playSigningPhone.trim()
  yanhe2ProfileLine.value = phone ? `${profile.userId}/${phone}` : String(profile.userId)
}

/** Called once by the host (LeftPanel). */
export function installYanhe2Session(): void {
  if (installed) return
  installed = true

  // Launch, sign-in and account switch all land here.
  watch(activeBadge, (badge, previous) => {
    if (badge !== previous) closeYanhe2SsoModal()
    if (badge) {
      void refreshYanhe2Session(badge)
      return
    }
    phaseTicket++
    yanhe2MenuPhase.value = 'idle'
  }, { immediate: true })

  // Fill the Settings field when this account has a session; clear it on sign-out
  // or account switch. Edits are left alone — this only runs when those change.
  watch([activeBadge, yanhe2SignedIn], ([badge, signedIn], prev) => {
    if (prev && prev[0] !== badge) yanhe2CookiesVisible.value = false
    if (!badge || !signedIn) {
      jwtLoad++
      profileLoad++
      yanhe2Cookies.value = ''
      yanhe2ProfileLine.value = ''
      return
    }
    if (!prev || prev[0] !== badge || !prev[1]) {
      void showStoredJwt(badge)
      void showStoredProfile(badge)
    }
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
