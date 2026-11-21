import { describe, expect, it } from 'vitest'
import { fitPanels, MIN_MAIN_PANE } from './panelLayout'

const shown = { leftShown: true, rightShown: true }
const centre = (fit: ReturnType<typeof fitPanels>, input: { leftShown: boolean; rightShown: boolean }) =>
  fit.main + (input.leftShown ? 0 : fit.left) + (input.rightShown ? 0 : fit.right)

describe('fitPanels', () => {
  it('leaves chosen widths alone when they fit', () => {
    expect(fitPanels({ total: 1440, left: 255, right: 340, ...shown })).toEqual({ left: 255, right: 340, main: 845 })
  })

  it('takes a narrower window from the right panel first, keeping the center pane', () => {
    const fit = fitPanels({ total: 1100, left: 450, right: 480, ...shown })
    expect(fit).toEqual({ left: 350, right: 250, main: MIN_MAIN_PANE })
  })

  it('returns to the chosen widths when the window grows again', () => {
    fitPanels({ total: 1000, left: 450, right: 480, ...shown })
    expect(fitPanels({ total: 1500, left: 450, right: 480, ...shown })).toEqual({ left: 450, right: 480, main: 570 })
  })

  it('does not let a hidden panel take room or lose its width', () => {
    const input = { leftShown: true, rightShown: false }
    const fit = fitPanels({ total: 900, left: 300, right: 600, ...input })
    expect(fit.right).toBe(600)
    expect(fit.left).toBe(300)
    expect(centre(fit, input)).toBe(600)
  })

  it('scales the minimums when the window is below them', () => {
    const fit = fitPanels({ total: 760, left: 400, right: 400, ...shown })
    expect(fit.left + fit.right + fit.main).toBe(760)
    expect(fit.left).toBe(160)
    expect(fit.right).toBe(200)
  })
})
