import { describe, expect, it } from 'vitest'
import {
  formatOutputDirProblem,
  parseOutputDirProblem,
  userFacingIpcError,
} from './outputDirAccess'

describe('outputDirAccess', () => {
  const dir = '/Users/someone/Downloads/AutoSlides'

  it('round-trips every kind', () => {
    for (const kind of ['denied', 'missing', 'unreachable'] as const) {
      expect(parseOutputDirProblem(new Error(formatOutputDirProblem(kind, dir)))).toEqual({ kind, dir })
    }
  })

  it('finds the marker inside the IPC wrapper', () => {
    const wrapped = new Error(
      `Error invoking remote method 'pdfmaker:getFolders': Error: ${formatOutputDirProblem('denied', dir)}`,
    )
    expect(parseOutputDirProblem(wrapped)).toEqual({ kind: 'denied', dir })
  })

  it('keeps colons inside the folder path', () => {
    const winDir = 'C:\\Users\\someone\\AutoSlides'
    expect(parseOutputDirProblem(formatOutputDirProblem('missing', winDir))).toEqual({ kind: 'missing', dir: winDir })
  })

  it('ignores unrelated errors and unknown kinds', () => {
    expect(parseOutputDirProblem(new Error(`EPERM: operation not permitted, scandir '${dir}'`))).toBeNull()
    expect(parseOutputDirProblem('AUTOSLIDES_OUTPUT_DIR:bogus:/x')).toBeNull()
    expect(parseOutputDirProblem(undefined)).toBeNull()
    expect(parseOutputDirProblem({ message: 'x' })).toBeNull()
  })

  it('strips the IPC wrapper for display', () => {
    expect(
      userFacingIpcError(new Error("Error invoking remote method 'lectures:listVideos': Error: ENOENT: no such file")),
    ).toBe('ENOENT: no such file')
    expect(userFacingIpcError(new Error('Network down'))).toBe('Network down')
    expect(userFacingIpcError('plain')).toBe('plain')
  })
})
