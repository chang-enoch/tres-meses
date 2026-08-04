export type LetterState = 'correct' | 'present' | 'absent'

/**
 * Scores a guess against the answer, NYT-style.
 *
 * Two passes, and it has to be two passes. Marking greens and yellows in a
 * single left-to-right sweep over-reports duplicates: guess AGREE against
 * answer EAGER would light up both E's as present even though only one E is
 * unaccounted for. So pass one claims the exact matches and tallies only the
 * answer letters they didn't consume; pass two hands out yellows strictly
 * against that remaining budget.
 */
export function evaluateGuess(guess: string, answer: string): LetterState[] {
  const g = guess.toUpperCase()
  const a = answer.toUpperCase()
  const result: LetterState[] = Array<LetterState>(g.length).fill('absent')

  // Answer letters still up for grabs after exact matches are claimed.
  const unclaimed = new Map<string, number>()

  for (let i = 0; i < g.length; i++) {
    if (g[i] === a[i]) {
      result[i] = 'correct'
    } else {
      const letter = a[i]
      unclaimed.set(letter, (unclaimed.get(letter) ?? 0) + 1)
    }
  }

  for (let i = 0; i < g.length; i++) {
    if (result[i] === 'correct') continue
    const left = unclaimed.get(g[i]) ?? 0
    if (left > 0) {
      result[i] = 'present'
      unclaimed.set(g[i], left - 1)
    }
  }

  return result
}

const RANK: Record<LetterState, number> = { absent: 0, present: 1, correct: 2 }

/**
 * Folds a guess into the on-screen keyboard's colours.
 *
 * Only ever upgrades. Once a key has gone green it must stay green, even if a
 * later guess puts that letter in the wrong slot — downgrading it would be
 * actively misleading.
 */
export function mergeKeyStates(
  current: Record<string, LetterState>,
  guess: string,
  states: LetterState[],
): Record<string, LetterState> {
  const next = { ...current }
  const g = guess.toUpperCase()

  for (let i = 0; i < g.length; i++) {
    const letter = g[i]
    const incoming = states[i]
    const existing = next[letter]
    if (existing === undefined || RANK[incoming] > RANK[existing]) {
      next[letter] = incoming
    }
  }

  return next
}

/** Emoji grid for sharing, same shape as NYT's. */
export function shareGrid(rows: LetterState[][]): string {
  const glyph: Record<LetterState, string> = {
    correct: '🟩',
    present: '🟨',
    absent: '⬛',
  }
  return rows.map((row) => row.map((s) => glyph[s]).join('')).join('\n')
}
