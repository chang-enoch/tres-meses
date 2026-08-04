import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import Ribbon, { CELL, cellCentre } from './Ribbon'

const COLS = 6

const draw = (cells: number[]) => {
  const { container } = render(
    <svg>
      <Ribbon cells={cells} cols={COLS} variant="active" />
    </svg>,
  )
  return {
    dots: [...container.querySelectorAll('.ribbon__dot')],
    links: [...container.querySelectorAll('.ribbon__link')],
  }
}

describe('Ribbon', () => {
  it('draws one disc per letter and one connector per step', () => {
    const { dots, links } = draw([0, 1, 8])
    expect(dots).toHaveLength(3)
    expect(links).toHaveLength(2)
  })

  it('draws a lone disc with no connector for a single letter', () => {
    // The first letter of a drag must still show something.
    const { dots, links } = draw([14])
    expect(dots).toHaveLength(1)
    expect(links).toHaveLength(0)
  })

  it('renders nothing for an empty selection', () => {
    const { dots, links } = draw([])
    expect(dots).toHaveLength(0)
    expect(links).toHaveLength(0)
  })

  it('centres each disc on its cell', () => {
    const { dots } = draw([0, 7])
    expect(dots[0].getAttribute('cx')).toBe(String(cellCentre(0, COLS).x))
    expect(dots[0].getAttribute('cy')).toBe(String(cellCentre(0, COLS).y))
    expect(dots[1].getAttribute('cx')).toBe(String(cellCentre(7, COLS).x))
  })

  it('joins consecutive discs centre to centre', () => {
    const { links } = draw([0, 7])
    const from = cellCentre(0, COLS)
    const to = cellCentre(7, COLS)
    expect(links[0].getAttribute('x1')).toBe(String(from.x))
    expect(links[0].getAttribute('y1')).toBe(String(from.y))
    expect(links[0].getAttribute('x2')).toBe(String(to.x))
    expect(links[0].getAttribute('y2')).toBe(String(to.y))
  })

  describe('proportions', () => {
    // The regression: discs and connector were sized independently and drifted
    // apart, leaving found words as thin dots and the active drag as fat
    // blobs. These pin the relationship rather than the raw numbers.
    const { dots, links } = draw([0, 1])
    const radius = Number(dots[0].getAttribute('r'))
    const linkWidth = Number(links[0].getAttribute('stroke-width'))

    it('makes discs clearly thicker than the connector', () => {
      expect(radius * 2).toBeGreaterThan(linkWidth * 2)
    })

    it('keeps the connector thin enough to read as a line', () => {
      expect(linkWidth).toBeLessThan(CELL * 0.25)
    })

    it('leaves a gap between neighbouring discs for the connector to bridge', () => {
      // Adjacent centres are one cell apart. If discs were larger than half a
      // cell in radius they would overlap and the beads would merge into a bar.
      expect(radius * 2).toBeLessThan(CELL)
    })

    it('still makes discs big enough to sit behind a letter', () => {
      expect(radius * 2).toBeGreaterThan(CELL * 0.6)
    })
  })
})
