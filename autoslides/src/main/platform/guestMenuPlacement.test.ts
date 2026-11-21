import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ WebContentsView: class {}, app: { getAppPath: () => '' } }))

import { placeGuestMenu } from './guestViewManager'

const base = { margin: 12, windowHeight: 700 }

describe('placeGuestMenu', () => {
  it('opens below the field when it fits', () => {
    expect(placeGuestMenu({ ...base, top: 200, anchorTop: 170, height: 120 })).toEqual({ y: 188, height: 144 })
  })
  it('opens above when below is short and above has more room', () => {
    expect(placeGuestMenu({ ...base, top: 620, anchorTop: 590, height: 200 })).toEqual({ y: 378, height: 224 })
  })
  it('never runs past the window', () => {
    const placed = placeGuestMenu({ ...base, top: 300, anchorTop: 270, height: 1000 })
    expect(placed.y + placed.height - 12).toBeLessThanOrEqual(700)
    expect(placed.y).toBeGreaterThanOrEqual(0)
  })
})
