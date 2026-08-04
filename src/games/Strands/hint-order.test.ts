import { describe, expect, it } from 'vitest'
import { PLACEMENTS } from '../../content/strands-grid.gen'
import { pickHintWord } from './hint-order'

// Exercises the same function the game calls, so the rule can't drift.
const pickHint = (found: string[], hinted: string[]) =>
  pickHintWord(PLACEMENTS, found, hinted)

/** For cases where a hint is expected — keeps the assertions readable. */
const pickOrFail = (found: string[], hinted: string[]) => {
  const picked = pickHint(found, hinted)
  if (!picked) throw new Error('expected a hint to be available')
  return picked
}

const THEME_ONLY = PLACEMENTS.filter((p) => !p.spangram)
const SPANGRAM = PLACEMENTS.find((p) => p.spangram)!
const LONGEST_THEME = [...THEME_ONLY].sort(
  (a, b) => b.word.length - a.word.length,
)[0]

describe('hint order', () => {
  it('offers the shortest non-spangram word first', () => {
    const lengths = THEME_ONLY.map((p) => p.word.length)
    expect(pickOrFail([], []).word.length).toBe(Math.min(...lengths))
  })

  it('works up from shortest to longest across repeated hints', () => {
    const hinted: string[] = []
    for (let i = 0; i < PLACEMENTS.length; i++) {
      hinted.push(pickOrFail([], hinted).word)
    }

    // Everything bar the spangram, which is pinned to the end regardless.
    const themeLengths = hinted.slice(0, -1).map((w) => w.length)
    expect(themeLengths).toEqual([...themeLengths].sort((a, b) => a - b))
    expect(hinted).toHaveLength(PLACEMENTS.length)
  })

  it('skips words she has already found', () => {
    const shortest = pickOrFail([], []).word
    expect(pickOrFail([shortest], []).word).not.toBe(shortest)
  })

  it('skips words already revealed by an earlier hint', () => {
    const first = pickOrFail([], []).word
    expect(pickOrFail([], [first]).word).not.toBe(first)
  })

  it('runs out rather than repeating once everything is revealed', () => {
    expect(pickHint(PLACEMENTS.map((p) => p.word), [])).toBeUndefined()
  })

  it('is deterministic for words of equal length', () => {
    expect(pickOrFail([], []).word).toBe(pickOrFail([], []).word)
  })

  describe('the spangram', () => {
    it('comes last of all', () => {
      const hinted: string[] = []
      for (let i = 0; i < PLACEMENTS.length; i++) {
        hinted.push(pickOrFail([], hinted).word)
      }
      expect(hinted[hinted.length - 1]).toBe(SPANGRAM.word)
    })

    it('stays back even for a word much longer than itself', () => {
      // The rule has to outrank length, not merely coexist with it. Hold back
      // everything except the longest theme word and the spangram must still
      // lose, despite being the shorter of the two.
      const others = THEME_ONLY.filter((p) => p !== LONGEST_THEME).map((p) => p.word)
      expect(LONGEST_THEME.word.length).toBeGreaterThan(SPANGRAM.word.length)
      expect(pickOrFail([], others).word).toBe(LONGEST_THEME.word)
    })

    it('is offered once nothing else is left', () => {
      const everyThemeWord = THEME_ONLY.map((p) => p.word)
      expect(pickOrFail([], everyThemeWord).word).toBe(SPANGRAM.word)
    })

    it('is skipped if she already found it herself', () => {
      const everyThemeWord = THEME_ONLY.map((p) => p.word)
      expect(pickHint([SPANGRAM.word], everyThemeWord)).toBeUndefined()
    })
  })
})
