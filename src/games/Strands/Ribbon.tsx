/**
 * The highlight drawn over a selected or found word.
 *
 * One disc per letter, consecutive discs joined by a thin connector — so a
 * word reads as beads on a string rather than a solid bar behind the letters.
 *
 * Sizing is what makes it look right. A disc is 78% of a cell across and
 * neighbouring cell centres are a full cell apart, so two discs never touch:
 * there's always a gap for the connector to bridge. Drawing the discs at the
 * connector's width instead (the obvious "make it thinner" move) collapses the
 * whole thing into a plain line and loses the beads entirely.
 */

/** SVG units per cell. The viewBox scales to fit, so these are unitless. */
export const CELL = 10

/** Disc radius — 78% of a cell across, big enough to sit behind a letter. */
const DOT_R = 3.9

/** Connector thickness. Deliberately much thinner than a disc. */
const LINK_W = 1.6

export type RibbonVariant = 'theme' | 'spangram' | 'active'

export const cellCentre = (cell: number, cols: number) => ({
  x: (cell % cols) * CELL + CELL / 2,
  y: Math.floor(cell / cols) * CELL + CELL / 2,
})

interface RibbonProps {
  cells: number[]
  cols: number
  variant: RibbonVariant
}

export default function Ribbon({ cells, cols, variant }: RibbonProps) {
  if (cells.length === 0) return null

  return (
    <g className={`ribbon ribbon--${variant}`}>
      {/* Connectors first, so the discs paint over their ends. */}
      {cells.slice(1).map((cell, i) => {
        const from = cellCentre(cells[i], cols)
        const to = cellCentre(cell, cols)
        return (
          <line
            key={`${cells[i]}-${cell}`}
            className="ribbon__link"
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            strokeWidth={LINK_W}
          />
        )
      })}

      {cells.map((cell) => {
        const { x, y } = cellCentre(cell, cols)
        // Keyed by cell so React reuses discs that are already on screen:
        // only genuinely new letters mount and play the pop, and backtracking
        // doesn't restart the animation on letters already selected.
        return <circle key={cell} className="ribbon__dot" cx={x} cy={y} r={DOT_R} />
      })}
    </g>
  )
}
