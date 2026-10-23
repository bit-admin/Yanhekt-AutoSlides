import { describe, expect, it } from 'vitest'
import { cbizEnvelopeError, isCbizOk } from './cbizEnvelope'

describe('cbiz envelope', () => {
  it('treats numeric and string zero as success', () => {
    expect(isCbizOk({ code: 0, message: '' })).toBe(true)
    expect(isCbizOk({ code: '0', message: '' })).toBe(true)
    expect(isCbizOk({ code: 99151011, message: 'failed to invoke service' })).toBe(false)
  })

  it('words the gateway failure, numeric or string code', () => {
    const expected = 'Remote server error or is temporarily down, please try again later'
    expect(cbizEnvelopeError({ code: 99151011, message: 'failed to invoke service' }).message).toBe(expected)
    expect(cbizEnvelopeError({ code: '99151011', message: 'failed to invoke service' }).message).toBe(expected)
  })

  it('words the auth failure', () => {
    expect(cbizEnvelopeError({ code: 13001001, message: 'x' }).message).toBe(
      'Authentication failed, please check if token is valid',
    )
  })

  it('keeps Yanhekt message and code for anything else', () => {
    expect(cbizEnvelopeError({ code: 12131112, message: 'service runtime exception' }).message).toBe(
      'API error: service runtime exception (code: 12131112)',
    )
  })
})
