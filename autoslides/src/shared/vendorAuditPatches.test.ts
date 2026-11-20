import { createRequire } from 'node:module'
import { describe, it, expect } from 'vitest'

const require = createRequire(import.meta.url)
const braces = require('../../vendor/braces') as {
  (pattern: string, opts?: { expand?: boolean }): string[]
  expand: (pattern: string) => string[]
}
// pptxgenjs asks for image-size ^1.2.1, which is still inside the GHSA
// range. The override installs 2.0.4, where a zero-length ICNS entry throws
// instead of looping.
const imageSize = require('image-size').imageSize as (
  input: Uint8Array | string,
) => { width: number; height: number; type?: string }

describe('image-size 2.0.4 (GHSA-w3rx-r6r6-pgpr / GHSA-5p2g-fcmc-qvqq)', () => {
  const PNG_1X1 = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
    'hex',
  )

  it('reports PNG dimensions', () => {
    const size = imageSize(new Uint8Array(PNG_1X1))
    expect(size).toEqual({ width: 1, height: 1, type: 'png' })
  })

  it('does not hang on ICNS with a zero-length entry', () => {
    const icns = Buffer.alloc(16)
    icns.write('icns', 0)
    icns.writeUInt32BE(16, 4)
    icns.write('ICON', 8)
    icns.writeUInt32BE(0, 12)
    expect(() => imageSize(new Uint8Array(icns))).toThrow(/Invalid ICNS/)
  })

  it('does not hang on a JXL container with a zero-size jxlp box', () => {
    const jxl = Buffer.alloc(32)
    jxl.write('JXL ', 4)
    expect(() => imageSize(new Uint8Array(jxl))).toThrow()
  })
})

describe('vendor braces (GHSA-vfj7-8cjw-p6xm)', () => {
  it('still expands and compiles ordinary patterns', () => {
    expect(braces.expand('a/{b,c}/{1..3}')).toEqual([
      'a/b/1', 'a/b/2', 'a/b/3', 'a/c/1', 'a/c/2', 'a/c/3',
    ])
    expect(braces('src/**/*.{ts,vue}')).toEqual(['src/**/*.(ts|vue)'])
    expect(braces.expand('{a,{b,{c,d}}}')).toEqual(['a', 'b', 'c', 'd'])
  })

  it('rejects deep nesting instead of overflowing the stack', () => {
    const depth = 4000
    const nestedBraces = '{'.repeat(depth) + 'a,b' + '}'.repeat(depth)
    const nestedParens = '('.repeat(depth) + 'a' + ')'.repeat(depth)
    expect(() => braces(nestedBraces)).toThrow(SyntaxError)
    expect(() => braces.expand(nestedBraces)).toThrow(/max depth/)
    expect(() => braces(nestedParens)).toThrow(/max depth/)
  })

  it('accepts nesting at the limit', () => {
    const depth = 250
    const pattern = '{'.repeat(depth) + 'a,b' + '}'.repeat(depth)
    expect(() => braces(pattern)).not.toThrow()
    expect(() => braces.expand(pattern)).not.toThrow()
  })
})
