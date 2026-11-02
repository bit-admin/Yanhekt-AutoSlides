import { describe, expect, it } from 'vitest'
import { formatSessionLookupProblem, parseSessionLookupProblem } from './sessionLookupProblem'

describe('session lookup problem marker', () => {
  it('round-trips every kind, raw or IPC-wrapped', () => {
    for (const kind of ['not_found', 'no_recording', 'expired', 'auth_required'] as const) {
      const text = formatSessionLookupProblem(kind, 'Session 1: detail')
      expect(parseSessionLookupProblem(new Error(text))).toBe(kind)
      expect(parseSessionLookupProblem(`Error invoking remote method 'api:x': Error: ${text}`)).toBe(kind)
    }
  })

  it('is null without the marker or with an unknown kind', () => {
    expect(parseSessionLookupProblem(new Error('network down'))).toBeNull()
    expect(parseSessionLookupProblem('AUTOSLIDES_SESSION_LOOKUP:other: x')).toBeNull()
    expect(parseSessionLookupProblem(undefined)).toBeNull()
  })
})
