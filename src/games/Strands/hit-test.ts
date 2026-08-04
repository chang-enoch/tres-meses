export interface GridRect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * How close to a cell's centre the pointer must be, in cell widths.
 *
 * Tapping is forgiving — anywhere on the letter counts. Dragging is strict, so
 * brushing past a letter en route to another one doesn't pick it up.
 */
export const TAP_RADIUS = 0.7
export const DRAG_RADIUS = 0.38

/**
 * Which cell the pointer is on, measured against cell centres.
 *
 * Deliberately not document.elementFromPoint. That hit-tests the whole cell
 * rectangle, so a diagonal drag clips the corner of an orthogonal neighbour on
 * the way — and since that neighbour is genuinely adjacent, the path accepts
 * it. A diagonal A→D drag silently becomes A→B→D: the wrong word, and letters
 * lit up that were never dragged over.
 *
 * Measuring from centres fixes it. Cutting a corner never comes within
 * DRAG_RADIUS of the neighbour's centre — closest approach is ~0.71 cells — so
 * a diagonal registers as the single step it looks like.
 *
 * Returning null is a real answer, not a failure: it means the pointer is in
 * the no-man's-land between centres and the path simply shouldn't grow yet.
 */
export function cellAtPoint(
  rect: GridRect,
  clientX: number,
  clientY: number,
  radius: number,
  cols: number,
  rows: number,
): number | null {
  const cellW = rect.width / cols
  const cellH = rect.height / rows
  const x = clientX - rect.left
  const y = clientY - rect.top

  const col = Math.floor(x / cellW)
  const row = Math.floor(y / cellH)
  if (col < 0 || col >= cols || row < 0 || row >= rows) return null

  const dx = (x - (col + 0.5) * cellW) / cellW
  const dy = (y - (row + 0.5) * cellH) / cellH
  if (Math.hypot(dx, dy) > radius) return null

  return row * cols + col
}
