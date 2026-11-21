export const MIN_LEFT_PANEL = 200
export const MIN_RIGHT_PANEL = 250
export const MIN_MAIN_PANE = 500

export interface PanelFitInput {
  total: number
  /** The widths the user chose; a narrow window borrows from them, not overwrites them. */
  left: number
  right: number
  leftShown: boolean
  rightShown: boolean
}

/**
 * Fit the side panels to the window. The center pane keeps its minimum: the
 * right panel gives way first, then the left. A hidden panel takes no room and
 * keeps its width. `main` is what remains after both baseline widths, so a
 * hidden panel's width is added back when the center pane is rendered.
 */
export function fitPanels({ total, left, right, leftShown, rightShown }: PanelFitInput) {
  let fittedLeft = Math.max(MIN_LEFT_PANEL, left)
  let fittedRight = Math.max(MIN_RIGHT_PANEL, right)
  const minimum = (leftShown ? MIN_LEFT_PANEL : 0) + (rightShown ? MIN_RIGHT_PANEL : 0) + MIN_MAIN_PANE

  if (total < minimum) {
    const ratio = total / minimum
    if (leftShown) fittedLeft = Math.floor(MIN_LEFT_PANEL * ratio)
    if (rightShown) fittedRight = Math.floor(MIN_RIGHT_PANEL * ratio)
  } else {
    let excess = (leftShown ? fittedLeft : 0) + (rightShown ? fittedRight : 0) + MIN_MAIN_PANE - total
    if (excess > 0 && rightShown) {
      const taken = Math.min(excess, fittedRight - MIN_RIGHT_PANEL)
      fittedRight -= taken
      excess -= taken
    }
    if (excess > 0 && leftShown) fittedLeft -= Math.min(excess, fittedLeft - MIN_LEFT_PANEL)
  }
  return { left: fittedLeft, right: fittedRight, main: total - fittedLeft - fittedRight }
}
