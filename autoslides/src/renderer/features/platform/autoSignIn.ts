// Whether a dead stored session may be recovered by submitting the saved
// campus SSO password. The caller still does the login; this only decides.

export interface AutoSignInAccount {
  badge: string
  token: string
}

/** The badge whose saved password may be tried, or null when auto sign-in is off for this launch. */
export function autoSignInBadge(input: {
  enabled: boolean
  /** Remember Password. Off means no password is kept, so nothing to sign in with. */
  rememberPassword: boolean
  demoMode: boolean
  accounts: readonly AutoSignInAccount[]
  expiredToken: string
}): string | null {
  if (!input.enabled || !input.rememberPassword || input.demoMode) return null
  const account = input.accounts.find((row) => row.token === input.expiredToken)
  if (!account) return null
  const badge = account.badge.trim()
  if (!badge || badge === 'unknown' || badge === 'user123') return null
  return badge
}

/** The saved login, or null when it is missing or incomplete. */
export function autoSignInCredentials(
  saved: { username: string; password: string } | null
): { username: string; password: string } | null {
  const username = saved?.username.trim() ?? ''
  const password = saved?.password ?? ''
  if (!username || !password) return null
  return { username, password }
}
