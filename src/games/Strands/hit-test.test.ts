import { describe, expect, it } from 'vitest'
import { cellAtPoint, DRAG_RADIUS, TAP_RADIUS } from './hit-test'

const COLS = 6
const ROWS = 8
// 60x80 box, so each cell is exactly 10x10 and centres land on x5 coordinates.
const RECT = { left: 0, top: 0, width: 60, height: 80 }

const at = (x: number, y: number, radius = DRAG_RADIUS) =>
  cellAtPoint(RECT, x, y, radius, COLS, ROWS)

const cell = (col: number, row: number) => row * COLS + col
const centre = (col: number, row: number) => ({ x: col * 10 + 5, y: row * 10 + 5 })

describe('cellAtPoint', () => {
  it('finds the cell under a centred pointer', () => {
    expect(at(5, 5)).toBe(cell(0, 0))
    expect(at(55, 75)).toBe(cell(5, 7))
    expect(at(25, 35)).toBe(cell(2, 3))
  })

  it('returns null outside the grid', () => {
    expect(at(-5, 5)).toBeNull()
    expect(at(5, -5)).toBeNull()
    expect(at(65, 5)).toBeNull()
    expect(at(5, 85)).toBeNull()
  })

  it('ignores the dead zone between two centres', () => {
    // Exactly on the border of two cells is half a cell from either centre,
    // beyond DRAG_RADIUS — so neither registers.
    expect(at(10, 5)).toBeNull()
    expect(at(5, 10)).toBeNull()
  })

  it('ignores the corner where four cells meet', () => {
    expect(at(10, 10)).toBeNull()
  })

  it('accepts a sloppy tap anywhere on the letter', () => {
    // Same points that a drag ignores are fine for a deliberate tap.
    expect(at(9, 9, TAP_RADIUS)).toBe(cell(0, 0))
    expect(at(2, 8, TAP_RADIUS)).toBe(cell(0, 0))
  })
})

describe('diagonal drags', () => {
  /**
   * Cells a finger registers sliding between two points.
   *
   * `bow` is peak perpendicular deviation from the straight line, in pixels
   * against 10px cells. A real finger never travels a mathematically perfect
   * diagonal, and the bug only surfaces once it doesn't — so a bow of zero
   * tests nothing.
   */
  const trace = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    bow = 0,
  ) => {
    const visited: number[] = []
    const STEPS = 300 // far denser than real pointermove sampling
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS
      const arc = Math.sin(t * Math.PI) * bow // zero at both ends, peak mid-drag
      const hit = at(
        from.x + (to.x - from.x) * t + arc,
        from.y + (to.y - from.y) * t - arc,
      )
      if (hit !== null && hit !== visited[visited.length - 1]) visited.push(hit)
    }
    return visited
  }

  it('registers a perfect diagonal as one step', () => {
    expect(trace(centre(0, 0), centre(1, 1))).toEqual([cell(0, 0), cell(1, 1)])
  })

  it('registers a wobbly diagonal as one step, not two', () => {
    // The regression. Hit-testing whole cell rectangles, a bow of just 0.5px —
    // 5% of a cell — clipped the corner of (1,0) and, because that cell is
    // legitimately adjacent, the path swallowed it: [0, 1, 7] instead of
    // [0, 7]. Wrong word, and a letter lit up that was never dragged over.
    for (const bow of [0.5, 1, 1.5, 2]) {
      expect(trace(centre(0, 0), centre(1, 1), bow), `bow ${bow}`).toEqual([
        cell(0, 0),
        cell(1, 1),
      ])
    }
  })

  it('still registers a neighbour the finger genuinely crosses', () => {
    // Being strict shouldn't mean ignoring reality: a 3px bow really does take
    // the finger through the middle of (1,0), and that should count.
    expect(trace(centre(0, 0), centre(1, 1), 3)).toEqual([
      cell(0, 0),
      cell(1, 0),
      cell(1, 1),
    ])
  })

  it('registers the other diagonal cleanly too', () => {
    expect(trace(centre(3, 4), centre(2, 3))).toEqual([cell(3, 4), cell(2, 3)])
    expect(trace(centre(1, 5), centre(2, 4))).toEqual([cell(1, 5), cell(2, 4)])
  })

  it('still registers every cell along an orthogonal drag', () => {
    expect(trace(centre(0, 0), centre(3, 0))).toEqual([
      cell(0, 0),
      cell(1, 0),
      cell(2, 0),
      cell(3, 0),
    ])
  })

  it('registers a long diagonal without picking up neighbours', () => {
    expect(trace(centre(0, 0), centre(3, 3))).toEqual([
      cell(0, 0),
      cell(1, 1),
      cell(2, 2),
      cell(3, 3),
    ])
  })

  it('handles a knight-ish sloppy diagonal by skipping, never inventing', () => {
    // A wobbly finger may miss cells, which the path logic rejects as
    // non-adjacent. What must never happen is registering a cell she didn't
    // actually drag through.
    const visited = trace(centre(0, 0), centre(2, 1))
    for (const hit of visited) {
      expect([cell(0, 0), cell(1, 0), cell(1, 1), cell(2, 1)]).toContain(hit)
    }
  })
})
