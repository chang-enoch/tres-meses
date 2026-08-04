import { describe, expect, it } from 'vitest'
import { evaluateGuess, mergeKeyStates } from './wordle-eval'

/** Compact notation: c=correct, p=present, a=absent. */
const score = (guess: string, answer: string) =>
  evaluateGuess(guess, answer)
    .map((s) => s[0])
    .join('')

describe('evaluateGuess', () => {
  it('marks an exact match all correct', () => {
    expect(score('HEART', 'HEART')).toBe('ccccc')
  })

  it('marks a total miss all absent', () => {
    expect(score('BLIMP', 'HEART')).toBe('aaaaa')
  })

  it('mixes correct and present', () => {
    //  guess  T R A I N
    //  answer H E A R T   → A lines up; T and R are elsewhere; I and N absent.
    expect(score('TRAIN', 'HEART')).toBe('ppcaa')
  })

  describe('duplicate letters', () => {
    it('marks only the first copy when the answer has just one', () => {
      //  guess  S E E D Y
      //  answer A B I D E   → D lines up. One E is unaccounted for, so the
      //  first E goes yellow and the second must go grey.
      expect(score('SEEDY', 'ABIDE')).toBe('apaca')
    })

    it('greys earlier copies when an exact match claims the only one', () => {
      //  guess  E E R I E
      //  answer A B I D E   → the final E is exact and consumes the answer's
      //  only E, so both leading E's must go grey.
      expect(score('EERIE', 'ABIDE')).toBe('aaapc')
    })

    it('greys every copy when the answer has none', () => {
      //  guess  G E E S E
      //  answer S A L T Y   → no E anywhere; only S is present.
      expect(score('GEESE', 'SALTY')).toBe('aaapa')
    })

    it('handles duplicates in the answer but not the guess', () => {
      //  guess  B L A M E
      //  answer L L A M A
      expect(score('BLAME', 'LLAMA')).toBe('accca')
    })

    it('never reports more copies than the answer holds', () => {
      const states = evaluateGuess('EERIE', 'ABIDE')
      const eMarked = [0, 1, 4].filter((i) => states[i] !== 'absent').length
      expect(eMarked).toBe(1) // ABIDE contains exactly one E
    })
  })
})

describe('mergeKeyStates', () => {
  it('records states from a guess', () => {
    const keys = mergeKeyStates({}, 'TRAIN', evaluateGuess('TRAIN', 'HEART'))
    expect(keys.A).toBe('correct')
    expect(keys.T).toBe('present')
    expect(keys.I).toBe('absent')
  })

  it('takes the best state when a letter repeats within one guess', () => {
    //  guess  T O A S T
    //  answer H E A R T   → the leading T scores absent, the trailing T scores
    //  correct. The keyboard key must show green.
    const keys = mergeKeyStates({}, 'TOAST', evaluateGuess('TOAST', 'HEART'))
    expect(keys.T).toBe('correct')
  })

  it('upgrades a key from present to correct', () => {
    const first = mergeKeyStates({}, 'TRAIN', evaluateGuess('TRAIN', 'HEART'))
    expect(first.T).toBe('present')
    const second = mergeKeyStates(first, 'HEART', evaluateGuess('HEART', 'HEART'))
    expect(second.T).toBe('correct')
  })

  it('never downgrades a key that has gone correct', () => {
    const first = mergeKeyStates({}, 'TRAIN', evaluateGuess('TRAIN', 'HEART'))
    expect(first.A).toBe('correct')
    //  guess  A D O P T vs HEART scores A as merely present.
    const second = mergeKeyStates(first, 'ADOPT', evaluateGuess('ADOPT', 'HEART'))
    expect(second.A).toBe('correct')
  })

  it('never downgrades present to absent', () => {
    const first = mergeKeyStates({}, 'SEEDY', evaluateGuess('SEEDY', 'ABIDE'))
    expect(first.E).toBe('present')
    //  GEESE vs ABIDE: the trailing E is exact, so E can only improve.
    const second = mergeKeyStates(first, 'CRESS', evaluateGuess('CRESS', 'ABIDE'))
    expect(second.E).not.toBe('absent')
  })
})
