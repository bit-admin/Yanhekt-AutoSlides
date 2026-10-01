import { describe, expect, it } from 'vitest'
import { autoSignInBadge, autoSignInCredentials, type AutoSignInAccount } from './autoSignIn'

const account: AutoSignInAccount = { badge: '1120210001', token: 'a'.repeat(32) }

describe('autoSignInBadge', () => {
  const ready = {
    enabled: true,
    rememberPassword: true,
    demoMode: false,
    accounts: [account],
    expiredToken: account.token,
  }

  it('returns the badge of the account whose session expired', () => {
    expect(autoSignInBadge(ready)).toBe('1120210001')
  })

  it('does nothing when the setting is off or this is a demo session', () => {
    expect(autoSignInBadge({ ...ready, enabled: false })).toBeNull()
    expect(autoSignInBadge({ ...ready, demoMode: true })).toBeNull()
  })

  it('does nothing when Remember Password is off', () => {
    expect(autoSignInBadge({ ...ready, rememberPassword: false })).toBeNull()
  })

  it('does nothing when the dead token is not one of the saved accounts', () => {
    expect(autoSignInBadge({ ...ready, expiredToken: 'b'.repeat(32) })).toBeNull()
    expect(autoSignInBadge({ ...ready, accounts: [] })).toBeNull()
  })

  it('ignores a placeholder badge', () => {
    expect(autoSignInBadge({
      ...ready,
      accounts: [{ badge: 'user123', token: account.token }],
    })).toBeNull()
  })
})

describe('autoSignInCredentials', () => {
  it('returns the saved campus username and password', () => {
    expect(autoSignInCredentials({ username: ' 1120210001 ', password: 'secret' })).toEqual({
      username: '1120210001',
      password: 'secret',
    })
  })

  it('does nothing without a usable saved password', () => {
    expect(autoSignInCredentials(null)).toBeNull()
    expect(autoSignInCredentials({ username: '  ', password: 'secret' })).toBeNull()
    expect(autoSignInCredentials({ username: '1120210001', password: '' })).toBeNull()
  })
})
