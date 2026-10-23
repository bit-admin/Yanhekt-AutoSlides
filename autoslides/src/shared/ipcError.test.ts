import { describe, expect, it } from 'vitest'
import { userFacingIpcError } from './ipcError'

describe('userFacingIpcError', () => {
  it('strips the Electron IPC wrapper', () => {
    const wrapped = new Error(
      "Error invoking remote method 'api:getPersonalCourseList': Error: Remote server error or is temporarily down, please try again later",
    )
    expect(userFacingIpcError(wrapped)).toBe('Remote server error or is temporarily down, please try again later')
  })

  it('strips a typed error name too', () => {
    expect(userFacingIpcError(new Error("Error invoking remote method 'x:y': TypeError: bad input"))).toBe('bad input')
  })

  it('leaves plain messages alone', () => {
    expect(userFacingIpcError(new Error('Network down'))).toBe('Network down')
    expect(userFacingIpcError('just text')).toBe('just text')
  })
})
