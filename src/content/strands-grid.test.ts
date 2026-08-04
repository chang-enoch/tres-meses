import { describe, expect, it } from 'vitest'
import {
  GRID_HEIGHT,
  GRID_LETTERS,
  GRID_WIDTH,
  PLACEMENTS,
  BONUS_WORDS,
} from './strands-grid.gen'
import { STRANDS } from './puzzles'

/**
 * Validates whatever scripts/build-strands.mjs last produced.
 *
 * The packer is randomised, so these run against the committed board rather
 * than a fixture — if a regenerated board is broken, this is what catches it
 * before it reaches her phone.
 */
describe('generated Strands board', () => {
  const cellCount = GRID_WIDTH * GRID_HEIGHT

  it('has letters for every cell', () => {
    expect(GRID_LETTERS).toHaveLength(cellCount)
    expect(GRID_LETTERS).toMatch(/^[A-Z]+$/)
  })

  it('uses every cell exactly once', () => {
    const used = new Map<number, string>()
    for (const { word, cells } of PLACEMENTS) {
      for (const cell of cells) {
        expect(used.has(cell), `cell ${cell} claimed twice`).toBe(false)
        used.set(cell, word)
      }
    }
    expect(used.size).toBe(cellCount)
  })

  it('spells each word along its path', () => {
    for (const { word, cells } of PLACEMENTS) {
      const spelled = cells.map((c) => GRID_LETTERS[c]).join('')
      expect(spelled).toBe(word)
    }
  })

  it('only steps between adjacent cells', () => {
    for (const { word, cells } of PLACEMENTS) {
      for (let i = 1; i < cells.length; i++) {
        const [prevRow, prevCol] = [
          Math.floor(cells[i - 1] / GRID_WIDTH),
          cells[i - 1] % GRID_WIDTH,
        ]
        const [row, col] = [Math.floor(cells[i] / GRID_WIDTH), cells[i] % GRID_WIDTH]
        const dr = Math.abs(row - prevRow)
        const dc = Math.abs(col - prevCol)
        expect(
          dr <= 1 && dc <= 1 && dr + dc > 0,
          `${word} jumps from ${cells[i - 1]} to ${cells[i]}`,
        ).toBe(true)
      }
    }
  })

  it('never revisits a cell within one word', () => {
    for (const { word, cells } of PLACEMENTS) {
      expect(new Set(cells).size, `${word} reuses a cell`).toBe(cells.length)
    }
  })

  it('never lets two words cross', () => {
    // A crossing is always the same shape: one word takes a diagonal of some
    // 2x2 block, another takes that block's other diagonal, and they meet in
    // an X. Since a block has only two diagonals, at most one diagonal step
    // per block means nothing on the board can cross.
    const claimedBy = new Map<number, string>()

    for (const { word, cells } of PLACEMENTS) {
      for (let i = 1; i < cells.length; i++) {
        const prevRow = Math.floor(cells[i - 1] / GRID_WIDTH)
        const prevCol = cells[i - 1] % GRID_WIDTH
        const row = Math.floor(cells[i] / GRID_WIDTH)
        const col = cells[i] % GRID_WIDTH

        // Straight steps can't cross anything.
        if (row === prevRow || col === prevCol) continue

        const block =
          Math.min(row, prevRow) * (GRID_WIDTH - 1) + Math.min(col, prevCol)
        const owner = claimedBy.get(block)
        expect(
          owner,
          `${word} crosses ${owner} at the 2x2 block starting cell ` +
            `${Math.min(row, prevRow) * GRID_WIDTH + Math.min(col, prevCol)}`,
        ).toBeUndefined()
        claimedBy.set(block, word)
      }
    }
  })

  it('has exactly one spangram, touching two opposite edges', () => {
    const spangrams = PLACEMENTS.filter((p) => p.spangram)
    expect(spangrams).toHaveLength(1)

    const cols = spangrams[0].cells.map((c) => c % GRID_WIDTH)
    const rows = spangrams[0].cells.map((c) => Math.floor(c / GRID_WIDTH))
    const spansWidth = Math.min(...cols) === 0 && Math.max(...cols) === GRID_WIDTH - 1
    const spansHeight = Math.min(...rows) === 0 && Math.max(...rows) === GRID_HEIGHT - 1

    expect(spansWidth || spansHeight).toBe(true)
  })

  it('matches the authored content', () => {
    const clean = (w: string) => w.toUpperCase().replace(/[^A-Z]/g, '')
    const placed = PLACEMENTS.map((p) => p.word).sort()
    const authored = [STRANDS.spangram, ...STRANDS.themeWords].map(clean).sort()
    expect(placed).toEqual(authored)

    const spangram = PLACEMENTS.find((p) => p.spangram)
    expect(spangram?.word).toBe(clean(STRANDS.spangram))
  })

  it('excludes theme words from the bonus list', () => {
    const theme = new Set(PLACEMENTS.map((p) => p.word))
    for (const bonus of BONUS_WORDS) {
      expect(theme.has(bonus), `${bonus} is both theme and bonus`).toBe(false)
    }
  })
})
