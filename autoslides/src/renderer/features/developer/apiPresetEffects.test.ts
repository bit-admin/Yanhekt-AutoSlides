import { describe, expect, it } from 'vitest'
import { requestEffect } from '@common/requestEffect'
import { CBIZ, YANHEKT_API_PRESETS, presetUrl } from './yanhektApiPresets'
import { YANHE2, YANHE2_API_PRESETS } from './yanhe2ApiPresets'

// The presets' "writes" notes and the table the network layer acts on must agree,
// or the page would label a request one way while it is sent the other.
describe('API presets and the request effect table', () => {
  it.each([
    ...YANHEKT_API_PRESETS.map((p) => [p.id, p, CBIZ] as const),
    ...YANHE2_API_PRESETS.map((p) => [p.id, p, YANHE2] as const),
  ])('%s', (_id, preset, origin) => {
    expect(requestEffect(preset.method, presetUrl(preset, origin))).toBe(preset.write ? 'write' : 'read')
  })
})
