import { PACKED_WORDS } from '../data/wordle-dict'
import { WORDLE } from '../content/puzzles'

let cache: Set<string> | null = null

/**
 * The set of guesses Wordle will accept.
 *
 * Built lazily so unpacking ~12.6k words doesn't block first paint, and only
 * once per session. The answer and any custom words are unioned in here rather
 * than baked into the generated dictionary, so editing puzzles.ts never
 * requires re-running the build script.
 */
export function getValidGuesses(): Set<string> {
  if (cache) return cache

  const words = new Set<string>()
  for (let i = 0; i < PACKED_WORDS.length; i += 5) {
    words.add(PACKED_WORDS.slice(i, i + 5))
  }

  // Names and inside jokes won't be in any dictionary.
  words.add(WORDLE.answer.toUpperCase())
  for (const w of WORDLE.extraValidWords) {
    if (w.length === 5) words.add(w.toUpperCase())
  }

  cache = words
  return words
}

export function isValidGuess(guess: string): boolean {
  return getValidGuesses().has(guess.toUpperCase())
}
